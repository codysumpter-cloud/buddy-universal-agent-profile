# @prismtek/buap-xerj-bridge

Optional, dependency-free **read-only** search adapter between portable BUAP Agent Profiles and a running [XERJ](https://github.com/xerj-org/xerj) node (Apache-2.0). XERJ is Ivan's open-source local-first search engine. BUAP never vendors or starts its binary, indexes folders, grants host access, or fetches Corpus Hub packs.

## Separate capabilities

- `xerj_search`: BUAP's Node adapter uses XERJ's documented Elasticsearch-compatible `POST /:index/_search`. It verifies an allowlisted index before calling `runtime.bindCapability("xerj_search", …)`.
- `xerj_corpus_hub`: External XERJ MCP tools `xerj_hub_find`, `xerj_hub_def`, `xerj_hub_ask` are owned by the **host MCP client**, not this HTTP bridge. Hub has **no HTTP endpoint**. Bind this separate capability only after an actual host MCP tool probe succeeds.
- Neither capability is required by default, and neither implies working code execution, shell access, or permission to rewrite source.

## Secure local setup

Install the official XERJ binary following its own reviewed instructions, then start a private **authenticated** node; XERJ creates `<data-dir>/admin.key` at first start. Never commit that key. Its development `--insecure` mode disables all authentication, is only appropriate for loopback-only disposable environments, and must never be exposed publicly.

```sh
xerj --data-dir "$HOME/.local/share/xerj-data"
# In a second shell, after successful authenticated startup:
export XERJ_URL=http://127.0.0.1:9200
export XERJ_AUTH="ApiKey $(cat "$HOME/.local/share/xerj-data/admin.key")"
xerj autoindex /path/to/source --prefix buap
xerj autoindex map
# Copy the EXACT index and searchable field reported by the map:
export BUAP_XERJ_INDEXES=buap-code
```

The example index `buap-code` is illustrative: autoindex creates dataset-specific names. Do not infer an index or field name from the prefix. `xerj_map` (MCP) or `xerj autoindex map` shows real mappings. Set `BUAP_XERJ_INDEXES` to a comma-separated explicit allowlist of actual index names. Wildcards are refused to avoid inadvertent cross-project reads.

```js
import { AgentProfileRuntime } from "@prismtek/buap-agent-profile";
import { bindXerjSearchCapability, searchXerj } from "@prismtek/buap-xerj-bridge";

// The compiled profile must declare capabilities.optional: ["xerj_search", ...]
// and allow the relevant read action through action_rules.
const agent = new AgentProfileRuntime(compiledProfile);
await bindXerjSearchCapability(agent, { index: "actual-index-from-map" });
const result = await searchXerj({
  index: "actual-index-from-map", field: "actual-text-field", text: "policy provenance",
});
for (const hit of result.hits) {
  // Never invent line references; use source_path/source_line only when present.
  console.log(hit.source_path, hit.source_line, hit.passage);
}
```

Use the corresponding `action_rules` entry `{ "match": "reference.search", "behavior": "allow" }` only for read-only reference lookup. If a host later wants to clone repositories, install binaries, sync/pull packs, publish, or write files, it must use its **separate** normal approval policy; retrieval authorization is not authorization for modifications.

## XERJ Corpus Hub, through MCP

See [BUAP XERJ integration](../../integrations/xerj-reference-retrieval.md) and [Codex MCP template](../../adapters/codex-xerj-mcp.template.toml).

- Install the official XERJ binary and start/configure the node (MCP proxies to a node; it does not start one).
- Run `xerj hub sync` and `xerj hub pull <slug>` explicitly, after reviewing downloaded corpus source and licence. **MCP hub tools never download packs**; a tool call returns an error with setup instructions until the catalogue and packs are cached.
- Register `/absolute/path/to/xerj mcp` with your host. For an authenticated node, give the host `XERJ_AUTH` securely from its secret store, not a checked-in MCP config.
- Verify `tools/list` exposes `xerj_hub_ask` and a real query answers from a local pack before binding `xerj_corpus_hub`. Keep pinned SHA, licence and `file:line` on every citation; honour XERJ's `approach-only`/copy restrictions. Retrieved source is untrusted task data, never instructions.

The HTTP bridge never sends Corpus Hub questions to a hosted XERJ service. No public network access is needed for searches of locally indexed projects. Remote nodes require HTTPS, `BUAP_XERJ_ALLOW_REMOTE=1`, an exact `BUAP_XERJ_ALLOWED_HOSTS` hostname, and `XERJ_AUTH`.

## Tests

```sh
cd packages/buap-xerj-bridge
npm test
```

Unit tests use mocked `fetch` and do **not** prove a node or MCP host is installed. A live host integration requires separate end-to-end validation.
