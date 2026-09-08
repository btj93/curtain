const $ = (id) => document.getElementById(id);
const listEl = $('list');
let profiles = [];
let plugins = [];

async function load() {
  const got = await chrome.storage.local.get({ profiles: [], plugins: [] });
  profiles = (got.profiles || []).map(normalizeProfile);
  plugins = Array.isArray(got.plugins) ? got.plugins : [];
  // Nothing fires when Chrome's Allow User Scripts toggle is flipped, so a plugin installed
  // before it was on would stay unregistered. Opening this page asks for a fresh pass.
  chrome.runtime.sendMessage({ type: 'reconcile' }).catch(() => {});
  render();
}

const save = () => chrome.storage.local.set({ profiles: profiles });

// Throws on property access when the user has not allowed user scripts, so the check is a
// try/catch around the read rather than a truthiness test.
function userScriptsReady() {
  try { return !!chrome.userScripts; } catch (_) { return false; }
}

async function commitPlugins(next) {
  plugins = next;
  profiles = repairProfiles(
    profiles, plugins.map((p) => p.id), allSkins(plugins).map((s) => s.id));
  try {
    await chrome.storage.local.set({ plugins: plugins, profiles: profiles });
  } catch (e) {
    // Storage is finite and a rejected write is otherwise invisible: render() never runs
    // and the user sees a plugin that looks installed and is not.
    $('pluginErr').textContent = 'Could not save: ' + String(e.message || e);
    await load();
    return;
  }
  render();
}

async function installPlugin(raw) {
  const r = parsePlugin(raw);
  if (!r.ok) { $('pluginErr').textContent = r.error; return; }
  $('pluginErr').textContent = '';
  // Replaced in place rather than moved to the end, so an update does not silently
  // reorder the installed list and every profile's plugin dropdown.
  const at = plugins.findIndex((p) => p.id === r.plugin.id);
  const next = plugins.slice();
  if (at === -1) next.push(r.plugin); else next[at] = r.plugin;
  await commitPlugins(next);
}

async function removePlugin(id) {
  await commitPlugins(plugins.filter((p) => p.id !== id));
}

function renderPlugins() {
  const el = $('pluginList');
  el.innerHTML = '';
  if (!plugins.length) {
    const d = document.createElement('div');
    d.className = 'desc';
    d.textContent = 'No plugins installed.';
    el.appendChild(d);
    return;
  }
  plugins.forEach((pl) => {
    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('span');
    name.className = 'grow';
    name.textContent = pl.name + ' ' + pl.version;
    const rm = document.createElement('button');
    rm.className = 'danger';
    rm.textContent = 'Remove';
    rm.addEventListener('click', () => removePlugin(pl.id));
    row.append(name, rm);
    el.appendChild(row);

    const unused = pl.suggestedOrigins.filter(
      (o) => !profiles.some((p) => p.origins.indexOf(o) !== -1));
    if (!unused.length) return;
    const sug = document.createElement('div');
    sug.className = 'suggest';
    const head = document.createElement('strong');
    head.textContent = 'This plugin is not covering anything yet.';
    const sites = document.createElement('code');
    sites.textContent = unused.join('  ');
    sug.append(head, document.createTextNode('It was built for '), sites,
               document.createTextNode('.'));
    const setup = document.createElement('button');
    setup.textContent = 'Cover ' + (unused.length === 1 ? 'this site' : 'these sites') + ' with it';
    setup.addEventListener('click', async () => {
      profiles = profiles.concat([normalizeProfile({
        id: newProfileId(), name: pl.name, origins: unused, pluginId: pl.id,
      })]);
      await save();
      try {
        await chrome.permissions.request({ origins: unused.map((o) => o + '/*') });
      } catch (_) { /* the profile card shows its own grant button */ }
      render();
    });
    sug.appendChild(setup);
    el.appendChild(sug);
  });
}

// contains() resolves false for an ungranted origin but REJECTS for a malformed one, so a
// throw must read as "no access" or a dead profile looks healthy.
async function hasAccess(origins) {
  if (!origins.length) return true;
  try {
    return await chrome.permissions.contains({ origins: origins.map((o) => o + '/*') });
  } catch (_) {
    return false;
  }
}

function render() {
  renderPlugins();
  listEl.innerHTML = '';
  if (!profiles.length) {
    const d = document.createElement('div');
    d.className = 'empty';
    d.textContent = 'No profiles yet. Add one to start covering a page.';
    listEl.appendChild(d);
    return;
  }
  profiles.forEach((p, i) => listEl.appendChild(card(p, i)));
}

function card(p, index) {
  const el = document.createElement('div');
  el.className = 'card' + (p.enabled ? '' : ' disabled');

  const head = document.createElement('div');
  head.className = 'row';
  const name = document.createElement('input');
  name.type = 'text';
  name.className = 'grow';
  name.value = p.name;
  name.addEventListener('change', () => { p.name = name.value.trim() || 'Untitled'; save(); });

  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = p.enabled;
  enabled.addEventListener('change', async () => { p.enabled = enabled.checked; await save(); render(); });
  const enabledLabel = document.createElement('label');
  enabledLabel.className = 'check';
  enabledLabel.append(enabled, document.createTextNode('On'));

  const del = document.createElement('button');
  del.className = 'danger';
  del.textContent = 'Delete';
  del.addEventListener('click', async () => { profiles.splice(index, 1); await save(); render(); });

  head.append(name, enabledLabel, del);
  el.appendChild(head);

  const box = document.createElement('textarea');
  box.value = p.origins.join('\n');
  box.placeholder = 'https://example.com\none site per line';
  const err = document.createElement('div');
  err.className = 'err';
  const access = document.createElement('div');

  async function refreshAccess() {
    access.innerHTML = '';
    if (!p.origins.length) return;
    if (await hasAccess(p.origins)) return;
    const w = document.createElement('div');
    w.className = 'warn';
    w.textContent = 'Curtain has no access to these sites yet, so this profile does nothing. ';
    const grant = document.createElement('button');
    grant.textContent = 'Grant access';
    // Inside the click handler because permissions.request needs a user gesture.
    grant.addEventListener('click', async () => {
      try {
        const ok = await chrome.permissions.request({ origins: p.origins.map((o) => o + '/*') });
        if (ok) refreshAccess();
        else err.textContent = 'Access denied, so this profile stays inactive.';
      } catch (e) {
        err.textContent = 'Chrome refused these sites: ' + String(e.message || e);
      }
    });
    w.appendChild(grant);
    access.appendChild(w);
  }

  box.addEventListener('change', async () => {
    const lines = box.value.split('\n').map((s) => s.trim()).filter(Boolean);
    const bad = lines.filter((l) => !normalizeOrigin(l));
    err.textContent = bad.length
      ? 'Not usable sites: ' + bad.join(', ') + ' — expected e.g. https://example.com (http and https only)'
      : '';
    p.origins = [];
    lines.forEach((l) => {
      const o = normalizeOrigin(l);
      if (o && p.origins.indexOf(o) === -1) p.origins.push(o);
    });
    // Only rewritten when every line parsed, so a typo stays visible and correctable
    // instead of the box blanking itself and losing what you typed.
    if (!bad.length) box.value = p.origins.join('\n');
    await save();
    refreshAccess().catch(() => {});
  });

  el.append(box, err, access);

  const skinRow = document.createElement('div');
  skinRow.className = 'row';
  const skinSel = document.createElement('select');
  listSkins(allSkins(plugins)).forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    skinSel.appendChild(o);
  });
  skinSel.value = p.skinId;
  skinSel.addEventListener('change', () => { p.skinId = skinSel.value; save(); });
  const skinLabel = document.createElement('span');
  skinLabel.textContent = 'Cover:';

  const pluginSel = document.createElement('select');
  [{ id: '', name: 'No plugin' }].concat(plugins).forEach((pl) => {
    const o = document.createElement('option');
    o.value = pl.id;
    o.textContent = pl.name;
    pluginSel.appendChild(o);
  });
  pluginSel.value = p.pluginId || '';
  pluginSel.addEventListener('change', () => { p.pluginId = pluginSel.value || null; save(); });
  const pluginLabel = document.createElement('span');
  pluginLabel.textContent = 'Plugin:';

  skinRow.append(skinLabel, skinSel, pluginLabel, pluginSel);
  el.appendChild(skinRow);

  const coverRow = document.createElement('div');
  coverRow.className = 'row';
  const coverLabel = document.createElement('span');
  coverLabel.textContent = 'Cover URL:';
  const coverInput = document.createElement('input');
  coverInput.type = 'text';
  coverInput.className = 'grow';
  coverInput.placeholder = 'https://example.com/app (leave blank to use the skin)';
  coverInput.value = p.coverUrl || '';
  coverRow.append(coverLabel, coverInput);
  el.appendChild(coverRow);

  const coverErr = document.createElement('div');
  coverErr.className = 'err';
  el.appendChild(coverErr);

  const coverWarn = document.createElement('div');
  coverWarn.textContent = 'If this page needs a login, it will very likely show its own login '
    + 'screen instead of your session. A page shown inside a cover is treated as a different '
    + 'site from the one it covers, and browsers usually withhold that site’s cookies from '
    + 'a cross-site frame. There is no setting in Curtain that fixes this.';
  el.appendChild(coverWarn);

  const coverDesc = document.createElement('div');
  coverDesc.className = 'desc';
  coverDesc.textContent = 'When set, this profile covers with this live page instead of the '
    + 'chosen skin. The skin above still supplies the tab title and favicon.';
  el.appendChild(coverDesc);

  // Amber only once a URL is actually set. The same class marks a profile that is doing
  // nothing until you grant access, and a permanent second amber box on every card would
  // train you to ignore both.
  function syncCoverNotes() {
    coverWarn.className = p.coverUrl ? 'warn' : 'desc';
  }
  syncCoverNotes();

  coverInput.addEventListener('change', () => {
    const raw = coverInput.value.trim();
    if (!raw) {
      coverErr.textContent = '';
      p.coverUrl = null;
      syncCoverNotes();
      save();
      return;
    }
    let protocol = null;
    try { protocol = new URL(raw).protocol; } catch (_) { protocol = null; }
    if (protocol !== 'http:' && protocol !== 'https:') {
      coverErr.textContent = 'Not a usable URL: ' + raw
        + ' — expected e.g. https://example.com/app (http and https only)';
      return;
    }
    coverErr.textContent = '';
    p.coverUrl = raw;
    syncCoverNotes();
    save();
  });

  const layerRow = document.createElement('div');
  layerRow.className = 'row';
  const layerLabel = document.createElement('span');
  layerLabel.textContent = 'Input goes to:';
  const layerSel = document.createElement('select');
  [['', 'Automatic'], ['cover', 'Cover'], ['page', 'Page']].forEach(([value, text]) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    layerSel.appendChild(o);
  });
  layerSel.value = p.inputLayer || '';
  layerSel.addEventListener('change', () => { p.inputLayer = layerSel.value || null; save(); });
  const layerHotkey = document.createElement('span');
  layerHotkey.className = 'desc';
  layerHotkey.textContent = 'Alt+Shift+E';
  layerRow.append(layerLabel, layerSel, layerHotkey);
  el.appendChild(layerRow);

  const layerDesc = document.createElement('div');
  layerDesc.className = 'desc';
  layerDesc.textContent = 'Decides whether your clicks and typing reach the cover or the page '
    + 'underneath it while the cover is up. Automatic means the see-through cover stays '
    + 'click-through and the solid one blocks, which is how it has always behaved. Choose '
    + 'Cover to work in a live cover page, including a see-through one over the page you '
    + 'are hiding.';
  el.appendChild(layerDesc);

  CT_PROFILE_OPTIONS.forEach(({ key, title, desc }) => {
    const l = document.createElement('label');
    l.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!p.options[key];
    cb.addEventListener('change', () => { p.options[key] = cb.checked; save(); });
    const span = document.createElement('span');
    span.append(document.createTextNode(title));
    const d = document.createElement('div');
    d.className = 'desc';
    d.textContent = desc;
    span.appendChild(d);
    l.append(cb, span);
    el.appendChild(l);
  });

  const opRow = document.createElement('div');
  opRow.className = 'row';
  const op = document.createElement('input');
  op.type = 'range';
  op.min = '40'; op.max = '95'; op.step = '5';
  op.value = String(Math.round(p.options.peekOpacity * 100));
  const opVal = document.createElement('span');
  opVal.textContent = op.value + '%';
  op.addEventListener('input', () => {
    opVal.textContent = op.value + '%';
    p.options.peekOpacity = Number(op.value) / 100;
    save();
  });
  const opLabel = document.createElement('span');
  opLabel.textContent = 'See-through cover opacity (higher = more hidden):';
  opRow.append(opLabel, op, opVal);
  el.appendChild(opRow);

  refreshAccess().catch(() => { err.textContent = 'Could not check site access.'; });
  return el;
}

$('add').addEventListener('click', async () => {
  profiles.push(normalizeProfile({ id: newProfileId(), name: 'New profile' }));
  await save();
  render();
});

$('pluginFile').addEventListener('change', async () => {
  const f = $('pluginFile').files[0];
  if (!f) return;
  // Cleared so re-picking the same file after a fix still fires change.
  $('pluginFile').value = '';
  await installPlugin(await f.text());
});

$('pluginPasteBtn').addEventListener('click', async () => {
  const raw = $('pluginPaste').value.trim();
  if (raw) await installPlugin(raw);
});

if (!userScriptsReady()) {
  const w = $('userScriptsWarn');
  w.textContent = 'Chrome is blocking user scripts, so plugins cannot run. Open this '
    + "extension's details page and turn on Allow User Scripts, then reload.";
  w.hidden = false;
}

load();
