const $ = (id) => document.getElementById(id);
const NEW = '__new__';

let tab = null;
let profiles = [];

$('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

const save = () => chrome.storage.local.set({ profiles: profiles });

async function hasAccess(origin) {
  try {
    return await chrome.permissions.contains({ origins: [origin + '/*'] });
  } catch (_) {
    return false;
  }
}

function show(kind) {
  for (const k of ['unsupported', 'unmatched', 'matched']) $(k).hidden = k !== kind;
}

// The disabled property, not just a dimming class: pointer-events alone leaves the range
// in the tab order, so a keyboard user can still change a control that reads as disabled.
function setPeekEnabled(on) {
  $('peekOpacity').disabled = !on;
  $('peekRow').classList.toggle('off', !on);
}

async function render() {
  const got = await chrome.storage.local.get({ profiles: [] });
  profiles = (got.profiles || []).map(normalizeProfile);
  const state = derivePopupState(profiles, (tab && tab.url) || '');

  if (state.kind === 'unsupported') {
    $('unsupportedReason').textContent = state.reason;
    show('unsupported');
    return;
  }
  if (state.kind === 'unmatched') return renderUnmatched(state);
  return renderMatched(state);
}

function renderUnmatched(state) {
  $('unmatchedOrigin').textContent = state.origin;
  const sel = $('target');
  sel.innerHTML = '';
  state.choices.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = 'Add to “' + c.name + '”';
    sel.appendChild(o);
  });
  const mk = document.createElement('option');
  mk.value = NEW;
  mk.textContent = 'New profile…';
  sel.appendChild(mk);
  sel.value = state.choices.length ? state.choices[0].id : NEW;

  const syncName = () => { $('newName').hidden = sel.value !== NEW; };
  syncName();
  sel.onchange = syncName;
  $('newName').value = '';
  $('addErr').textContent = '';
  $('add').disabled = false;
  show('unmatched');

  $('add').onclick = async () => {
    // Disabled for the duration: the handler awaits before reassigning `profiles`, so a
    // double-click on the new-profile path would append two profiles for one origin.
    $('add').disabled = true;
    const next = sel.value === NEW
      ? createProfileWithOrigin(profiles, $('newName').value, state.origin)
      : addOriginToProfile(profiles, sel.value, state.origin);
    if (!next) {
      $('addErr').textContent = 'Could not add this site.';
      $('add').disabled = false;
      return;
    }
    profiles = next;
    // Saved before the permission prompt, so the profile survives even if Chrome
    // dismisses the popup while the prompt is open.
    await save();
    try {
      await chrome.permissions.request({ origins: [state.origin + '/*'] });
    } catch (_) { /* the reopened popup shows a grant banner instead */ }
    await render();
  };
}

async function renderMatched(state) {
  const p = state.profile;
  $('profileName').textContent = p.name;
  $('matchedOrigin').textContent = state.origin;
  show('matched');

  $('grantWarn').hidden = await hasAccess(state.origin);
  $('grant').onclick = async () => {
    try { await chrome.permissions.request({ origins: [state.origin + '/*'] }); } catch (_) {}
    await render();
  };

  $('cover').onclick = () => {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle-cover' }).catch(() => {});
    window.close();
  };

  const opts = $('opts');
  opts.innerHTML = '';
  CT_PROFILE_OPTIONS.forEach(({ key, title, desc }) => {
    const l = document.createElement('label');
    l.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!p.options[key];
    cb.addEventListener('change', async () => {
      p.options[key] = cb.checked;
      await save();
      if (key === 'peekWhenFocused') setPeekEnabled(cb.checked);
    });
    const span = document.createElement('span');
    span.append(document.createTextNode(title));
    const d = document.createElement('div');
    d.className = 'desc';
    d.textContent = desc;
    span.appendChild(d);
    l.append(cb, span);
    opts.appendChild(l);
  });

  const range = $('peekOpacity');
  range.value = String(Math.round(p.options.peekOpacity * 100));
  $('peekVal').textContent = range.value + '%';
  setPeekEnabled(p.options.peekWhenFocused);
  range.oninput = () => {
    $('peekVal').textContent = range.value + '%';
    p.options.peekOpacity = Number(range.value) / 100;
    save();
  };
}

(async () => {
  // Not lastFocusedWindow: inside a popup, the popup IS the last focused window.
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = tabs[0] || null;
  await render();
})();
