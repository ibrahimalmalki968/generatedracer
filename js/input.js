/** Unified keyboard, captured-pointer and gamepad controls. */
export class InputHandler {
  constructor() {
    this.enabled = false;
    this._keys = new Set();
    this._pointers = new Map();
    this._bindings = [];
    this._turboPending = false;
    this._gamepad = {};
    this._gamepadWasTurbo = false;
    this._listen(window, 'keydown', e => this._key(e, true));
    this._listen(window, 'keyup', e => this._key(e, false));
    this._listen(window, 'blur', () => this.reset());
    this._listen(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    this._listen(window, 'gamepaddisconnected', () => this.reset());
  }

  _listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this._bindings.push(() => target.removeEventListener(type, fn, options));
  }

  _action(code) {
    const wasd = { KeyA: 'left', KeyD: 'right', KeyW: 'gas', KeyS: 'brake', KeyE: 'turbo' };
    const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'gas', ArrowDown: 'brake', KeyL: 'turbo' };
    return wasd[code] || arrows[code];
  }

  _key(e, down) {
    const action = this._action(e.code);
    if (!down) { this._keys.delete(e.code); return; }
    if (!this.enabled || !action || e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    // Let focused buttons retain normal Enter/Space activation.
    e.preventDefault();
    if (action === 'turbo' && !this._keys.has(e.code)) this._turboPending = true;
    this._keys.add(e.code);
  }

  bindButton(el, action) {
    this._listen(el, 'pointerdown', e => {
      if (!this.enabled || e.button > 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { action, el });
      el.classList.add('pressed');
      if (action === 'turbo') this._turboPending = true;
    });
    const release = e => {
      if (!this._pointers.has(e.pointerId)) return;
      this._pointers.delete(e.pointerId);
      if (![...this._pointers.values()].some(p => p.el === el)) el.classList.remove('pressed');
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this._listen(el, event, release);
    // Keyboard/assistive activation of the visible Turbo button.
    if (action === 'turbo') this._listen(el, 'click', e => {
      if (this.enabled && e.detail === 0) this._turboPending = true;
    });
  }

  setEnabled(value) { this.reset(); this.enabled = value; }
  reset() {
    this._keys.clear();
    for (const [id, { el }] of this._pointers) {
      if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id);
      el.classList.remove('pressed');
    }
    this._pointers.clear();
    this._turboPending = false;
    this._gamepad = {};
    this._gamepadWasTurbo = false;
  }

  pollGamepad() {
    this._gamepad = {};
    if (!this.enabled) return;
    let gp;
    try { gp = [...(navigator.getGamepads?.() || [])].find(Boolean); }
    catch { return; } // A denied Gamepad API must not stop touch/keyboard racing.
    if (!gp) { this._gamepadWasTurbo = false; return; }
    const pressed = i => Boolean(gp.buttons[i]?.pressed);
    const axis = gp.axes[0] || 0;
    this._gamepad = {
      steer: pressed(14) ? -1 : pressed(15) ? 1 : Math.abs(axis) > 0.2 ? axis : 0,
      gas: Math.max(gp.buttons[7]?.value || 0, pressed(12) ? 1 : 0),
      brake: Math.max(gp.buttons[6]?.value || 0, pressed(13) ? 1 : 0), turbo: pressed(0),
    };
    if (this._gamepad.turbo && !this._gamepadWasTurbo) this._turboPending = true;
    this._gamepadWasTurbo = this._gamepad.turbo;
  }

  get() {
    if (!this.enabled) return { steer: 0, gas: 0, brake: 0, turbo: false };
    const actions = new Set([...this._keys].map(k => this._action(k)));
    for (const { action } of this._pointers.values()) actions.add(action);
    const steer = actions.has('left') || actions.has('right')
      ? Number(actions.has('right')) - Number(actions.has('left')) : this._gamepad.steer || 0;
    const brake = Math.max(Number(actions.has('brake')), this._gamepad.brake || 0);
    const result = { steer, gas: brake ? 0 : Math.max(Number(actions.has('gas')), this._gamepad.gas || 0),
      brake, turbo: actions.has('turbo') || Boolean(this._gamepad.turbo) || this._turboPending };
    this._turboPending = false;
    return result;
  }

  destroy() { this.reset(); this._bindings.forEach(remove => remove()); this._bindings = []; }
}
