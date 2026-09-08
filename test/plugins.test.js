const test = require('node:test');
const assert = require('node:assert');
const { parsePlugin, pluginById, CT_PLUGIN_MAX_BYTES } = require('../src/lib/plugins.js');

const good = () => ({ id: 'demo', name: 'Demo', version: '1.0.0', probe: 'void 0;' });

test('a minimal plugin parses', () => {
  const r = parsePlugin(good());
  assert.equal(r.ok, true);
  assert.equal(r.plugin.id, 'demo');
  assert.equal(r.plugin.page, null);
  assert.deepEqual(r.plugin.suggestedOrigins, []);
  assert.deepEqual(r.plugin.skins, []);
});

test('a JSON string is accepted as well as an object', () => {
  assert.equal(parsePlugin(JSON.stringify(good())).ok, true);
  assert.equal(parsePlugin('{not json').ok, false);
});

test('id must be a safe slug, because it becomes part of a registration id', () => {
  for (const id of ['', 'A', 'has space', 'has/slash', '_lead', '-lead', 'x'.repeat(33), 'dot.dot']) {
    const r = parsePlugin(Object.assign(good(), { id }));
    assert.equal(r.ok, false, JSON.stringify(id));
  }
  assert.equal(parsePlugin(Object.assign(good(), { id: 'a' })).ok, true);
  assert.equal(parsePlugin(Object.assign(good(), { id: 'a-b-9' })).ok, true);
});

test('probe is required and must be a non-empty string', () => {
  assert.equal(parsePlugin(Object.assign(good(), { probe: undefined })).ok, false);
  assert.equal(parsePlugin(Object.assign(good(), { probe: '   ' })).ok, false);
  assert.equal(parsePlugin(Object.assign(good(), { probe: 42 })).ok, false);
});

test('page is optional but must be a string when present', () => {
  assert.equal(parsePlugin(Object.assign(good(), { page: 'void 0;' })).plugin.page, 'void 0;');
  assert.equal(parsePlugin(Object.assign(good(), { page: 42 })).ok, false);
});

test('suggested origins are normalized and bad ones rejected', () => {
  const r = parsePlugin(Object.assign(good(), { suggestedOrigins: ['https://Example.com/x', 'https://example.com'] }));
  assert.deepEqual(r.plugin.suggestedOrigins, ['https://example.com']);
  assert.equal(parsePlugin(Object.assign(good(), { suggestedOrigins: ['ftp://x.test'] })).ok, false);
  assert.equal(parsePlugin(Object.assign(good(), { suggestedOrigins: 'nope' })).ok, false);
});

test('skins must be complete when present', () => {
  const skin = { id: 's', name: 'S', title: 'T', favicon: 'data:,', html: '<div class="ct-root"></div>', css: '' };
  assert.equal(parsePlugin(Object.assign(good(), { skins: [skin] })).plugin.skins.length, 1);
  const { html, ...missingHtml } = skin;
  assert.equal(parsePlugin(Object.assign(good(), { skins: [missingHtml] })).ok, false);
  assert.equal(parsePlugin(Object.assign(good(), { skins: {} })).ok, false);
});

test('an oversized plugin is rejected rather than filling storage', () => {
  const r = parsePlugin(Object.assign(good(), { probe: 'x'.repeat(CT_PLUGIN_MAX_BYTES + 1) }));
  assert.equal(r.ok, false);
  assert.match(r.error, /too large/i);
});

test('unknown top-level keys are dropped, not carried', () => {
  const r = parsePlugin(Object.assign(good(), { evil: 'x' }));
  assert.equal(r.ok, true);
  assert.equal('evil' in r.plugin, false);
});

test('lookup by id', () => {
  const p = parsePlugin(good()).plugin;
  assert.equal(pluginById([p], 'demo').id, 'demo');
  assert.equal(pluginById([p], 'nope'), null);
  assert.equal(pluginById(null, 'demo'), null);
});

test('the size cap counts bytes, not UTF-16 code units', () => {
  const good = { id: 'demo', name: 'Demo', version: '1.0.0', probe: 'void 0;' };
  // Each of these is one UTF-16 unit but three UTF-8 bytes, so a length-based cap would
  // let roughly three times the intended payload through.
  const wide = '中'.repeat(Math.ceil(CT_PLUGIN_MAX_BYTES / 3) + 10);
  const r = parsePlugin(Object.assign({}, good, { probe: wide }));
  assert.equal(r.ok, false);
  assert.match(r.error, /too large/i);
});

test('an oversized JSON string is refused before it is parsed', () => {
  const r = parsePlugin('{"id":"demo","probe":"' + 'x'.repeat(CT_PLUGIN_MAX_BYTES) + '"}');
  assert.equal(r.ok, false);
  assert.match(r.error, /too large/i);
});

test('a plugin skin keeps its alert variants through import', () => {
  const skin = { id: 's', name: 'S', title: 'T', titleAlertPrefix: '! ',
                 favicon: 'data:,a', faviconAlert: 'data:,b',
                 html: '<div class="ct-root"></div>', css: '' };
  const got = parsePlugin(Object.assign(good(), { skins: [skin] })).plugin.skins[0];
  assert.equal(got.titleAlertPrefix, '! ');
  assert.equal(got.faviconAlert, 'data:,b');
});

test('a plugin skin without alert variants gets empty ones, not missing keys', () => {
  const skin = { id: 's', name: 'S', title: 'T', favicon: 'data:,a',
                 html: '<div class="ct-root"></div>', css: '' };
  const got = parsePlugin(Object.assign(good(), { skins: [skin] })).plugin.skins[0];
  assert.equal(got.titleAlertPrefix, '');
  assert.equal(got.faviconAlert, '');
});

test('a non-string alert variant is rejected rather than coerced', () => {
  const skin = { id: 's', name: 'S', title: 'T', favicon: 'data:,a',
                 faviconAlert: 42, html: '<div class="ct-root"></div>', css: '' };
  assert.equal(parsePlugin(Object.assign(good(), { skins: [skin] })).ok, false);
});
