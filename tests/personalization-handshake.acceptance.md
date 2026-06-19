# Personalization Handshake Acceptance Checks

These checks can be used by any BUAP implementation, including Siri/App Intents adapters.

## Required checks

- [ ] If `user_display_name` and `buddy_display_name` are both empty, the agent asks for both in one prompt.
- [ ] If `user_display_name` is set and `buddy_display_name` is empty, the agent asks only what the Buddy should be called.
- [ ] If `buddy_display_name` is set and `user_display_name` is empty, the agent asks only what to call the user.
- [ ] If both fields are set, the agent does not repeat first-run setup.
- [ ] The agent uses the chosen user display name in direct address.
- [ ] The agent uses the chosen Buddy display name as the visible assistant persona.
- [ ] The agent keeps BUAP roles internally intact even when the visible Buddy name changes.
- [ ] The agent does not claim persistent memory when `memory_scope` is `none` or `session`.
- [ ] The agent confirms before saving personalization when the host requires explicit confirmation.
- [ ] Siri-mode responses remain short, voice-friendly, and action-first.

## Example test fixture

Input state:

```json
{
  "user_display_name": "",
  "buddy_display_name": "",
  "first_run_personalization_complete": false,
  "memory_scope": "device"
}
```

Expected first response:

```text
Before I lock in your Buddy setup, what should I call you, and what do you want your Buddy to be called?
```
