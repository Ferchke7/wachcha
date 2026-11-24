---
name: wachcha-verify
description: >-
  Full Wachcha verification gate: checks Prettier & rustfmt, TypeScript + Vite bundle, Vitest
  unit & UI tests, Rust cargo test + security invariants, stdio media_probe build & smoke test,
  and AI kit integrity. Invoke via /wachcha-verify.
---

# Wachcha Verification Gate

Run every check below and report actual command exit codes and key metrics:

1. **Formatting**:
   `npm run format:check`
2. **Frontend Type-Check & Build**:
   `npm run build:web`
   Confirm `dist/sw.js` exists and initial JS gzip bundle stays lean (Shaka Player split into its own lazy chunk).
3. **Frontend Unit & UI Tests**:
   `npm test`
4. **Rust Offline Unit & Security Tests**:
   `npm run test:rust` (`cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib`)
5. **Rust Tauri Compilation & Stdio Probe**:
   `cargo check --manifest-path src-tauri/Cargo.toml`
   `npm run probe:build && npm run check:probe`
   Confirm `media_probe` responds over stdin/stdout with valid JSON and zero TCP ports.
6. **Workflow Scripts & AI Kit**:
   `python -c "import ast, glob; [compile(open(p).read(), p, 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT) for p in glob.glob('tools/workflows/*.py')]"`
   Confirm all `.agents/skills/*/SKILL.md` have valid YAML frontmatter and `AGENTS.md` is under 24 KB.
