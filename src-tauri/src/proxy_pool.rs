//! Optional user-configured HTTP/HTTPS/SOCKS5 proxy pool for catalog & stream transport.

use reqwest::{Client, Proxy};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;

pub const USER_AGENT: &str = "Wachcha/0.1 (+https://github.com/wachcha/wachcha)";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfig {
    pub enabled: bool,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyReport {
    pub enabled: bool,
    pub scheme: Option<String>,
    pub host: Option<String>,
}

/// Validates a proxy URL strictly without ever returning embedded credentials.
pub fn validate_proxy_url(raw: &str) -> Result<(Url, ProxyReport), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Proxy URL cannot be empty.".into());
    }
    let parsed = Url::parse(trimmed).map_err(|_| "Invalid proxy URL format.".to_string())?;
    let scheme = parsed.scheme();
    if !matches!(scheme, "http" | "https" | "socks5" | "socks5h") {
        return Err("Proxy scheme must be http, https, socks5, or socks5h.".into());
    }
    let host = parsed
        .host_str()
        .filter(|h| !h.is_empty())
        .ok_or_else(|| "Proxy URL is missing a host.".to_string())?
        .to_string();
    let report = ProxyReport {
        enabled: true,
        scheme: Some(scheme.to_string()),
        host: Some(host),
    };
    Ok((parsed, report))
}

/// Builds a hardened `reqwest::Client` with optional proxy and configurable redirect policy.
pub fn build_http_client(
    config: &ProxyConfig,
    allow_redirects: bool,
    timeout: Duration,
) -> Result<Client, String> {
    let mut builder = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(timeout)
        .gzip(true)
        .pool_max_idle_per_host(8);

    if !allow_redirects {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    }

    if config.enabled {
        if let Some(raw) = config.url.as_deref() {
            let (parsed, _) = validate_proxy_url(raw)?;
            let proxy = Proxy::all(parsed.as_str())
                .map_err(|e| format!("Could not initialize proxy transport: {e}"))?;
            builder = builder.proxy(proxy);
        }
    }

    builder
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_supported_proxy_schemes_and_redacts_credentials() {
        let (_, report) = validate_proxy_url("socks5h://user:secret@proxy.example.org:1080")
            .expect("valid socks5h proxy");
        assert!(report.enabled);
        assert_eq!(report.scheme.as_deref(), Some("socks5h"));
        assert_eq!(report.host.as_deref(), Some("proxy.example.org"));
    }

    #[test]
    fn rejects_unsupported_schemes() {
        assert!(validate_proxy_url("file:///etc/passwd").is_err());
        assert!(validate_proxy_url("ftp://proxy.example.org:21").is_err());
        assert!(validate_proxy_url("   ").is_err());
    }
}
