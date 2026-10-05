'use strict';
// Real installed-model evaluation of the approved local Ollama embedding model.
// Authored synthetic fixtures only; never user memories. Local loopback HTTP only.
// Run: node workspace-memory/nomic-embedding-evaluation.cjs [--endpoint URL] [--model NAME]
const assert = require('node:assert/strict');
const { corpus, cases } = require('./retrieval-evaluation.cjs');
const negatives = ['volcanic seismology', 'photosynthesis in ferns', 'Who won the football match?', 'How do I bake sourdough bread?', 'Explain lunar crater geology'];
function argument(name, fallback) {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const endpoint = argument('endpoint', 'http://127.0.0.1:11434');
const model = argument('model', 'nomic-embed-text:v1.5');
async function embed(input) {
  const response = await fetch(endpoint + '/api/embed', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, input }), signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error('Embedding request failed with HTTP ' + response.status + ': ' + (await response.text()).slice(0, 300));
  const body = await response.json();
  if (!Array.isArray(body.embeddings) || body.embeddings.length !== input.length) throw Error('Embedding response shape mismatch');
  for (const vector of body.embeddings) { assert.ok(Array.isArray(vector) && vector.length); assert.ok(vector.every(Number.isFinite)); }
  return { vectors: body.embeddings, totalDuration: body.total_duration ?? null, loadDuration: body.load_duration ?? null };
}
const cosine = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0) / Math.sqrt(a.reduce((s, v) => s + v * v, 0) * b.reduce((s, v) => s + v * v, 0));
const THRESHOLDS = [0.3, 0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
function score(vectors, prefix) {
  const rank = (vector) => corpus.map(([id], i) => ({ id, score: cosine(vector, vectors[i]) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const rows = cases.map(([group, query, target], i) => ({ group, query, target, ranking: rank(vectors[corpus.length + i]) }));
  const negativeRows = negatives.map((query, i) => ({ query, top1: rank(vectors[corpus.length + cases.length + i])[0] }));
  const sweeps = THRESHOLDS.map(threshold => ({
    threshold,
    groups: Object.fromEntries(['exact', 'paraphrase', 'natural-paraphrase'].map(group => {
      const items = rows.filter(r => r.group === group);
      return [group, { cases: items.length, recall: items.filter(r => r.ranking.some(v => v.id === r.target && v.score >= threshold)).length, top1: items.filter(r => r.ranking[0].id === r.target && r.ranking[0].score >= threshold).length }];
    })),
    negativeQueriesSelected: negativeRows.filter(r => r.top1.score >= threshold).length,
  }));
  return { prefix, rows: rows.map(r => ({ ...r, ranking: r.ranking.map(v => ({ id: v.id, score: Number(v.score.toFixed(4)) })) })), negatives: negativeRows.map(r => ({ query: r.query, top1: r.top1.id, score: Number(r.top1.score.toFixed(4)) })), sweeps };
}
async function main() {
  const documents = corpus.map(([, title, content]) => title + '. ' + content);
  const queries = [...cases.map(([, query]) => query), ...negatives];
  const report = { endpoint, model, dimensions: null, prefixes: {} };
  for (const mode of ['none', 'nomic-v1.5']) {
    const documentInput = mode === 'none' ? documents : documents.map(text => 'search_document: ' + text);
    const queryInput = mode === 'none' ? queries : queries.map(text => 'search_query: ' + text);
    const started = performance.now();
    const documentsResult = await embed(documentInput);
    const queriesResult = await embed(queryInput);
    const measuredMs = performance.now() - started;
    report.dimensions = documentsResult.vectors[0].length;
    report[mode === 'none' ? 'unprefixed' : 'prefixed'] = { measuredMs: Number(measuredMs.toFixed(1)), totalDurationNs: (documentsResult.totalDuration ?? 0) + (queriesResult.totalDuration ?? 0), ...score([...documentsResult.vectors, ...queriesResult.vectors], mode) };
  }
  report.scope = 'synthetic authored diagnostic fixtures; threshold sweep is exploratory, not held-out validation; semantic-only ranking, not the production hybrid; single-run latency on one machine';
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
