const test = require('node:test');
const assert = require('node:assert');
const { normalizeProfile } = require('../src/lib/profiles.js');
const { derivePopupState, addOriginToProfile, createProfileWithOrigin } = require('../src/lib/popup-state.js');

const P = (over) => normalizeProfile(Object.assign({ id: 'a', name: 'Work' }, over));

test('pages with no coverable origin are unsupported, not unmatched', () => {
  for (const url of ['chrome://extensions', 'about:blank', 'file:///tmp/x.html', '', null, 'not a url']) {
    assert.equal(derivePopupState([], url).kind, 'unsupported', String(url));
  }
});

test('an uncovered site offers every profile as a target', () => {
  const profiles = [P({ id: 'a', name: 'Work' }), P({ id: 'b', name: 'Games' })];
  const s = derivePopupState(profiles, 'https://example.com/page?x=1');
  assert.equal(s.kind, 'unmatched');
  assert.equal(s.origin, 'https://example.com');
  assert.deepEqual(s.choices, [{ id: 'a', name: 'Work' }, { id: 'b', name: 'Games' }]);
});

test('a disabled profile is still offered as a target', () => {
  const s = derivePopupState([P({ id: 'a', name: 'Work', enabled: false })], 'https://example.com/');
  assert.equal(s.kind, 'unmatched');
  assert.deepEqual(s.choices, [{ id: 'a', name: 'Work' }]);
});

test('with no profiles at all the site is unmatched with no choices', () => {
  const s = derivePopupState([], 'https://example.com/');
  assert.equal(s.kind, 'unmatched');
  assert.deepEqual(s.choices, []);
});

test('a covered site reports its profile', () => {
  const profiles = [P({ id: 'a', name: 'Work', origins: ['https://example.com'] })];
  const s = derivePopupState(profiles, 'https://example.com/deep/path');
  assert.equal(s.kind, 'matched');
  assert.equal(s.profile.id, 'a');
  assert.equal(s.origin, 'https://example.com');
});

test('a site in a disabled profile counts as unmatched, since nothing covers it', () => {
  const profiles = [P({ id: 'a', enabled: false, origins: ['https://example.com'] })];
  assert.equal(derivePopupState(profiles, 'https://example.com/').kind, 'unmatched');
});

test('adding an origin returns a new array and leaves the input alone', () => {
  const before = [P({ id: 'a', origins: [] })];
  const after = addOriginToProfile(before, 'a', 'https://example.com/page');
  assert.deepEqual(after[0].origins, ['https://example.com']);
  assert.deepEqual(before[0].origins, [], 'input was mutated');
  assert.notEqual(after, before);
});

test('adding is idempotent and rejects a bad origin or an unknown profile', () => {
  const profiles = [P({ id: 'a', origins: ['https://example.com'] })];
  assert.deepEqual(addOriginToProfile(profiles, 'a', 'https://example.com')[0].origins, ['https://example.com']);
  assert.equal(addOriginToProfile(profiles, 'a', 'ftp://example.com'), null);
  assert.equal(addOriginToProfile(profiles, 'missing', 'https://example.com'), null);
});

test('adding to a disabled profile re-enables it, since the user just asked for coverage', () => {
  const profiles = [P({ id: 'a', enabled: false, origins: [] })];
  const after = addOriginToProfile(profiles, 'a', 'https://example.com');
  assert.equal(after[0].enabled, true);
});

test('creating a profile appends one carrying the origin', () => {
  const before = [P({ id: 'a' })];
  const after = createProfileWithOrigin(before, 'Docs', 'https://example.com/x');
  assert.equal(after.length, 2);
  assert.equal(after[1].name, 'Docs');
  assert.deepEqual(after[1].origins, ['https://example.com']);
  assert.equal(after[1].enabled, true);
  assert.ok(after[1].id);
  assert.equal(before.length, 1, 'input was mutated');
});

test('creating falls back to the hostname when no name is given', () => {
  const after = createProfileWithOrigin([], '   ', 'https://example.com/x');
  assert.equal(after[0].name, 'example.com');
});

test('creating rejects a bad origin', () => {
  assert.equal(createProfileWithOrigin([], 'X', 'chrome://extensions'), null);
});
