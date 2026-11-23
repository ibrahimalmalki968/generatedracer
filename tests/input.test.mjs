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
test('steer and brake retain independent pointer ownership', () => setup(h => {
  const left = new Button(), brake = new Button(); h.bindButton(left, 'left'); h.bindButton(brake, 'brake');
  event(left, 'pointerdown', { pointerId: 1, button: 0 }); event(brake, 'pointerdown', { pointerId: 2, button: 0 });
  assert.deepEqual(h.get(), { steer: -1, gas: 0, brake: 1, turbo: false });
  event(left, 'pointercancel', { pointerId: 1 }); assert.equal(h.get().steer, 0); assert.equal(h.get().brake, 1);
  event(brake, 'lostpointercapture', { pointerId: 2 }); assert.equal(h.get().brake, 0);
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
  event(window, 'keydown', { code: 'KeyS' }); assert.equal(h.get().brake, 1);
  event(window, 'blur'); assert.equal(h.get().brake, 0);
  h.setEnabled(false); event(window, 'keydown', { code: 'KeyS' }); assert.equal(h.get().brake, 0);
}));

test('WASD and arrows are alternatives for the same device player, including Turbo', () => setup(h => {
  for (const code of ['KeyS', 'ArrowDown']) {
    event(window, 'keydown', { code }); assert.equal(h.get().brake, 1);
    event(window, 'keyup', { code }); assert.equal(h.get().brake, 0);
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
  h._key({ code: 'KeyS', target: { closest: () => true }, preventDefault() {} }, true);
  assert.equal(h.get().brake, 0);
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[14].pressed = true; buttons[7].value = 1;
  setPads([{ axes: [0], buttons }]); h.pollGamepad(); assert.equal(h.get().steer, -1); assert.equal(h.get().brake, 0);
  event(window, 'keydown', { code: 'KeyS' }); assert.equal(h.get().gas, 0); assert.equal(h.get().brake, 1);
  setPads([]); event(window, 'gamepaddisconnected'); h.pollGamepad(); assert.equal(h.get().steer, 0); assert.equal(h.get().brake, 0);
}));
test('destroy removes keyboard/pointer listeners and capture state', () => setup(h => {
  const brake = new Button(); h.bindButton(brake, 'brake'); h.destroy();
  event(brake, 'pointerdown', { pointerId: 9, button: 0 }); event(window, 'keydown', { code: 'KeyS' });
  assert.equal(h.get().brake, 0); assert.equal(brake.captures.size, 0);
}));

test('a held thumb can drift across the edge and still releases on lift',()=>setup(h=>{
  const left=new Button(); h.bindButton(left,'left');
  event(left,'pointerdown',{pointerId:9,button:0});
  event(left,'pointermove',{pointerId:9,clientX:-12,clientY:5});
  assert.equal(h.get().steer,-1);
  event(left,'pointerup',{pointerId:9}); assert.equal(h.get().steer,0);
}));
