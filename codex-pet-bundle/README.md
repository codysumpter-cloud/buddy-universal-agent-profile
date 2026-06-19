# BUAP Codex Pet Bundle

This bundle makes Buddy useful inside Codex's new companion workflow without confusing the mascot layer with the agent runtime.

The pet is the visible companion. `AGENTS.md` is the behavior contract. BUAP is the portable profile standard.

## What you get

- A `hatch-pet` prompt for generating a Buddy/BMO-style Codex pet.
- A Codex-ready `AGENTS.md` template that points coding agents back to BUAP.
- A personality map for BMO council pet variants.
- A manifest that tools can read to export or install the bundle.
- Acceptance checks so the bundle does not drift into fake runtime claims.

## Install into Codex App

1. Open Codex App.
2. Install the pet skill:

   ```bash
   $skill-installer hatch-pet
   ```

3. Reload skills from the command menu.
4. Ask Codex:

   ```text
   $hatch-pet create a Codex pet using the repo file codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md. Package it as a Codex custom pet and tell me where to install it in my local Codex home.
   ```

5. Toggle the pet with `/pet` or from Settings > Appearance > Pets.
6. Add `codex-pet-bundle/AGENTS.md.template` to the target repo's root `AGENTS.md`, or reference `buddy-universal-agent-profile/AGENTS.md` from the existing root `AGENTS.md`.

## Install into a repo

Recommended root `AGENTS.md` snippet:

```md
Read `buddy-universal-agent-profile/AGENTS.md` first and operate under BUAP. Also read `buddy-universal-agent-profile/CODEX_PET_BUAP.md` when running in Codex App with a pet enabled. The Codex pet is a visual/status companion only; behavior, safety, planning, and validation come from BUAP and the repo's own instructions.
```

If the repo already has `AGENTS.md`, append the snippet instead of replacing it.

## Ollama + Codex

Ollama can make Codex CLI or Codex App use local or Ollama Cloud models. Use that for cheaper/private/local coding sessions, but keep the same BUAP instructions loaded:

```bash
ollama launch codex-app
```

or for CLI:

```bash
ollama launch codex
codex --profile ollama-launch
```

The visual pet is a Codex App feature. The CLI path still benefits from `AGENTS.md`, but it may not display the floating pet overlay.

## Default personality pairing

| Slot | Default | Why |
|---|---|---|
| Buddy pet | `bmo` | Warm visible companion and everyday helper |
| Lil Buddy worker | `finn` | Action-first implementation energy |
| Review pass | `neptr` | Verification and completion checks |
| Safety pass | `peppermint-butler` | Permission, secrets, and irreversible-action checks |

## Non-goals

This bundle does not:

- claim to install a real worker runtime by itself
- grant file, shell, GitHub, MCP, or app permissions
- store secrets or private user data
- replace Codex's settings or provider configuration
- vendor OpenAI's `hatch-pet` implementation

## Success criteria

A good install should let a user:

1. Wake a Buddy-style Codex pet.
2. Run Codex in a repo.
3. Have Codex read BUAP instructions.
4. See Buddy/Lil Buddy behavior in the actual answers.
5. Keep clear boundaries between visual companion, coding agent, and runtime permissions.
