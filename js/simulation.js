/** Local race composition, independent of browser rendering and input devices. */
import { Car, resolveCarCollision } from './car.js';
import { AiController } from './ai.js';
import { RaceManager } from './race.js';
import { NUM_AI } from './constants.js';
import { trackProgress } from './track.js';

export const START_POSITIONS = [
  { x: 1490, y: 268, angle: 0 }, { x: 1490, y: 335, angle: 0 },
  { x: 1420, y: 268, angle: 0 }, { x: 1420, y: 335, angle: 0 },
  { x: 1350, y: 268, angle: 0 }, { x: 1350, y: 335, angle: 0 },
];

export class LocalSession {
  constructor(humans = 1) {
    if (!Number.isInteger(humans) || humans < 1 || humans > 6) throw new RangeError('Races support one to six humans.');
    this.humans = humans;
    // Solo has five AI; local two-human races have no AI filling empty slots.
    this.cars = Array.from({ length: humans === 1 ? 1 + NUM_AI : humans }, (_, id) => {
      const p = START_POSITIONS[id];
      return new Car(id, p.x, p.y, p.angle, { isHuman: id < humans,
        name: id < humans ? humans === 1 ? 'YOU' : `PLAYER ${id + 1}` : `CPU ${id}` });
    });
    this.ai = this.cars.filter(c => !c.isHuman).map(c => new AiController(c));
    this.race = new RaceManager(this.cars);
  }

  start() { this.race.start(); }
  step(dt, inputs = []) {
    if (this.race.startTime === null || this.race.finished) return;
    this.cars.filter(c => c.isHuman).forEach(c => {
      c.input = inputs[c.id] || { gas: 0, brake: 0, steer: 0, turbo: false };
    });
    const player = this.cars[0];
    const progress = player.lap + trackProgress(player.x, player.y);
    this.ai.forEach(ai => ai.update(dt, progress));
    this.cars.forEach(c => c.update(dt));
    for (let a = 0; a < this.cars.length; a++) {
      for (let b = a + 1; b < this.cars.length; b++) resolveCarCollision(this.cars[a], this.cars[b]);
    }
    this.race.update(dt);
  }
}
