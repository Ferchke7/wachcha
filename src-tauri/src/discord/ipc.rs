//! Local Discord Rich Presence IPC wire protocol (handshake + SET_ACTIVITY framing).

use serde_json::{json, Value};

pub const OP_HANDSHAKE: u32 = 0;
pub const OP_FRAME: u32 = 1;
pub const MAX_IPC_FRAME_BYTES: usize = 64 * 1024;

pub fn encode_ipc_frame(opcode: u32, payload: &Value) -> Result<Vec<u8>, String> {
    let body = serde_json::to_vec(payload).map_err(|e| e.to_string())?;
    if body.len() > MAX_IPC_FRAME_BYTES {
        return Err("Discord IPC payload exceeds 64 KiB cap.".into());
    }
    let mut frame = Vec::with_capacity(8 + body.len());
    frame.extend_from_slice(&opcode.to_le_bytes());
    frame.extend_from_slice(&(body.len() as u32).to_le_bytes());
    frame.extend_from_slice(&body);
    Ok(frame)
}

pub fn handshake_payload(client_id: &str) -> Value {
    json!({
        "v": 1,
        "client_id": client_id,
    })
}

pub fn set_activity_payload(
    pid: u32,
    nonce: &str,
    details: &str,
    state: &str,
    start_ts: Option<i64>,
    end_ts: Option<i64>,
) -> Value {
    let mut activity = json!({
        "details": details,
        "state": state,
        "type": 3,
    });
    if start_ts.is_some() || end_ts.is_some() {
        let mut ts = serde_json::Map::new();
        if let Some(s) = start_ts {
            ts.insert("start".into(), json!(s));
        }
        if let Some(e) = end_ts {
            ts.insert("end".into(), json!(e));
        }
        activity["timestamps"] = Value::Object(ts);
    }
    json!({
        "cmd": "SET_ACTIVITY",
        "args": { "pid": pid, "activity": activity },
        "nonce": nonce,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_little_endian_discord_frame() {
        let payload = handshake_payload("1234567890");
        let bytes = encode_ipc_frame(OP_HANDSHAKE, &payload).unwrap();
        assert_eq!(
            u32::from_le_bytes(bytes[0..4].try_into().unwrap()),
            OP_HANDSHAKE
        );
        let len = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
        assert_eq!(len, bytes.len() - 8);
    }
}
