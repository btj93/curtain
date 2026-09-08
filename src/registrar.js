const CT_ENGINE_ID = 'curtain-engine';
const CT_KEEPALIVE_ID = 'curtain-keepalive';

// Order is load-bearing: each file defines globals the next one uses.
const CT_ENGINE_JS = [
  'src/lib/profiles.js',
  'src/lib/overlay-state.js',
  'src/skins/ide.js',
  'src/skins/index.js',
  'src/content.js',
];

function pushUnique(arr, v) { if (arr.indexOf(v) === -1) arr.push(v); }

function desiredRegistrations(profiles, grantedOrigins) {
  const granted = grantedOrigins || [];
  const engineMatches = [];
  const keepMatches = [];

  for (let i = 0; i < (profiles || []).length; i++) {
    const p = profiles[i];
    if (!p.enabled) continue;
    for (let j = 0; j < p.origins.length; j++) {
      const o = p.origins[j];
      // Registration does NOT itself check host permissions: it succeeds and the script
      // silently never injects. Filtering here is what makes that state visible.
      if (granted.indexOf(o) === -1) continue;
      pushUnique(engineMatches, o + '/*');
      if (p.options.keepAlive) pushUnique(keepMatches, o + '/*');
    }
  }

  const out = [];
  if (engineMatches.length) {
    out.push({
      id: CT_ENGINE_ID, matches: engineMatches, js: CT_ENGINE_JS.slice(),
      world: 'ISOLATED', runAt: 'document_start', allFrames: false, persistAcrossSessions: true,
    });
  }
  if (keepMatches.length) {
    out.push({
      id: CT_KEEPALIVE_ID, matches: keepMatches, js: ['src/keepalive.js'],
      world: 'MAIN', runAt: 'document_start', allFrames: true, persistAcrossSessions: true,
    });
  }
  return out;
}

function desiredUserScripts(profiles, plugins, grantedOrigins) {
  const granted = grantedOrigins || [];
  const byPlugin = {};

  for (let i = 0; i < (profiles || []).length; i++) {
    const p = profiles[i];
    if (!p.enabled || !p.pluginId) continue;
    for (let j = 0; j < p.origins.length; j++) {
      if (granted.indexOf(p.origins[j]) === -1) continue;
      if (!byPlugin[p.pluginId]) byPlugin[p.pluginId] = [];
      pushUnique(byPlugin[p.pluginId], p.origins[j] + '/*');
    }
  }

  const out = [];
  Object.keys(byPlugin).forEach(function (id) {
    let plugin = null;
    for (let i = 0; i < (plugins || []).length; i++) if (plugins[i].id === id) plugin = plugins[i];
    if (!plugin) return;
    const matches = byPlugin[id];
    out.push({
      id: 'curtain-probe-' + id, matches: matches, js: [{ code: plugin.probe }],
      world: 'USER_SCRIPT', runAt: 'document_start', allFrames: false,
    });
    if (plugin.page) {
      out.push({
        id: 'curtain-page-' + id, matches: matches, js: [{ code: plugin.page }],
        world: 'MAIN', runAt: 'document_start', allFrames: false,
      });
    }
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CT_ENGINE_ID, CT_KEEPALIVE_ID, CT_ENGINE_JS, desiredRegistrations, desiredUserScripts };
}
