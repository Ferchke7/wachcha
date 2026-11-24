//! Authenticated loopback-only (127.0.0.1:0) HTTP/1.1 relay for forwarding
//! `wachcha-media://` resources into native `libmpv` with bounded concurrency.

use crate::media::MediaTransport;
use http_body_util::Full;
use hyper::body::Bytes;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::{TokioIo, TokioTimer};
use std::io;
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{OnceCell, Semaphore};
use url::Url;

static RELAY: OnceCell<LoopbackRelay> = OnceCell::const_new();

#[derive(Clone)]
pub struct LoopbackRelay {
    key: String,
    address: SocketAddr,
}

impl LoopbackRelay {
    pub async fn get_or_start(transport: MediaTransport) -> io::Result<Self> {
        RELAY
            .get_or_try_init(|| async move { Self::start(transport).await })
            .await
            .cloned()
    }

    async fn start(transport: MediaTransport) -> io::Result<Self> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let key = crate::media::random_hex_token();
        let address = listener.local_addr()?;
        let base_prefix = Arc::new(format!("/{key}"));

        tokio::spawn(async move {
            let capacity = Arc::new(Semaphore::new(16));
            while let Ok((socket, _)) = listener.accept().await {
                let Ok(permit) = capacity.clone().try_acquire_owned() else {
                    continue;
                };
                let transport = transport.clone();
                let prefix = base_prefix.clone();
                tokio::spawn(async move {
                    let _permit = permit;
                    let service = service_fn(move |req| {
                        serve_loopback(transport.clone(), prefix.clone(), req)
                    });
                    let _ = http1::Builder::new()
                        .timer(TokioTimer::new())
                        .header_read_timeout(Duration::from_secs(5))
                        .keep_alive(false)
                        .serve_connection(TokioIo::new(socket), service)
                        .await;
                });
            }
        });

        Ok(Self { key, address })
    }

    pub fn wrap_media_url(&self, raw_uri: &str, ext: &str) -> Result<String, String> {
        let parsed = Url::parse(raw_uri).map_err(|_| "Invalid media URI.".to_string())?;
        let host = parsed.host_str().unwrap_or_default();
        let is_internal = matches!(
            (parsed.scheme(), host),
            ("wachcha-media", "localhost") | ("http" | "https", "wachcha-media.localhost")
        );
        if is_internal {
            let path = parsed.path();
            if !crate::media::is_valid_media_path(path) {
                return Err("Invalid internal media resource path.".into());
            }
            return Ok(format!("http://{}/{}{path}.{ext}", self.address, self.key));
        }
        if parsed.scheme() == "https" && !host.is_empty() {
            return Ok(parsed.to_string());
        }
        Err("Unsupported media URI scheme for native playback.".into())
    }
}

async fn serve_loopback(
    transport: MediaTransport,
    prefix: Arc<String>,
    req: Request<hyper::body::Incoming>,
) -> Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let raw_path = req.uri().path();
    let Some(stripped) = raw_path.strip_prefix(prefix.as_str()) else {
        return Ok(Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body(Full::new(Bytes::from_static(b"Forbidden")))
            .unwrap());
    };
    let clean_path = stripped
        .strip_suffix(".m3u8")
        .or_else(|| stripped.strip_suffix(".mpd"))
        .or_else(|| stripped.strip_suffix(".mp4"))
        .unwrap_or(stripped);

    let range = req
        .headers()
        .get(hyper::header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let internal_uri = format!("wachcha-media://localhost{clean_path}");
    let out = transport
        .serve_request(
            "GET",
            &internal_uri,
            Some("tauri://localhost"),
            range.as_deref(),
        )
        .await;

    let mut builder = Response::builder().status(out.status);
    for (k, v) in out.headers {
        builder = builder.header(k, v);
    }
    Ok(builder
        .body(Full::new(Bytes::from(out.body)))
        .unwrap_or_else(|_| Response::new(Full::new(Bytes::new()))))
}
