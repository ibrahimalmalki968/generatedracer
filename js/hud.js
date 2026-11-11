import { NUM_LAPS } from './constants.js';
import { formatTime } from './race.js';
import { t, ordinal, displayNameOf } from './i18n.js';
export class Hud {
  constructor(id = 'hud') {
    this.id = id;
    this.el = document.getElementById(id);
    this.turbo = document.getElementById(`${id}-turbo`);
    this.turboTitle = this.turbo.querySelector('strong'); this.turboCaption = this.turbo.querySelector('small');
    this.nodes = new Map(); this.lastLap = null; this.lastCar = null; this.announcement = null;
    this.segments = [...document.getElementById(`${id}-progress`).children];
  }
  _text(key, value) {
    if (!this.nodes.has(key)) this.nodes.set(key, document.getElementById(`${this.id}-${key}`));
    const el = this.nodes.get(key);
    if (el.textContent !== value) el.textContent = value;
  }
  prepare(name) {
    // Countdown has no new authoritative car snapshot yet. Never show the
    // previous race's Finished/Turbo/timing values while the new grid loads.
    this.lastCar = null; this.lastLap = 0; this.announcement = null;
    this._text('position', '—'); this._text('driver', name);
    this._text('lap', t('hud.lap', { lap: 1, total: NUM_LAPS }));
    this._text('time', formatTime(0)); this._text('speed', '0');
    this.turboTitle.textContent = t('hud.turbo'); this.turboCaption.textContent = t('hud.turboAvailable');
    this.turbo.setAttribute('aria-disabled', 'true'); this.turbo.classList.remove('used', 'boosting');
    this.nodes.get('lap').closest('.lap-pill').classList.remove('lap-changed');
    this.segments.forEach((segment, i) => { segment.classList.remove('complete'); segment.classList.toggle('current', i === 0); });
    if (this.id === 'hud') document.getElementById('raceAnnouncement').textContent = '';
  }
  update(car, race) {
    if (this.lastCar !== car.participantId + ':' + car.id) { this.lastLap = null; this.lastCar = car.participantId + ':' + car.id; }
    this._text('position', ordinal(car.position));
    this._text('lap', car.finished ? t('hud.finished') : t('hud.lap', { lap: Math.min(car.lap + 1, NUM_LAPS), total: NUM_LAPS }));
    this._text('time', formatTime(race.getFinishTime(car.id) ?? race.elapsed));
    this._text('speed', String(Math.round(Math.abs(car.speed) * 0.36)));
    this._text('driver', displayNameOf(car));
    if (this.lastLap !== car.lap) {
      this.segments.forEach((segment, i) => { segment.classList.toggle('complete', i < car.lap); segment.classList.toggle('current', i === car.lap); });
      const pill = this.nodes.get('lap').closest('.lap-pill');
      pill.classList.remove('lap-changed');
      if (this.lastLap !== null && car.lap > this.lastLap) { void pill.offsetWidth; pill.classList.add('lap-changed'); this.announcement = { key: car.finished ? 'hud.finished' : 'ui.lapComplete', params: { lap: car.lap } }; }
      else if (car.lap === 0) this.announcement = null;
      this.lastLap = car.lap;
    }
    if (this.id === 'hud') {
      const announcement = document.getElementById('raceAnnouncement'), copy = this.announcement ? t(this.announcement.key, this.announcement.params) : '';
      if (announcement.textContent !== copy) announcement.textContent = copy;
    }
    const status = t(car.finished ? 'hud.finished' : car.turboActive ? 'hud.boosting' : car.turboAvailable ? 'hud.turbo' : 'hud.used');
    if (this.turboTitle.textContent !== status) this.turboTitle.textContent = status;
    const caption = t(car.finished ? 'hud.complete' : car.turboAvailable ? 'hud.turboAvailable' : 'hud.turboNext');
    if (this.turboCaption.textContent !== caption) this.turboCaption.textContent = caption;
    const disabled = String(car.finished || !car.turboAvailable);
    if (this.turbo.getAttribute('aria-disabled') !== disabled) this.turbo.setAttribute('aria-disabled', disabled);
    this.turbo.classList.toggle('boosting', car.turboActive);
    this.turbo.classList.toggle('used', !car.turboAvailable && !car.turboActive);
  }
}
