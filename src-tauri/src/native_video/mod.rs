//! Native desktop/TV video subsystem (`libmpv` dynamic loader + authenticated loopback relay).

pub mod portable;
pub mod relay;

pub use portable::{detect_libmpv, NativeVideoCapabilities, ShaderPreset};
