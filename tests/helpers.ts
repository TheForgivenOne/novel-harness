import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export async function makeBundle(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "novel-harness-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  return root;
}

export const validStoryDir = join(import.meta.dir, "fixtures", "valid-story");

export async function tmpProject(name: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `novel-harness-${name}-`));
}
