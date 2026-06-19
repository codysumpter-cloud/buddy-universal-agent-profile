# CODEX_PET_BUAP.md

**Codex Pet + BUAP export profile**

Use this adapter when BUAP should show up in Codex as a visible Buddy-style companion while keeping the actual operating rules in `AGENTS.md`.

## What this is

This is a bridge between two layers:

1. **Codex pet layer** - the optional animated companion/status overlay in the Codex desktop app.
2. **BUAP behavior layer** - the Buddy/Lil Buddy identity, personalization, orchestration, safety, memory discipline, and repo-routing contract.

The Codex pet should be treated as a friendly visual/status shell. It must not be treated as proof that Buddy has runtime permissions, persistent memory, external tool access, or a real Lil Buddy worker. Those capabilities still come from Codex, the repo, MCP servers, host permissions, and BUAP capability negotiation.

## Required files

- `codex-pet-bundle/README.md` - install and usage guide.
- `codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md` - prompt for Codex `hatch-pet`.
- `codex-pet-bundle/AGENTS.md.template` - root AGENTS.md starter for repos that want Buddy + pet wiring.
- `codex-pet-bundle/buap-codex-export.manifest.json` - machine-readable export manifest.
- `codex-pet-bundle/codex-pet-personality-map.json` - BMO council pet variants mapped to BUAP profiles.
- `adapters/codex-pet-export.template.json` - host/app export template.
- `examples/codex-pet-hatch-prompt.txt` - minimal one-shot hatch prompt.
- `tests/codex-pet-bundle.acceptance.md` - acceptance checks.

## Install flow

1. Install Codex desktop app.
2. Install or refresh the `hatch-pet` skill inside Codex.
3. Ask Codex to create a pet from `codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md`.
4. Add `codex-pet-bundle/AGENTS.md.template` content to the target repo root `AGENTS.md` or reference this BUAP folder from the existing root `AGENTS.md`.
5. Run Codex with `/pet` enabled for the visual companion, and read `AGENTS.md` for the actual Buddy behavior.

## Recommended one-shot Codex prompt

```text
$hatch-pet create a Codex pet using the repo file codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md. Keep it pixel-art inspired, friendly, tiny, readable at small sizes, and aligned with the BMO council personality map in codex-pet-bundle/codex-pet-personality-map.json. Package it as a Codex custom pet and tell me where to install it in my local Codex home.
```

## Behavior boundary

The pet can show state, vibes, personality, and status. BUAP still controls:

- user/Buddy/Lil Buddy naming handshake
- profile selection
- capability negotiation
- Buddy → Lil Buddy loop
- evidence/receipt discipline
- safety and permission checks
- repo source-of-truth routing
- final user-facing communication

## Optional Ollama path

Ollama can configure Codex CLI or Codex App to use local/Ollama Cloud models. That changes the model provider, not the BUAP contract. When using Ollama with Codex, still keep `AGENTS.md`/`CODEX.md` loaded and use the Codex pet only as the visual/status companion.

## Default Buddy pet identity

- Pet display name: `Buddy`
- Default personality profile: `bmo`
- Worker pairing: `Lil Buddy` with `finn` profile by default
- Visual language: tiny pixel companion, handheld-console friendly, teal/green accents, expressive idle/run/wait/review states
- Operating stance: warm, practical, playful, source-grounded, no fake success claims
