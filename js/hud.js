import { NUM_LAPS } from './constants.js';
import { formatTime } from './race.js';
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
    this._text('position', race.getOrdinal(car.id) || '1st');
    this._text('lap', car.finished ? 'FINISHED' : `LAP ${Math.min(car.lap + 1, NUM_LAPS)} / ${NUM_LAPS}`);
    this._text('time', formatTime(race.getFinishTime(car.id) ?? race.elapsed));
    this._text('speed', String(Math.round(Math.abs(car.speed) * 0.36)));
    const status = car.finished ? 'Finished' : car.turboActive ? 'BOOSTING' : car.turboAvailable ? 'TURBO' : 'USED';
    if (this.turbo.querySelector('strong').textContent !== status) this.turbo.querySelector('strong').textContent = status;
    this.turbo.querySelector('small').textContent = car.finished ? 'Race complete' : car.turboAvailable ? '1 use this lap' : 'Next lap refreshes';
    this.turbo.setAttribute('aria-disabled', String(car.finished || !car.turboAvailable));
    this.turbo.classList.toggle('boosting', car.turboActive);
    this.turbo.classList.toggle('used', !car.turboAvailable && !car.turboActive);
  }
}
