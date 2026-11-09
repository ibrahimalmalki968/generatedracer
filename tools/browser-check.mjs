import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/server.js';
import { roomJourney, rematchJourney } from '../tests/browser-journeys.mjs';

const evidence = resolve(process.env.EVIDENCE_DIR || 'work/browser');
await mkdir(evidence, { recursive: true });
const report = { channel: process.env.BROWSER_CHANNEL || 'chrome', mode: process.env.BROWSER_SUITE || 'full', checks: [], errors: [], scenarios: [] };
const check = (condition, label) => { assert.ok(condition, label); report.checks.push(label); };
const s = await createGameServer(); const baseUrl = `http://127.0.0.1:${s.port}/`;
let browser;
const before = { rss: process.memoryUsage().rss, cpu: process.cpuUsage(), at: performance.now() };
try {
  browser = await chromium.launch({ channel: report.channel, headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  report.version = browser.version();
  const root = await browser.newPage(); await root.goto(baseUrl);
  for (const [name, scenario] of [['rooms and lobby', roomJourney], ...(report.mode === 'full' ? [['two full races and rematches', rematchJourney]] : [])]) {
    console.log(`Checking ${name}…`);
    const result = await scenario(root, baseUrl, evidence);
    report.checks.push(...result.checks); report.errors.push(...result.errors); report.scenarios.push(name);
  }
  console.log('Checking mobile layouts, touches, six browser clients and recovery…');
  const contexts = [], pages = [];
  async function customer(n, viewport = { width: 390, height: 844 }, invite) {
    const ctx = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); contexts.push(ctx);
    const p = await ctx.newPage(); pages.push(p); p.on('pageerror', e => report.errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await p.goto(invite || baseUrl);
    await p.evaluate(async () => {
      const { Network } = await import('/js/network.js');
      const apply = Network.prototype.apply, send = Network.prototype.send;
      Network.prototype.apply = function(s) { window.testNet = this; window.snaps = (window.snaps || 0) + 1; return apply.call(this, s); };
      Network.prototype.send = function(m) {
        if (m.type === 'input' && window.delayInput) { const original = this; setTimeout(() => send.call(original, m), window.delayInput); return true; }
        return send.call(this, m);
      };
    });
    await p.getByLabel('Your nickname').fill(n); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
    return p;
  }
  try {
    const host = await customer('Mobile'), codePage = await customer('Guest');
    await host.getByText('Create a room', { exact: true }).click(); await host.getByLabel('Room name', { exact: true }).fill('Six phones');
    await host.getByRole('button', { name: 'Create Room', exact: true }).tap(); await host.locator('#lobbyScreen').waitFor({ state: 'visible' });
    const code = await host.locator('#lobbyCode').textContent();
    const invite = await host.locator('#inviteLink').inputValue();
    await codePage.getByText('Join with a room code', { exact: true }).click(); await codePage.getByLabel('Room code', { exact: true }).fill(code);
    await codePage.getByRole('button', { name: 'Join Room', exact: true }).tap();
    const extras = [];
    for (const name of ['Racer 3', 'Racer 4', 'Racer 5', 'Racer 6']) {
      const p = await customer(name, { width: 412, height: 915 }, invite); await p.locator('#lobbyScreen').waitFor({ state: 'visible' }); extras.push(p);
    }
    await host.waitForFunction(() => document.querySelectorAll('#lobbyPlayers li').length === 6);
    check(await host.locator('#lobbyPlayers li').count() === 6, 'Six isolated browser customers in one lobby');
    const seven = await customer('Seventh', { width: 360, height: 640 }, invite);
    await seven.getByRole('alert').filter({ hasText: 'full' }).waitFor(); check(await seven.locator('#roomBrowser').isVisible(), 'Seventh browser rejected without entering room');
    const racers = [host, codePage, ...extras];
    for (const p of racers) await p.getByRole('button', { name: 'Ready', exact: true }).tap();
    await Promise.all(racers.map(p => p.waitForFunction(() => window.testNet?.latest?.cars.length === 6)));
    check(await host.evaluate(() => testNet.latest.cars.every(c => c.isHuman)), 'Six browser racers have no AI fill');
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 844, height: 390 }]) {
      await host.setViewportSize(viewport); await host.waitForTimeout(70);
      const layout = await host.evaluate(() => ['hud-position', 'hud-lap', 'hud-speed', 'hud-time', 'hud-turbo', 'btn-left', 'btn-right', 'btn-gas', 'btn-brake', 'btn-pause'].map(id => {
        const el = document.getElementById(id), r = el.getBoundingClientRect();
        return { id, x: r.x, y: r.y, w: r.width, h: r.height,
          hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button')?.id };
      }));
      for (const r of layout) check(r.x >= 0 && r.y >= 0 && r.x + r.w <= viewport.width + .1 && r.y + r.h <= viewport.height + .1, `${viewport.width}x${viewport.height} ${r.id} fits`);
      for (const r of layout.filter(r => r.id.startsWith('btn-') || r.id === 'hud-turbo')) check(r.hit === r.id && r.h >= 44, `${viewport.width}x${viewport.height} ${r.id} target responds`);
      if (viewport.width === 390 || viewport.width === 844) await host.screenshot({ path: `${evidence}/mobile-${viewport.width}.png`, scale: 'css' });
    }
    await host.setViewportSize({ width: 390, height: 844 }); await host.waitForTimeout(100);
    const separated = await host.evaluate(async () => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      const boxes = [];
      CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
        if (testNet.latest.cars.some(c => c.name === text)) {
          const t = this.getTransform(), w = this.measureText(text).width * t.a, h = parseFloat(this.font.match(/[\d.]+px/)[0]) * t.d;
          boxes.push({ x: t.a * x + t.e - w / 2, y: t.d * y + t.f - h, w, h });
        }
        return original.call(this, text, x, y, ...rest);
      };
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      CanvasRenderingContext2D.prototype.fillText = original;
      const last = boxes.slice(-6);
      return last.length === 6 && last.every((r, i) => last.every((s, j) => i === j || r.x + r.w <= s.x || s.x + s.w <= r.x || r.y + r.h <= s.y || s.y + s.h <= r.y));
    });
    check(separated, 'Six starting-grid nicknames do not overlap');
    const cdp = await host.context().newCDPSession(host);
    const point = async id => { const b = await host.locator(id).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const gas = await point('#btn-gas'), left = await point('#btn-left'), turbo = await point('#hud-turbo');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...gas, id: 1 }, { ...left, id: 2 }, { ...turbo, id: 3 }] });
    await host.waitForTimeout(700);
    check(await host.evaluate(() => testNet.latest.cars.find(c => c.participantId === testNet.playerId).turboUses === 1), 'Touch Turbo is authoritative');
    check(await host.evaluate(() => testNet.predicted.speed > 0), 'Touch acceleration and steering drive predicted car');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await host.setViewportSize({ width: 844, height: 390 }); await host.waitForTimeout(100);
    check(await host.evaluate(() => testNet.pending.length < 120), 'Prediction history bounded after orientation change');
    for (const p of racers) await p.keyboard.down('ArrowUp');
    await codePage.evaluate(() => { window.delayInput = 150; });
    await host.waitForTimeout(2300);
    check(await host.evaluate(() => testNet.latest.cars.every(c => c.speed > 0)), 'Six clients move simultaneously including 150ms delayed input');
    check(await codePage.evaluate(() => testNet.pending.length < 30), 'Delayed input reconciles without unbounded history');
    await codePage.evaluate(() => { window.delayInput = 0; });
    for (const p of racers) await p.keyboard.up('ArrowUp');
    const previousId = await extras[0].evaluate(() => testNet.playerId);
    await extras[0].reload();
    await extras[0].evaluate(async () => {
      const { Network } = await import('/js/network.js'); const apply = Network.prototype.apply;
      Network.prototype.apply = function(s) { window.testNet = this; return apply.call(this, s); };
    });
    await extras[0].waitForFunction(() => !document.getElementById('roomBrowser').classList.contains('hidden') || window.testNet?.room?.phase === 'racing');
    const resumedId = await extras[0].evaluate(() => window.testNet?.playerId);
    check(!resumedId || resumedId === previousId, 'Reload can only resume the same existing identity');
    await extras[1].context().close();
    await host.waitForFunction(() => testNet.latest.cars.some(c => c.disconnected));
    check(await host.locator('#hud').isVisible(), 'Closed browser records DNF without stopping other humans');
    check(await host.evaluate(() => testNet.latest.cars.length === 6 && testNet.latest.cars.every(c => c.isHuman)), 'Disconnect never converts active multiplayer to AI solo');
    // Exercise an invalid invitation through the actual first-screen path.
    const invalid = await customer('<img onerror=x>', { width: 320, height: 568 }, `${baseUrl}?room=0000000000`);
    await invalid.getByRole('alert').filter({ hasText: 'not found or expired' }).waitFor();
    check(await invalid.locator('#playerGreeting img').count() === 0, 'Nickname markup rendered safely as text');
    check(await invalid.locator('#roomBrowser').isVisible(), 'Expired invitation recovers to browser');
  } finally { for (const ctx of contexts) await ctx.close(); }

  if (report.mode === 'full') {
    console.log('Checking complete solo browser journey…');
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
    try {
      const p = await ctx.newPage(); p.on('pageerror', e => report.errors.push(String(e))); await p.goto(baseUrl);
      await p.evaluate(async () => {
        const { Network } = await import('/js/network.js'); const { AiController } = await import('/js/ai.js'); const { Car } = await import('/js/car.js');
        const old = Network.prototype.predict;
        Network.prototype.predict = function(input) {
          window.soloNet = this;
          const c = this.latest?.cars.find(c => c.participantId === this.playerId);
          if (c && !c.finished) {
            const ghost = new Car(c.id, c.x, c.y, c.angle, { isHuman: false }); Object.assign(ghost, { speed: c.speed, lap: c.lap, turboAvailable: c.turboAvailable });
            new AiController(ghost).update(1 / 60); input = ghost.input;
          }
          return old.call(this, input);
        };
      });
      await p.getByLabel('Your nickname').fill('Solo customer'); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
      await p.getByText('Create a room', { exact: true }).click(); await p.getByRole('button', { name: 'Create Room', exact: true }).tap();
      await p.locator('#lobbyScreen').waitFor({ state: 'visible' }); const code = await p.locator('#lobbyCode').textContent();
      await p.getByRole('button', { name: 'Start Race', exact: true }).tap();
      await p.locator('#raceOver').waitFor({ state: 'visible', timeout: 110000 });
      check(await p.locator('#results li').count() === 6, 'Solo result includes human plus five AI');
      check(await p.evaluate(() => soloNet.room.results.some(r => r.name === 'Solo customer' && r.lap === 3)), 'Solo customer completes three valid laps');
      await p.getByRole('button', { name: 'Return room to lobby', exact: true }).tap();
      await p.locator('#lobbyScreen').waitFor({ state: 'visible' });
      check(await p.locator('#lobbyCode').textContent() === code, 'Solo returns to same unified lobby');
      check(await p.getByRole('button', { name: 'Start Race', exact: true }).isVisible(), 'Solo rematch requires explicit Start');
    } finally { await ctx.close(); }
  }
  await browser.close(); browser = null; await new Promise(r => setTimeout(r, 100));
  check(s.game.rooms.size === 0, 'All browser test rooms cleaned up');
  check(s.wss.clients.size === 0, 'All browser sockets cleaned up');
  check(report.errors.length === 0, 'No captured app errors');
  report.passed = report.checks.length;
} catch (e) { report.failed = e.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.durationSeconds = (performance.now() - before.at) / 1000;
  report.nodeCpuMicros = process.cpuUsage(before.cpu); report.nodeRssDelta = process.memoryUsage().rss - before.rss;
  await s.close();
  await writeFile(`${evidence}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, errors: report.errors, seconds: report.durationSeconds, evidence }, null, 2));
}
