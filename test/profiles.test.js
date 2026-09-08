const test = require('node:test');
const assert = require('node:assert');
const { CT_DEFAULT_OPTIONS, normalizeOrigin, normalizeProfile, pickProfileForUrl, repairProfiles, newProfileId } = require('../src/lib/profiles.js');

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

test('pluginId round-trips and defaults to null', () => {
  assert.equal(normalizeProfile({}).pluginId, null);
  assert.equal(normalizeProfile({ pluginId: 'demo' }).pluginId, 'demo');
  assert.equal(normalizeProfile({ pluginId: '' }).pluginId, null);
  assert.equal(normalizeProfile({ pluginId: 42 }).pluginId, null);
});

test('a cover url keeps its path but must be http or https', () => {
  assert.equal(normalizeProfile({}).coverUrl, null);
  assert.equal(normalizeProfile({ coverUrl: 'https://example.com/board?q=1#top' }).coverUrl,
    'https://example.com/board?q=1#top');
  assert.equal(normalizeProfile({ coverUrl: '  http://localhost:3000/docs  ' }).coverUrl,
    'http://localhost:3000/docs');
  for (const bad of ['', '   ', 'example.com', 'javascript:alert(1)', 'data:text/html,x',
                     'file:///tmp/x', 'not a url', 42, {}, null]) {
    assert.equal(normalizeProfile({ coverUrl: bad }).coverUrl, null, String(bad));
  }
});

// null is automatic, meaning follow the mode. It is the default because a single fixed
// value cannot preserve both of the pre-split behaviours: peek let clicks through to the
// page and cover blocked them, so either default silently breaks one of them.
test('input layer defaults to automatic and accepts only the two explicit layers', () => {
  assert.equal(normalizeProfile({}).inputLayer, null);
  assert.equal(normalizeProfile({ inputLayer: 'cover' }).inputLayer, 'cover');
  assert.equal(normalizeProfile({ inputLayer: 'page' }).inputLayer, 'page');
  for (const bad of ['Page', ' page', '', 'both', 0, false, null, {}]) {
    assert.equal(normalizeProfile({ inputLayer: bad }).inputLayer, null, String(bad));
  }
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

test('repair clears a pluginId whose plugin is gone', () => {
  const before = [normalizeProfile({ id: 'a', pluginId: 'gone', skinId: 'ide' })];
  const after = repairProfiles(before, ['other'], ['ide']);
  assert.equal(after[0].pluginId, null);
  assert.equal(before[0].pluginId, 'gone', 'input was mutated');
});

test('repair falls a dangling skinId back to the first available skin', () => {
  const before = [normalizeProfile({ id: 'a', skinId: 'vanished' })];
  const after = repairProfiles(before, [], ['ide', 'other']);
  assert.equal(after[0].skinId, 'ide');
});

test('repair leaves an intact profile untouched, by identity', () => {
  const before = [normalizeProfile({ id: 'a', pluginId: 'demo', skinId: 'ide' })];
  const after = repairProfiles(before, ['demo'], ['ide']);
  assert.equal(after[0], before[0]);
});

test('repair with no skins at all leaves skinId alone rather than clearing it', () => {
  const before = [normalizeProfile({ id: 'a', skinId: 'ide' })];
  assert.equal(repairProfiles(before, [], [])[0].skinId, 'ide');
});
