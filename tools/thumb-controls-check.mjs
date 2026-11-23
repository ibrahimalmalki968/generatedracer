// Exercise the actual page and driving buttons on a toolbar-reduced portrait viewport.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';
import { createGameServer } from '../server/server.js';

const dir = process.env.EVIDENCE_DIR || 'work/thumb-controls';
await mkdir(dir, { recursive: true });
const server = process.env.BASE_URL ? null : await createGameServer();
const url = process.env.BASE_URL || 'http://127.0.0.1:' + server.port;
try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    try {
      const page = await browser.newPage({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 548 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url);
      assert.ok((await page.title()).includes('GenerateRacer'));
      const nickname = page.locator('#nickname');
      assert.notEqual(await nickname.evaluate(el => getComputedStyle(el).webkitUserSelect), 'none');
      assert.ok(await nickname.evaluate(el => el.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true }))));
      await nickname.fill('Thumb');
      await page.locator('#nicknameForm button').tap();
      await page.locator('#btn-solo').tap();
      await page.waitForSelector('body[data-screen=racing]');

      const ids = ['#btn-left', '#btn-right', '#btn-brake', '#hud-turbo'];
      for (const selector of [...ids, '#btn-brake small', '#hud-turbo strong', '#gameCanvas']) {
        const styles = await page.locator(selector).evaluate(el => {
          const s = getComputedStyle(el);
          const blocked = ['selectstart','contextmenu','dragstart','gesturestart'].every(type =>
            !el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })));
          return { select: s.webkitUserSelect, touch: s.touchAction, blocked };
        });
        assert.deepEqual(styles, { select: 'none', touch: 'none', blocked: true }, selector);
      }
      for (const size of [{ width: 320, height: 460 }, { width: 390, height: 620 }, { width: 844, height: 355 }]) {
        await page.setViewportSize(size);
        for (const id of ids) {
          const hit = await page.locator(id).evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth &&
              r.top >= 0 && r.bottom <= innerHeight && el.contains(document.elementFromPoint(r.x + r.width/2, r.y + r.height/2));
          });
          assert.ok(hit, `${id} accessible at ${size.width} × ${size.height}`);
        }
      }
      await page.setViewportSize({ width: 375, height: 548 });
      const center = async (selector, id) => {
        const r = await page.locator(selector).boundingBox();
        return { id, x: r.x + r.width/2, y: r.y + r.height/2 };
      };
      const brake = await center('#btn-brake small', 2);
      if (engine === webkit) {
        // Desktop WebKit exposes trusted mouse and touch taps, without a multitouch injector.
        await page.mouse.move(brake.x, brake.y);
        await page.mouse.down();
        await page.waitForSelector('#btn-brake.pressed');
        await page.waitForTimeout(900);
        await page.mouse.move(brake.x - 45, brake.y - 15, { steps: 5 });
        assert.equal(await page.evaluate(() => String(getSelection())), '');
        await page.mouse.up();
        await page.waitForSelector('#btn-brake.pressed', { state: 'detached' });
        await page.locator('#hud-turbo').tap();
        await page.waitForSelector('#hud-turbo.boosting');
      } else {
        const cdp = await page.context().newCDPSession(page);
        const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        const left = await center('#btn-left', 1);
        await page.locator('#btn-left').evaluate(el => el.addEventListener('gotpointercapture',
          e => { el.dataset.testPointerId = String(e.pointerId); }, { once: true }));
        await touch('touchStart', [left, brake]);
        await page.waitForFunction(() => document.querySelectorAll('#touchControls .pressed').length === 2);
        await page.waitForTimeout(900);
        // Browser chrome can change the visual viewport while both thumbs are down.
        await page.evaluate(() => visualViewport.dispatchEvent(new Event('resize')));
        await touch('touchMove', [{ ...left, y: left.y-18 }, { ...brake, x: brake.x-12 }]);
        assert.equal(await page.locator('#touchControls .pressed').count(), 2);
        assert.equal(await page.evaluate(() => String(getSelection())), '');
        await page.screenshot({ path: dir + '/portrait-hold.png' });
        await page.locator('#btn-left').evaluate(el => el.releasePointerCapture(Number(el.dataset.testPointerId)));
        await touch('touchMove', [{ ...left, y: left.y-24 }, brake]);
        await page.waitForFunction(() => !document.querySelector('#btn-left.pressed') && document.querySelector('#btn-brake.pressed'));
        await touch('touchCancel', []);
        await page.waitForFunction(() => !document.querySelector('.pressed'));
        const turbo = await center('#hud-turbo', 3);
        await touch('touchStart', [left, turbo]);
        await page.waitForSelector('#hud-turbo.boosting');
        assert.ok(await page.locator('#btn-left.pressed').count());
        await touch('touchEnd', []);
        await page.waitForFunction(() => !document.querySelector('.pressed'));
      }
      assert.deepEqual(errors, []);
      console.log(engine.name(), browser.version(), 'passed selection, release, control reach and gameplay checks');
    } finally { await browser.close(); }
  }
} finally { await server?.close(); }
