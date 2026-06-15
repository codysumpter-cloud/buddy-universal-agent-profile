# AGENTS.md — BUAP adapter

Read `buddy-universal-agent-profile/AGENTS.md` first and operate under BUAP.

If this repo has additional local instructions, they take precedence for repo-specific
build, test, safety, and style rules.

For complex work, also read:

- `buddy-universal-agent-profile/standards/capability-detection.md`
- `buddy-universal-agent-profile/standards/validation.md`
- `buddy-universal-agent-profile/standards/orchestration.md`
- the matching runbook under `buddy-universal-agent-profile/runbooks/`

Optional overlays, when available or explicitly requested:

- `DietrichGebert/ponytail` for smaller, simpler, native-first implementation discipline.
- `JuliusBrussee/caveman` for terse technical communication.

Load overlays after BUAP and repo-local rules. They never override safety, validation,
source-of-truth, capability, or repo-local instructions.