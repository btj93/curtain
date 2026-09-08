const test = require('node:test');
const assert = require('node:assert');
const { CT_BUILTIN_SKINS, resolveSkin, listSkins } = require('../src/skins/index.js');

test('the built-in set is non-empty and every skin is complete', () => {
  assert.ok(CT_BUILTIN_SKINS.length >= 1);
  for (const s of CT_BUILTIN_SKINS) {
    for (const key of ['id', 'name', 'title', 'titleAlertPrefix', 'favicon', 'faviconAlert', 'html', 'css']) {
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

test('every skin provides the four binding hooks and both alert variants', () => {
  const { CT_BUILTIN_SKINS } = require('../src/skins/index.js');
  for (const s of CT_BUILTIN_SKINS) {
    assert.match(s.html, /data-ct-slot="label"/, s.id);
    assert.match(s.html, /data-ct-slot="count"/, s.id);
    assert.match(s.html, /data-ct-live/, s.id);
    assert.match(s.html, /data-ct-level="ok"/, s.id);
    assert.ok(s.titleAlertPrefix, s.id + ' has no titleAlertPrefix');
    assert.ok(s.faviconAlert, s.id + ' has no faviconAlert');
  }
});

test('plugin skins join the registry after the built-ins', () => {
  const { CT_BUILTIN_SKINS, allSkins, resolveSkin } = require('../src/skins/index.js');
  const mine = { id: 'mine', name: 'Mine', title: 'T', titleAlertPrefix: '! ',
                 favicon: 'data:,', faviconAlert: 'data:,', html: '<div class="ct-root"></div>', css: '' };
  const all = allSkins([{ id: 'p', skins: [mine] }]);
  assert.equal(all.length, CT_BUILTIN_SKINS.length + 1);
  assert.equal(resolveSkin(all, 'mine').id, 'mine');
});

test('a built-in wins an id collision with a plugin skin', () => {
  const { CT_BUILTIN_SKINS, allSkins, resolveSkin } = require('../src/skins/index.js');
  const impostor = { id: CT_BUILTIN_SKINS[0].id, name: 'Impostor', title: 'T', titleAlertPrefix: '! ',
                     favicon: 'data:,', faviconAlert: 'data:,', html: '<div class="ct-root"></div>', css: '' };
  const all = allSkins([{ id: 'p', skins: [impostor] }]);
  assert.equal(resolveSkin(all, CT_BUILTIN_SKINS[0].id).name, CT_BUILTIN_SKINS[0].name);
});

test('allSkins tolerates plugins with no skins', () => {
  const { CT_BUILTIN_SKINS, allSkins } = require('../src/skins/index.js');
  assert.equal(allSkins([{ id: 'p' }]).length, CT_BUILTIN_SKINS.length);
  assert.equal(allSkins(null).length, CT_BUILTIN_SKINS.length);
});
