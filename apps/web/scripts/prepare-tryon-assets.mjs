import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const target = fileURLToPath(new URL('../public/try-on/wasm/', import.meta.url));
const source = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
await mkdir(target, { recursive: true });
for (const variant of ['vision_wasm_internal', 'vision_wasm_module_internal']) {
  for (const extension of ['js', 'wasm']) {
    const file = variant + '.' + extension;
    await copyFile(join(source, file), join(target, file));
  }
}

