const CT_DEFAULT_OPTIONS = {
  keepAlive: true,
  autoCover: true,
  mute: true,
  peekWhenFocused: true,
  peekOpacity: 0.8,
};

const CT_PROFILE_OPTIONS = [
  { key: 'keepAlive', title: 'Keep the page running when unfocused',
    desc: 'Spoofs page visibility so a site that pauses itself on blur keeps going. Cannot beat Chrome’s own throttling of hidden or covered windows.' },
  { key: 'autoCover', title: 'Cover automatically when I look away',
    desc: 'Drops the cover the moment real focus leaves. Off means hotkey only.' },
  { key: 'mute', title: 'Mute the tab while covered',
    desc: 'No audio leaks out of a window pretending to be something else.' },
  { key: 'peekWhenFocused', title: 'See-through cover while I’m looking',
    desc: 'Keeps a faint cover you can click straight through, instead of fully revealing the page.' },
];

function normalizeOrigin(s) {
  try {
    const u = new URL(String(s == null ? '' : s).trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch (_) {
    return null;
  }
}

function clampOpacity(v) {
  const n = Number(v);
  if (!isFinite(n)) return CT_DEFAULT_OPTIONS.peekOpacity;
  return Math.min(0.97, Math.max(0.3, n));   // peek is never fully clear or fully solid
}

// Drops unknown keys by construction, so every new profile field must be added here too
// or it is silently stripped on load.
function normalizeProfile(raw) {
  const p = raw || {};
  const options = Object.assign({}, CT_DEFAULT_OPTIONS, p.options || {});
  options.peekOpacity = clampOpacity(options.peekOpacity);
  const origins = [];
  (Array.isArray(p.origins) ? p.origins : []).forEach(function (s) {
    const o = normalizeOrigin(s);
    if (o && origins.indexOf(o) === -1) origins.push(o);
  });
  return {
    id: String(p.id || ''),
    name: String(p.name || 'Untitled'),
    enabled: p.enabled !== false,
    origins: origins,
    skinId: String(p.skinId || 'ide'),
    pluginId: (typeof p.pluginId === 'string' && p.pluginId) ? p.pluginId : null,
    options: options,
  };
}

function pickProfileForUrl(profiles, url) {
  const origin = normalizeOrigin(url);
  if (!origin) return null;
  for (let i = 0; i < (profiles || []).length; i++) {
    const p = profiles[i];
    if (p.enabled && p.origins.indexOf(origin) !== -1) return p;
  }
  return null;
}

function newProfileId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CT_DEFAULT_OPTIONS, CT_PROFILE_OPTIONS, normalizeOrigin, normalizeProfile, pickProfileForUrl, newProfileId };
}
