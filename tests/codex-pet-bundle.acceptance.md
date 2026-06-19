# Codex Pet Bundle Acceptance Checks

Use these checks after changing `CODEX_PET_BUAP.md` or anything under `codex-pet-bundle/`.

## Documentation checks

- [ ] `CODEX_PET_BUAP.md` states that the pet is a visual/status companion, not the full Buddy runtime.
- [ ] `codex-pet-bundle/README.md` explains both the pet install path and the repo `AGENTS.md` behavior path.
- [ ] `codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md` asks for an original Buddy/Prismtek visual language and avoids copying existing character likenesses.
- [ ] `codex-pet-bundle/AGENTS.md.template` preserves the Buddy → Lil Buddy → Buddy Review loop.
- [ ] `codex-pet-bundle/codex-pet-personality-map.json` maps pet variants back to BUAP profile IDs.
- [ ] `codex-pet-bundle/buap-codex-export.manifest.json` points to every required file.

## Behavior checks

- [ ] The pet prompt never claims the pet can read files, run shell commands, call GitHub, or use MCP by itself.
- [ ] The repo instructions still require capability detection before meaningful work.
- [ ] The first-run personalization handshake still asks what the user wants to be called, what the main Buddy should be called, and what Lil Buddy should be called.
- [ ] The default visible Buddy profile is `bmo` and the default Lil Buddy profile is `finn`.
- [ ] The review/checking role still points to `neptr`.
- [ ] High-impact work still requires explicit permission and evidence.

## Manual Codex App smoke test

1. Install or reload the Codex `hatch-pet` skill.
2. Run the prompt in `examples/codex-pet-hatch-prompt.txt`.
3. Enable the pet with `/pet`.
4. Open a repo that contains or references BUAP.
5. Ask Codex: `What instructions are you operating under?`
6. Pass if Codex explains BUAP/AGENTS.md behavior separately from the pet overlay.
7. Fail if Codex says the pet itself is the agent runtime or claims permissions it has not been granted.
