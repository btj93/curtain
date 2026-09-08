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
