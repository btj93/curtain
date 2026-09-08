function computeOverlayMode(s) {
  if (s.manualForce) return 'cover';
  if (s.autoReveal) return 'hidden';
  if (!s.focused) return s.autoCover ? 'cover' : 'hidden';
  return s.peekWhenFocused ? 'peek' : 'hidden';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeOverlayMode };
}
