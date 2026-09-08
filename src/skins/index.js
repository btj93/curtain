const CT_BUILTIN_SKINS = [
  (typeof module !== 'undefined' && module.exports) ? require('./ide.js').CT_SKIN_IDE : CT_SKIN_IDE,
];

// Falls back rather than returning null: a profile can point at a skin a removed plugin
// took with it, and failing to cover is the one outcome that exposes the page.
function resolveSkin(skins, skinId) {
  if (!skins || !skins.length) return null;
  for (let i = 0; i < skins.length; i++) if (skins[i].id === skinId) return skins[i];
  return skins[0];
}

function skinKind(skin) {
  return skin && skin.url ? 'url' : 'html';
}

// The profile wins, so a user can point a url skin somewhere else without editing the
// plugin that supplied it. Both inputs are validated where they enter storage:
// normalizeProfile for the profile field, parsePlugin for the skin's.
function coverUrlFor(profileCoverUrl, skin) {
  return profileCoverUrl || (skin && skin.url) || null;
}

function listSkins(skins) {
  return (skins || []).map(function (s) { return { id: s.id, name: s.name }; });
}

// Built-ins first, so resolveSkin's linear search returns one on an id collision. A plugin
// cannot shadow a built-in skin by claiming its id.
function allSkins(plugins) {
  let out = CT_BUILTIN_SKINS.slice();
  (plugins || []).forEach(function (p) {
    if (p && Array.isArray(p.skins)) out = out.concat(p.skins);
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CT_BUILTIN_SKINS, resolveSkin, listSkins, allSkins, skinKind, coverUrlFor };
}
