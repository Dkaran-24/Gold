import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Part = 'input' | 'output';
const privateName = /^([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.(input|output)$/;
export class PrivatePhotos {
  readonly root: string;
  constructor(directory?: string) {
    this.root = resolve(directory || process.env.TRYON_PRIVATE_DIR ||
      fileURLToPath(new URL('../../../../../.local/tryon-private', import.meta.url)));
    if (this.root.split(/[\\/]/).some(part => ['public','.next','dist','node_modules'].includes(part.toLowerCase()))) {
      throw new Error('Try-on storage requires a dedicated, non-served directory.');
    }
  }
  path(id: string, part: Part) {
    const filename = id + '.' + part;
    if (!privateName.test(filename)) throw new Error('Invalid private media identifier.');
    return join(this.root, filename);
  }
  async write(id: string, part: Part, data: Buffer) {
    await mkdir(this.root, {recursive: true, mode: 0o700});
    await writeFile(this.path(id, part), data, {mode: 0o600, flag: 'wx'});
  }
  read(id: string, part: Part) { return readFile(this.path(id, part)); }
  async remove(id: string, part: Part) {
    try { await unlink(this.path(id, part)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  async sweep(keep: (id: string, part: Part) => Promise<boolean>) {
    let names: string[];
    try { names = await readdir(this.root); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    for (const name of names) {
      const match = privateName.exec(name);
      if (!match) continue;
      const id = match[1]!;
      const part = match[2] as Part;
      try {
        const file = await stat(this.path(id, part));
        // Leave a grace period for a creation transaction or completion commit.
        if (Date.now() - file.mtimeMs > 300000 && !(await keep(id, part))) await this.remove(id, part);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}
