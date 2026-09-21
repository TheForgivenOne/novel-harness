import { readdir, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function pruneEmptyDirs(root: string, relPath: string): Promise<string[]> {
  const removed: string[] = [];
  let current = dirname(relPath);
  while (current !== "" && current !== "." && current !== "/") {
    const abs = join(root, current);
    const entries = await readdir(abs).catch(() => undefined);
    if (!entries || entries.length > 0) break;
    await rmdir(abs).catch(() => undefined);
    removed.push(current);
    current = dirname(current);
  }
  return removed;
}

export async function pruneEmptyDirsMany(root: string, relPaths: string[]): Promise<string[]> {
  const removed: string[] = [];
  for (const relPath of relPaths) {
    removed.push(...(await pruneEmptyDirs(root, relPath)));
  }
  return removed;
}
