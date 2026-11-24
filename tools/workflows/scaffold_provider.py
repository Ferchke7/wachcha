"""Wachcha multi-agent workflow: scaffold and verify a new catalog or stream provider.

Run via Antigravity `run_workflow` with:
  Args = {"provider_slug": "kinopoisk", "vertical": "movie", "api_docs_url": "https://..."}
"""

slug = args.get("provider_slug", "custom_provider")
vertical = args.get("vertical", "movie")
docs_url = args.get("api_docs_url", "")

phase("1. Research & Contract Specification")
spec = await agent(
    f"Research the public/documented API for provider '{slug}' (vertical: {vertical}, docs: {docs_url}). "
    "Read .agents/skills/wachcha-providers/SKILL.md and references/provider-contract.md. "
    "Verify open-source compliance (no DRM/CAPTCHA bypass). Return exact endpoints, CDN host allowlist, "
    "canonical ExternalIds mapping, and sample JSON schema.",
    schema={
        "type": "object",
        "properties": {
            "compliant": {"type": "boolean"},
            "base_url": {"type": "string"},
            "cdn_allowlist": {"type": "array", "items": {"type": "string"}},
            "endpoints": {"type": "object"},
            "summary": {"type": "string"},
        },
        "required": ["compliant", "base_url", "cdn_allowlist", "summary"],
    },
    role=f"Research {slug}",
    type_name="wachcha-provider-engineer",
)
log(f"Spec ready for {slug}: compliant={spec['compliant']}, allowlist={spec['cdn_allowlist']}")

if not spec["compliant"]:
    raise RuntimeError(f"Provider '{slug}' failed open-source compliance check: {spec['summary']}")

phase("2. Parallel Implementation (Rust Backend + Frontend i18n/UI)")
impl_results = await parallel(
    [
        (
            "wachcha-provider-engineer",
            f"Implement src-tauri/src/providers/{slug}.rs following this spec: {spec}. "
            "Register it in providers/mod.rs and backend.rs, add CDN allowlists in media.rs/images.rs, "
            "and write deterministic offline unit tests with JSON fixtures.",
            f"Implement Rust provider {slug}",
        ),
        (
            "wachcha-frontend-ui",
            f"Add localized EN/RU/TR provider labels and descriptions for '{slug}' in src/locales/ "
            "and ensure Sources.tsx renders configuration/status cleanly for it.",
            f"Wire UI & i18n for {slug}",
        ),
    ],
    lambda item: agent(
        item[1],
        schema={"type": "string"},
        role=item[2],
        type_name=item[0],
    ),
)
for res in impl_results:
    log(res)

phase("3. Security Audit & Full Verification Gate")
verdict = await agent(
    f"Audit the newly added provider '{slug}' against AGENTS.md security invariants "
    "(no redirects, strict HTTPS allowlists, no secrets in logs, offline fixture coverage) "
    "and run npm run format:check, npm test, npm run build:web, and cargo test --manifest-path src-tauri/Cargo.toml.",
    schema={
        "type": "object",
        "properties": {
            "passed": {"type": "boolean"},
            "findings": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["passed", "findings"],
    },
    role=f"Verify {slug}",
    type_name="wachcha-qa-verifier",
)
log(f"Verification verdict: {verdict}")
print(verdict)
