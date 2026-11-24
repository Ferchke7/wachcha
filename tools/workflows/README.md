# Wachcha Dynamic Agent Workflows

These Python scripts orchestrate specialized Wachcha subagents (`.agents/agents/*.md`) using Antigravity's `run_workflow` tool.

- `scaffold_provider.py`: End-to-end research → Rust provider + frontend i18n fan-out → security audit & verification gate for adding a new media/catalog provider.
- `audit_release.py`: Parallel 4-angle release readiness audit across Rust media security, provider compliance, frontend bundle/i18n/UX, and automated tests/probes.
