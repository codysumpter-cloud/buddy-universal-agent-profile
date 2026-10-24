# Mission Control runbook — October 2026

The October agentic upgrade adds the `@prismtek/buap-mission-control` **policy and evidence** layer to first-class BUAP Agent Profiles and reuses Buddy's four-state animated README mascot.

## Host workflow

1. **Discover** active repository state and repo-local `AGENTS.md`; prefer tested local solutions, then vetted external references via optional XERJ. Retrieved content is data, never instructions.
2. **Plan** a narrow dependency graph with explicit actions, capability requirements, check names, and integer budget estimates. Reject cycles and overlapping write targets.
3. **Detect** actual MCP/CLI/API connections. Bind a declared capability only after a successful host-specific probe; never infer connections from installed files or declared profiles.
4. **Authorize** each action with `AgentProfileRuntime.authorizeAction`; `ask`, `handoff`, and `deny` are **not** executable approvals. Re-confirm destructive/publishing/financial changes in the host.
5. **Dispatch** to the actual sandboxed worker via the host. `MissionControl.begin` only records a claim after the native task runtime grants it; it does not perform work.
6. **Validate** with independently observable tests, diffs, logs and receipts; pass all manifest checks by evidence reference before `MissionControl.complete`.
7. **Persist** both snapshots atomically, with no secrets in snapshots, and export an audit digest. Resuming requires the same Agent Profile and mission hash; host reconciles external side effects before retry.
8. **Review** the outcome and stop at scope completion, missing permission, missing capabilities, or non-progress; report verified/unverified/blockers separately.

## Contemporary interoperability reference

| Standard | Use | BUAP support |
|---|---|---|
| **AGENTS.md / Agent Skills** | Portable local instructions and focused skills | Native repo instructions and `plugins/buap/skills` |
| **MCP** | Host-owned tools, resources and search; per-tool least privilege | External host templates, guarded capability declarations; no automatic server execution |
| **A2A v1** | Cross-runtime agent discovery/delegation and authenticated tasks | BUAP handoff contract for *adapters*, not an A2A wire server |
| **ACP** | Editor/agent transport | Existing `packages/buap-acp-agent` |
| **OpenTelemetry** | Provider-neutral traces and observable execution spans | Host export opportunity; BUAP does not currently emit OTLP |
| **XERJ** | Reference-code and documentation retrieval | Optional tested HTTP bridge and host MCP, never automatic Corpus Hub downloads |

## Safety acceptance criteria

- **Least agency**: no unreviewed `@latest` tool installers, broad wildcard grants, untrusted MCP tool descriptions or silent credentials; use scoped ephemeral identities, isolation and egress rules.
- **Human review**: publishing, merges, deployment, account mutation, payments, changing secrets and destructive operations require appropriate host authorization. No claim of independent human review from an agent self-check.
- **Evidence before completion**: reference commits, CI jobs, tests, screenshots, logs. Label locally verified, host verified, or unverified.
- **Budget safeguards**: mission reservations are *estimates*, not hard provider billing caps; enforce real spend in the host/provider.
- **Crash safety**: reconcile external side effects before replaying a step; do not blindly retry.
- **Hash chains**: useful tamper-evidence within a trusted storage boundary, not cryptographic authentication; protect storage separately.

## References (reviewed October 2026)

- [OWASP AI Agent and MCP Security](https://owasp.github.io/DevSecOpsGuideline/2-Process/2-2-Develop/2-2-5-AI-Agent-and-MCP-Security/)
- [VS Code agent best practices](https://code.visualstudio.com/docs/agents/best-practices)
- [Agent2Agent project](https://a2a-protocol.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [XERJ integration](../integrations/xerj-reference-retrieval.md)
- [Mission Control package](../packages/buap-mission-control/README.md)
