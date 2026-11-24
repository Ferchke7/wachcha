//! Platform keep-awake control to prevent display sleep during active video playback.

#[cfg(target_os = "windows")]
pub fn set_keep_awake(active: bool) -> Result<(), String> {
    use windows_sys::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };
    let flags = if active {
        ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    // SAFETY: Win32 thread execution state API takes a bitmask and returns prior state.
    let res = unsafe { SetThreadExecutionState(flags) };
    if res == 0 {
        return Err("Failed to update Windows execution state.".into());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set_keep_awake(_active: bool) -> Result<(), String> {
    Ok(())
}
