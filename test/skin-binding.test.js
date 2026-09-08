const test = require('node:test');
const assert = require('node:assert');
const { CT_IDLE_SIGNAL, describeSkinUpdate } = require('../src/lib/skin-binding.js');

test('the idle signal is quiet and non-alerting', () => {
  const d = describeSkinUpdate(CT_IDLE_SIGNAL);
  assert.equal(d.level, 'ok');
  assert.equal(d.alert, false);
  assert.equal(d.live, false);
});

test('missing or unknown levels fall back to ok', () => {
  assert.equal(describeSkinUpdate(null).level, 'ok');
  assert.equal(describeSkinUpdate({}).level, 'ok');
  assert.equal(describeSkinUpdate({ level: 'bogus' }).level, 'ok');
});

test('only alert sets the alert flag', () => {
  assert.equal(describeSkinUpdate({ level: 'warn' }).level, 'warn');
  assert.equal(describeSkinUpdate({ level: 'warn' }).alert, false);
  assert.equal(describeSkinUpdate({ level: 'alert' }).alert, true);
});

test('label and count are stringified, null stays null, zero survives', () => {
  const d = describeSkinUpdate({ label: 'Needs you', count: 42 });
  assert.equal(d.label, 'Needs you');
  assert.equal(d.count, '42');
  assert.equal(describeSkinUpdate({}).label, null);
  assert.equal(describeSkinUpdate({}).count, null);
  assert.equal(describeSkinUpdate({ count: 0 }).count, '0');
});

test('live is coerced to a boolean', () => {
  assert.equal(describeSkinUpdate({ live: 1 }).live, true);
  assert.equal(describeSkinUpdate({ live: undefined }).live, false);
});

test('a hostile probe cannot inject markup through a label', () => {
  const d = describeSkinUpdate({ label: '<img src=x onerror=alert(1)>' });
  assert.equal(typeof d.label, 'string');
});
