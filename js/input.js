/** Unified keyboard, captured-pointer and gamepad controls. */
export class InputHandler {
  constructor(surface) {
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
    this._listen(window, 'pagehide', () => this.reset());
    this._listen(window, 'orientationchange', () => this.reset());
    // Release even if capture is unavailable and the finger lifts elsewhere.
    for (const type of ['pointerup', 'pointercancel']) {
      this._listen(window, type, e => this._release(e.pointerId, type), true);
    }
    if (surface) {
      const suppress = e => { if (this.enabled && e.cancelable) e.preventDefault(); };
      for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'gesturechange', 'touchstart', 'touchmove']) {
        this._listen(surface, type, suppress, { passive: false });
      }
    }
    this._listen(document, 'visibilitychange', () => { if (document.hidden) this.reset(); });
    this._listen(window, 'gamepaddisconnected', () => this.reset());
  }

  _listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this._bindings.push(() => target.removeEventListener(type, fn, options));
  }

  _action(code) {
    const wasd = { KeyA: 'left', KeyD: 'right', KeyS: 'brake', KeyE: 'turbo' };
    const arrows = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'brake', KeyL: 'turbo' };
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
      // An interrupted native touch can already have lost its pointer ID.
      try { el.setPointerCapture?.(e.pointerId); }
      catch (error) {
        if (error.name === 'NotFoundError') return;
        throw error;
      }
      this._pointers.set(e.pointerId, { action, el, unreadTap: action === 'turbo' });
      el.classList.add('pressed');
    });
    const release = e => {
      if (this._pointers.get(e.pointerId)?.el === el) this._release(e.pointerId, e.type);
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this._listen(el, event, release);
    // A resting thumb can drift across a painted edge. Keep its initial control
    // until lift/cancel; captured events still arrive outside the button.
    // Keyboard/assistive activation of the visible Turbo button.
    if (action === 'turbo') this._listen(el, 'click', e => {
      if (this.enabled && e.detail === 0) this._turboPending = true;
    });
  }

  _release(id, type) {
    const pointer = this._pointers.get(id);
    if (!pointer) return;
    if (type === 'pointerup' && pointer.unreadTap) this._turboPending = true;
    this._pointers.delete(id);
    if (![...this._pointers.values()].some(p => p.el === pointer.el)) pointer.el.classList.remove('pressed');
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
      brake: Math.max(gp.buttons[6]?.value || 0, pressed(13) ? 1 : 0), turbo: pressed(0),
    };
    if (this._gamepad.turbo && !this._gamepadWasTurbo) this._turboPending = true;
    this._gamepadWasTurbo = this._gamepad.turbo;
  }

  get() {
    if (!this.enabled) return { steer: 0, gas: 0, brake: 0, turbo: false };
    const actions = new Set([...this._keys].map(k => this._action(k)));
    for (const pointer of this._pointers.values()) {
      actions.add(pointer.action);
      pointer.unreadTap = false;
    }
    const steer = actions.has('left') || actions.has('right')
      ? Number(actions.has('right')) - Number(actions.has('left')) : this._gamepad.steer || 0;
    const brake = Math.max(Number(actions.has('brake')), this._gamepad.brake || 0);
    const result = { steer, gas: brake ? 0 : 1,
      brake, turbo: actions.has('turbo') || Boolean(this._gamepad.turbo) || this._turboPending };
    this._turboPending = false;
    return result;
  }

  destroy() { this.reset(); this._bindings.forEach(remove => remove()); this._bindings = []; }
}
