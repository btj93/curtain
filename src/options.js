const listEl = document.getElementById('list');
let profiles = [];

async function load() {
  const got = await chrome.storage.local.get({ profiles: [] });
  profiles = (got.profiles || []).map(normalizeProfile);
  render();
}

const save = () => chrome.storage.local.set({ profiles: profiles });

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
  listSkins(CT_BUILTIN_SKINS).forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    skinSel.appendChild(o);
  });
  skinSel.value = p.skinId;
  skinSel.addEventListener('change', () => { p.skinId = skinSel.value; save(); });
  const skinLabel = document.createElement('span');
  skinLabel.textContent = 'Cover:';
  skinRow.append(skinLabel, skinSel);
  el.appendChild(skinRow);

  const OPTS = [
    ['keepAlive', 'Keep the page running when unfocused', 'Spoofs page visibility so a site that pauses itself on blur keeps going. Cannot beat Chrome’s own throttling of hidden or covered windows.'],
    ['autoCover', 'Cover automatically when I look away', 'Drops the cover the moment real focus leaves. Off means hotkey only.'],
    ['mute', 'Mute the tab while covered', 'No audio leaks out of a window pretending to be something else.'],
    ['peekWhenFocused', 'See-through cover while I’m looking', 'Keeps a faint cover you can click straight through, instead of fully revealing the page.'],
  ];
  OPTS.forEach(([key, title, desc]) => {
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

document.getElementById('add').addEventListener('click', async () => {
  profiles.push(normalizeProfile({ id: newProfileId(), name: 'New profile' }));
  await save();
  render();
});

load();
