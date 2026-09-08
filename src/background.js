importScripts('lib/profiles.js', 'registrar.js');

async function loadProfiles() {
  const { profiles } = await chrome.storage.local.get({ profiles: [] });
  return (profiles || []).map(normalizeProfile);
}

// Must use permissions.contains, never string comparison against permissions.getAll():
// getAll returns granted patterns verbatim, and the options page uses contains, so a
// string comparison here would report a profile as granted while nothing registers.
async function grantedOrigins(profiles) {
  const wanted = [];
  for (const p of profiles) {
    if (!p.enabled) continue;
    for (const o of p.origins) if (wanted.indexOf(o) === -1) wanted.push(o);
  }
  const checks = await Promise.all(wanted.map(async (o) => {
    try {
      return (await chrome.permissions.contains({ origins: [o + '/*'] })) ? o : null;
    } catch (_) {
      return null;
    }
  }));
  return checks.filter(Boolean);
}

// Every trigger funnels here and re-derives the whole desired state, so a half-applied
// previous run self-heals. Bursts coalesce (the opacity slider writes on every input
// event) but are never dropped: a write landing mid-run re-runs after it.
let reconciling = null;
let reconcilePending = false;
async function reconcile() {
  if (reconciling) { reconcilePending = true; return reconciling; }
  reconciling = (async () => {
    try {
      const profiles = await loadProfiles();
      const granted = await grantedOrigins(profiles);
      const desired = desiredRegistrations(profiles, granted);

      const existing = await chrome.scripting.getRegisteredContentScripts();
      if (existing.length) {
        try { await chrome.scripting.unregisterContentScripts({ ids: existing.map((r) => r.id) }); }
        catch (e) { console.error('[curtain] unregister failed', e); }
      }
      // One at a time: registerContentScripts is batch-atomic, so a single bad entry
      // would silently register nothing at all.
      for (const r of desired) {
        try { await chrome.scripting.registerContentScripts([r]); }
        catch (e) { console.error('[curtain] register failed', r.id, e); }
      }
    } catch (e) {
      console.error('[curtain] reconcile failed', e);
    } finally {
      reconciling = null;
    }
  })();
  const run = reconciling;
  await run;
  if (reconcilePending) { reconcilePending = false; return reconcile(); }
  return run;
}

chrome.runtime.onInstalled.addListener(reconcile);
chrome.runtime.onStartup.addListener(reconcile);
chrome.permissions.onAdded.addListener(reconcile);
chrome.permissions.onRemoved.addListener(reconcile);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.profiles) reconcile();
});

// sender.tab.id is available without the "tabs" permission, and muting needs no permission
// and no user gesture, so tab mute adds no install warning.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'set-mute' && sender.tab && sender.tab.id != null) {
    chrome.tabs.update(sender.tab.id, { muted: !!msg.muted })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

// chrome.commands fires only here, never in a content script, hence the relay.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-cover') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.id == null) return;
  const profiles = await loadProfiles();
  if (!pickProfileForUrl(profiles, tab.url || '')) return;
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-cover' }).catch(() => {});
});
