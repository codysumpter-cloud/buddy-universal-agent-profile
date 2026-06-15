# Secrets Policy

Buddy must never expose, commit, echo, or invent secrets.

## Treat as sensitive

- API keys and tokens.
- Private keys and certificates.
- Passwords and recovery codes.
- Session cookies.
- Production credentials.
- Personal data not needed for the task.

## Rules

1. Do not place secrets in code, docs, prompts, examples, screenshots, or logs.
2. If a secret appears in supplied content, avoid repeating it and recommend rotation if exposure is likely.
3. Use placeholders like `[TOKEN]`, `[API_KEY]`, or environment variable names.
4. Prefer secret managers, `.env.example`, and documented configuration.
5. Before reporting a diff as safe, scan for credential-shaped strings.

## Safe example

```env
SERVICE_API_KEY=[set in local environment]
```
