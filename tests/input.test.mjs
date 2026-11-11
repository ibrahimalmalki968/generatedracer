import test from 'node:test';
import assert from 'node:assert/strict';
import { InputHandler } from '../js/input.js';

class Button extends EventTarget {
  captures = new Set();
  classes = new Set();
  classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c) };
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
function event(target, type, properties = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, properties); target.dispatchEvent(e);
}
function setup(fn) {
  globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
  let pads = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } });
  const h = new InputHandler(); h.setEnabled(true);
  try { fn(h, p => { pads = p; }); } finally { h.destroy(); }
}
test('multiple pointer ownership: releasing steer does not release acceleration', () => setup(h => {
  const left = new Button(), gas = new Button(); h.bindButton(left, 'left'); h.bindButton(gas, 'gas');
  event(left, 'pointerdown', { pointerId: 1, button: 0 }); event(gas, 'pointerdown', { pointerId: 2, button: 0 });
  assert.deepEqual(h.get(), { steer: -1, gas: 1, brake: 0, turbo: false });
  event(left, 'pointercancel', { pointerId: 1 }); assert.equal(h.get().steer, 0); assert.equal(h.get().gas, 1);
  event(gas, 'lostpointercapture', { pointerId: 2 }); assert.equal(h.get().gas, 0);
}));
test('two fingers on one button and quick Turbo taps retain their own state', () => setup(h => {
  const turbo = new Button(); h.bindButton(turbo, 'turbo');
  event(turbo, 'pointerdown', { pointerId: 1, button: 0 }); event(turbo, 'pointerup', { pointerId: 1 });
  assert.equal(h.get().turbo, true); assert.equal(h.get().turbo, false);
  event(turbo, 'pointerdown', { pointerId: 1, button: 0 }); event(turbo, 'pointerdown', { pointerId: 2, button: 0 });
  event(turbo, 'pointerup', { pointerId: 1 }); assert.equal(h.get().turbo, true); assert.ok(turbo.classes.has('pressed'));
  event(turbo, 'pointerup', { pointerId: 2 }); assert.equal(h.get().turbo, false);
}));
test('blur clears held controls and disabled handlers ignore input', () => setup(h => {
  event(window, 'keydown', { code: 'KeyW' }); assert.equal(h.get().gas, 1);
  event(window, 'blur'); assert.equal(h.get().gas, 0);
  h.setEnabled(false); event(window, 'keydown', { code: 'KeyW' }); assert.equal(h.get().gas, 0);
}));

test('WASD and arrows are alternatives for the same device player, including Turbo', () => setup(h => {
  for (const code of ['KeyW', 'ArrowUp']) {
    event(window, 'keydown', { code }); assert.equal(h.get().gas, 1);
    event(window, 'keyup', { code }); assert.equal(h.get().gas, 0);
  }
  for (const code of ['KeyA', 'ArrowLeft']) {
    event(window, 'keydown', { code }); assert.equal(h.get().steer, -1);
    event(window, 'keyup', { code }); assert.equal(h.get().steer, 0);
  }
  for (const code of ['KeyE', 'KeyL']) {
    event(window, 'keydown', { code }); assert.equal(h.get().turbo, true);
    event(window, 'keyup', { code }); assert.equal(h.get().turbo, false);
  }
}));
test('form focus does not drive; brake wins; gamepad D-pad works with neutral stick', () => setup((h, setPads) => {
  h._key({ code: 'KeyW', target: { closest: () => true }, preventDefault() {} }, true);
  assert.equal(h.get().gas, 0);
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[14].pressed = true; buttons[7].value = 1;
  setPads([{ axes: [0], buttons }]); h.pollGamepad(); assert.equal(h.get().steer, -1); assert.equal(h.get().gas, 1);
  event(window, 'keydown', { code: 'KeyS' }); assert.equal(h.get().gas, 0); assert.equal(h.get().brake, 1);
  setPads([]); event(window, 'gamepaddisconnected'); h.pollGamepad(); assert.equal(h.get().steer, 0); assert.equal(h.get().gas, 0);
}));
test('destroy removes keyboard/pointer listeners and capture state', () => setup(h => {
  const gas = new Button(); h.bindButton(gas, 'gas'); h.destroy();
  event(gas, 'pointerdown', { pointerId: 9, button: 0 }); event(window, 'keydown', { code: 'KeyW' });
  assert.equal(h.get().gas, 0); assert.equal(gas.captures.size, 0);
}));
