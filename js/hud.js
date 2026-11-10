import { NUM_LAPS } from './constants.js';
import { formatTime } from './race.js';
import { t, ordinal } from './i18n.js';
export class Hud {
  constructor(id = 'hud') {
    this.id = id;
    this.el = document.getElementById(id);
    this.turbo = document.getElementById(`${id}-turbo`);
  }
  _text(key, value) {
    const el = document.getElementById(`${this.id}-${key}`);
    if (el.textContent !== value) el.textContent = value;
  }
  update(car, race) {
    this._text('position', ordinal(car.position));
    this._text('lap', car.finished ? t('hud.finished') : t('hud.lap', { lap: Math.min(car.lap + 1, NUM_LAPS), total: NUM_LAPS }));
    this._text('time', formatTime(race.getFinishTime(car.id) ?? race.elapsed));
    this._text('speed', String(Math.round(Math.abs(car.speed) * 0.36)));
    const status = t(car.finished ? 'hud.finished' : car.turboActive ? 'hud.boosting' : car.turboAvailable ? 'hud.turbo' : 'hud.used');
    if (this.turbo.querySelector('strong').textContent !== status) this.turbo.querySelector('strong').textContent = status;
    this.turbo.querySelector('small').textContent = t(car.finished ? 'hud.complete' : car.turboAvailable ? 'hud.turboAvailable' : 'hud.turboNext');
    this.turbo.setAttribute('aria-disabled', String(car.finished || !car.turboAvailable));
    this.turbo.classList.toggle('boosting', car.turboActive);
    this.turbo.classList.toggle('used', !car.turboAvailable && !car.turboActive);
  }
}
