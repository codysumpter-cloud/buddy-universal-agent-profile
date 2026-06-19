# Knowledge Vault Search

BUAP can use a local checkout of `codysumpter-cloud/knowledge-vault` as a
read-only searchable note source for Buddy and Lil Buddy.

## What the Knowledge Vault is

KnowledgeVault is Prismtek's durable agent memory database and Obsidian operating
book. It stores project context, decisions, runbooks, dashboards, handoffs,
context bundles, and Vegapunk Brain / Punk Records shared-memory docs.

By default, local BUAP tooling expects the vault at:

```text
~/Prismtek/knowledge-vault
```

Override that path with:

```bash
export KNOWLEDGE_VAULT_PATH=/absolute/path/to/knowledge-vault
```

## Indexer package

The indexer lives in:

```text
packages/buap-knowledge-vault/
```

It recursively reads Markdown notes, skips generated index files, and records:

- note path relative to the vault
- title from frontmatter, first Markdown heading, or filename
- a 200-character excerpt from note content

Search is case-insensitive and checks titles plus excerpts.

## Build an index file

From the BUAP repo:

```bash
cd ~/Prismtek/buddy-universal-agent-profile/packages/buap-knowledge-vault
npm install
npm run build

cd ../..
node scripts/build-vault-index.mjs
```

This writes these generated files into the vault:

```text
~/Prismtek/knowledge-vault/KNOWLEDGE_VAULT_INDEX.json
~/Prismtek/knowledge-vault/KNOWLEDGE_VAULT_INDEX.md
```

The ACP slash command builds an in-memory index on demand; the generated files are
for human inspection and external tooling.

## ACP slash command

In an ACP client using `packages/buap-acp-agent`, run:

```text
/buap search-vault query="meeting"
```

The command returns up to five hits with title, relative path, and snippet, plus a
Lil Buddy report. It is read-only: it does not write to the vault, call external
systems, or print secrets.

## Limitations

- Search is simple substring matching, not embeddings or semantic search.
- Only titles and 200-character excerpts are searched.
- The in-memory index is cached per agent process and vault path.
- If `KNOWLEDGE_VAULT_PATH` points somewhere else, BUAP searches only that
  configured folder.
