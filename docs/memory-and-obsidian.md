# Memory And Obsidian

BUAP's preferred durable memory layer is a user-owned Obsidian vault. Plain repo docs are still useful, but Obsidian gives the user a local-first, portable, readable home for personalization and long-running context.

## Why Obsidian

Obsidian is recommended because:

- memory stays local-first and user-owned
- Markdown is readable by humans and agents
- notes can be versioned or synced separately from runtime code
- Claude, Codex, ChatGPT, and local tools can load the same context
- pet hatching improves when "what you know about me" is richer and safer

BUAP can still run without Obsidian, but the complete experience is better with a vault.

## Cody / Prismtek Memory Home

```text
/Users/prismtek/Prismtek/knowledge-vault
```

Primary BUAP directory:

```text
/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP
```

Key files:

- `WHAT_YOU_KNOW_ABOUT_ME.md` - durable Cody / Prismtek memory.
- `BUAP_HATCH_CONTEXT.md` - concise context to load before `$hatch-pet create a pet based on what you know about me`.
- `BUAP_PROFILE_PAIRING.md` - Buddy=`bmo`, Lil Buddy=`finn`.
- `BUAP_TOOLING_CONTEXT.md` - local Apple Notes, PixelLab, LibreSprite, and hatch-pet tooling context.

## Repo Pointers

The BUAP repo stores pointers under `personalization/` so the repo can teach agents where the real local-first memory lives without duplicating private memory:

- `personalization/WHAT_YOU_KNOW_ABOUT_ME_POINTER.md`
- `personalization/BUAP_HATCH_CONTEXT.md`

## Hatch-Pet Rule

Before running:

```text
$hatch-pet create a pet based on what you know about me
```

agents should load:

```text
/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/BUAP_HATCH_CONTEXT.md
```

When useful, also load:

```text
/Users/prismtek/Prismtek/knowledge-vault/99-System/BUAP/WHAT_YOU_KNOW_ABOUT_ME.md
```

Do not regenerate pets just to refresh memory. Hatching should still follow the official hatch-pet skill and final verification contract.
