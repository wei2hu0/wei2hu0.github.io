import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = 'https://github.com/JhuoW/PDF-Editor';
const base = '/PDF-Editor/';
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.resolve(root, 'PDF-Editor');
const source = process.argv[2] && path.resolve(process.argv[2]);
if (!source || process.argv.length > 4) {
  throw new Error('Usage: node _tools/build-pdf-editor.mjs <upstream-checkout> [expected-revision] (run npm ci there first)');
}
// Automatic sync supplies the upstream SHA; manual rebuilds default to the
// version already published in source.json rather than following a moving ref.
const revision = process.argv[3] ?? JSON.parse(readFileSync(path.join(destination, 'source.json'), 'utf8')).revision;
if (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error('Expected revision must be a complete 40-character lowercase Git commit SHA.');
}
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== revision || git('status', '--porcelain', '--untracked-files=no')) {
  throw new Error(`Use a clean upstream checkout at ${revision}.`);
}
if (!existsSync(path.join(source, 'node_modules/vite/bin/vite.js'))) {
  throw new Error('Upstream dependencies are missing; run npm ci in the upstream checkout first.');
}
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], { cwd: source, stdio: 'inherit' });
const { build, loadConfigFromFile, mergeConfig } = await import(
  pathToFileURL(path.join(source, 'node_modules/vite/dist/node/index.js')).href
);
const upstream = await loadConfigFromFile({ command: 'build', mode: 'production' }, undefined, source);
if (!upstream) throw new Error('Upstream Vite configuration not found.');
// Jekyll omits __vite-browser-external chunks. Prefix every chunk, including
// worker dependencies, so the existing homepage configuration can stay intact.
const output = { chunkFileNames: 'assets/chunk-[name]-[hash].js' };
await build(mergeConfig(upstream.config, {
  root: source,
  configFile: false,
  base,
  build: { rollupOptions: { output } },
  worker: { rollupOptions: { output } },
}));

const dist = path.join(source, 'dist');
let html = readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!html.includes(`${base}assets/`)) throw new Error('Build is missing the required deployment base.');
html = html.replace(/<title>[^<]*<\/title>/, '<title>PDF Editor</title>')
  .replace(/\s*<link\b[^>]*href="[^"]*vite\.svg"[^>]*\/>/, '');
for (const directory of ['assets', 'pdfjs', 'ocr', 'licenses']) {
  if (!existsSync(path.join(dist, directory))) throw new Error(`Missing build assets: ${directory}`);
}

// Jekyll skips names beginning with _. Refuse an incomplete static deployment.
function verifyFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.isSymbolicLink()) {
      throw new Error(`Unsupported static asset: ${path.join(directory, entry.name)}`);
    }
    if (entry.isDirectory()) verifyFiles(path.join(directory, entry.name));
  }
}
verifyFiles(dist);
// Only replace this generated subdirectory, after a successful build.
if (path.dirname(destination) !== path.resolve(root) || path.basename(destination) !== 'PDF-Editor') {
  throw new Error('Invalid output directory.');
}
if (existsSync(destination)) rmSync(destination, { recursive: true });
cpSync(dist, destination, { recursive: true });
writeFileSync(path.join(destination, 'index.html'), html);
rmSync(path.join(destination, 'vite.svg'), { force: true });
cpSync(path.join(source, 'LICENSE'), path.join(destination, 'LICENSE.txt'));
writeFileSync(path.join(destination, 'source.json'), JSON.stringify({
  repository,
  revision,
  source: `${repository}/tree/${revision}`,
  base,
  build: 'npm ci; node _tools/build-pdf-editor.mjs <upstream-checkout>',
  packaging: '_tools/build-pdf-editor.mjs',
  packagingSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
}, null, 2) + '\n');
console.log(`Packaged ${repository}@${revision} at ${destination}`);
