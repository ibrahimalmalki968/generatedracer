import { singleDeviceView } from '../tests/browser-single-view.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createGameServer } from '../server/server.js';
import { translate } from '../shared/translations.js';

const evidence = resolve(process.env.EVIDENCE_DIR || '../i18n-qa'); await mkdir(evidence, { recursive: true });
const server = process.env.BASE_URL ? null : await createGameServer();
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:' + server.port + '/';
const full = process.env.BILINGUAL_SUITE !== 'smoke';
const report = { baseUrl, channel: process.env.BROWSER_CHANNEL || 'chrome', full, checks: [], errors: [], browserPlugin: 'Browser plugin not available; existing Playwright used' };
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
let browser; const contexts = [], pages = []; const started = performance.now();
const switchTo = async (p, language) => {
  await p.locator('[data-language="' + language + '"]').click();
  await p.waitForFunction(lang => document.documentElement.lang === lang, language);
};
async function customer(name, language, invite) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' }); contexts.push(ctx);
  if (language) await ctx.addInitScript(lang => localStorage.setItem('racer-language', lang), language);
  const p = await ctx.newPage(); pages.push(p);
  p.on('pageerror', e => report.errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await p.goto(invite || baseUrl);
  await p.evaluate(async () => {
    const { Network } = await import('/js/network.js'); const { AiController } = await import('/js/ai.js'); const { Car } = await import('/js/car.js');
    const connect = Network.prototype.connect, predict = Network.prototype.predict, send = Network.prototype.send;
    Network.prototype.connect = function(n) { window.qaNet = this; const result = connect.call(this, n); this.socket?.addEventListener('close', e => { window.qaClose = { code: e.code, reason: e.reason }; }); return result; };
    Network.prototype.send = function(m) { if (m.type !== 'input') (window.qaCommands ||= []).push(m.type); else { (window.qaInputTimes ||= []).push(performance.now()); if (window.qaInputTimes.length > 1000) window.qaInputTimes.shift(); } return send.call(this, m); };
    Network.prototype.predict = function(input) {
      const c = this.predicted;
      if (window.qaDrive && c && !c.finished) {
        const ghost = new Car(c.id, c.x, c.y, c.angle, { isHuman: false }); Object.assign(ghost, { speed: c.speed, lap: c.lap, turboAvailable: c.turboAvailable });
        new AiController(ghost).update(1 / 60); input = ghost.input;
      }
      return predict.call(this, input);
    };
  });
  if (name) { await p.locator('#nickname').fill(name); await p.locator('#nicknameForm button').click(); await p.waitForFunction(() => window.qaNet?.ready); }
  return p;
}
async function noMissing(p, stage) {
  const missing = await p.evaluate(async () => [...(await import('/js/i18n.js')).missingTranslations]);
  check(missing.length === 0, stage + ': no missing translation keys');
}
async function layout(p, language, stage) {
  check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage + ': no horizontal page overflow');
  const clip = await p.evaluate(() => [...document.querySelectorAll('.panel button, .panel label, .hud-pill strong, .mode-option small')].filter(el => el.getClientRects().length && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2).map(el => el.id || el.textContent));
  check(clip.length === 0, stage + ': no clipped labels/buttons ' + JSON.stringify(clip));
  check(await p.locator('html').getAttribute('dir') === (language === 'ar' ? 'rtl' : 'ltr'), stage + ': correct text direction');
}
async function results(p, language) {
  await p.locator('#raceOver').waitFor({ state: 'visible', timeout: 150000 });
  check((await p.locator('#resultsTitle').textContent()) === translate(language, 'results.title'), language + ': localized results title');
  check(await p.evaluate(() => qaNet.room.results.filter(r => r.isHuman).every(r => r.lap === 3 || r.status === 'disconnected')), language + ': results reflect authoritative three-lap standings');
  await noMissing(p, language + ' results');
}
try {
  browser = await chromium.launch({ channel: report.channel, headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  report.version = browser.version();
  const host = await customer();
  check(await host.title() === translate('ar', 'page.title'), 'Fresh English-browser visitor gets Arabic page title');
  check(await host.locator('html').getAttribute('lang') === 'ar', 'Arabic is default without saved preference');
  const leftovers = await host.evaluate(() => document.body.textContent.replace(/GenerateRacer|Jeroen Willemsen|MIT|WASD|Esc|English|\b[ELA]\b/g, '').match(/[A-Za-z]{2,}/g));
  check(!leftovers, 'All initial and hidden Arabic screen text is localized; only explicit technical/brand/language names exempt');
  await host.locator('#nicknameForm button').click();
  check(await host.locator('#appMessage').textContent() === translate('ar', 'error.nameLength', { max: 20 }), 'Arabic client validation replaces native browser validation');
  await switchTo(host, 'en');
  check(await host.locator('#appMessage').textContent() === translate('en', 'error.nameLength', { max: 20 }), 'Visible validation updates immediately to English');
  await host.reload(); check(await host.locator('html').getAttribute('lang') === 'en', 'Language persists after refresh');
  const savedPreference = await host.context().storageState();
  const revisit = await browser.newContext({ storageState: savedPreference }); contexts.push(revisit);
  const revisitPage = await revisit.newPage(); await revisitPage.goto(baseUrl);
  check(await revisitPage.locator('html').getAttribute('lang') === 'en', 'Saved preference survives a new visit with stored browser data'); await revisit.close();
  // Reload replaced the QA prototype hooks. Reapply once by returning through customer helper state.
  await host.evaluate(async () => {
    const { Network } = await import('/js/network.js'); const connect = Network.prototype.connect, predict = Network.prototype.predict, send = Network.prototype.send;
    const { AiController } = await import('/js/ai.js'); const { Car } = await import('/js/car.js');
    Network.prototype.connect = function(n) { window.qaNet = this; const result = connect.call(this, n); this.socket?.addEventListener('close', e => { window.qaClose = { code: e.code, reason: e.reason }; }); return result; };
    Network.prototype.send = function(m) { if (m.type !== 'input') (window.qaCommands ||= []).push(m.type); else { (window.qaInputTimes ||= []).push(performance.now()); if (window.qaInputTimes.length > 1000) window.qaInputTimes.shift(); } return send.call(this, m); };
    Network.prototype.predict = function(input) { const c = this.predicted; if (window.qaDrive && c && !c.finished) { const g = new Car(c.id, c.x, c.y, c.angle, { isHuman: false }); Object.assign(g, { speed: c.speed, lap: c.lap, turboAvailable: c.turboAvailable }); new AiController(g).update(1 / 60); input = g.input; } return predict.call(this, input); };
  });
  await switchTo(host, 'ar'); await host.locator('#nickname').fill('عمر Racer'); await host.locator('#nicknameForm button').click(); await host.locator('#modeMenu').waitFor({ state: 'visible' });
  for (const language of ['ar', 'en']) {
    await switchTo(host, language);
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await host.setViewportSize(viewport); await layout(host, language, language + ' mode ' + viewport.width + 'x' + viewport.height);
      const boxes = await Promise.all(['#btn-solo', '#btn-multiplayer', '#languageSwitcher'].map(s => host.locator(s).boundingBox()));
      check(boxes.every(b => b && b.y >= 0 && b.x >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height), language + ': both modes and switcher visible without scrolling at ' + viewport.width + 'x' + viewport.height);
    }
    await host.setViewportSize({ width: 390, height: 844 }); await host.screenshot({ path: evidence + '/menu-' + language + '.png', scale: 'css' });
  }
  await switchTo(host, 'ar'); await host.locator('#btn-multiplayer').click(); await host.locator('summary[data-i18n="room.createSummary"]').click();
  await host.locator('#roomName').fill('جلسة Friends'); await host.locator('#roomPrivacy').selectOption('private'); await host.locator('#createForm button').click(); await host.locator('#lobbyScreen').waitFor({ state: 'visible' });
  const code = await host.locator('#lobbyCode').textContent(), invite = await host.locator('#inviteLink').inputValue();
  check(await host.locator('#lobbyName').textContent() === 'جلسة Friends', 'Custom mixed-script room names preserved');
  check(await host.locator('#inviteLink').getAttribute('dir') === 'ltr' && await host.locator('#roomCode').getAttribute('dir') === 'ltr', 'URLs and room codes remain LTR');
  await host.locator('#lobbyScreen details summary').click(); await host.locator('#btn-invite').click(); await host.locator('#appMessage').waitFor({ state: 'visible' });
  const arCopy = await host.locator('#appMessage').textContent();
  check([translate('ar', 'notice.copied'), translate('ar', 'notice.copyManually')].includes(arCopy), 'Clipboard success/fallback notification localized');
  await switchTo(host, 'en'); check([translate('en', 'notice.copied'), translate('en', 'notice.copyManually')].includes(await host.locator('#appMessage').textContent()), 'Existing notification translates without repeating clipboard action'); await switchTo(host, 'ar');
  const guest = await customer('CPU 1', 'en', invite); await guest.locator('#lobbyScreen').waitFor({ state: 'visible' });
  const observer = await customer('زائر'); await observer.locator('#btn-multiplayer').click();
  check(!(await observer.locator('#publicRooms').textContent()).includes('جلسة Friends'), 'Private room stays hidden in Arabic public browser');
  await observer.getByText(translate('ar', 'room.codeSummary'), { exact: true }).click(); await observer.locator('#roomCode').fill('BAD'); await observer.locator('#joinForm button').click();
  await observer.waitForFunction(() => document.getElementById('appMessage').textContent.includes('غير صحيح'));
  check(await observer.locator('#appMessage').textContent() === translate('ar', 'error.roomCode'), 'Server room-code validation localized to Arabic');
  await switchTo(observer, 'en'); check(await observer.locator('#appMessage').textContent() === translate('en', 'error.roomCode'), 'Same server error switches to English immediately');
  await host.locator('#btn-room-start').click(); await host.waitForFunction(() => qaNet.room.players.some(p => p.ready));
  const readiness = await host.evaluate(() => JSON.stringify(qaNet.room.players)); await switchTo(host, 'en');
  check(await host.evaluate(before => JSON.stringify(qaNet.room.players) === before, readiness), 'Lobby language switch preserves roster and readiness');
  await guest.locator('#btn-room-start').click(); await host.locator('#countdown').waitFor({ state: 'visible' });
  const deadline = await host.evaluate(() => qaNet.room.startAt); await switchTo(host, 'ar');
  check(await host.evaluate(before => qaNet.room.startAt === before, deadline), 'Countdown language switch preserves common server deadline');
  await Promise.all([host, guest].map(p => p.waitForFunction(() => qaNet.latest?.cars.length === 2)));
  await singleDeviceView(host, check, 'Arabic multiplayer'); await singleDeviceView(guest, check, 'English multiplayer');
  await layout(host, 'ar', 'Arabic HUD'); await layout(guest, 'en', 'English HUD');
  check((await host.locator('#hud-lap').textContent()).includes('\u20661 / 3\u2069'), 'Arabic HUD isolates 1 / 3 as an LTR numeric fraction');
  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 844, height: 390 }]) {
    await host.setViewportSize(viewport); await layout(host, 'ar', 'Arabic racing ' + viewport.width + 'x' + viewport.height);
    const controls = await host.evaluate(() => ['btn-left', 'btn-right', 'btn-brake', 'btn-gas', 'hud-turbo', 'btn-pause'].map(id => {
      const el = document.getElementById(id), r = el.getBoundingClientRect();
      return { id, x: r.x, y: r.y, w: r.width, h: r.height, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id };
    }));
    check(controls.every(r => r.x >= 0 && r.y >= 0 && r.x + r.w <= viewport.width + .1 && r.y + r.h <= viewport.height + .1 && r.h >= 44 && r.hit === r.id), 'Arabic driving/HUD targets fit and respond, clear of switcher at ' + viewport.width + 'x' + viewport.height);
  }
  await host.setViewportSize({ width: 390, height: 844 });
  const directions = await host.evaluate(() => ['btn-left', 'btn-right', 'btn-brake', 'btn-gas'].map(id => document.getElementById(id).getBoundingClientRect().x));
  check(directions[0] < directions[1] && directions[2] < directions[3], 'Arabic keeps physical left/right steering and brake/gas order');
  await host.evaluate(() => { window.originalSocket = qaNet.socket; window.originalRace = qaNet.room.raceId; window.originalPlayer = qaNet.playerId; window.beforeCommands = qaCommands.length; window.pageOrigin = performance.timeOrigin; });
  // Viewport/other-page checks can leave this page unfocused; the game correctly
  // releases held keys on blur. Acquire actual focus before testing held keys.
  await host.bringToFront();
  await host.locator('#gameCanvas').click({ position: { x: 150, y: 280 } });
  await host.waitForFunction(() => document.hasFocus());
  await host.keyboard.down('ArrowUp'); await host.keyboard.down('ArrowLeft');
  await host.waitForFunction(() => qaNet.latest?.cars.find(c => c.participantId === qaNet.playerId)?.speed > 20); await switchTo(host, 'en'); await switchTo(host, 'ar');
  check(await host.evaluate(() => qaNet.socket === originalSocket && qaNet.room.raceId === originalRace && qaNet.playerId === originalPlayer && qaCommands.length === beforeCommands && performance.timeOrigin === pageOrigin), 'Live language switching sends no commands, reload or reconnection and retains car ownership');
  check(await host.evaluate(() => { const c = qaNet.latest.cars.find(c => c.participantId === qaNet.playerId); return c.speed > 20 && c.angle < 0; }), 'Held acceleration and left steering continue across language changes');
  await host.keyboard.up('ArrowLeft'); await host.keyboard.up('ArrowUp'); await host.locator('#hud-turbo').click();
  await host.waitForFunction(() => qaNet.latest.cars.find(c => c.participantId === qaNet.playerId).turboUses === 1);
  check((await host.locator('#hud-turbo').textContent()).includes('اللفة'), 'Turbo indicator stays localized after authoritative activation');
  await host.locator('#btn-pause').click(); await switchTo(host, 'en');
  check(await host.locator('#pauseTitle').textContent() === translate('en', 'pause.onlineTitle'), 'Online pause copy switches without pausing other racers');
  await switchTo(host, 'ar'); await host.locator('#btn-resume').click();
  await host.screenshot({ path: evidence + '/race-ar.png', scale: 'css' }); await noMissing(host, 'Arabic racing'); await noMissing(guest, 'English racing');
  if (full) {
    console.log('Driving mixed Arabic/English private race…');
    for (const p of [host, guest]) await p.evaluate(() => { window.qaDrive = true; });
    await Promise.all([results(host, 'ar'), results(guest, 'en')]);
    const standings = await host.evaluate(() => qaNet.room.results);
    assert.deepEqual(await guest.evaluate(() => qaNet.room.results), standings); check(true, 'Mixed-language clients share identical authoritative results');
    check(await host.locator('#results .name').allTextContents().then(names => names.includes('CPU 1')), 'Human nickname CPU 1 never translated as an AI name');
    const resultInfo = (await host.locator('#results .info').allTextContents()).join(' ');
    check(!resultInfo.includes('best') && resultInfo.includes('أفضل لفة'), 'Arabic result times/status labels are localized');
    await host.screenshot({ path: evidence + '/results-ar.png', scale: 'css' });
    await switchTo(host, 'en'); check((await host.locator('#resultsSummary').textContent()).includes('wins'), 'Winner announcement changes live on results screen'); await switchTo(host, 'ar');
    for (const p of [host, guest]) await p.evaluate(() => { window.qaDrive = false; });
    await host.locator('#btn-restart').click(); await Promise.all([host, guest].map(p => p.locator('#lobbyScreen').waitFor({ state: 'visible' })));
    check(await host.locator('#lobbyCode').textContent() === code && await host.evaluate(() => qaNet.room.players.every(p => !p.ready)), 'Mixed-language rematch returns same room and resets readiness');
    for (const p of [host, guest]) await p.locator('#btn-room-start').click();
    await host.waitForFunction(() => qaNet.room.phase === 'racing' && qaNet.latest?.cars.every(c => c.lap === 0 && c.turboUses === 0));
    await guest.context().close(); await host.evaluate(() => { window.qaDrive = true; }); await results(host, 'ar');
    check((await host.locator('#results').textContent()).includes(translate('ar', 'results.dnf')), 'Disconnect/DNF appears in Arabic and does not block remaining finisher');
    await host.locator('#btn-menu').click(); await host.locator('#modeMenu').waitFor({ state: 'visible' });
    for (const language of ['ar', 'en']) {
      await switchTo(host, language); await host.locator('#btn-solo').click(); console.log('Driving solo AI race in ' + language + '…');
      await host.waitForFunction(() => qaNet.latest?.cars.length === 6);
      await singleDeviceView(host, check, language + ' solo');
      await results(host, language);
      check(await host.locator('#results .name').allTextContents().then(names => names.some(n => n.includes(language === 'ar' ? 'المنافس الآلي' : 'CPU'))), language + ': generated AI names localized');
      await host.locator('#btn-menu').click(); await host.locator('#modeMenu').waitFor({ state: 'visible' });
    }
  } else { for (const p of [host, guest]) { await p.locator('#btn-pause').click(); await p.locator('#btn-leave').click(); } }
  // Public generated names are localized independently; room identity/code is shared.
  await observer.locator('#btn-browser-menu').click(); await switchTo(observer, 'ar'); await observer.locator('#btn-multiplayer').click();
  await observer.locator('summary[data-i18n="room.createSummary"]').click(); await observer.locator('#createForm button').click(); await observer.locator('#lobbyScreen').waitFor({ state: 'visible' });
  check((await observer.locator('#lobbyName').textContent()).includes('سباق'), 'Generated public room title localized in Arabic');
  const publicCode = await observer.locator('#lobbyCode').textContent();
  const publicGuest = await customer('Friend', 'en'); await publicGuest.locator('#btn-multiplayer').click();
  const publicRow = publicGuest.locator('#publicRooms [data-room-code="' + publicCode + '"]');
  await publicRow.waitFor({ state: 'visible' });
  check((await publicRow.textContent()).includes("'s race"), 'Same public room gets an English generated name for an English player');
  await publicRow.locator('button').click(); await publicGuest.locator('#lobbyScreen').waitFor({ state: 'visible' });
  check(await publicGuest.locator('#lobbyCode').textContent() === await observer.locator('#lobbyCode').textContent(), 'Translated public-room titles still join the same room');
  for (const p of pages.filter(p => !p.isClosed())) await noMissing(p, 'Final bilingual UI');
  check(report.errors.length === 0, 'No captured app/console/mixed-content errors');
  report.passed = report.checks.length;
} catch (e) {
  report.failed = e.stack; process.exitCode = 1;
  for (const [i, p] of pages.entries()) if (!p.isClosed()) {
    await p.screenshot({ path: evidence + '/failure-' + i + '.png', scale: 'css' }).catch(() => {});
    const state = await p.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText, phase: window.qaNet?.room?.phase, close: window.qaClose, inputTimes: window.qaInputTimes, snapshot: window.qaNet?.latest })).catch(() => null);
    await writeFile(evidence + '/failure-' + i + '.json', JSON.stringify(state, null, 2));
  }
} finally {
  for (const ctx of contexts) await ctx.close().catch(() => {});
  if (browser) await browser.close(); if (server) await server.close();
  report.seconds = (performance.now() - started) / 1000;
  await writeFile(evidence + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, errors: report.errors, seconds: report.seconds, evidence }, null, 2));
}
