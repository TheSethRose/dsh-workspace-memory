'use strict';
// Local embedding transport for workspace memory. Loopback HTTP only by default;
// nothing here reads user files or sends memory text to a non-loopback host.
const DEFAULTS = {
  endpoint: 'http://127.0.0.1:11434',
  model: 'nomic-embed-text:v1.5',
  timeoutMs: 20000,
  batchSize: 32,
  cacheEntries: 4096,
};
const MAX_TEXT = 32000;
/**
 * A record far longer than the model window would have its tail silently dropped, so
 * only 6,000 characters of a long record are embedded, with the title already in front.
 * That keeps the title and the leading content inside the window instead of losing them
 * to a silent truncation.
 */
const EMBED_TEXT_LIMIT = 6000;
/** nomic-embed-text v1.5 is trained with asymmetric task prefixes and compression. */
function prefixesFor(model) {
  return /^nomic-embed-text/i.test(model) ? { document: 'search_document: ', query: 'search_query: ' } : { document: '', query: '' };
}
function loopbackOnly(endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { throw Error('Embedding endpoint must be a valid URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) throw Error('Embedding endpoint must be an http loopback address; refusing to send memory text elsewhere');
  return url;
}
class EmbeddingError extends Error {
  constructor(message, code) { super(message); this.name = 'EmbeddingError'; this.code = code; }
}
/**
 * Derived-vector cache. Vectors are recomputable and never authoritative, so they
 * are kept in memory rather than in the durable domain. Keys include the model and
 * the record revision, so an edited or upgraded record can never reuse a stale vector.
 */
class VectorCache {
  constructor(maxEntries = DEFAULTS.cacheEntries) { this.maxEntries = maxEntries; this.map = new Map(); }
  key(workspaceId, id, revision) { return `${workspaceId}\u0000${id}\u0000${revision}`; }
  get(key) {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key); this.map.set(key, value);
    return value;
  }
  set(key, vector) {
    this.map.delete(key); this.map.set(key, vector);
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value);
  }
  clear() { this.map.clear(); }
  get size() { return this.map.size; }
}
/** Batched loopback embedding client with strict response validation. */
class LocalEmbeddingClient {
  constructor(options = {}) {
    this.endpoint = options.endpoint ?? process.env.WORKSPACE_MEMORY_EMBED_ENDPOINT ?? DEFAULTS.endpoint;
    this.model = options.model ?? process.env.WORKSPACE_MEMORY_EMBED_MODEL ?? DEFAULTS.model;
    this.timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
    this.batchSize = options.batchSize ?? DEFAULTS.batchSize;
    this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.prefixes = prefixesFor(this.model);
    this.url = loopbackOnly(this.endpoint);
    this.stats = { requests: 0, texts: 0 };
  }
  /** Embeds text for one role. Returns vectors in input order. */
  async embed(texts, role, limit = MAX_TEXT) {
    if (!Array.isArray(texts)) throw new EmbeddingError('Embedding input must be an array', 'INVALID_INPUT');
    if (!texts.length) return [];
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new EmbeddingError('Embedding length limit must be a positive integer', 'INVALID_INPUT');
    const prefix = role === 'query' ? this.prefixes.query : this.prefixes.document;
    const prepared = texts.map(value => {
      if (typeof value !== 'string' || !value.length) throw new EmbeddingError('Embedding input must be non-empty text', 'INVALID_INPUT');
      return prefix + value.slice(0, Math.max(1, limit - prefix.length));
    });
    const vectors = [];
    for (let start = 0; start < prepared.length; start += this.batchSize) {
      const batch = prepared.slice(start, start + this.batchSize);
      vectors.push(...await this.#request(batch));
    }
    return vectors;
  }
  async #request(input) {
    let response;
    try {
      response = await this.fetch(this.url.toString().replace(/\/$/, '') + '/api/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new EmbeddingError('Embedding service unavailable: ' + error.message, 'UNAVAILABLE');
    }
    this.stats.requests += 1; this.stats.texts += input.length;
    if (!response.ok) throw new EmbeddingError('Embedding service returned HTTP ' + response.status, 'UNAVAILABLE');
    let body;
    try { body = await response.json(); } catch { throw new EmbeddingError('Embedding service returned invalid JSON', 'PROTOCOL'); }
    const embeddings = body?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== input.length) throw new EmbeddingError('Embedding response count mismatch', 'PROTOCOL');
    return embeddings.map(vector => {
      if (!Array.isArray(vector) || !vector.length || vector.length > 8192) throw new EmbeddingError('Embedding vector shape invalid', 'PROTOCOL');
      if (!vector.every(value => typeof value === 'number' && Number.isFinite(value))) throw new EmbeddingError('Embedding vector contains non-finite values', 'PROTOCOL');
      return vector;
    });
  }
  /** Cheap reachability/model probe used by the settings UI, not by retrieval. */
  async status() {
    try { return { available: true, model: this.model, endpoint: this.url.origin }; }
    catch (error) { return { available: false, model: this.model, endpoint: String(this.endpoint), error: error.message }; }
  }
}
function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return null;
  let dot = 0, left = 0, right = 0;
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return null;
    dot += a[i] * b[i]; left += a[i] * a[i]; right += b[i] * b[i];
  }
  const denominator = Math.sqrt(left) * Math.sqrt(right);
  return denominator > 0 ? dot / denominator : null;
}
/**
 * Semantic layer over the pure core. It only ever scores records the core already
 * considers eligible, never widens approval/expiry/supersession gates, and reports
 * failures instead of silently pretending semantic retrieval happened.
 * @returns {Promise<{scores: Array|null, state: string, detail?: string, embedded: number, cached: number}>}
 */
function createSemanticScorer({ client, cache = new VectorCache() } = {}) {
  const queryCache = new Map();
  const QUERY_CACHE_MAX = 256;
  async function queryVector(text) {
    const cached = queryCache.get(text);
    if (cached) { queryCache.delete(text); queryCache.set(text, cached); return cached; }
    const [vector] = await client.embed([text], 'query');
    queryCache.set(text, vector);
    while (queryCache.size > QUERY_CACHE_MAX) queryCache.delete(queryCache.keys().next().value);
    return vector;
  }
  return {
    cache,
    client,
    /** Scores `records` (already eligibility-filtered by the caller) against `query`. */
    async score(workspaceId, records, query) {
      if (!records.length) return { scores: [], state: 'empty', embedded: 0, cached: 0 };
      if (!String(query ?? '').trim()) return { scores: [], state: 'no-query', embedded: 0, cached: 0 };
      const missing = records.filter(record => cache.get(cache.key(workspaceId, record.id, record.revision)) === undefined);
      let embedded = 0;
      if (missing.length) {
        const vectors = await client.embed(missing.map(record => `${record.title}\n${record.content}`), 'document', EMBED_TEXT_LIMIT);
        missing.forEach((record, index) => cache.set(cache.key(workspaceId, record.id, record.revision), vectors[index]));
        embedded = missing.length;
      }
      const vector = await queryVector(String(query));
      const scores = [];
      for (const record of records) {
        const similarity = cosine(vector, cache.get(cache.key(workspaceId, record.id, record.revision)));
        if (similarity !== null) scores.push({ id: record.id, revision: record.revision, score: similarity });
      }
      return { scores, state: 'scored', embedded, cached: records.length - embedded };
    },
  };
}
module.exports = { LocalEmbeddingClient, VectorCache, EmbeddingError, createSemanticScorer, cosine, prefixesFor, loopbackOnly, DEFAULTS, MAX_TEXT, EMBED_TEXT_LIMIT };
