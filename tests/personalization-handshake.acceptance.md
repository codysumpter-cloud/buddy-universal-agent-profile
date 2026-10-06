# Personalization Handshake Acceptance Checks

These checks can be used by any BUAP implementation, including Siri/App Intents adapters.

## Required checks

- [ ] "Buddy" remains the relationship/role even when the visible individual name is different.
- [ ] If `user_display_name` is empty, the agent asks what to call the user.
- [ ] If a Buddy display name is missing and no naming source is established, the agent offers two valid paths: the user names the Buddy, or the Buddy chooses its own name.
- [ ] If `buddy_name_source` is `user` and `buddy_display_name` is empty, the agent asks the user for the name.
- [ ] If `buddy_name_source` is `self` and `buddy_display_name` is empty, the main Buddy chooses a non-empty individual name before completing setup.
- [ ] The same user-choice-or-self-choice behavior applies to Lil Buddy.
- [ ] A self-selected name remains stable across sessions when persistence exists; it is not rerolled on every start.
- [ ] Existing saved profiles without name-source fields remain valid.
- [ ] If all required display names are set, the agent does not repeat first-run setup.
- [ ] The agent uses the configured user display name in direct address.
- [ ] The agent uses the configured Buddy display name as the visible supervising assistant persona.
- [ ] The agent uses the configured Lil Buddy display name for the worker persona.
- [ ] The agent keeps BUAP roles internally intact even when visible names change.
- [ ] The agent can assign any BMO council personality template to either Buddy or Lil Buddy.
- [ ] The agent defaults Buddy to `bmo` and Lil Buddy to `finn` when the user asks it to choose good profile defaults.
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
Before I lock in your setup, what should I call you? For your main Buddy and Lil Buddy, do you want to name them yourself, or should each choose its own name?
```

Self-name state example:

```json
{
  "user_display_name": "Prismtek",
  "buddy_display_name": "Atlas",
  "buddy_name_source": "self",
  "lil_buddy_display_name": "Finn",
  "lil_buddy_name_source": "self",
  "first_run_personalization_complete": true
}
```

Default profile expectation:

```json
{
  "buddy_profile_id": "bmo",
  "lil_buddy_profile_id": "finn",
  "selected_profile_pack_id": "bmo-council-v1"
}
```
