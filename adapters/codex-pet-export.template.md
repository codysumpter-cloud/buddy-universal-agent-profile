# Codex Pet Export Template

Use this template for tools that want to export BUAP as a Codex App pet bundle.

## Required fields

```json
{
  "bundle_id": "buap-codex-pet-buddy",
  "name": "BUAP Codex Pet Buddy Bundle",
  "version": "0.1.0",
  "status": "adapter_contract",
  "owner": "codysumpter-cloud/buddy-universal-agent-profile",
  "entrypoints": {
    "adapter": "CODEX_PET_BUAP.md",
    "readme": "codex-pet-bundle/README.md",
    "hatch_prompt": "codex-pet-bundle/BUDDY_CODEX_PET_PROMPT.md",
    "agents_template": "codex-pet-bundle/AGENTS.md.template",
    "personality_map": "codex-pet-bundle/codex-pet-personality-map.json"
  },
  "default_configuration": {
    "visible_pet_name": "Buddy",
    "main_buddy_profile_id": "bmo",
    "lil_buddy_profile_id": "finn",
    "pet_is_runtime": false,
    "requires_agents_md_for_behavior": true
  }
}
```

## Rules

- The pet is a visual/status companion only.
- Behavior comes from BUAP and repo instructions.
- Generated local pet assets should stay local unless the user explicitly chooses to publish them.
- Do not include secrets, private paths, or private repo context in generated pet assets.
- Do not copy existing character likenesses; use original Prismtek/Buddy visual language.
