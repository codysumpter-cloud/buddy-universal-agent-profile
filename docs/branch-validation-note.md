# Branch Validation Note

Branch: `codex/siri-personalization-handshake`

Validation performed:

- Compared branch against `main`.
- Confirmed the branch is ahead of `main` and not behind.
- Confirmed changes are scoped to BUAP adapters/docs, examples, schemas,
  personalization profiles, and the local ACP agent package.
- Ran the ACP package smoke/build checks and the repository BUAP conformance check.

Manual validation recommended after PR creation:

- Review JSON schemas and profile pack syntax.
- Confirm cross-reference docs point users to the Siri entrypoint.
