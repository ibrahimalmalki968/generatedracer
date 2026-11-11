/** Browser composition and renderer. Core physics and race rules live in simulation.js. */
import { InputHandler } from './input.js';
import { Hud } from './hud.js';
import { drawTrack } from './track.js';
import { formatTime } from './race.js';
import { APP_VERSION, SIMULATION_STEP } from './constants.js';
import { Network } from './network.js';
import { LobbyUI } from './lobby.js';
import { Car } from './car.js';
import { t, displayNameOf, ordinal, initLanguage, languageEvents, getLanguage } from './i18n.js';
import { message } from '../shared/translations.js';

import { Presentation, setButtonLabel } from './ui.js';

initLanguage();
const presentation = new Presentation();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = new InputHandler();
const hud = new Hud();
const network = new Network();
const lobby = new LobbyUI(network);
const drawingCars = new Map();
let session = null;
let state = 'menu';
let pausedState = 'racing';
let accumulator = 0;
let lastTimestamp = null;
let width = 0, height = 0, pixelRatio = 1;
let camera = null;
let renderDirty = true;

for (const [id, action] of [['btn-left', 'left'], ['btn-right', 'right'], ['btn-gas', 'gas'], ['btn-brake', 'brake']]) {
  input.bindButton(document.getElementById(id), action);
}
input.bindButton(hud.turbo, 'turbo');

function resize() {
  input.reset();
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
function showCountdown(value) {
  const number = document.getElementById('countdownNum');
  if (number.textContent !== String(value)) {
    number.textContent = String(value); const box = number.closest('.countdown-content'); box.classList.remove('tick'); void box.offsetWidth; box.classList.add('tick');
    document.querySelectorAll('.start-lights i').forEach((light, i) => light.classList.toggle('dim', i >= 4 - value));
  }
  const box = document.getElementById('countdown'), label = t('race.countdownLabel', { count: value });
  if (box.getAttribute('aria-label') !== label) box.setAttribute('aria-label', label);
}
function waitingMessage(finished) {
  return t('race.waiting', { names: finished.length ? displayNameOf(finished[0]) : '',
    count: (network.latest?.cars || []).filter(c => !c.finished && !c.disconnected).length });
}
function setInputs(enabled) {
  input.setEnabled(enabled);
}
function syncScreens() {
  renderDirty = true;
  const playing = state === 'racing' || state === 'countdown';
  lobby.view(state);
  show('raceOver', state === 'finished');
  show('pauseMenu', state === 'paused');
  show('hud', playing);
  show('raceToolbar', playing);
  show('keyHint', playing);
  show('touchControls', playing);
  show('countdown', state === 'countdown');
  show('btn-cancel-countdown', state === 'countdown');
  show('raceStatus', playing && session?.cars.some(c => c.finished));
  presentation.update(state);
}

function pause() {
  if (!['racing', 'countdown'].includes(state)) return;
  pausedState = state;
  network.neutral();
  state = 'paused';
  accumulator = 0;
  setInputs(false);
  syncScreens();
  refreshCopy();
  document.getElementById('btn-resume').focus();
}
function resume() {
  state = pausedState;
  lastTimestamp = null;
  setInputs(state === 'racing');
  document.activeElement?.blur();
  syncScreens();
}
function menu(toMain = false) {
  if (network.room) { setInputs(false); network.neutral(); lobby.leave(toMain ? 'modes' : 'browser'); return; }
  state = network.ready ? 'modes' : 'menu';
  setInputs(false);
  session = null;
  camera = null;
  accumulator = 0;
  syncScreens();
  if (state === 'menu') document.getElementById('nickname').focus();
}
function finish() {
  state = 'finished';
  setInputs(false);
  renderResults();
  syncScreens();
  document.getElementById('resultsTitle').focus({ preventScroll: true });
}
function renderResults() {
  const results = document.getElementById('results');
  results.replaceChildren();
  const standings = session.race.getResults();
  const winner = standings.find(r => r.status === 'finished');
  document.getElementById('winnerName').textContent = winner ? displayNameOf(winner) : '';
  document.getElementById('resultsSummary').textContent = winner ? t('results.winner', { name: displayNameOf(winner) }) : t('results.noWinner');
  document.getElementById('resultsHint').textContent = t(network.room && !network.room.solo ? 'results.lobbyHint' : 'results.replayHint');
  const ownId = network.latest?.cars.find(c => c.participantId === network.playerId)?.id;
  const own = standings.find(r => r.id === ownId);
  document.getElementById('personalResult').textContent = own ? t(own.status === 'disconnected' ? 'ui.yourDnf' : 'ui.yourFinish', { position: ordinal(own.position) }) : '';
  for (const r of standings) {
    const row = document.createElement('li');
    row.className = `result-row${r.isHuman ? ' result-human' : ''}`;
    row.dataset.dnf = String(r.status === 'disconnected');
    row.classList.toggle('result-self', r.id === ownId);
    for (const [className, text] of [['pos', r.status === 'disconnected' ? t('results.dnf') : `${r.position}.`], ['name', displayNameOf(r)],
      ['info', r.finished ? t('results.time', { time: formatTime(r.finishTime), best: formatTime(r.bestLap) }) : r.status === 'disconnected' ? t('results.disconnected') : t('results.unfinished', { lap: Math.min(r.lap + 1, 3) })]]) {
      const span = document.createElement('span'); span.className = className; span.textContent = text; if (className === 'name') span.dir = 'auto'; row.append(span);
    }
    results.append(row);
  }
}

function onlineScene() {
  if (!network.latest) return;
  const cars = network.displayCars().map(s => {
    let car = drawingCars.get(s.id);
    if (!car) { car = new Car(s.id, s.x, s.y, s.angle); drawingCars.set(s.id, car); }
    Object.assign(car, s); return car;
  });
  const race = {
    elapsed: network.latest.elapsed,
    getOrdinal: id => ordinal(network.latest.cars[id]?.position),
    getBestLap: id => network.latest.cars[id]?.bestLap,
    getFinishTime: id => network.latest.cars[id]?.finishTime,
    getResults: () => network.room?.results || [],
  };
  session = { cars, race };
  const own = cars.find(c => c.participantId === network.playerId);
  const target = own?.finished ? cars.find(c => c.isHuman && !c.finished && !c.disconnected) || own : own;
  if (target) {
    if (!camera) camera = { x: target.x, y: target.y, carId: target.id };
    camera.carId = target.id;
    hud.update(own, race);
  }
}

network.addEventListener('welcome', () => {
  if (!network.room) { session = null; camera = null; state = lobby.invite ? 'browser' : 'modes'; setInputs(false); syncScreens(); }
});
lobby.addEventListener('navigate', e => {
  if (network.room) return;
  session = null; camera = null; drawingCars.clear(); accumulator = 0;
  state = e.detail; setInputs(false); syncScreens();
});
network.addEventListener('room', e => {
  const room = e.detail;
  if (room.phase === 'lobby') {
    state = room.solo ? 'modes' : 'lobby'; session = null; camera = null; drawingCars.clear(); setInputs(false);
  } else if (room.phase === 'countdown') {
    state = 'countdown'; session = null; camera = null; drawingCars.clear(); accumulator = 0; setInputs(false);
    hud.prepare(room.players.find(p => p.id === network.playerId)?.nickname || network.nickname);
  } else if (room.phase === 'racing') {
    if (state !== 'racing') { accumulator = 0; setInputs(true); }
    state = 'racing';
  } else if (room.phase === 'results') {
    onlineScene();
    if (session) finish();
  }
  refreshCopy();
  syncScreens();
});
network.addEventListener('left', e => {
  session = null; camera = null; drawingCars.clear();
  state = e.detail.solo ? 'modes' : lobby.leaveDestination; lobby.leaveDestination = 'browser';
  setInputs(false); syncScreens();
});
network.addEventListener('disconnected', e => {
  session = null; camera = null; drawingCars.clear(); state = 'menu'; setInputs(false); syncScreens();
  lobby.message(network.closeMessage || message(e.detail === 4001 ? 'connection.elsewhere' : 'connection.disconnected'));
});

function loop(ts) {
  const dt = lastTimestamp === null ? 0 : Math.min((ts - lastTimestamp) / 1000, 0.25);
  lastTimestamp = ts;
  if (network.latest) onlineScene();
  if (state === 'countdown') {
    showCountdown(Math.max(1, Math.ceil((network.room.startAt - Date.now() - network.offset) / 1000)));
  } else if (state === 'racing') {
    input.pollGamepad(); accumulator += dt;
    while (accumulator >= SIMULATION_STEP) { network.predict(input.get()); accumulator -= SIMULATION_STEP; }
    const finished = network.latest?.cars.filter(c => c.finished) || [];
    show('raceStatus', finished.length > 0);
    if (finished.length) {
      const label = waitingMessage(finished), status = document.getElementById('raceStatus');
      if (status.textContent !== label) status.textContent = label;
    }
  }
  if (state === 'racing' || state === 'countdown' || renderDirty) {
    render(dt);
    renderDirty = false;
  }
  requestAnimationFrame(loop);
}

function renderRace(camera, dt) {
  const car = session.cars.find(c => c.id === camera.carId);
  const lerp = 1 - Math.exp(-8 * dt);
  camera.x += (car.x - camera.x) * lerp;
  camera.y += (car.y - camera.y) * lerp;
  const scale = width < height ? width / 850 : height / 620;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-camera.x, -camera.y);
  drawTrack(ctx);
  [...session.cars].sort((a, b) => a.y - b.y).forEach(c => {
    c.draw(ctx);
  });
  // Separate close starting-grid labels instead of drawing names over one another.
  const labels = [];
  const labelSize = Math.max(18, 11 / scale);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${labelSize}px "Segoe UI", Tahoma, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.direction = getLanguage() === 'ar' ? 'rtl' : 'ltr';
  for (const c of session.cars) {
    const name = displayNameOf(c);
    const text = '\u2068' + name + '\u2069' + (c.finished ? ' ✓' : '');
    const w = ctx.measureText(text).width + 8 / scale, h = labelSize + 5 / scale;
    const x = c.x;
    let y = c.y - 30;
    while (labels.some(r => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < h)) y -= h;
    labels.push({ x, y, w });
    if (y < c.y - 31) {
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 18); ctx.lineTo(x, y + 4 / scale);
      ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1 / scale; ctx.stroke();
    }
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}
function render(dt) {
  if (!width || !height) return;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = '#285d24'; ctx.fillRect(0, 0, width, height);
  if (session && camera) {
    renderRace(camera, dt);
  } else {
    const scale = Math.min(width / 3200, height / 2200) * 0.9;
    ctx.translate((width - 3000 * scale) / 2, (height - 2000 * scale) / 2);
    ctx.scale(scale, scale); drawTrack(ctx);
  }
}

document.getElementById('btn-restart').addEventListener('click', () => lobby.action(network.room.solo ? 'solo' : 'back', { raceId: network.room.raceId }));
document.getElementById('btn-menu').addEventListener('click', () => menu(true));
document.getElementById('btn-pause').addEventListener('click', pause);
document.getElementById('btn-resume').addEventListener('click', resume);
document.getElementById('btn-leave').addEventListener('click', () => menu());
const inactive = () => { input.reset(); network.neutral(); };
window.addEventListener('blur', inactive);
document.addEventListener('visibilitychange', () => { if (document.hidden) inactive(); });
window.addEventListener('keydown', e => { if (e.code === 'Escape') { if (state === 'paused') resume(); else pause(); } });
document.getElementById('btn-cancel-countdown').addEventListener('click', () => lobby.action('cancel'));
function refreshCopy() {
  document.getElementById('menu-version').textContent = t('footer.version', { version: APP_VERSION });
  setButtonLabel(document.getElementById('btn-pause'), t('race.onlineMenu'));
  document.getElementById('btn-pause').setAttribute('aria-label', t('race.onlineMenu'));
  setButtonLabel(document.getElementById('btn-restart'), t(network.room && !network.room.solo ? 'results.returnLobby' : 'results.playAgain'));
  document.getElementById('btn-menu').textContent = t('nav.main');
  document.getElementById('btn-leave').textContent = t(network.room?.solo ? 'nav.main' : 'pause.leave');
  document.getElementById('pauseTitle').textContent = t('pause.onlineTitle');
  document.getElementById('pauseDescription').textContent = t('pause.onlineDescription');
  const count = Number(document.getElementById('countdownNum').textContent) || 3;
  document.getElementById('countdown').setAttribute('aria-label', t('race.countdownLabel', { count }));
  if (network.latest) onlineScene();
  if (state === 'finished' && session) renderResults();
  if (document.getElementById('raceStatus').textContent) {
    const finished = network.latest?.cars.filter(c => c.finished) || [];
    document.getElementById('raceStatus').textContent = waitingMessage(finished);
  }
  renderDirty = true;
}
languageEvents.addEventListener('change', refreshCopy);
refreshCopy();
syncScreens();
resize();
requestAnimationFrame(loop);
