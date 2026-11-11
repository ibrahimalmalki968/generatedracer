import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createGameServer } from '../server/server.js';
import { translate } from '../shared/translations.js';

// Real browser flows; no injected room/simulation state or fabricated results.
const dir = resolve(process.env.EVIDENCE_DIR || '../ui-ux-qa'); await mkdir(dir, { recursive: true });
const server = process.env.BASE_URL ? null : await createGameServer();
const url = process.env.BASE_URL || `http://127.0.0.1:${server.port}/`;
const report = { url, channel: process.env.BROWSER_CHANNEL || 'chrome', browser: 'Browser plugin not available; existing Playwright used', checks: [], errors: [] };
const check = (v, name) => { assert.ok(v, name); report.checks.push(name); };
const contexts = [], pages = []; let browser; const start = performance.now();
const snap = async (p, name) => { await p.waitForTimeout(230); await p.screenshot({ path: `${dir}/${name}.png`, scale: 'css' }); };
const language = async (p, value) => { await p.locator(`[data-language="${value}"]`).click(); await p.waitForFunction(value => document.documentElement.lang === value, value); };
async function customer(name, lang, invite) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); contexts.push(c);
  const p = await c.newPage(); pages.push(p); p.on('pageerror', e => report.errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await p.goto(invite || url);
  await p.evaluate(async () => {
    const { Network } = await import('/js/network.js'); const connect = Network.prototype.connect, predict = Network.prototype.predict;
    const { AiController } = await import('/js/ai.js'); const { Car } = await import('/js/car.js');
    Network.prototype.connect = function(name) { window.uiNet = this; return connect.call(this, name); };
    Network.prototype.predict = function(input) {
      if (window.uiDrive && this.predicted && !this.predicted.finished) {
        const c = this.predicted, ghost = new Car(c.id, c.x, c.y, c.angle, { isHuman: false });
        Object.assign(ghost, { speed: c.speed, lap: c.lap, turboAvailable: c.turboAvailable }); new AiController(ghost).update(1 / 60); input = ghost.input;
      }
      return predict.call(this, input);
    };
  });
  if (lang) await language(p, lang);
  if (name) { await p.locator('#nickname').fill(name); await p.locator('#nicknameForm button').click(); await p.waitForFunction(() => uiNet.ready); }
  return p;
}
async function layout(p, stage, expand = true) {
  const result = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
    clipped: [...document.querySelectorAll('.overlay:not(.hidden) h1, .overlay:not(.hidden) h2, .overlay:not(.hidden) button, .overlay:not(.hidden) summary, .overlay:not(.hidden) label')].filter(e => e.clientWidth && e.scrollWidth > e.clientWidth + 2).map(e => e.id || e.textContent),
    small: [...document.querySelectorAll('.overlay:not(.hidden) button, .overlay:not(.hidden) summary, #languageSwitcher button')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 43.9).map(e => e.id || e.textContent),
  }));
  check(!result.overflow && !result.clipped.length && !result.small.length, stage + ': no overflow/clipped text; controls at least 44px ' + JSON.stringify(result));
  check(await p.evaluate(async () => (await import('/js/i18n.js')).missingTranslations.size === 0), stage + ': all translations resolve');
  if (stage.includes('results')) {
    const separated = await p.evaluate(() => {
      const a = document.querySelector('.standings-scroll').getBoundingClientRect(), b = document.querySelector('.results-actions').getBoundingClientRect();
      return a.bottom <= b.top + 1 || a.right <= b.left + 1 || a.left >= b.right - 1;
    });
    check(separated, stage + ': replay actions never overlay standings');
  }
  if (expand && / (welcome|discovery|create|lobby|pause|results)$/.test(stage)) {
    const original = p.viewportSize();
    for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await p.setViewportSize(size);
      await layout(p, stage + ' ' + size.width, false);
      await snap(p, stage.replaceAll(' ', '-') + '-' + size.width);
    }
    await p.setViewportSize(original);
  }
}
try {
  browser = await chromium.launch({ channel: report.channel, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  report.version = browser.version();
  const host = await customer();
  check(await host.title() === translate('ar', 'page.title') && await host.locator('#mainMenu').isVisible(), 'Arabic default: correct page identity and meaningful welcome screen');
  check(await host.evaluate(async () => { const r = await fetch('/assets/menu-kart.webp'); return r.ok && r.headers.get('content-type').startsWith('image/webp'); }), 'Optimized artwork loads with correct image type');
  for (const lang of ['ar', 'en']) {
    await language(host, lang); await layout(host, lang + ' welcome'); await snap(host, 'welcome-' + lang);
  }
  await host.locator('#nicknameForm button').click();
  check(await host.locator('#nickname').getAttribute('aria-invalid') === 'true', 'Invalid nickname is associated with its input'); await snap(host, 'nickname-error-en');
  await host.locator('#btn-message-dismiss').click();
  check(await host.locator('#appMessage').isHidden() && await host.locator('#nickname').getAttribute('aria-invalid') === null, 'Dismiss clears obsolete error/invalid state');
  await host.setViewportSize({ width: 390, height: 420 }); await host.locator('#nickname').fill('عمر');
  await host.locator('#nicknameForm button').scrollIntoViewIfNeeded(); check(await host.locator('#nicknameForm button').isVisible(), 'Submit remains reachable with short virtual-keyboard viewport');
  await host.locator('#nicknameForm button').click(); await host.locator('#modeMenu').waitFor({ state: 'visible' }); await host.setViewportSize({ width: 390, height: 844 });
  check(await host.evaluate(() => document.activeElement.id === 'modeTitle'), 'Mode navigation moves keyboard focus to its heading without opening keyboard');
  for (const lang of ['ar', 'en']) {
    await language(host, lang);
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await host.setViewportSize(size); await layout(host, `${lang} modes ${size.width}x${size.height}`); await snap(host, `modes-${lang}-${size.width}`);
    }
  }
  await host.setViewportSize({ width: 390, height: 844 }); await language(host, 'ar'); await host.locator('#btn-multiplayer').click();
  for (const lang of ['ar', 'en']) { await language(host, lang); await layout(host, lang + ' discovery'); await snap(host, 'rooms-' + lang); }
  await host.locator('[data-i18n="room.codeSummary"]').click(); await host.locator('#roomCode').fill('BAD'); await host.locator('#joinForm button').click();
  await host.locator('#roomCode[aria-invalid="true"]').waitFor();
  check(await host.locator('#roomCode').getAttribute('aria-invalid') === 'true', 'Server code error has input semantics');
  await language(host, 'ar'); await snap(host, 'code-error-ar'); await host.locator('#btn-message-dismiss').click();
  await host.locator('[data-i18n="room.codeSummary"]').click(); await host.locator('[data-i18n="room.createSummary"]').click();
  await host.locator('#roomName').fill('سباق الأصدقاء');
  for (const lang of ['ar', 'en']) { await language(host, lang); await layout(host, lang + ' create'); await snap(host, 'create-' + lang); }
  await host.locator('#createForm button').click(); await host.locator('#lobbyScreen').waitFor({ state: 'visible' });
  const invite = await host.locator('#inviteLink').inputValue();
  check(await host.locator('#btn-share').isVisible(), 'Invitation share is visible without opening details');
  await host.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: async data => { window.sharedData = data; } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedData = text; } } });
  });
  await host.locator('#btn-share').click(); await host.waitForFunction(() => Boolean(window.sharedData));
  check(await host.evaluate(invite => sharedData.url === invite && !window.copiedData, invite), 'Native share receives real invitation and does not also copy');
  await host.locator('#btn-message-dismiss').click();
  await host.evaluate(() => { navigator.share = async () => { const e = new Error(); e.name = 'AbortError'; throw e; }; });
  await host.locator('#btn-share').click();
  check(await host.locator('#appMessage').isHidden(), 'Cancelling share sheet stays quiet');
  await host.evaluate(() => { navigator.share = async () => { throw new Error('Denied'); }; });
  await host.locator('#btn-share').click(); await host.waitForFunction(() => Boolean(window.copiedData));
  check(await host.evaluate(invite => copiedData === invite, invite), 'Denied share falls back to exact clipboard invitation');
  await host.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
  await host.locator('#btn-share').click();
  check(await host.locator('#inviteLink').evaluate(e => e.closest('details').open && e.selectionEnd - e.selectionStart === e.value.length), 'Denied clipboard opens and selects manual link fallback');
  await host.locator('#btn-message-dismiss').click(); await host.locator('#lobbyScreen details summary').click();
  const guest = await customer('Alex', 'en', invite); await guest.locator('#lobbyScreen').waitFor({ state: 'visible' });
  await host.waitForFunction(() => uiNet.room.players.length === 2);
  check(await host.locator('#readyMeter').getAttribute('aria-valuemax') === '2', 'Readiness uses actual current roster capacity');
  await host.locator('#btn-room-start').click(); await host.waitForFunction(() => uiNet.room.players.some(p => p.ready));
  check(await host.locator('#readyMeter').getAttribute('aria-valuenow') === '1', 'Readiness meter and pressed state follow server acknowledgement');
  for (const lang of ['ar', 'en']) {
    await language(host, lang); await layout(host, lang + ' lobby'); await snap(host, 'lobby-' + lang);
    check((await host.locator('#lobbyHint').textContent()).includes('Alex'), lang + ': waiting instruction identifies actual remaining player');
  }
  await language(host, 'ar'); await guest.locator('#btn-room-start').click(); await host.locator('#countdown').waitFor({ state: 'visible' });
  await Promise.all([snap(host, 'countdown-ar'), snap(guest, 'countdown-en')]);
  await host.waitForFunction(() => uiNet.latest?.cars.length === 2); await guest.waitForFunction(() => uiNet.latest?.cars.length === 2);
  for (const lang of ['ar', 'en']) {
    await language(host, lang);
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await host.setViewportSize(size);
      const targets = await host.evaluate(() => ['btn-left', 'btn-right', 'btn-brake', 'btn-gas', 'hud-turbo', 'btn-pause'].map(id => {
        const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, h: r.height, w: r.width, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id };
      }));
      check(targets.every(t => t.h >= 44 && t.w >= 44 && t.hit === t.id), `${lang} ${size.width}: all physical controls hit safely`);
      const identity = await host.locator('#hud .race-identity').boundingBox(), menu = await host.locator('#btn-pause').boundingBox();
      check(identity.x + identity.width <= menu.x || identity.y >= menu.y + menu.height || identity.y + identity.height <= menu.y, `${lang} ${size.width}: player label and menu do not overlap`);
      await snap(host, `race-${lang}-${size.width}`);
    }
  }
  await host.setViewportSize({ width: 390, height: 844 }); await host.locator('#btn-pause').click();
  for (const lang of ['ar', 'en']) { await language(host, lang); await layout(host, lang + ' pause'); await snap(host, 'pause-' + lang); }
  await host.locator('#btn-leave').focus(); await host.keyboard.press('Tab');
  check(await host.evaluate(() => document.activeElement.dataset.language === 'ar'), 'Dialog Tab wraps through language control without background navigation');
  await host.keyboard.press('Escape'); check(await host.locator('#pauseMenu').isHidden(), 'Escape resumes race from keyboard');
  await host.emulateMedia({ reducedMotion: 'reduce' }); await host.locator('#btn-pause').click();
  check(await host.locator('#pauseMenu .panel').evaluate(e => getComputedStyle(e).animationName === 'none'), 'Reduced motion disables screen animation');
  await host.locator('#btn-resume').click(); await host.emulateMedia({ reducedMotion: 'no-preference' });
  console.log('Driving physical mixed-language race for redesigned results…');
  for (const p of [host, guest]) await p.evaluate(() => { window.uiDrive = true; });
  await Promise.all([host, guest].map(p => p.locator('#raceOver').waitFor({ state: 'visible', timeout: 150000 })));
  check(await host.evaluate(() => uiNet.room.results.every(r => r.lap === 3)), 'Results follow actual three-lap simulation');
  check(await host.locator('#results .result-self').count() === 1 && (await host.locator('#personalResult').textContent()).length > 0, 'Personal finishing position identifies own car using authoritative mapping');
  for (const lang of ['ar', 'en']) { await language(host, lang); await layout(host, lang + ' results'); await snap(host, 'results-' + lang); }
  await host.locator('#btn-restart').click(); await Promise.all([host, guest].map(p => p.locator('#lobbyScreen').waitFor({ state: 'visible' })));
  await host.waitForFunction(() => document.getElementById('readyMeter').getAttribute('aria-valuenow') === '0');
  check(await host.locator('#readyMeter').getAttribute('aria-valuenow') === '0', 'Return to same lobby resets visible readiness');
  let offline = true;
  await host.routeWebSocket('**/socket', route => offline ? route.close({ code: 1013, reason: 'error.connectionLost' }) : route.connectToServer());
  await host.evaluate(() => uiNet.socket.close()); await host.locator('#mainMenu').waitFor({ state: 'visible' });
  await host.locator('#btn-reconnect').waitFor({ state: 'visible' });
  for (const lang of ['ar', 'en']) { await language(host, lang); await snap(host, 'connection-lost-' + lang); }
  check(await host.locator('#connectionStatus').getAttribute('class').then(c => c.includes('offline')), 'Transport loss shows localized offline state and a recovery action');
  offline = false; await host.locator('#btn-reconnect').click(); await host.waitForFunction(() => uiNet.ready); await host.locator('#modeMenu').waitFor({ state: 'visible' });
  check(await host.locator('#btn-reconnect').isHidden(), 'Manual recovery reconnects real socket and hides obsolete reconnect action');
  check(report.errors.length === 0, 'No browser application or console errors'); report.passed = report.checks.length;
} catch (error) {
  report.failed = error.stack; process.exitCode = 1;
  for (const [i, p] of pages.entries()) if (!p.isClosed()) await snap(p, 'failure-' + i).catch(() => {});
} finally {
  report.seconds = (performance.now() - start) / 1000; await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
  for (const c of contexts) await c.close(); await browser?.close(); await server?.close();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, errors: report.errors, seconds: report.seconds, evidence: dir }, null, 2));
}
