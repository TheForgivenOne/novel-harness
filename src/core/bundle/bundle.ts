import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseConcept, type Concept } from "./concept.ts";
import { toPosix } from "./paths.ts";

export interface MalformedFile {
  path: string;
  message: string;
}

export interface ReservedFile {
  /** Bundle-relative path. */
  path: string;
  /** Absolute path on disk. */
  absPath: string;
  /** File contents. */
  raw: string;
}

export interface Bundle {
  /** Absolute path to the bundle root. */
  root: string;
  /** Parsed concept documents, sorted by path. */
  concepts: Concept[];
  /** Files that could not be parsed, reported as errors by validation. */
  malformed: MalformedFile[];
  /** Reserved index.md files. */
  indexFiles: ReservedFile[];
  /** Reserved log.md files. */
  logFiles: ReservedFile[];
}

const SKIP_DIRS = new Set([".git", "node_modules", ".novel", "dist"]);

export async function loadBundle(root: string): Promise<Bundle> {
  const info = await stat(root).catch(() => undefined);
  if (!info?.isDirectory()) {
    throw new Error(`bundle directory not found: ${root}`);
  }

  const concepts: Concept[] = [];
  const malformed: MalformedFile[] = [];
  const indexFiles: ReservedFile[] = [];
  const logFiles: ReservedFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(abs);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

      const rel = toPosix(relative(root, abs));
      const raw = await readFile(abs, "utf8");

      if (entry.name === "index.md") {
        indexFiles.push({ path: rel, absPath: abs, raw });
        continue;
      }
      if (entry.name === "log.md") {
        logFiles.push({ path: rel, absPath: abs, raw });
        continue;
      }

      try {
        concepts.push(parseConcept(abs, rel, raw));
      } catch (error) {
        malformed.push({ path: rel, message: (error as Error).message });
      }
    }
  }

  await walk(root);
  concepts.sort((a, b) => a.path.localeCompare(b.path));
  indexFiles.sort((a, b) => a.path.localeCompare(b.path));
  logFiles.sort((a, b) => a.path.localeCompare(b.path));

  return {
    root,
    concepts,
    malformed,
    indexFiles: indexFiles.sort(),
    logFiles: logFiles.sort(),
  };
}

export function conceptById(bundle: Bundle, id: string): Concept | undefined {
  return bundle.concepts.find((concept) => concept.id === id);
}
