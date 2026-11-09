/** Browser composition and renderer. Core physics and race rules live in simulation.js. */
import { LocalSession } from './simulation.js';
import { InputHandler } from './input.js';
import { Hud } from './hud.js';
import { drawTrack } from './track.js';
import { formatTime } from './race.js';
import { APP_VERSION, SIMULATION_STEP } from './constants.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = new InputHandler('all');
const inputP1 = new InputHandler('wasd');
const inputP2 = new InputHandler('arrows');
const handlers = [input, inputP1, inputP2];
const hud = new Hud('hud'), hud2 = new Hud('hud2');
let session = null;
let state = 'menu';
let pausedState = 'racing';
let countdown = 3;
let accumulator = 0;
let lastTimestamp = null;
let width = 0, height = 0, pixelRatio = 1;
let cameras = [];
let renderDirty = true;
const activeInputs = () => session?.humans === 2 ? [inputP1, inputP2] : [input];

for (const [id, action] of [['btn-left', 'left'], ['btn-right', 'right'], ['btn-gas', 'gas'], ['btn-brake', 'brake']]) {
  input.bindButton(document.getElementById(id), action);
}
// One DOM button can dispatch to the correct enabled P1 handler in either local mode.
input.bindButton(hud.turbo, 'turbo');
inputP1.bindButton(hud.turbo, 'turbo');
inputP2.bindButton(hud2.turbo, 'turbo');

function resize() {
  handlers.forEach(h => h.reset());
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  render(0);
  renderDirty = false;
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

function show(id, visible) { document.getElementById(id).classList.toggle('hidden', !visible); }
function setInputs(enabled) {
  handlers.forEach(h => h.setEnabled(false));
  if (enabled) activeInputs().forEach(h => h.setEnabled(true));
}
function syncScreens() {
  renderDirty = true;
  const playing = state === 'racing' || state === 'countdown';
  const split = session?.humans === 2;
  document.body.classList.toggle('splitscreen', Boolean(split && playing));
  show('mainMenu', state === 'menu');
  show('raceOver', state === 'finished');
  show('pauseMenu', state === 'paused');
  show('hud', playing);
  show('hud2', playing && split);
  show('raceToolbar', playing);
  show('keyHint', playing);
  show('touchControls', playing && !split);
  show('countdown', state === 'countdown');
  show('raceStatus', playing && session?.cars.some(c => c.finished));
}

function start(humans) {
  setInputs(false);
  session = new LocalSession(humans);
  cameras = session.cars.slice(0, humans).map(c => ({ x: c.x, y: c.y }));
  state = 'countdown';
  countdown = 3;
  accumulator = 0;
  lastTimestamp = null;
  document.getElementById('countdownNum').textContent = '3';
  hud.update(session.cars[0], session.race);
  if (humans === 2) hud2.update(session.cars[1], session.race);
  document.activeElement?.blur();
  syncScreens();
}
function pause() {
  if (!['racing', 'countdown'].includes(state)) return;
  pausedState = state;
  state = 'paused';
  accumulator = 0;
  setInputs(false);
  syncScreens();
  document.getElementById('btn-resume').focus();
}
function resume() {
  state = pausedState;
  lastTimestamp = null;
  setInputs(state === 'racing');
  document.activeElement?.blur();
  syncScreens();
}
function menu() {
  state = 'menu';
  setInputs(false);
  session = null;
  cameras = [];
  accumulator = 0;
  syncScreens();
  document.getElementById('btn-single').focus();
}
function finish() {
  state = 'finished';
  setInputs(false);
  const results = document.getElementById('results');
  results.replaceChildren();
  for (const r of session.race.getResults()) {
    const row = document.createElement('li');
    row.className = `result-row${r.isHuman ? ' result-human' : ''}`;
    for (const [className, text] of [['pos', r.status === 'disconnected' ? 'DNF' : `${r.position}.`], ['name', r.name],
      ['info', r.finished ? `${formatTime(r.finishTime)} · best ${formatTime(r.bestLap)}` : r.status === 'disconnected' ? 'Disconnected' : `Unfinished · lap ${r.lap + 1}/3`]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = text; row.append(span);
    }
    results.append(row);
  }
  syncScreens();
  document.getElementById('btn-restart').focus();
}

function loop(ts) {
  const dt = lastTimestamp === null ? 0 : Math.min((ts - lastTimestamp) / 1000, 0.25);
  lastTimestamp = ts;
  if (state === 'countdown') {
    countdown -= dt;
    document.getElementById('countdownNum').textContent = String(Math.max(1, Math.ceil(countdown)));
    if (countdown <= 0) {
      state = 'racing'; session.start(); accumulator = 0; setInputs(true); syncScreens();
    }
  } else if (state === 'racing') {
    activeInputs().forEach(h => h.pollGamepad());
    accumulator += dt;
    while (accumulator >= SIMULATION_STEP && state === 'racing') {
      session.step(SIMULATION_STEP, activeInputs().map(h => h.get()));
      accumulator -= SIMULATION_STEP;
      if (session.race.finished) finish();
    }
    hud.update(session.cars[0], session.race);
    if (session.humans === 2) hud2.update(session.cars[1], session.race);
    const waiting = session.cars.some(c => c.finished);
    show('raceStatus', state === 'racing' && waiting);
    if (waiting) document.getElementById('raceStatus').textContent = 'A racer has finished. Keep racing — all players can finish.';
  }
  if (state === 'racing' || state === 'countdown' || renderDirty) {
    render(dt);
    renderDirty = false;
  }
  requestAnimationFrame(loop);
}

function renderViewport(camera, offset, viewWidth, dt) {
  const car = session.cars[cameras.indexOf(camera)];
  const lerp = 1 - Math.exp(-8 * dt);
  camera.x += (car.x - camera.x) * lerp;
  camera.y += (car.y - camera.y) * lerp;
  const scale = viewWidth < height ? viewWidth / 850 : height / 620;
  ctx.save();
  ctx.beginPath(); ctx.rect(offset, 0, viewWidth, height); ctx.clip();
  ctx.translate(offset + viewWidth / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);
  drawTrack(ctx);
  [...session.cars].sort((a, b) => a.y - b.y).forEach(c => {
    c.draw(ctx);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(c.finished ? `${c.name} ✓` : c.name, c.x, c.y - 30);
  });
  ctx.restore();
}
function render(dt) {
  if (!width || !height) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = '#285d24'; ctx.fillRect(0, 0, width, height);
  if (session && cameras.length) {
    const viewWidth = width / session.humans;
    cameras.forEach((camera, i) => renderViewport(camera, i * viewWidth, viewWidth, dt));
    if (session.humans === 2) {
      ctx.fillStyle = '#eee'; ctx.fillRect(viewWidth - 1, 0, 2, height);
    }
  } else {
    const scale = Math.min(width / 3200, height / 2200) * 0.9;
    ctx.translate((width - 3000 * scale) / 2, (height - 2000 * scale) / 2);
    ctx.scale(scale, scale); drawTrack(ctx);
  }
}

document.getElementById('btn-single').addEventListener('click', () => start(1));
document.getElementById('btn-splitscreen').addEventListener('click', () => start(2));
document.getElementById('btn-restart').addEventListener('click', () => start(session.humans));
document.getElementById('btn-menu').addEventListener('click', menu);
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-resume').addEventListener('click', resume);
document.getElementById('btn-leave').addEventListener('click', menu);
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('keydown', e => { if (e.code === 'Escape') { if (state === 'paused') resume(); else pause(); } });
document.getElementById('menu-version').textContent = `v${APP_VERSION} · Phase 1 preview`;
syncScreens();
resize();
requestAnimationFrame(loop);
