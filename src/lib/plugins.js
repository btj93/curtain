const CT_PL = (typeof module !== 'undefined' && module.exports)
  ? require('./profiles.js')
  : { normalizeOrigin: normalizeOrigin };

const CT_PLUGIN_MAX_BYTES = 512 * 1024;
// Becomes part of a chrome.userScripts registration id, which may not start with '_'.
const CT_PLUGIN_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const CT_SKIN_KEYS = ['id', 'name', 'title', 'favicon'];
// Optional, and carried through rather than dropped: the engine reads titleAlertPrefix and
// faviconAlert, so stripping them here would silently disable every plugin skin's alert.
// html and url are optional here too; the union check below enforces exactly one of them.
const CT_SKIN_OPTIONAL = ['css', 'titleAlertPrefix', 'faviconAlert', 'html', 'url'];

function str(v) { return typeof v === 'string' ? v : null; }

// String.length counts UTF-16 code units, so a plugin full of non-ASCII text would pass a
// cap named for bytes while storing up to four times that.
function byteLength(s) { return new TextEncoder().encode(s).length; }

function parsePlugin(raw) {
  let o = raw;
  if (typeof raw === 'string') {
    // Checked before parsing, so an absurd file is refused rather than parsed and then refused.
    if (byteLength(raw) > CT_PLUGIN_MAX_BYTES) return { ok: false, error: 'Plugin is too large.' };
    try { o = JSON.parse(raw); } catch (_) { return { ok: false, error: 'Not valid JSON.' }; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'Not a plugin object.' };

  const id = str(o.id);
  if (!id || !CT_PLUGIN_ID.test(id)) {
    return { ok: false, error: 'id must be lowercase letters, digits and dashes, starting with a letter or digit.' };
  }

  const probe = str(o.probe);
  if (!probe || !probe.trim()) return { ok: false, error: 'probe is required and must be JavaScript source.' };

  const page = o.page == null ? null : str(o.page);
  if (o.page != null && page === null) return { ok: false, error: 'page must be JavaScript source when present.' };

  let suggestedOrigins = [];
  if (o.suggestedOrigins != null) {
    if (!Array.isArray(o.suggestedOrigins)) return { ok: false, error: 'suggestedOrigins must be a list.' };
    for (const s of o.suggestedOrigins) {
      const n = CT_PL.normalizeOrigin(s);
      if (!n) return { ok: false, error: 'Not a usable site: ' + String(s) };
      if (suggestedOrigins.indexOf(n) === -1) suggestedOrigins.push(n);
    }
  }

  let skins = [];
  if (o.skins != null) {
    if (!Array.isArray(o.skins)) return { ok: false, error: 'skins must be a list.' };
    for (const s of o.skins) {
      if (!s || typeof s !== 'object') return { ok: false, error: 'A skin is not an object.' };
      const out = {};
      for (const k of CT_SKIN_KEYS) {
        if (typeof s[k] !== 'string' || !s[k]) return { ok: false, error: 'Skin is missing ' + k + '.' };
        out[k] = s[k];
      }
      for (const k of CT_SKIN_OPTIONAL) {
        if (s[k] == null) { out[k] = ''; continue; }
        if (typeof s[k] !== 'string') return { ok: false, error: 'Skin ' + k + ' must be text.' };
        out[k] = s[k];
      }
      if (out.html && out.url) return { ok: false, error: 'Skin cannot have both html and url.' };
      if (!out.html && !out.url) return { ok: false, error: 'Skin must have html or url.' };
      // Parsed here because a header rule is derived from this URL's origin, so junk would
      // surface as a missing rule rather than as a bad cover.
      if (out.url && !CT_PL.normalizeOrigin(out.url)) {
        return { ok: false, error: 'Skin url must be an http or https address.' };
      }
      skins.push(out);
    }
  }

  const plugin = {
    id: id,
    name: str(o.name) || id,
    version: str(o.version) || '0.0.0',
    suggestedOrigins: suggestedOrigins,
    probe: probe,
    page: page,
    skins: skins,
  };

  if (byteLength(JSON.stringify(plugin)) > CT_PLUGIN_MAX_BYTES) {
    return { ok: false, error: 'Plugin is too large.' };
  }
  return { ok: true, plugin: plugin };
}

function pluginById(plugins, id) {
  for (let i = 0; i < (plugins || []).length; i++) if (plugins[i].id === id) return plugins[i];
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsePlugin, pluginById, CT_PLUGIN_MAX_BYTES };
}
