'use strict';

// Run from this directory: node --test integration.test.cjs
// No transformed host source or mocked dependency modules: registration uses the
// installed zod, storage-domain and defineTool implementations verbatim.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const clone = value => structuredClone(value);
const SETTINGS = { enabled: true, suggestions: true, budgetChars: 8000, excluded: [], semantic: false, semanticThreshold: 0.5 };

async function createHarness(options = {}) {
  const host = await import(pathToFileURL(path.join(__dirname, 'host.mjs')).href);
  const toolsPackage = await import('@deepseek-ai/dsh-tools');
  const handlers = new Map(), effects = [], provided = new Map();
  const contexts = [], sections = [], tools = [], routes = [], tables = new Map();
  const authRequests = [], writes = [], inspectProviders = new Map();
  let spec, closed = false;
  const workspaces = [
    { id: 'workspace-a', title: 'A', path: '/workspaces/a', sessionIds: ['session-a', 'session-a2'] },
    { id: 'workspace-b', title: 'B', path: '/workspaces/b', sessionIds: ['session-b'] },
  ];
  const ctx = {
    get(name) { return name === 'cordisInspect' ? { register(provider) {
      for (const method of provider.manifest.methods) {
        toolsPackage.assertSupportedJsonSchema(method.inputSchema);
        toolsPackage.assertSupportedJsonSchema(method.outputSchema);
      }
      inspectProviders.set(provider.manifest.id, provider);
      return () => inspectProviders.delete(provider.manifest.id);
    } } : undefined; },
    storageDomain: { async open(value) {
      spec = value;
      for (const [name, declaration] of Object.entries(spec.tables)) {
        assert.equal(typeof declaration.valueSchema.parse, 'function');
        const rows = new Map();
        tables.set(name, {
          get(key) { const row = rows.get(key); return row === undefined ? undefined : clone(row); },
          entries() { return [...rows].map(([key, row]) => [key, clone(row)]); },
          async put(key, value) {
            // Validation is deliberately before mutation, just like the real domain.
            const parsed = declaration.valueSchema.parse(value);
            if (options.failWrite?.(name, key, parsed)) throw Error('Mock durability failure');
            rows.set(key, clone(parsed)); writes.push({ name, key, value: clone(parsed) });
          },
          async delete(key) { rows.delete(key); },
        });
      }
      return { table(name) { assert.ok(tables.has(name)); return tables.get(name); }, async close() { closed = true; } };
    } },
    workspaceRegistry: { list: () => clone(workspaces), get: id => clone(workspaces.find(w => w.id === id)) },
    agents: {},
    connection: { requestRejection(request) { authRequests.push(request); return options.rejection; } },
    effect(factory, label) { const dispose = factory(); effects.push({ label, dispose }); return dispose; },
    on(event, handler) { const list = handlers.get(event) || []; list.push(handler); handlers.set(event, list); return () => {}; },
    provide(name, value) { provided.set(name, value); },
    tools: { register(tool) {
      // defineTool already compiled its author DSL; additionally model the real
      // registry boundary rather than silently accepting arbitrary definitions.
      toolsPackage.assertObjectJsonSchema(tool.parameters);
      toolsPackage.assertSupportedJsonSchema(tool.output.schema);
      assert.equal(typeof tool.execute, 'function');
      // DSH requires render to return an array of content blocks. Returning a bare
      // string fails only at runtime, deep inside the tool-result pipeline.
      const blocks = tool.output.render({ operation: 'search' }, [{ id: 'x', revision: 1, history: [{ revision: 1 }], content: 'y' }]);
      assert.ok(Array.isArray(blocks), 'output.render must return content blocks, not a string');
      for (const block of blocks) assert.equal(typeof block.text, 'string');
      tools.push(tool); return () => {};
    } },
    systemPrompt: {
      context(value) { contexts.push(value); return () => {}; },
      section(value) { sections.push(value); return () => {}; },
    },
    webServer: { register(route) {
      if (routes.some(r => r.kind === route.kind && r.path === route.path)) throw Error('Duplicate route');
      routes.push(route);
      return () => { const index = routes.indexOf(route); if (index >= 0) routes.splice(index, 1); };
    } },
  };
  await host.apply(ctx);
  const service = provided.get('workspaceMemory');
  assert.ok(service, 'apply must provide workspaceMemory');
  async function emit(event, ...args) {
    for (const handler of handlers.get(event) || []) await handler(...args);
  }
  // Waterfall next returns an asynchronously-resolved downstream result. It is
  // not a callback that merely mutates the first argument.
  async function waterfall(event, args, result) {
    const chain = handlers.get(event) || [];
    const dispatch = async index => index === chain.length ? await Promise.resolve(result) :
      await chain[index](...args, async () => await dispatch(index + 1));
    return dispatch(0);
  }
  function agent(id = 'session-a', messages = []) {
    return { id, session: { deriveMessages: () => clone(messages) }, inbox: { nextTurn: [], nextStep: [] } };
  }
  async function call(args, who = agent(), signal = new AbortController().signal) {
    assert.equal(tools.length, 1); return tools[0].execute(args, { agent: who, signal });
  }
  async function confirmed(workspaceId = 'workspace-a', input = {}) {
    const proposed = await service.invoke('create', { workspaceId, input: { title: 'Orchard', content: 'Use orchard apples.', ...input } });
    return service.invoke('approve', { workspaceId, id: proposed.id, expectedRevision: proposed.revision });
  }
  async function request(operation = 'workspaces', args = {}, overrides = {}) {
    const payload = overrides.rawBody ?? JSON.stringify({ operation, args });
    const req = Readable.from([payload]);
    req.method = overrides.method ?? 'POST';
    req.headers = { host: '127.0.0.1:19387', origin: 'http://127.0.0.1:19387', 'x-workspace-memory': '1', ...overrides.headers };
    req.socket = { remoteAddress: overrides.remoteAddress ?? '127.0.0.1' };
    const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); } };
    const route = routes.find(r => r.path === '/workspace-memory/api');
    assert.ok(route); await route.handler(req, res); return { req, ...res };
  }
  async function prompt(who) { return await contexts.find(c => c.name === 'workspace-memory').text({ agent: who }); }
  return { host, ctx, spec, tables, tools, contexts, sections, effects, provided, routes, handlers, writes, authRequests, inspectProviders, service, emit, waterfall, agent, call, confirmed, request, prompt, get closed() { return closed; } };
}
module.exports = { createHarness };

const user = text => ({ role: 'user', content: [{ type: 'text', text }] });

test('apply uses real schema/tool registration and tracks domain disposal', async () => {
  const h = await createHarness();
  assert.equal(h.spec.name, 'workspace_memory');
  assert.deepEqual(Object.keys(h.spec.tables).sort(), ['memories', 'settings', 'usage']);
  assert.equal(h.tools[0].name, 'workspace_memory');
  assert.match(h.sections[0].text, /explicit user request/i);
  assert.ok(h.effects.some(e => /storage/.test(e.label)));
  for (const effect of h.effects) await effect.dispose();
  assert.equal(h.closed, true);
  assert.equal(h.routes.length, 0, 'disposal must release the HTTP route for reactivation');
  assert.equal(h.inspectProviders.size, 0, 'disposal must release the inspection provider');
});

test('disclosure query scopes turn zero instead of returning other turns', async () => {
  const h = await createHarness();
  for (const turn of [0, 1]) await h.tables.get('usage').put('turn-' + turn, {
    workspaceId: 'workspace-a', sessionId: 'session-a', turn, step: 1,
    at: '2026-10-04T00:00:00Z', state: 'prepared', selected: [], overflow: [], usedChars: 0, enabled: true,
  });
  const rows = await h.service.invoke('usage', { workspaceId: 'workspace-a', sessionId: 'session-a', turn: 0 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].turn, 0);
});

test('context preview honors injection settings and session exclusions', async () => {
  const h = await createHarness(), record = await h.confirmed('workspace-a', { pinned: true });
  assert.equal((await h.service.invoke('preview', { workspaceId: 'workspace-a', query: '' })).records.length, 1);
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', sessionId: 'session-a', value: { ...SETTINGS, excluded: [record.id] } });
  assert.equal((await h.service.invoke('preview', { workspaceId: 'workspace-a', sessionId: 'session-a', query: '' })).records.length, 0);
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: { ...SETTINGS, enabled: false } });
  assert.equal((await h.service.invoke('preview', { workspaceId: 'workspace-a', query: '' })).records.length, 0);
});

test('storage adapter validates strict table schemas before put', async () => {
  const h = await createHarness();
  await assert.rejects(h.tables.get('settings').put('workspace:workspace-a', { ...SETTINGS, alien: true }));
  await assert.rejects(h.tables.get('settings').put('workspace:workspace-a', { ...SETTINGS, budgetChars: 999 }));
  assert.equal(h.tables.get('settings').get('workspace:workspace-a'), undefined);
  const record = await h.confirmed();
  assert.equal(record.history.length, 2);
  await assert.rejects(h.tables.get('memories').put(JSON.stringify(['workspace-a', record.id]), { ...record, revision: 0 }));
  assert.equal(h.service.store.get('workspace-a', record.id).revision, 2);
});

test('workspace and session ownership protects service calls and record identity', async () => {
  const h = await createHarness(), record = await h.confirmed('workspace-b');
  await assert.rejects(h.service.invoke('list', { workspaceId: 'unknown' }), /Unknown workspace/);
  await assert.rejects(h.service.invoke('settings', { workspaceId: 'workspace-a', sessionId: 'session-b' }), /does not belong/);
  assert.equal(await h.call({ operation: 'get', id: record.id }), null);
  await assert.rejects(h.call({ operation: 'remove', id: record.id, expectedRevision: 2, userRequested: true }), /not found/i);
  await assert.rejects(h.call({ operation: 'search' }, h.agent('unregistered')), /No registered workspace/);
  await assert.rejects(h.call({ operation: 'search' }, null), /Agent required/);
  assert.equal(h.service.store.get('workspace-b', record.id).revision, 2);
});

test('real defineTool validates required operation, enums and types', async () => {
  const h = await createHarness();
  for (const args of [{}, { operation: 'approve' }, { operation: 'remember', userRequested: 'true' }, { operation: 'propose', kind: 'admin' }]) {
    await assert.rejects(h.call(args), error => error.code === 'INVALID_ARGS');
  }
  assert.equal(h.service.store.list('workspace-a').length, 0);
});

test('global memory reaches every workspace, is labelled, and never leaks workspace records', async () => {
  const h = await createHarness();
  const local = await h.confirmed('workspace-a', { content: 'Local only note.' });
  const created = await h.service.invoke('create', { scope: 'global', input: { kind: 'instruction', pinned: true, title: 'Reading level', content: 'Write at a high school reading level.' } });
  const shared = await h.service.invoke('approve', { scope: 'global', id: created.id, expectedRevision: created.revision });
  assert.equal(shared.workspaceId, 'global');
  // The two scopes can never read each other's records.
  assert.deepEqual((await h.service.invoke('list', { workspaceId: 'workspace-a' })).map(r => r.id), [local.id]);
  assert.deepEqual((await h.service.invoke('list', { scope: 'global' })).map(r => r.id), [shared.id]);
  assert.equal(await h.service.invoke('get', { workspaceId: 'workspace-a', id: shared.id }), null);
  assert.equal(await h.service.invoke('get', { scope: 'global', id: local.id }), null);
  // Both workspaces receive it in the new-chat context; the project record stays local.
  const a = JSON.parse(await h.prompt(h.agent('session-a'))), b = JSON.parse(await h.prompt(h.agent('session-b')));
  assert.deepEqual(a.instructions.map(r => [r.scope, r.id]), [['global', shared.id]]);
  assert.deepEqual(b.instructions.map(r => [r.id]), [[shared.id]]);
  assert.ok(a.references.some(r => r.id === local.id));
  assert.ok(!b.references.some(r => r.id === local.id));
  assert.match(a.framing, /overrides a "global" entry/);
  // Session exclusion still applies to a global entry.
  await h.service.invoke('setSettings', { workspaceId: 'workspace-b', sessionId: 'session-b', value: { ...SETTINGS, excluded: [shared.id] } });
  assert.equal(await h.prompt(h.agent('session-b')), '');
  // Disclosure records which scope each selected entry came from.
  const who = h.agent('session-a');
  await h.prompt(who);
  await h.waterfall('agent/pre-step', [{ agent: who, turn: 3, step: 1 }], { kind: 'continue' });
  const rows = await h.service.invoke('usage', { workspaceId: 'workspace-a', sessionId: who.id, turn: 3 });
  assert.deepEqual([...new Set(rows.flatMap(row => row.selected.map(entry => entry.scope)))].sort(), ['global', 'workspace']);
});

test('the memory tool writes global memory but only cross-project kinds, and cannot name a workspace', async () => {
  const h = await createHarness(), who = h.agent();
  const record = await h.call({ operation: 'remember', scope: 'global', kind: 'instruction', pinned: true, title: 'Reading level', content: 'Write at a high school reading level.', userRequested: true }, who);
  assert.equal(record.workspaceId, 'global');
  assert.equal(record.status, 'confirmed');
  assert.deepEqual((await h.call({ operation: 'search', scope: 'global' }, who)).map(r => r.id), [record.id]);
  assert.deepEqual(await h.call({ operation: 'search' }, who), []);
  for (const args of [
    { operation: 'remember', scope: 'global', kind: 'decision', title: 'X', content: 'Y', userRequested: true },
    { operation: 'remember', scope: 'global', kind: 'working-state', title: 'X', content: 'Y', userRequested: true },
    { operation: 'update', scope: 'global', id: record.id, kind: 'decision', expectedRevision: record.revision, userRequested: true },
  ]) await assert.rejects(h.call(args, who), /only accepts instruction or fact/);
  assert.equal((await h.call({ operation: 'get', scope: 'global', id: record.id }, who)).kind, 'instruction');
  // A scope value can never be a workspace id, so ownership cannot be redirected.
  await assert.rejects(h.call({ operation: 'search', scope: 'workspace-b' }, who), error => error.code === 'INVALID_ARGS');
  const foreign = await h.confirmed('workspace-b', { content: 'Foreign secret.' });
  assert.equal(await h.call({ operation: 'get', scope: 'global', id: foreign.id }, who), null);
  assert.deepEqual(await h.call({ operation: 'search', query: 'Foreign' }, who), []);
  // Global writes still need an explicit user request.
  await assert.rejects(h.call({ operation: 'remember', scope: 'global', kind: 'fact', title: 'A', content: 'B' }, who), /Explicit user request required/);
});

test('conversation remember/propose/update/remove authorization and optimistic revisions', async () => {
  const h = await createHarness();
  for (const operation of ['remember', 'update', 'remove']) {
    await assert.rejects(h.call({ operation, title: 'Preference', content: 'Concise answers.' }), /Explicit user request/);
  }
  const proposal = await h.call({ operation: 'propose', title: 'Preference', content: 'Concise answers.' });
  assert.equal(proposal.status, 'proposed');
  assert.deepEqual(proposal.source, { session: 'session-a', origin: 'suggestion' });
  const remembered = await h.call({ operation: 'remember', title: 'Preference', content: 'Use concise answers.', userRequested: true });
  assert.equal(remembered.status, 'confirmed');
  assert.equal(remembered.source.origin, 'user-request');
  await assert.rejects(h.call({ operation: 'update', id: remembered.id, content: 'Long answers.', expectedRevision: 1, userRequested: true }), error => error.code === 'REVISION_CONFLICT');
  const updated = await h.call({ operation: 'update', id: remembered.id, content: 'Short answers.', expectedRevision: remembered.revision, userRequested: true });
  assert.equal(updated.status, 'confirmed');
  assert.equal(updated.content, 'Short answers.');
  await assert.rejects(h.call({ operation: 'remove', id: updated.id, userRequested: true }), /expectedRevision/);
  assert.equal(await h.call({ operation: 'remove', id: updated.id, expectedRevision: updated.revision, userRequested: true }), true);
  assert.equal(await h.call({ operation: 'get', id: updated.id }), null);
});

test('conversation restore remains proposed and cancellation prevents mutation', async () => {
  const h = await createHarness(), record = await h.confirmed();
  const restored = await h.call({ operation: 'restore', id: record.id, targetRevision: 1, expectedRevision: record.revision });
  assert.equal(restored.status, 'proposed');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.call({ operation: 'remember', title: 'Abort', content: 'Never save.', userRequested: true }, h.agent(), controller.signal), { name: 'AbortError' });
  assert.equal(h.service.store.list('workspace-a').length, 1);
});

test('conversational tool has no workspace/session inputs and cannot cross ownership', async () => {
  const h = await createHarness();
  for (const key of ['workspaceId', 'sessionId']) assert.equal(Object.hasOwn(h.tools[0].parameters.properties, key), false);
  const foreign = await h.confirmed('workspace-b', { title: 'Foreign secret', content: 'Secret banana.' });
  // Unknown fields may be allowed by the actual package's open parameter root;
  // either reject them or ignore them, but never honor an ownership override.
  for (const extra of [{ workspaceId: 'workspace-b' }, { sessionId: 'session-b' }]) {
    try { assert.equal(await h.call({ operation: 'get', id: foreign.id, ...extra }), null); }
    catch (error) { assert.equal(error.code, 'INVALID_ARGS'); }
  }
  assert.deepEqual(await h.call({ operation: 'search', query: 'Secret' }), []);
});

test('session settings override workspace settings, suppress suggestions and reset', async () => {
  const h = await createHarness();
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: { ...SETTINGS, enabled: false } });
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', sessionId: 'session-a', value: { ...SETTINGS, suggestions: false } });
  assert.equal((await h.service.invoke('settings', { workspaceId: 'workspace-a', sessionId: 'session-a' })).enabled, true);
  await assert.rejects(h.call({ operation: 'propose', title: 'Disabled', content: 'Suggestion.' }), /Suggestions disabled/);
  assert.equal((await h.service.invoke('settings', { workspaceId: 'workspace-a', sessionId: 'session-a2' })).enabled, false);
  const reset = await h.service.invoke('resetSession', { workspaceId: 'workspace-a', sessionId: 'session-a' });
  assert.equal(reset.enabled, false); assert.equal(reset.suggestions, true);
});

test('API injects connection and checks browser authentication before operations', async () => {
  const h = await createHarness({ rejection: 401 });
  assert.ok(h.host.inject.includes('connection'), 'connection must be injected');
  const response = await h.request('create', { workspaceId: 'workspace-a', input: { title: 'Unauthorized', content: 'Must not save.' } });
  assert.equal(response.statusCode, 401);
  assert.equal(h.authRequests.length, 1);
  assert.equal(h.authRequests[0], response.req);
  assert.equal(h.service.store.list('workspace-a').length, 0);
});

test('API forwards connection CSRF rejection and enforces local POST/custom header/origin', async () => {
  const refused = await createHarness({ rejection: 403 });
  assert.equal((await refused.request()).statusCode, 403);
  const h = await createHarness();
  for (const overrides of [
    { method: 'GET' }, { headers: { 'x-workspace-memory': undefined } },
    { headers: { origin: 'https://evil.example' } }, { headers: { host: 'evil.example:19387' } },
    { remoteAddress: '203.0.113.1' },
  ]) assert.equal((await h.request('workspaces', {}, overrides)).statusCode, 403);
  const valid = await h.request();
  assert.equal(valid.statusCode, 200); assert.equal(valid.body.result.length, 2);
  assert.equal(valid.headers['cache-control'], 'no-store');
});

test('authenticated API validates JSON, size, operations and workspace/session pairing', async () => {
  const h = await createHarness();
  for (const response of [
    await h.request('workspaces', {}, { rawBody: '{broken' }),
    await h.request('workspaces', {}, { rawBody: 'x'.repeat(100001) }),
    await h.request('not-an-operation', { workspaceId: 'workspace-a' }),
    await h.request('settings', { workspaceId: 'workspace-a', sessionId: 'session-b' }),
  ]) { assert.equal(response.statusCode, 400); assert.equal(typeof response.body.error, 'string'); }
});

test('prompt retrieval uses claimed/pending users, frames untrusted data and isolates workspace', async () => {
  const h = await createHarness();
  const apple = await h.confirmed('workspace-a', { title: 'Orchard apple', content: 'Apples from the orchard.' });
  await h.confirmed('workspace-b', { title: 'Orchard foreign', content: 'Foreign private apple.' });
  await h.service.invoke('create', { workspaceId: 'workspace-a', input: { title: 'Orchard proposed', content: 'Unapproved apple.' } });
  const who = h.agent('session-a', [user('irrelevant topic')]);
  who.inbox.nextStep.push(user('orchard'));
  await h.emit('agent/inbox/claimed', { agent: who, message: user('apple') });
  const text = await h.prompt(who), parsed = JSON.parse(text);
  assert.match(parsed.framing, /untrusted/);
  assert.deepEqual(parsed.references.map(r => r.id), [apple.id]);
  assert.ok(!text.includes('Foreign private') && !text.includes('Unapproved'));
  assert.equal(await h.prompt(h.agent('unknown')), '');
});

test('new-chat context reaches the real DSH renderer without interpolating literal memory', async () => {
  const { renderContextSections } = await import('@deepseek-ai/dsh-system-prompt');
  const h = await createHarness();
  const content = 'Never resolve {{secret:ref}}, {{known}}, or {{{nested}}} from memory.';
  await h.confirmed('workspace-a', { pinned: true, content });
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: SETTINGS });
  const who = h.agent(), text = await h.prompt(who);
  const initial = { sections: [], contexts: [{ name: 'workspace-memory', text }], tools: [], variables: { known: 'SHOULD NOT APPEAR' } };
  const assembled = await h.waterfall('system-prompt/assemble', [initial, { agent: who }], initial);
  const rendered = renderContextSections(assembled);
  assert.equal(JSON.parse(rendered[0].text).references[0].content, content);
  assert.ok(!rendered[0].text.includes('{{'));
});

test('semantic replacement also reaches the real renderer safely', async t => {
  const { renderContextSections } = await import('@deepseek-ai/dsh-system-prompt');
  t.mock.method(globalThis, 'fetch', async (_url, options) => ({ ok: true, json: async () => ({ embeddings: JSON.parse(options.body).input.map(() => [1, 0]) }) }));
  const h = await createHarness();
  const content = 'A saved literal {{secret:ref}} and {{known}}.';
  await h.confirmed('workspace-a', { content });
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: { ...SETTINGS, semantic: true } });
  const who = h.agent('session-a', [user('unrelated query')]);
  const initial = { sections: [], contexts: [{ name: 'workspace-memory', text: await h.prompt(who) }], tools: [], variables: {} };
  assert.equal(initial.contexts[0].text, '', 'fixture requires semantic-only selection');
  const assembled = await h.waterfall('system-prompt/assemble', [initial, { agent: who }], initial);
  assert.equal(JSON.parse(renderContextSections(assembled)[0].text).references[0].content, content);
});

test('live runtime inspection validates stored/new-chat contexts without writes or disclosure', async () => {
  const h = await createHarness();
  await h.confirmed('workspace-a', { pinned: true, content: 'Private {{secret:ref}} text.' });
  await h.confirmed('workspace-b', { pinned: true, content: 'Foreign {{other:ref}} text.' });
  const writesBefore = h.writes.length;
  const status = h.inspectProviders.get('WorkspaceMemory').query();
  assert.equal(status.fixturePassed, true);
  assert.equal(status.literalDataPreserved, true);
  assert.equal(status.eligibleRecordsChecked, 2);
  assert.equal(status.newChatContextsChecked, 2);
  assert.equal(h.writes.length, writesBefore, 'diagnostic cannot mutate durable state');
  assert.ok(!JSON.stringify(status).includes('Private') && !JSON.stringify(status).includes('Foreign'));
});

test('tool results render as content blocks for every operation, without history', async () => {
  const h = await createHarness(), record = await h.confirmed();
  const who = h.agent();
  const check = (args, value) => {
    const blocks = h.tools[0].output.render(args, value);
    assert.ok(Array.isArray(blocks) && blocks.length > 0, `${args.operation} must render content blocks`);
    for (const block of blocks) { assert.equal(block.type, 'text'); assert.equal(typeof block.text, 'string'); }
    assert.ok(!blocks.some(block => block.text.includes('"history"')), `${args.operation} must not dump revision history`);
    assert.doesNotThrow(() => JSON.parse(blocks.map(block => block.text).join('')));
    return blocks.map(block => block.text).join('');
  };
  const calls = [
    { operation: 'search', query: 'orchard' },
    { operation: 'get', id: record.id },
    { operation: 'remember', title: 'Second memory', content: 'Another useful note.', userRequested: true },
    { operation: 'update', id: record.id, content: 'Use orchard pears.', expectedRevision: record.revision, userRequested: true },
  ];
  let latest;
  for (const args of calls) { latest = await h.call(args, who); check(args, latest); }
  // Every mutation returns the durable record: no revision is guessed here.
  check({ operation: 'remove', id: record.id, expectedRevision: latest.revision, userRequested: true },
    await h.call({ operation: 'remove', id: record.id, expectedRevision: latest.revision, userRequested: true }, who));
  assert.match(check({ operation: 'search' }, await h.call({ operation: 'search' }, who)), /Second memory/);
  const long = await h.service.invoke('create', { workspaceId: 'workspace-a', input: { title: 'Long', content: 'x'.repeat(2000) } });
  assert.match(check({ operation: 'search' }, [long]), /2000 characters total/);
});

test('async pre-step records prepared disclosure and stream start marks started', async () => {
  const h = await createHarness(), record = await h.confirmed();
  const who = h.agent('session-a', [user('orchard')]);
  const text = await h.prompt(who);
  const decision = { kind: 'continue', marker: 'downstream' };
  assert.equal(await h.waterfall('agent/pre-step', [{ agent: who, turn: 7, step: 2 }], decision), decision);
  let rows = await h.service.invoke('usage', { workspaceId: 'workspace-a', sessionId: who.id, turn: 7 });
  assert.equal(rows.length, 1); assert.equal(rows[0].state, 'prepared');
  assert.deepEqual(rows[0].selected.map(r => [r.id, r.revision]), [[record.id, record.revision]]);
  assert.equal(rows[0].usedChars, text.length);
  await h.emit('agent/assistant-stream', { agent: who, frame: { type: 'delta', turn: 7, step: 2 } });
  assert.equal(h.tables.get('usage').get(JSON.stringify([who.id, 7, 2])).state, 'prepared');
  await h.emit('agent/assistant-stream', { agent: who, frame: { type: 'start', turn: 7, step: 2 } });
  assert.equal(h.tables.get('usage').get(JSON.stringify([who.id, 7, 2])).state, 'started');
  const rejected = { kind: 'reject', reason: 'downstream veto' };
  assert.equal(await h.waterfall('agent/pre-step', [{ agent: who, turn: 8, step: 1 }], rejected), rejected);
  assert.equal(h.tables.get('usage').get(JSON.stringify([who.id, 8, 1])), undefined);
});

test('assembled retained memory context preserves selection and disclosure durability failures reject pre-step', async () => {
  const h = await createHarness({ failWrite: name => name === 'usage' });
  const record = await h.confirmed();
  const who = h.agent('session-a', [user('orchard')]);
  const text = await h.prompt(who);
  const assembly = { contexts: [{ name: 'workspace-memory', text }] };
  assert.equal(await h.waterfall('system-prompt/assemble', [{ contexts: [] }, { agent: who }], assembly), assembly);
  await assert.rejects(h.waterfall('agent/pre-step', [{ agent: who, turn: 1, step: 1 }], { kind: 'continue' }), /Mock durability failure/);
  assert.deepEqual(h.tables.get('usage').entries(), []);
  assert.equal(h.service.store.get('workspace-a', record.id).status, 'confirmed');
});

test('failed durable memory writes never report success or change authoritative state', async () => {
  let fail = false;
  const h = await createHarness({ failWrite: name => name === 'memories' && fail });
  const record = await h.confirmed();
  fail = true;
  await assert.rejects(h.call({ operation: 'update', id: record.id, expectedRevision: record.revision, content: 'Changed', userRequested: true }), /Mock durability failure/);
  assert.equal(h.service.store.get('workspace-a', record.id).revision, record.revision);
  assert.equal(h.service.store.get('workspace-a', record.id).content, record.content);
  await assert.rejects(h.call({ operation: 'remember', title: 'Failed', content: 'No claim of success', userRequested: true }), /Mock durability failure/);
  assert.equal(h.service.store.list('workspace-a').length, 1);
});

test('suppressed assembled context clears stale selection before disclosure', async () => {
  const h = await createHarness(); await h.confirmed();
  const who = h.agent('session-a', [user('orchard')]);
  assert.notEqual(await h.prompt(who), '');
  const assembly = { contexts: [{ name: 'another-plugin', text: 'Other context' }] };
  assert.equal(await h.waterfall('system-prompt/assemble', [{ contexts: [] }, { agent: who }], assembly), assembly);
  await h.waterfall('agent/pre-step', [{ agent: who, turn: 1, step: 1 }], { kind: 'continue' });
  const [row] = await h.service.invoke('usage', { workspaceId: 'workspace-a' });
  assert.deepEqual(row.selected, []); assert.deepEqual(row.overflow, []); assert.equal(row.usedChars, 0);
});

test('disabled injection, exclusion, expired/disabled entries and budget overflow are disclosed accurately', async () => {
  const h = await createHarness();
  const excluded = await h.confirmed('workspace-a', { pinned: true });
  await h.confirmed('workspace-a', { title: 'Expired orchard', content: 'Old apple.', expiresAt: '2000-01-01T00:00:00Z' });
  await h.confirmed('workspace-a', { title: 'Disabled orchard', content: 'Hidden apple.', enabled: false });
  const large = await h.confirmed('workspace-a', { title: 'Oversized orchard', content: 'apple '.repeat(1000), pinned: true });
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: { ...SETTINGS, budgetChars: 1000, excluded: [excluded.id] } });
  const who = h.agent('session-a', [user('orchard')]);
  assert.equal(await h.prompt(who), '');
  await h.waterfall('agent/pre-step', [{ agent: who, turn: 1, step: 1 }], { kind: 'continue' });
  const first = h.tables.get('usage').get(JSON.stringify([who.id, 1, 1]));
  assert.deepEqual(first.selected, []);
  assert.deepEqual(first.overflow, [{ id: large.id, reason: 'budget', pinned: true }]);
  await h.service.invoke('setSettings', { workspaceId: 'workspace-a', value: { ...SETTINGS, enabled: false } });
  assert.equal(await h.prompt(who), '');
  await h.waterfall('agent/pre-step', [{ agent: who, turn: 2, step: 1 }], { kind: 'continue' });
  const second = h.tables.get('usage').get(JSON.stringify([who.id, 2, 1]));
  assert.equal(second.enabled, false); assert.deepEqual(second.selected, []); assert.deepEqual(second.overflow, []);
});
