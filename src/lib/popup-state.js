const CT_PS = (typeof module !== 'undefined' && module.exports)
  ? require('./profiles.js')
  : { normalizeOrigin: normalizeOrigin, normalizeProfile: normalizeProfile,
      pickProfileForUrl: pickProfileForUrl, newProfileId: newProfileId };

function derivePopupState(profiles, url) {
  const list = profiles || [];
  const origin = CT_PS.normalizeOrigin(url);
  // Chrome's own pages, extension pages, about:blank and file: URLs have no coverable
  // origin. Reporting them as merely uncovered would invite an add that can never work.
  if (!origin) return { kind: 'unsupported', reason: 'Curtain cannot cover this kind of page.' };

  const match = CT_PS.pickProfileForUrl(list, url);
  if (match) return { kind: 'matched', profile: match, origin: origin };

  return {
    kind: 'unmatched',
    origin: origin,
    choices: list.map(function (p) { return { id: p.id, name: p.name }; }),
  };
}

function addOriginToProfile(profiles, profileId, origin) {
  const o = CT_PS.normalizeOrigin(origin);
  if (!o) return null;
  const list = profiles || [];
  let found = false;
  const next = list.map(function (p) {
    if (p.id !== profileId) return p;
    found = true;
    const origins = p.origins.indexOf(o) === -1 ? p.origins.concat([o]) : p.origins;
    // Re-enabled because adding a site to a switched-off profile would otherwise appear
    // to do nothing, which reads as a bug rather than as a setting.
    return CT_PS.normalizeProfile(Object.assign({}, p, { origins: origins, enabled: true }));
  });
  return found ? next : null;
}

function createProfileWithOrigin(profiles, name, origin) {
  const o = CT_PS.normalizeOrigin(origin);
  if (!o) return null;
  const trimmed = String(name == null ? '' : name).trim();
  return (profiles || []).concat([CT_PS.normalizeProfile({
    id: CT_PS.newProfileId(),
    name: trimmed || new URL(o).hostname,
    origins: [o],
  })]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { derivePopupState, addOriginToProfile, createProfileWithOrigin };
}
