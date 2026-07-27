import fs from "node:fs/promises";
import path from "node:path";

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if ((char === '"' || char === "'") && line[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === "#" && quote === null) return line.slice(0, i);
  }
  return line;
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "") return {};
  if (value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(",").map((item) => parseScalar(item)) : [];
  }
  return value;
}

export function parseSimpleYaml(source, filename = "<yaml>") {
  const lines = source
    .split(/\r?\n/)
    .map((raw, index) => ({ index: index + 1, raw: stripComment(raw).replace(/\s+$/, "") }))
    .filter(({ raw }) => raw.trim() !== "");
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    const { raw, index } = lines[cursor];
    const indent = raw.length - raw.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`${filename}:${index}: YAML indentation must use two spaces`);
    const text = raw.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;

    if (text.startsWith("- ") || text === "-") {
      if (!Array.isArray(parent)) throw new Error(`${filename}:${index}: list item has no list parent`);
      const itemText = text.slice(1).trim();
      if (itemText.includes(":")) {
        const split = itemText.indexOf(":");
        const key = itemText.slice(0, split).trim();
        const rawValue = itemText.slice(split + 1).trim();
        const item = {};
        item[key] = parseScalar(rawValue);
        parent.push(item);
        if (rawValue === "") stack.push({ indent, value: item[key] });
        else stack.push({ indent, value: item });
      } else {
        parent.push(parseScalar(itemText));
      }
      continue;
    }

    const split = text.indexOf(":");
    if (split < 1) throw new Error(`${filename}:${index}: expected key: value`);
    const key = text.slice(0, split).trim();
    const rawValue = text.slice(split + 1).trim();
    if (Array.isArray(parent)) throw new Error(`${filename}:${index}: mapping key cannot be added directly to a list`);

    if (rawValue !== "") {
      parent[key] = parseScalar(rawValue);
      continue;
    }

    const next = lines[cursor + 1];
    const nextText = next?.raw.trim() ?? "";
    const nextIndent = next ? next.raw.length - next.raw.trimStart().length : -1;
    const child = next && nextIndent > indent && (nextText === "-" || nextText.startsWith("- ")) ? [] : {};
    parent[key] = child;
    stack.push({ indent, value: child });
  }
  return root;
}

export async function readStructuredFile(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new Error(`${filePath}: invalid JSON: ${error.message}`);
    }
  }
  if (extension === ".yaml" || extension === ".yml") return parseSimpleYaml(source, filePath);
  throw new Error(`${filePath}: expected .json, .yaml, or .yml`);
}
