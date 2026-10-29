import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

const script = fileURLToPath(new URL('./build-pdf-editor.mjs', import.meta.url));
const published = JSON.parse(readFileSync(new URL('../PDF-Editor/source.json', import.meta.url), 'utf8')).revision;
const fixture = mkdtempSync(path.join(os.tmpdir(), 'pdf-editor-revision-test-'));
// Only this freshly created temporary repository is removed during cleanup.
after(() => rmSync(fixture, { recursive: true, force: true }));
const git = (...args) => execFileSync('git', ['-C', fixture, ...args], { encoding: 'utf8' }).trim();
git('init', '--quiet');
writeFileSync(path.join(fixture, 'source.txt'), 'clean fixture\n');
git('add', 'source.txt');
git('-c', 'user.name=Deployment test', '-c', 'user.email=deployment-test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
const revision = git('rev-parse', 'HEAD');

function rejects(args, message) {
  const result = spawnSync(process.execPath, [script, fixture, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, message);
}

test('rejects moving refs and abbreviated SHAs before invoking build tools', () => {
  for (const invalid of ['master', revision.slice(0, 8), 'g'.repeat(40)]) {
    rejects([invalid], /complete 40-character lowercase Git commit SHA/);
  }
});

test('defaults to the currently published SHA and rejects a mismatching checkout', () => {
  assert.notEqual(revision, published);
  rejects([], new RegExp(`Use a clean upstream checkout at ${published}`));
});

test('accepts an explicit matching SHA and reaches the dependency check', () => {
  rejects([revision], /Upstream dependencies are missing/);
});

test('rejects staged and unstaged source changes before dependency installation', () => {
  writeFileSync(path.join(fixture, 'source.txt'), 'changed fixture\n');
  rejects([revision], /Use a clean upstream checkout/);
  git('add', 'source.txt');
  rejects([revision], /Use a clean upstream checkout/);
});
