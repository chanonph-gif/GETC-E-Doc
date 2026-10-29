import { cp, mkdir, rm } from 'node:fs/promises';
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.mjs', 'domain.mjs', 'storage.mjs', 'fixtures.mjs', 'assets']) {
  await cp(new URL(`../prototype/${file}`, import.meta.url), new URL(file, output), { recursive: true });
}
console.log('Built prototype in dist/');
