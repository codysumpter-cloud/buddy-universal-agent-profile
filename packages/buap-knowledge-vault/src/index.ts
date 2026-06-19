import { promises as fs } from "node:fs";
import path from "node:path";

export type VaultEntry = {
  path: string;
  title: string;
  excerpt: string;
};

export type VaultIndex = {
  generatedAt: string;
  vaultPath: string;
  entries: VaultEntry[];
};

export type VaultHit = {
  path: string;
  title: string;
  snippet: string;
};

const GENERATED_INDEX_FILES = new Set([
  "KNOWLEDGE_VAULT_INDEX.md",
  "KNOWLEDGE_VAULT_INDEX.json"
]);

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseMarkdown(relativePath: string, raw: string): VaultEntry {
  let content = raw;
  let title = "";

  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---", 4);
    if (end >= 0) {
      const frontmatter = raw.slice(4, end);
      const titleMatch = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) title = titleMatch[1].trim();
      content = raw.slice(end + 4);
    }
  }

  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (!title && headingMatch) title = headingMatch[1].trim();
  if (!title) title = path.basename(relativePath, path.extname(relativePath));

  const excerpt = normalizeText(content.replace(/^#\s+.+$/m, "")).slice(0, 200);
  return { path: relativePath, title, excerpt };
}

async function walkMarkdown(root: string, current: string, entries: VaultEntry[]): Promise<void> {
  const dirents = await fs.readdir(current, { withFileTypes: true });

  for (const dirent of dirents) {
    if (dirent.name === ".git" || dirent.name === "node_modules") continue;
    if (dirent.isSymbolicLink()) continue;

    const absolutePath = path.join(current, dirent.name);
    if (dirent.isDirectory()) {
      await walkMarkdown(root, absolutePath, entries);
      continue;
    }

    if (!dirent.isFile() || !dirent.name.toLowerCase().endsWith(".md")) continue;
    if (GENERATED_INDEX_FILES.has(dirent.name)) continue;

    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const raw = await fs.readFile(absolutePath, "utf8");
    entries.push(parseMarkdown(relativePath, raw));
  }
}

export async function buildIndex(vaultPath: string): Promise<VaultIndex> {
  const resolvedVaultPath = path.resolve(vaultPath);
  const stat = await fs.stat(resolvedVaultPath);
  if (!stat.isDirectory()) {
    throw new Error(`Knowledge vault path is not a directory: ${resolvedVaultPath}`);
  }

  const entries: VaultEntry[] = [];
  await walkMarkdown(resolvedVaultPath, resolvedVaultPath, entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));

  return {
    generatedAt: new Date().toISOString(),
    vaultPath: resolvedVaultPath,
    entries
  };
}

export function searchIndex(index: VaultIndex, query: string): VaultHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return index.entries
    .filter((entry) => {
      const searchable = `${entry.title}\n${entry.excerpt}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    })
    .map((entry) => ({
      path: entry.path,
      title: entry.title,
      snippet: entry.excerpt
    }));
}

export async function loadAndSearch(vaultPath: string, query: string): Promise<VaultHit[]> {
  const index = await buildIndex(vaultPath);
  return searchIndex(index, query);
}
