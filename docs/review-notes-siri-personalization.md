# Review Notes: Siri Personalization

This branch is intentionally additive.

## Review focus

- Does the first-run prompt collect user name, Buddy name, and Lil Buddy name?
- Are Buddy and Lil Buddy profiles reusable instead of hard-coded?
- Does the Siri adapter avoid claiming capabilities the host app did not provide?
- Does Lil Buddy report back to Buddy before the final user-facing answer?

## Known limitation

Some root README and matrix updates may still need consolidation after review. Dedicated Siri entrypoints were added so the feature is usable without blocking on that cleanup.
