'use strict';
// Dependency-free diagnostic benchmark: invokes the real core, not a scoring replica.
// Run: node workspace-memory/retrieval-evaluation.cjs
const assert = require('node:assert/strict');
const { MemoryStore, retrieve, renderContext } = require('./core.js');
const NOW = '2026-01-01T00:00:00Z';
const corpus = [
  ['style', 'Concise responses', 'Prefer brief answers without lengthy explanations.'],
  ['language', 'TypeScript implementation', 'Use strict types for application code.'],
  ['storage', 'Database choice', 'Persist durable records in PostgreSQL.'],
  ['privacy', 'Offline processing', 'Keep confidential documents on this machine; avoid external transmission.'],
  ['timezone', 'Scheduling timezone', 'Interpret appointments using America/Chicago.'],
  ['testing', 'Regression coverage', 'Add automated tests for bug fixes.'],
  ['format', 'Spreadsheet deliverables', 'Supply financial tables as XLSX files.'],
  ['approval', 'Destructive operations', 'Obtain explicit confirmation before deleting data.'],
];
const cases = [
  ['exact', 'concise responses', 'style'],
  ['exact', 'TypeScript', 'language'],
  ['exact', 'PostgreSQL', 'storage'],
  ['exact', 'offline processing', 'privacy'],
  ['exact', 'America/Chicago', 'timezone'],
  ['exact', 'regression coverage', 'testing'],
  ['exact', 'spreadsheet deliverables', 'format'],
  ['exact', 'destructive operations', 'approval'],
  ['paraphrase', 'terse replies', 'style'],
  ['paraphrase', 'statically typed JavaScript', 'language'],
  ['paraphrase', 'relational persistence backend', 'storage'],
  ['paraphrase', 'never upload sensitive material', 'privacy'],
  ['paraphrase', 'Central US clock', 'timezone'],
  ['paraphrase', 'verify repaired defects automatically', 'testing'],
  ['paraphrase', 'Excel workbook output', 'format'],
  ['paraphrase', 'ask permission prior to erasure', 'approval'],
  ['natural-paraphrase', 'How should you answer me?', 'style'],
  ['natural-paraphrase', 'Which language should we use?', 'language'],
  ['natural-paraphrase', 'Where should our app save information?', 'storage'],
  ['natural-paraphrase', 'Can you send my private material to a cloud service?', 'privacy'],
];
async function main() {
  const values = new Map();
  let nextId;
  const store = new MemoryStore({ get: key => values.get(key), entries: () => values.entries(), put: async (key, value) => values.set(key, value), delete: async key => values.delete(key) }, {
    validateWorkspace: id => ['evaluation', 'foreign'].includes(id), now: () => NOW, id: () => nextId,
  });
  async function create(id, title, content, extras = {}, approve = true, workspace = 'evaluation') {
    nextId = id;
    const r = await store.create(workspace, { title, content, ...extras });
    return approve ? store.approve(workspace, r.id, r.revision) : r;
  }
  for (const [id, title, content] of corpus) await create(id, title, content);
  const records = store.list('evaluation');
  const rows = cases.map(([group, query, target]) => {
    const result = retrieve(records, query, { now: NOW, limit: 20, budgetChars: 8000 });
    assert.ok(result.usedChars <= 8000);
    assert.equal(result.usedChars, renderContext(result).length);
    const selected = result.records.map(r => r.id);
    const rank = selected.indexOf(target) + 1;
    return { group, query, target, selected, scores: result.reasons.map(r => `${r.id}:${r.score}`), rank, hit: rank > 0, top1: rank === 1 };
  });
  const summary = Object.fromEntries(['exact', 'paraphrase', 'natural-paraphrase'].map(group => {
    const items = rows.filter(r => r.group === group);
    return [group, { cases: items.length, recall: items.filter(r => r.hit).length / items.length, top1: items.filter(r => r.top1).length / items.length, mrr: items.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / items.length }];
  }));
  const irrelevant = retrieve(records, 'volcanic seismology', { now: NOW });
  assert.deepEqual(irrelevant.records, []);
  // Independent contracts: pins are not a substitute for unpinned paraphrase retrieval.
  await create('pin', 'Standing preference', 'Always show units.', { pinned: true });
  await create('proposal', 'terse replies', 'terse replies', { pinned: true }, false);
  await create('disabled', 'terse replies', 'terse replies', { enabled: false, pinned: true });
  await create('expired', 'terse replies', 'terse replies', { expiresAt: NOW, pinned: true });
  const rejected = await create('rejected', 'terse replies', 'terse replies', { pinned: true });
  await store.reject('evaluation', rejected.id, rejected.revision);
  const old = await create('old', 'terse replies', 'terse replies', { pinned: true });
  await create('replacement', 'Updated preference', 'Latest approved preference.', { supersedes: old.id });
  const contracts = retrieve(store.list('evaluation'), 'terse replies', { now: NOW });
  assert.deepEqual(contracts.records.map(r => r.id), ['pin']);
  assert.equal(contracts.reasons[0].score, 0);
  const tiny = retrieve(store.list('evaluation'), 'terse replies', { now: NOW, budgetChars: 1 });
  assert.deepEqual(tiny.records, []);
  assert.deepEqual(tiny.overflow.reasons, [{ id: 'pin', reason: 'budget', pinned: true }]);
  const foreign = await create('foreign-record', 'terse replies', 'terse replies', {}, true, 'foreign');
  assert.throws(() => retrieve([...records, foreign], '', { now: NOW }), e => e.code === 'INVALID_WORKSPACE');
  console.log(JSON.stringify({ node: process.version, now: NOW, corpus, rows, summary, irrelevantSelected: irrelevant.records.length, contractChecks: 'PASS: approval, enabled, expiry equality, rejection, supersession, pins, exact budget, workspace isolation' }, null, 2));
}
module.exports = { corpus, cases };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
