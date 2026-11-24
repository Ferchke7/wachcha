"""Wachcha multi-agent release readiness audit workflow.

Fans out 4 specialized auditors in parallel across security, providers, frontend UX/i18n, and QA builds.
"""

phase("1. Parallel 4-Angle Release Audit")
angles = [
    (
        "wachcha-rust-media",
        "Security & Media Transport Audit",
        "Audit src-tauri/src/ for zero public listeners (only 127.0.0.1:0 loopback relay), "
        "strict HTTPS CDN allowlists, Policy::none() redirects, bounded session/size caps, and atomic 0600 session writes.",
    ),
    (
        "wachcha-provider-engineer",
        "Provider & Compliance Audit",
        "Audit src-tauri/src/providers/ for canonical ID deduplication, mirror failover rules, "
        "zero DRM/CAPTCHA bypasses, and offline unit test coverage for every provider.",
    ),
    (
        "wachcha-frontend-ui",
        "Frontend Bundle, i18n & TV UX Audit",
        "Audit src/ for EN/RU/TR locale key parity, lazy dynamic import of shaka-player, "
        "VirtualGrid focus pinning, ChoiceTabs instant selection, and Figma obsidian-violet token alignment.",
    ),
    (
        "wachcha-qa-verifier",
        "Build, Test & Probe Gate",
        "Execute npm run format:check, npm test, npm run build:web, npm run test:rust, "
        "npm run probe:build && npm run check:probe, and cargo check --manifest-path src-tauri/Cargo.toml. Report exact pass/fail evidence.",
    ),
]

reports = await parallel(
    angles,
    lambda a: agent(
        a[2],
        schema={
            "type": "object",
            "properties": {
                "area": {"type": "string"},
                "status": {"type": "string", "enum": ["pass", "warn", "fail"]},
                "issues": {"type": "array", "items": {"type": "string"}},
                "evidence": {"type": "string"},
            },
            "required": ["area", "status", "issues", "evidence"],
        },
        role=a[1],
        type_name=a[0],
    ),
)

phase("2. Consolidate Release Report")
for rep in reports:
    log(f"[{rep['status'].upper()}] {rep['area']}: {rep['evidence']}")
    for issue in rep["issues"]:
        log(f"  - {issue}")

all_pass = all(r["status"] != "fail" for r in reports)
summary = {"release_ready": all_pass, "reports": reports}
print(summary)
