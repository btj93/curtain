(() => {
  'use strict';

  let profile = null;
  let manualForce = false;
  let focused = document.hasFocus();
  let mode = 'hidden';
  let hostEl = null;
  let shadow = null;
  let chromeGuard = null;
  let signal = CT_IDLE_SIGNAL;
  let signalAt = 0;
  let plugins = [];
  // A probe must keep re-emitting to stay live. Held indefinitely, `live` would leave the
  // indicator spinning after the probe died, which is the opposite of proof of life.
  const CT_SIGNAL_STALE_MS = 15000;
  // Captured on first show, not at load: at document_start the page has set neither title
  // nor icon, so an early snapshot would later "restore" a blank title.
  const original = { title: null, captured: false };
  let realIconNodes = null;

  async function loadProfile() {
    const got = await chrome.storage.local.get({ profiles: [], plugins: [] });
    plugins = got.plugins || [];
    profile = pickProfileForUrl((got.profiles || []).map(normalizeProfile), location.href);
    // Dropped whenever the profile or plugin set changes. A standing alert would otherwise
    // outlive the probe that raised it: detaching the plugin unregisters the probe, so no
    // further signal can ever arrive, and with auto-reveal on the page stays uncovered
    // forever with nothing left in the system able to clear it.
    signal = CT_IDLE_SIGNAL;
    signalAt = 0;
    if (!profile) { teardown(); return; }
    pushKeepAlive();
    recompute();
  }

  function teardown() {
    manualForce = false;
    applyMode('hidden');
    pushKeepAlive();
  }

  loadProfile();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.profiles || changes.plugins)) loadProfile();
  });

  const refocus = () => { focused = document.hasFocus(); recompute(); };
  window.addEventListener('focus', refocus, true);
  window.addEventListener('blur', refocus, true);
  document.addEventListener('visibilitychange', refocus, true);
  // Backstop, in case an event is swallowed by the page or by keepalive.js.
  setInterval(() => {
    const f = document.hasFocus();
    if (f !== focused) { focused = f; recompute(); }
  }, 750);

  window.addEventListener('__ct_signal', (e) => {
    signal = e.detail || CT_IDLE_SIGNAL;
    signalAt = Date.now();
    recompute();
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle-cover' && profile) { manualForce = !manualForce; recompute(); }
  });

  function recompute() {
    if (!profile) return;
    applyMode(computeOverlayMode({
      manualForce: manualForce,
      autoReveal: !!(profile.options.autoRevealOnAlert && describeSkinUpdate(signal).alert),
      autoCover: profile.options.autoCover,
      focused: focused,
      peekWhenFocused: profile.options.peekWhenFocused,
    }));
  }

  function applyMode(next) {
    const wasVisible = mode !== 'hidden';
    const willVisible = next !== 'hidden';
    mode = next;
    if (willVisible && !wasVisible) showCover();
    else if (!willVisible && wasVisible) hideCover();
    if (willVisible && hostEl && profile) {
      const peek = next === 'peek';
      setHost('opacity', peek ? String(profile.options.peekOpacity) : '1');
      setHost('pointer-events', peek ? 'none' : 'auto');
    }
    setTabMute(willVisible && !!(profile && profile.options.mute));
  }

  function pushKeepAlive() {
    window.dispatchEvent(new CustomEvent('__ct_keepalive', {
      detail: !!(profile && profile.options.keepAlive),
    }));
  }

  // Whole-tab mute beats suspending the page's AudioContext: no permission, no autoplay
  // warning, and a library resuming its own context cannot undo it.
  let mutedState = null;
  function setTabMute(muted) {
    if (muted === mutedState) return;
    mutedState = muted;
    try {
      const p = chrome.runtime.sendMessage({ type: 'set-mute', muted: muted });
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* extension context invalidated during a reload */ }
  }

  function skin() { return resolveSkin(allSkins(plugins), profile && profile.skinId); }

  function ensureCover() {
    if (hostEl) return;
    const s = skin();
    if (!s) return;
    hostEl = document.createElement('div');
    hostEl.setAttribute('aria-hidden', 'true');
    // all:initial first, so inheritable properties the page sets on a bare div (line-height,
    // letter-spacing, direction) cannot reach through the shadow boundary. The longhands
    // after it win for the properties the cover actually needs.
    hostEl.style.cssText =
      'all:initial!important;' +
      'position:fixed!important;inset:0!important;width:auto!important;height:auto!important;' +
      'z-index:2147483647!important;display:none!important;visibility:visible!important;' +
      'opacity:1!important;pointer-events:auto!important;' +
      'margin:0!important;padding:0!important;border:0!important;' +
      'transform:none!important;filter:none!important;clip-path:none!important;';
    // Closed, so the covered page cannot reach the cover's contents via hostEl.shadowRoot.
    shadow = hostEl.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = s.css;
    shadow.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = s.html;
    while (wrap.firstChild) shadow.appendChild(wrap.firstChild);
    (document.documentElement || document.body).appendChild(hostEl);
  }

  function setHost(prop, value) { hostEl.style.setProperty(prop, value, 'important'); }

  function showCover() {
    // Re-captured every time the cover goes up, not once: a single-page app changes its
    // title as you navigate, and a one-shot snapshot would restore a stale one forever.
    // Skipped when the title is already ours, so a repeated show cannot capture the disguise.
    // Both variants, because an alert-level cover carries the prefix. Comparing only the
    // plain title would let a repeated show capture our own disguise as the page's title.
    const s0 = skin();
    const ours = s0 && (document.title === s0.title ||
                        document.title === (s0.titleAlertPrefix || '') + s0.title);
    if (!ours) {
      original.title = document.title;
      original.captured = true;
    }
    ensureCover();
    if (!hostEl) return;
    setHost('display', 'block');
    applyDisguiseChrome();
    // Re-asserted on an interval, not once: pages rewrite their own title, and a page that
    // adds its <link rel=icon> after the cover went up would otherwise win it back.
    if (!chromeGuard) chromeGuard = setInterval(() => {
      if (mode !== 'hidden') applyDisguiseChrome();
    }, 1000);
  }

  function hideCover() {
    if (hostEl) {
      setHost('display', 'none');
      setHost('opacity', '1');
      setHost('pointer-events', 'auto');
    }
    if (chromeGuard) { clearInterval(chromeGuard); chromeGuard = null; }
    if (original.captured) setTitle(original.title);
    restoreFavicon();
  }

  function applyDisguiseChrome() {
    const s = skin();
    if (!s) return;
    const d = describeSkinUpdate(signal);
    const want = (d.alert ? (s.titleAlertPrefix || '') : '') + s.title;
    if (document.title !== want) setTitle(want);
    applyDisguiseFavicon(d.alert ? (s.faviconAlert || s.favicon) : s.favicon);

    const root = shadow && shadow.querySelector('.ct-root');
    if (!root) return;
    root.setAttribute('data-ct-level', d.level);
    const label = root.querySelector('[data-ct-slot="label"]');
    const count = root.querySelector('[data-ct-slot="count"]');
    const live = root.querySelector('[data-ct-live]');
    // textContent, never innerHTML: a probe is untrusted input to this function.
    // The label is written even when null, clearing it to the skin's ::before glyph alone.
    // Leaving it would show the skin's placeholder text as though a probe had reported it.
    if (label) label.textContent = d.label == null ? '' : d.label;
    if (count) count.textContent = d.count == null ? '' : d.count;
    if (live) live.classList.toggle('ct-on', d.live && Date.now() - signalAt < CT_SIGNAL_STALE_MS);
  }

  function setTitle(t) { try { document.title = t; } catch (_) {} }

  function applyDisguiseFavicon(href) {
    if (realIconNodes === null) realIconNodes = [];
    const found = Array.prototype.slice.call(document.querySelectorAll("link[rel~='icon']"));
    found.forEach((n) => {
      if (n.id !== 'ct-favicon' && realIconNodes.indexOf(n) === -1) realIconNodes.push(n);
    });
    realIconNodes.forEach((n) => n.remove());
    let link = document.getElementById('ct-favicon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'ct-favicon';
      link.rel = 'icon';
      (document.head || document.documentElement).appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }

  function restoreFavicon() {
    const link = document.getElementById('ct-favicon');
    if (link) link.remove();
    if (realIconNodes) {
      realIconNodes.forEach((n) => (document.head || document.documentElement).appendChild(n));
    }
    // Cleared so the next cover cycle re-queries. Keeping the array would re-attach nodes
    // the page has since discarded, growing the head on every cover.
    realIconNodes = null;
  }

  // Lives in the ISOLATED world, so DevTools reaches it only after switching the console's
  // JavaScript context away from `top`.
  window.__ctDebug = () => ({ mode, focused, manualForce, profile: profile && profile.name });
})();
