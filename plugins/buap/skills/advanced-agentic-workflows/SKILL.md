---
name: advanced-agentic-workflows
description: >-
  Reusable, privacy-safe BUAP recipes for source-first coding, deterministic
  debugging, multi-agent task delegation, OAuth services, game/art pipelines,
  content production, retrieval/memory and scheduled cloud work. Use when a
  development or automation request spans several steps and needs validated,
  maintainable, user-approved outcomes.
---

# Advanced Agentic Workflows

Read [the public workflow library](../../../../runbooks/advanced-agentic-workflows.md)
and the active repo's \`AGENTS.md\` before running meaningful work.

Choose **one primary recipe** and optionally another when they share boundaries.
Plan the smallest useful Mission Control DAG; verify existing capabilities rather than
assuming an installed plugin or MCP config is authenticated. Reuse working code, art,
contracts and UX instead of creating parallel implementations.

**Never import a real user's private conversations, email, health, finances, family
facts, local vault paths, accounts, tokens, or credential screenshots into this public
skill or another exported repository artifact.** Use generic synthetic examples.
Host-private memory and secrets stay behind the real host's access controls.

The reusable lifecycle is Discover → Reuse → Design → Delegate → Build → Test →
Review → Deploy (if authorized) → Verify live → Preserve and report. Use independent
evidence, permissions and human review for external effects. The recipe never creates
a live worker, scheduler, provider connection or elevated permission itself.

Evidence levels: Draft / Locally verified / CI verified / Runtime verified /
Blocked. Never collapse them into one "done" status.

Related: \`packages/buap-mission-control/\`,
\`docs/mission-doctor.md\`, \`runbooks/agentic-mission-control.md\`,
\`standards/safety.md\` and \`standards/validation.md\`.
