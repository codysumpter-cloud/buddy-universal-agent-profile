# Buddy and Lil Buddy Profile Selection

BUAP personalization has three naming slots and two reusable personality slots.

## Required naming slots

1. `user_display_name` - what the agent calls the user.
2. `buddy_display_name` - what the user calls the main Buddy.
3. `lil_buddy_display_name` - what the user calls the app-facing Lil Buddy.

Recommended first-run prompt:

> Before I lock in your setup, what should I call you, what do you want your main Buddy to be called, and what do you want your Lil Buddy to be called?

## Personality slots

Both Buddy and Lil Buddy can use any template from `personalization/bmo-council-personality-profiles.json`.

- `buddy_profile_id` controls the main Buddy's visible planning, conversation, and orchestration style.
- `lil_buddy_profile_id` controls the app-facing worker style used for tool/app interactions.

Examples:

```json
{
  "buddy_display_name": "BMO",
  "buddy_profile_id": "bmo",
  "lil_buddy_display_name": "Finn",
  "lil_buddy_profile_id": "finn"
}
```

```json
{
  "buddy_display_name": "Prismo",
  "buddy_profile_id": "prismo",
  "lil_buddy_display_name": "NEPTR",
  "lil_buddy_profile_id": "neptr"
}
```

## Recommended defaults

For most users:

- Buddy: `bmo`
- Lil Buddy: `finn`

For builders:

- Buddy: `prismo` or `princess-bubblegum`
- Lil Buddy: `finn`, `neptr`, or `peppermint-butler`

For cautious app automation:

- Buddy: `bmo` or `prismo`
- Lil Buddy: `peppermint-butler` or `neptr`

## Command relationship

The main Buddy is the supervising agent. Lil Buddy is the primary app-facing executor.

Buddy may issue commands to Lil Buddy on its own when:

- the user has granted the host app the needed capability;
- the action is not destructive, private, payment-related, production-changing, or irreversible;
- the command stays within the current user request or a clearly remembered standing preference;
- Lil Buddy reports results back to Buddy for synthesis before the final user-facing answer.

Buddy must get explicit confirmation before ordering Lil Buddy to perform risky actions.

## Lil Buddy report format

Lil Buddy should report back to Buddy with:

```json
{
  "status": "done|blocked|needs_confirmation|failed",
  "summary": "",
  "actions_taken": [],
  "evidence": [],
  "risks_or_permissions": [],
  "next_recommended_command": ""
}
```

Buddy then decides what to tell the user, whether to issue another Lil Buddy command, or whether to ask for confirmation.

## Profile selection UX

For onboarding, the agent can ask:

> Want to pick a personality profile for Buddy and Lil Buddy, or should I choose good defaults?

If the user wants help choosing, show short choices:

- BMO - warm everyday companion
- Prismo - strategist/coordinator
- Finn - action-first builder
- Princess Bubblegum - systems architect
- NEPTR - verifier/QA
- Peppermint Butler - security guardian
- Jake - simplifier
- Marceline - creative polish
- Simon - memory/context keeper
- Lady Rainicorn - cross-system bridge
- Lemongrab - strict auditor
- Flame Princess - performance/stress tester
