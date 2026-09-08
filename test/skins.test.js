const test = require('node:test');
const assert = require('node:assert');
const { CT_BUILTIN_SKINS, resolveSkin, listSkins } = require('../src/skins/index.js');

test('the built-in set is non-empty and every skin is complete', () => {
  assert.ok(CT_BUILTIN_SKINS.length >= 1);
  for (const s of CT_BUILTIN_SKINS) {
    for (const key of ['id', 'name', 'title', 'favicon', 'html', 'css']) {
      assert.ok(s[key], s.id + ' is missing ' + key);
    }
    assert.match(s.html, /class="ct-root"/, s.id);
  }
});

test('resolve returns the requested skin, or the first built-in for an unknown id', () => {
  assert.equal(resolveSkin(CT_BUILTIN_SKINS, 'ide').id, 'ide');
  assert.equal(resolveSkin(CT_BUILTIN_SKINS, 'vanished').id, CT_BUILTIN_SKINS[0].id);
  assert.equal(resolveSkin(CT_BUILTIN_SKINS, null).id, CT_BUILTIN_SKINS[0].id);
  assert.equal(resolveSkin([], 'ide'), null);
});

test('list exposes just id and name for the options dropdown', () => {
  assert.deepEqual(listSkins(CT_BUILTIN_SKINS), CT_BUILTIN_SKINS.map((s) => ({ id: s.id, name: s.name })));
});

test('no skin leaks a hostname', () => {
  for (const s of CT_BUILTIN_SKINS) {
    assert.doesNotMatch(s.html + s.css + s.title, /https?:\/\//);
  }
});
