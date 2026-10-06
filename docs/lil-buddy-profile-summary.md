# Lil Buddy Profile Summary

BUAP setup includes three display-name fields:

- what the assistant calls the user
- the main Buddy's individual name
- the Lil Buddy's individual name

"Buddy" and "Lil Buddy" remain relationship/role labels. Each individual name may be
chosen by the user or self-selected by the agent, recorded with optional
`buddy_name_source` / `lil_buddy_name_source` values of `user` or `self`.

It also includes two profile selections:

- main Buddy profile
- Lil Buddy profile

Defaults:

- main Buddy profile: `bmo`
- Lil Buddy profile: `finn`
- profile pack: `bmo-council-v1`

The main Buddy supervises the conversation and final response. Lil Buddy completes routine worker tasks through the host surface and returns a report to Buddy.
