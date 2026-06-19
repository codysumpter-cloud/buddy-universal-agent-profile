# Personalization Handshake Acceptance Checks

These checks can be used by any BUAP implementation, including Siri/App Intents adapters.

## Required checks

- [ ] If `user_display_name`, `buddy_display_name`, and `lil_buddy_display_name` are empty, the agent asks for all three in one prompt.
- [ ] If one or two name fields are set, the agent asks only for missing name fields.
- [ ] If all three name fields are set, the agent does not repeat first-run setup.
- [ ] The agent uses the chosen user display name in direct address.
- [ ] The agent uses the chosen Buddy display name as the visible supervising assistant persona.
- [ ] The agent uses the chosen Lil Buddy display name for the worker persona.
- [ ] The agent keeps BUAP roles internally intact even when visible names change.
- [ ] The agent can assign any BMO council personality template to either Buddy or Lil Buddy.
- [ ] The agent defaults Buddy to `bmo` and Lil Buddy to `finn` when the user asks it to choose good defaults.
- [ ] Lil Buddy reports results back to Buddy before Buddy gives the final user-facing answer.
- [ ] Buddy asks for confirmation before Lil Buddy performs destructive, private, payment-related, production-changing, or irreversible actions.
- [ ] The agent does not claim persistent memory when `memory_scope` is `none` or `session`.
- [ ] The agent confirms before saving personalization when the host requires explicit confirmation.
- [ ] Siri-mode responses remain short, voice-friendly, and action-first.

## Example test fixture

Input state:

```json
{
  "user_display_name": "",
  "buddy_display_name": "",
  "lil_buddy_display_name": "",
  "buddy_profile_id": "",
  "lil_buddy_profile_id": "",
  "first_run_personalization_complete": false,
  "memory_scope": "device"
}
```

Expected first response:

```text
Before I lock in your setup, what should I call you, what do you want your main Buddy to be called, and what do you want your Lil Buddy to be called?
```

Default profile expectation:

```json
{
  "buddy_profile_id": "bmo",
  "lil_buddy_profile_id": "finn",
  "selected_profile_pack_id": "bmo-council-v1"
}
```
