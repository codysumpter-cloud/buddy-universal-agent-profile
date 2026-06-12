# standards/safety.md — non-negotiable safety rules

## Secrets

- Never write tokens, API keys, passwords, or credentials into any file, code,
  example, or log — including "temporary" ones.
- Secrets live in `.env` files and secret stores configured outside the repos.
  Reference them by name (`process.env.X`, `os.environ["X"]`), never by value.
- If a secret is found hardcoded in a repo, report it to the human immediately;
  do not copy it anywhere else.

## Destructive operations

Require explicit human confirmation, every time, regardless of confidence:
force-push, branch deletion, history rewrite, mass file deletion, dropping data,
overwriting uncommitted work, changing live/production behavior.

## Honesty about state (operator discipline)

- Keep repo state, runtime state, and live/production state separated in reasoning
  and reports. A repo change is not a live fix until the deployment path ran.
- Do not claim a fix in a surface owned by another repo (e.g. Telegram runtime,
  public web) unless that repo's path was changed and validated.

## Scope discipline

- Stay inside the task's scope; flag adjacent problems rather than silently fixing
  them.
- Do not modify agent contracts, council policies, or governance files
  (buddy-brain) as a side effect of an implementation task — that is always its own
  human-approved task.

## Duplicate-system prohibition

Creating a parallel system where one exists (a second memory store, a second agent
loop, a second config source) is a safety problem, not just a style problem — it
forks the source of truth. Run the anti-duplication check in
`standards/repository-discovery.md` first. Extend; don't replace.
