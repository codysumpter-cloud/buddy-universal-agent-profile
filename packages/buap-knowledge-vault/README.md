# @prismtek/buap-knowledge-vault

Local Markdown indexer for Prismtek's KnowledgeVault.

## Usage

```ts
import { buildIndex, searchIndex, loadAndSearch } from "@prismtek/buap-knowledge-vault";

const index = await buildIndex("/Users/prismtek/Prismtek/knowledge-vault");
const hits = searchIndex(index, "meeting");
```

## Scripts

```bash
npm install
npm run build
npm run smoke
```

For generated vault index files, run from the BUAP repo root:

```bash
node scripts/build-vault-index.mjs
```
