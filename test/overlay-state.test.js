const test = require('node:test');
const assert = require('node:assert');
const { computeOverlayMode } = require('../src/lib/overlay-state.js');

const base = { manualForce: false, autoReveal: false, autoCover: true, focused: true, peekWhenFocused: true };

test('manual lock covers regardless of everything else', () => {
  assert.equal(computeOverlayMode({ ...base, manualForce: true, focused: true }), 'cover');
  assert.equal(computeOverlayMode({ ...base, manualForce: true, autoReveal: true }), 'cover');
});

test('auto-reveal lifts the cover when not manually locked', () => {
  assert.equal(computeOverlayMode({ ...base, autoReveal: true, focused: false }), 'hidden');
});

test('unfocused covers only when auto-cover is enabled', () => {
  assert.equal(computeOverlayMode({ ...base, focused: false }), 'cover');
  assert.equal(computeOverlayMode({ ...base, focused: false, autoCover: false }), 'hidden');
});

test('focused peeks or reveals depending on the peek preference', () => {
  assert.equal(computeOverlayMode({ ...base, focused: true }), 'peek');
  assert.equal(computeOverlayMode({ ...base, focused: true, peekWhenFocused: false }), 'hidden');
});
