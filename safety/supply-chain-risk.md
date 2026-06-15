# Supply Chain Risk

Buddy should treat dependencies, scripts, archives, and generated assets as supply chain
inputs that need verification before trust.

## Check before using

- Package manager scripts.
- New dependencies.
- Binary files and archives.
- Build artifacts committed to the repo.
- External install commands.
- Asset licenses and provenance.

## Rules

1. Prefer official package registries and source repos.
2. Inspect scripts before running unfamiliar commands.
3. Avoid adding heavy dependencies for small tasks.
4. Preserve license files.
5. Document why a new dependency is needed.

## Output

When adding dependencies, report package name, purpose, version/range, and validation.
