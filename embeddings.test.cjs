'use strict';
// Offline contract tests for the embedding transport. Nothing here contacts a real
// service: the injected fetch is a stub, so no memory text leaves the machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const { LocalEmbeddingClient, VectorCache, createSemanticScorer, cosine, prefixesFor, loopbackOnly } = require('./embeddings.js');

function vector(seed, length = 8) { return Array.from({ length }, (_, index) => Math.sin(seed + index)); }
function stubFetch(handler) { const calls = []; return { calls, fetch: async (url, options) => { const body = JSON.parse(options.body); calls.push({ url, body }); return handler(body, calls.length); } }; }
function respond(body) { return { ok: true, status: 200, json: async () => body }; }

test('only loopback HTTP endpoints are accepted', () => {
  for (const endpoint of ['https://127.0.0.1:11434', 'http://example.com:11434', 'http://10.0.0.5:11434', 'file:///tmp/x', 'not a url']) {
    assert.throws(() => loopbackOnly(endpoint), /loopback|valid URL/);
  }
  for (const endpoint of ['http://127.0.0.1:11434', 'http://localhost:11434', 'http://[::1]:11434']) assert.equal(loopbackOnly(endpoint).hostname.length > 0, true);
});

test('nomic models receive asymmetric task prefixes and other models do not', () => {
  assert.deepEqual(prefixesFor('nomic-embed-text:v1.5'), { document: 'search_document: ', query: 'search_query: ' });
  assert.deepEqual(prefixesFor('some-other-model'), { document: '', query: '' });
  const stub = stubFetch(body => respond({ embeddings: body.input.map((_, index) => vector(index)) }));
  const client = new LocalEmbeddingClient({ fetch: stub.fetch });
  assert.equal(client.model, 'nomic-embed-text:v1.5');
  return client.embed(['a memory'], 'document').then(() => {
    assert.equal(stub.calls[0].body.input[0], 'search_document: a memory');
    return client.embed(['a question'], 'query');
  }).then(() => {
    assert.equal(stub.calls[1].body.input[0], 'search_query: a question');
    assert.equal(stub.calls[0].body.model, 'nomic-embed-text:v1.5');
  });
});

test('batching preserves input order and reports service failure without throwing shapes', async () => {
  const stub = stubFetch(body => respond({ embeddings: body.input.map(text => [text.length, 0]) }));
  const client = new LocalEmbeddingClient({ fetch: stub.fetch, batchSize: 2 });
  assert.equal(client.batchSize, 2);
  const texts = ['one', 'two', 'three', 'four', 'five'];
  const vectors = await client.embed(texts, 'document');
  assert.equal(vectors.length, texts.length);
  assert.equal(stub.calls.length, 3);
  assert.deepEqual(vectors.map(v => v[0]), texts.map(text => text.length + 'search_document: '.length), 'batched vectors keep input order');
  const failing = new LocalEmbeddingClient({ fetch: async () => { throw Error('connect ECONNREFUSED'); } });
  await assert.rejects(failing.embed(['x'], 'query'), error => error.code === 'UNAVAILABLE');
  const badShape = new LocalEmbeddingClient({ fetch: async () => respond({ embeddings: [[1, 2], 'nope'] }) });
  await assert.rejects(badShape.embed(['a', 'b'], 'document'), error => error.code === 'PROTOCOL');
  const badCount = new LocalEmbeddingClient({ fetch: async () => respond({ embeddings: [[1, 2]] }) });
  await assert.rejects(badCount.embed(['a', 'b'], 'document'), error => error.code === 'PROTOCOL');
  const nonFinite = new LocalEmbeddingClient({ fetch: async () => respond({ embeddings: [[1, NaN]] }) });
  await assert.rejects(nonFinite.embed(['a'], 'document'), error => error.code === 'PROTOCOL');
  const wrongStatus = new LocalEmbeddingClient({ fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  await assert.rejects(wrongStatus.embed(['a'], 'document'), error => error.code === 'UNAVAILABLE');
});

test('invalid input is rejected before any request is made', async () => {
  const stub = stubFetch(body => respond({ embeddings: body.input.map(() => vector(1)) }));
  const client = new LocalEmbeddingClient({ fetch: stub.fetch });
  await assert.rejects(client.embed('nope', 'query'), error => error.code === 'INVALID_INPUT');
  await assert.rejects(client.embed([''], 'query'), error => error.code === 'INVALID_INPUT');
  await assert.rejects(client.embed([42], 'query'), error => error.code === 'INVALID_INPUT');
  assert.deepEqual(await client.embed([], 'query'), []);
  assert.equal(stub.calls.length, 0);
});

test('long memories are truncated rather than silently overflowing the model window', async () => {
  const stub = stubFetch(body => respond({ embeddings: body.input.map(() => vector(1)) }));
  const client = new LocalEmbeddingClient({ fetch: stub.fetch });
  await client.embed(['x'.repeat(40000)], 'document');
  assert.equal(stub.calls[0].body.input[0].length, 32000, 'the prefix counts against the enforced window');
  assert.ok(stub.calls[0].body.input[0].startsWith('search_document: '), 'the prefix survives truncation');
  await client.embed(['y'.repeat(40000)], 'document', 6000);
  assert.equal(stub.calls[1].body.input[0].length, 6000, 'record embedding uses a shorter window');
  await assert.rejects(client.embed(['z'], 'document', 0), error => error.code === 'INVALID_INPUT');
});

test('the vector cache is revision and workspace keyed with bounded eviction', async () => {
  const cache = new VectorCache(2);
  cache.set(cache.key('w1', 'm1', 1), vector(1));
  assert.notEqual(cache.get(cache.key('w1', 'm1', 1)), undefined);
  assert.equal(cache.get(cache.key('w1', 'm1', 2)), undefined, 'a new revision must not reuse the old vector');
  assert.equal(cache.get(cache.key('w2', 'm1', 1)), undefined, 'another workspace must not reuse the vector');
  cache.set(cache.key('w1', 'm2', 1), vector(2));
  cache.set(cache.key('w1', 'm3', 1), vector(3));
  assert.equal(cache.size, 2);
  assert.equal(cache.get(cache.key('w1', 'm1', 1)), undefined, 'least recently used entry is evicted');
});

test('scoring only embeds the eligible records it is given and reuses cached vectors', async () => {
  const stub = stubFetch(body => respond({ embeddings: body.input.map((_, index) => vector(index)) }));
  const client = new LocalEmbeddingClient({ fetch: stub.fetch });
  const scorer = createSemanticScorer({ client });
  const records = [{ id: 'm1', revision: 1, title: 'A', content: 'alpha' }, { id: 'm2', revision: 3, title: 'B', content: 'beta' }];
  const first = await scorer.score('w1', records, 'question');
  assert.equal(first.state, 'scored');
  assert.equal(first.embedded, 2);
  assert.equal(first.scores.length, 2);
  assert.deepEqual(first.scores.map(s => [s.id, s.revision]), [['m1', 1], ['m2', 3]]);
  assert.equal(stub.calls.length, 2, 'one document batch and one query embedding');
  const second = await scorer.score('w1', records, 'question');
  assert.equal(second.embedded, 0);
  assert.equal(second.cached, 2);
  assert.equal(stub.calls.length, 2, 'a repeated query reuses the cached vectors');
  const edited = await scorer.score('w1', [{ ...records[0], revision: 2 }], 'question');
  assert.equal(edited.embedded, 1, 'an edited record is re-embedded');
  assert.equal((await scorer.score('w1', [], 'question')).state, 'empty');
  assert.equal((await scorer.score('w1', records, '   ')).state, 'no-query');
});

test('cosine similarity is normalized and rejects malformed vectors', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(Math.round(cosine([1, 0], [-1, 0])), -1);
  assert.equal(cosine([0, 0], [1, 0]), null);
  assert.equal(cosine([1], [1, 2]), null);
  assert.equal(cosine([1, NaN], [1, 2]), null);
  assert.equal(cosine([], []), null);
});
