const CT_IDLE_SIGNAL = { level: 'ok', label: null, count: null, live: false };

function describeSkinUpdate(signal) {
  const s = signal || {};
  const level = (s.level === 'alert' || s.level === 'warn') ? s.level : 'ok';
  return {
    level: level,
    label: s.label == null ? null : String(s.label),
    count: s.count == null ? null : String(s.count),
    live: !!s.live,
    alert: level === 'alert',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CT_IDLE_SIGNAL, describeSkinUpdate };
}
