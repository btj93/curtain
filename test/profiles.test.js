const test = require('node:test');
const assert = require('node:assert');
const { CT_DEFAULT_OPTIONS, normalizeOrigin, normalizeProfile, pickProfileForUrl, newProfileId } = require('../src/lib/profiles.js');

test('origins are normalized by the URL parser', () => {
  assert.equal(normalizeOrigin('https://example.com'), 'https://example.com');
  assert.equal(normalizeOrigin('  https://example.com  '), 'https://example.com');
  assert.equal(normalizeOrigin('https://Example.COM'), 'https://example.com');
  assert.equal(normalizeOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(normalizeOrigin('https://example.com:443'), 'https://example.com');
  assert.equal(normalizeOrigin('http://example.com:80'), 'http://example.com');
});

test('a pasted page URL is reduced to its origin', () => {
  assert.equal(normalizeOrigin('https://example.com/app/x?q=1#frag'), 'https://example.com');
});

test('non-web schemes and junk are rejected', () => {
  for (const s of ['ftp://example.com', 'file:///tmp', 'example.com', '', null, 'not a url']) {
    assert.equal(normalizeOrigin(s), null, String(s));
  }
});

test('normalize fills defaults for a bare object', () => {
  const p = normalizeProfile({ id: 'a' });
  assert.equal(p.id, 'a');
  assert.equal(p.name, 'Untitled');
  assert.equal(p.enabled, true);
  assert.deepEqual(p.origins, []);
  assert.equal(p.skinId, 'ide');
  assert.deepEqual(p.options, CT_DEFAULT_OPTIONS);
});

test('normalize drops junk origins and dedupes the rest', () => {
  const p = normalizeProfile({ origins: ['https://example.com', 'nonsense', 'https://Example.com/x', ''] });
  assert.deepEqual(p.origins, ['https://example.com']);
});

test('normalize clamps peek opacity and respects supplied options', () => {
  assert.equal(normalizeProfile({ options: { mute: false } }).options.mute, false);
  assert.equal(normalizeProfile({ options: { peekOpacity: 5 } }).options.peekOpacity, 0.97);
  assert.equal(normalizeProfile({ options: { peekOpacity: 0 } }).options.peekOpacity, 0.3);
  assert.equal(normalizeProfile({ options: { peekOpacity: 'x' } }).options.peekOpacity, 0.8);
});

test('enabled is true unless explicitly false', () => {
  assert.equal(normalizeProfile({}).enabled, true);
  assert.equal(normalizeProfile({ enabled: false }).enabled, false);
});

test('pick returns the first enabled profile matching the origin', () => {
  const profiles = [
    normalizeProfile({ id: 'off', enabled: false, origins: ['https://example.com'] }),
    normalizeProfile({ id: 'hit', origins: ['https://example.com'] }),
    normalizeProfile({ id: 'also', origins: ['https://example.com'] }),
  ];
  assert.equal(pickProfileForUrl(profiles, 'https://example.com/deep/path').id, 'hit');
  assert.equal(pickProfileForUrl(profiles, 'https://other.org/x'), null);
  assert.equal(pickProfileForUrl(profiles, 'https://sub.example.com/x'), null);
  assert.equal(pickProfileForUrl(profiles, 'not a url'), null);
  assert.equal(pickProfileForUrl([], 'https://example.com/x'), null);
});

test('ids are unique', () => {
  assert.notEqual(newProfileId(), newProfileId());
});

test('the shared option list covers every boolean default and nothing else', () => {
  const { CT_PROFILE_OPTIONS, CT_DEFAULT_OPTIONS } = require('../src/lib/profiles.js');
  const listed = CT_PROFILE_OPTIONS.map((o) => o.key);
  const booleans = Object.keys(CT_DEFAULT_OPTIONS).filter((k) => typeof CT_DEFAULT_OPTIONS[k] === 'boolean');
  assert.deepEqual(listed.slice().sort(), booleans.slice().sort());
  for (const o of CT_PROFILE_OPTIONS) {
    assert.ok(o.title, o.key + ' has no title');
    assert.ok(o.desc, o.key + ' has no description');
  }
});
