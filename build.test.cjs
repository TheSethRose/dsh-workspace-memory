'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { build, revisionOf } = require('./build.cjs');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-memory-build-'));
  fs.copyFileSync(path.join(__dirname, 'build.cjs'), path.join(root, 'build.cjs'));
  fs.writeFileSync(path.join(root, 'host.mjs'), "import core from './core.js';\nimport embeddings from './embeddings.js';\nexport const value = () => [core.value, embeddings.value];\n");
  fs.writeFileSync(path.join(root, 'core.js'), "module.exports = { value: 'old-core' };\n");
  fs.writeFileSync(path.join(root, 'embeddings.js'), "module.exports = { value: 'old-embeddings' };\n");
  fs.writeFileSync(path.join(root, 'client.js'), '// Client revision one\n');
  return root;
}
const load = (root, result) => import(pathToFileURL(path.join(root, result.entry)).href);

test('same-process rebuild refreshes cached CJS helpers as well as the Host', async () => {
  const root = fixture();
  // Deliberately prime the original helpers in the same long-lived process.
  const oldCore = require(path.join(root, 'core.js'));
  const oldEmbedding = require(path.join(root, 'embeddings.js'));
  const first = build(root), oldRuntime = await load(root, first);
  assert.deepEqual(oldRuntime.value(), ['old-core', 'old-embeddings']);
  assert.deepEqual(build(root), first, 'unchanged builds are deterministic');

  fs.writeFileSync(path.join(root, 'core.js'), "module.exports = { value: 'fixed-core' };\n");
  const second = build(root), updatedRuntime = await load(root, second);
  assert.notEqual(second.revision, first.revision);
  assert.deepEqual(updatedRuntime.value(), ['fixed-core', 'old-embeddings']);
  assert.equal(oldCore.value, 'old-core', 'old cache really is still present');

  fs.writeFileSync(path.join(root, 'embeddings.js'), "module.exports = { value: 'fixed-embeddings' };\n");
  const third = build(root), newestRuntime = await load(root, third);
  assert.notEqual(third.revision, second.revision, 'embedding-only changes invalidate the build');
  assert.deepEqual(newestRuntime.value(), ['fixed-core', 'fixed-embeddings']);
  assert.equal(oldEmbedding.value, 'old-embeddings');
  assert.deepEqual(oldRuntime.value(), ['old-core', 'old-embeddings']);
  assert.ok(fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8').includes(third.entry));
  for (const helper of third.helpers) assert.ok(fs.existsSync(path.join(root, helper)));
});

test('generator and Client changes also invalidate runtime identity', () => {
  const root = fixture(), first = build(root);
  fs.appendFileSync(path.join(root, 'client.js'), '// Client revision two\n');
  const second = build(root);
  assert.notEqual(second.revision, first.revision);
  fs.appendFileSync(path.join(root, 'build.cjs'), '// Generator revision two\n');
  assert.notEqual(build(root).revision, second.revision);
});

test('missing helper imports fail before generating a misleading runtime', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'host.mjs'), "export const value = () => [];\n");
  assert.throws(() => build(root), /Expected exactly one core import/);
  assert.equal(fs.existsSync(path.join(root, 'cordis.patch.yml')), false);
});

test('a rebuild prunes stale generated artifacts and leaves other files alone', () => {
  const root = fixture();
  for (const stale of ['runtime-deadbeefdeadbeef.mjs', 'core-runtime-deadbeefdeadbeef.cjs', 'embeddings-runtime-deadbeefdeadbeef.cjs']) fs.writeFileSync(path.join(root, stale), '// stale\n');
  fs.writeFileSync(path.join(root, 'keep-me.txt'), 'user file\n');
  fs.writeFileSync(path.join(root, 'runtime-notahash.mjs'), '// not a generated name\n');
  const result = build(root);
  for (const stale of ['runtime-deadbeefdeadbeef.mjs', 'core-runtime-deadbeefdeadbeef.cjs', 'embeddings-runtime-deadbeefdeadbeef.cjs']) assert.equal(fs.existsSync(path.join(root, stale)), false, `${stale} must be pruned`);
  for (const kept of ['keep-me.txt', 'runtime-notahash.mjs']) assert.ok(fs.existsSync(path.join(root, kept)), `${kept} must survive`);
  assert.ok(fs.existsSync(path.join(root, result.entry)));
});

test('this bundle is committed at its current revision', () => {
  // The generated artifacts ship in the repository so a clone can be installed
  // without a build step; this fails when someone edits source and forgets to run it.
  const { revision, entry, helpers } = revisionOf(__dirname);
  assert.equal(revision.length, 16);
  for (const file of [entry, ...helpers]) assert.ok(fs.existsSync(path.join(__dirname, file)), `${file} is missing: run node build.cjs`);
  assert.equal(fs.readFileSync(path.join(__dirname, 'cordis.patch.yml'), 'utf8'), `- insert:\n    - id: workspace-memory\n      name: ./${entry}\n`);
  const generated = fs.readdirSync(__dirname).filter(file => /^(?:runtime-[a-f0-9]{16}\.mjs|(?:core|embeddings)-runtime-[a-f0-9]{16}\.cjs)$/.test(file));
  assert.deepEqual(generated.sort(), [entry, ...helpers].sort(), 'exactly one revision may be present');
});
