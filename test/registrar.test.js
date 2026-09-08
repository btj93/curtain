const test = require('node:test');
const assert = require('node:assert');
const { normalizeProfile } = require('../src/lib/profiles.js');
const { CT_ENGINE_ID, CT_KEEPALIVE_ID, desiredRegistrations } = require('../src/registrar.js');

const GRANTED = ['https://example.com', 'https://example.org'];
const profile = (over) => normalizeProfile(Object.assign({ id: 'a', origins: ['https://example.com'] }, over));

test('no profiles means no registrations', () => {
  assert.deepEqual(desiredRegistrations([], GRANTED), []);
});

test('an enabled profile registers the engine at document_start in the isolated world', () => {
  const [engine] = desiredRegistrations([profile()], GRANTED);
  assert.equal(engine.id, CT_ENGINE_ID);
  assert.deepEqual(engine.matches, ['https://example.com/*']);
  assert.equal(engine.world, 'ISOLATED');
  assert.equal(engine.runAt, 'document_start');
  assert.equal(engine.allFrames, false);
  assert.equal(engine.js[engine.js.length - 1], 'src/content.js');
});

test('keep-alive registers in the main world only for profiles that enabled it', () => {
  const keep = desiredRegistrations([profile()], GRANTED).find((r) => r.id === CT_KEEPALIVE_ID);
  assert.equal(keep.world, 'MAIN');
  assert.equal(keep.allFrames, true);
  assert.deepEqual(keep.matches, ['https://example.com/*']);
  assert.deepEqual(keep.js, ['src/keepalive.js']);

  const off = desiredRegistrations([profile({ options: { keepAlive: false } })], GRANTED);
  assert.equal(off.find((r) => r.id === CT_KEEPALIVE_ID), undefined);
  assert.equal(off.length, 1);
});

test('disabled profiles and ungranted origins are excluded', () => {
  assert.deepEqual(desiredRegistrations([profile({ enabled: false })], GRANTED), []);
  assert.deepEqual(desiredRegistrations([profile()], []), []);
});

test('only the granted subset of a profile is registered', () => {
  const p = profile({ origins: ['https://example.com', 'https://ungranted.test'] });
  const [engine] = desiredRegistrations([p], GRANTED);
  assert.deepEqual(engine.matches, ['https://example.com/*']);
});

test('origins from several profiles are unioned without duplicates', () => {
  const ps = [
    profile({ id: 'a', origins: ['https://example.com'] }),
    profile({ id: 'b', origins: ['https://example.com', 'https://example.org'] }),
  ];
  const [engine] = desiredRegistrations(ps, GRANTED);
  assert.deepEqual(engine.matches, ['https://example.com/*', 'https://example.org/*']);
});

const { desiredUserScripts } = require('../src/registrar.js');
const PLUGINS = [
  { id: 'alpha', probe: 'A;', page: 'AP;' },
  { id: 'beta', probe: 'B;', page: null },
];

test('a profile with no plugin registers no user scripts', () => {
  assert.deepEqual(desiredUserScripts([profile()], PLUGINS, GRANTED), []);
});

test('a profile naming a plugin registers its probe in the user-script world', () => {
  const p = profile({ pluginId: 'alpha' });
  const regs = desiredUserScripts([p], PLUGINS, GRANTED);
  const probe = regs.find((r) => r.id === 'curtain-probe-alpha');
  assert.deepEqual(probe.matches, ['https://example.com/*']);
  assert.equal(probe.world, 'USER_SCRIPT');
  assert.equal(probe.runAt, 'document_start');
  assert.deepEqual(probe.js, [{ code: 'A;' }]);
});

test('a page script registers in the main world, and is omitted when absent', () => {
  const withPage = desiredUserScripts([profile({ pluginId: 'alpha' })], PLUGINS, GRANTED);
  const page = withPage.find((r) => r.id === 'curtain-page-alpha');
  assert.equal(page.world, 'MAIN');
  assert.deepEqual(page.js, [{ code: 'AP;' }]);

  const noPage = desiredUserScripts([profile({ pluginId: 'beta' })], PLUGINS, GRANTED);
  assert.equal(noPage.find((r) => r.id === 'curtain-page-beta'), undefined);
  assert.equal(noPage.length, 1);
});

test('each plugin gets only the origins of the profiles that name it', () => {
  const ps = [
    profile({ id: 'a', pluginId: 'alpha', origins: ['https://example.com'] }),
    profile({ id: 'b', pluginId: 'beta', origins: ['https://example.org'] }),
  ];
  const regs = desiredUserScripts(ps, PLUGINS, GRANTED);
  assert.deepEqual(regs.find((r) => r.id === 'curtain-probe-alpha').matches, ['https://example.com/*']);
  assert.deepEqual(regs.find((r) => r.id === 'curtain-probe-beta').matches, ['https://example.org/*']);
});

test('disabled profiles, ungranted origins and missing plugins register nothing', () => {
  assert.deepEqual(desiredUserScripts([profile({ pluginId: 'alpha', enabled: false })], PLUGINS, GRANTED), []);
  assert.deepEqual(desiredUserScripts([profile({ pluginId: 'alpha' })], PLUGINS, []), []);
  assert.deepEqual(desiredUserScripts([profile({ pluginId: 'ghost' })], PLUGINS, GRANTED), []);
});
