(() => {
  'use strict';

  // Defaults on because registration is already scoped to profiles that enabled it, and
  // waiting for the engine's async storage read would leave a gap at document_start.
  let keepAlive = true;

  function spoofGetter(obj, prop, fakeValue) {
    const proto = Object.getPrototypeOf(obj);
    const desc = Object.getOwnPropertyDescriptor(obj, prop) ||
                 (proto && Object.getOwnPropertyDescriptor(proto, prop));
    const realGet = desc && desc.get;
    try {
      Object.defineProperty(obj, prop, {
        configurable: true,
        get() { return keepAlive ? fakeValue : (realGet ? realGet.call(obj) : undefined); },
      });
    } catch (_) { /* non-configurable on some builds; event swallowing still helps */ }
  }

  spoofGetter(document, 'hidden', false);
  spoofGetter(document, 'visibilityState', 'visible');
  spoofGetter(document, 'webkitHidden', false);
  spoofGetter(document, 'webkitVisibilityState', 'visible');

  // Capture phase at document_start runs ahead of the page's own handlers.
  const swallow = (e) => { if (keepAlive) { e.stopImmediatePropagation(); e.stopPropagation(); } };
  document.addEventListener('visibilitychange', swallow, true);
  document.addEventListener('webkitvisibilitychange', swallow, true);
  window.addEventListener('blur', swallow, true);
  window.addEventListener('pagehide', swallow, true);
  window.addEventListener('freeze', swallow, true);

  // document.hasFocus() is deliberately left honest: the engine relies on it to know when
  // you actually looked away, which spoofing it here would destroy.

  window.addEventListener('__ct_keepalive', (e) => { keepAlive = !!(e.detail); }, true);
})();
