export async function modeJourney(page, baseUrl, evidenceDir) {
  const checks = [], errors = [], browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const check = (v, label) => { if (!v) throw new Error(label); checks.push(label); };
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await p.goto(baseUrl);
    check(await p.title() === 'GenerateRacer · Café Racing', 'Menu page identity and meaningful content');
    await p.evaluate(async () => {
      const { Network } = await import('/js/network.js'); const connect = Network.prototype.connect;
      Network.prototype.connect = function(name) { window.menuNet = this; return connect.call(this, name); };
    });
    await p.getByLabel('Your nickname').fill('Maha'); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
    await p.locator('#modeMenu').waitFor({ state: 'visible' });
    check(await p.evaluate(() => menuNet.room === null), 'Entering nickname opens mode choices without creating a room');
    for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
      await p.setViewportSize(viewport);
      const a = await p.locator('#btn-solo').boundingBox(), b = await p.locator('#btn-multiplayer').boundingBox();
      check([a, b].every(r => r && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height), 'Both mode options visible without scrolling at ' + viewport.width + 'x' + viewport.height);
      check(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Mode buttons do not overlap at ' + viewport.width + 'x' + viewport.height);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({ path: evidenceDir + '/mode-menu.png', scale: 'css' });
    await p.getByRole('button', { name: 'Solo Race', exact: true }).tap();
    await p.locator('#btn-cancel-countdown').waitFor({ state: 'visible' });
    check(await p.evaluate(() => menuNet.room.solo && menuNet.room.private && menuNet.room.players.length === 1), 'One tap creates private solo countdown without manual room/lobby screens');
    await p.locator('#btn-cancel-countdown').tap(); await p.locator('#modeMenu').waitFor({ state: 'visible' });
    check(await p.evaluate(() => menuNet.room === null), 'Cancelling solo countdown returns to mode menu and leaves no room');
    await p.getByRole('button', { name: 'Solo Race', exact: true }).tap();
    await p.waitForFunction(() => window.menuNet?.latest?.cars.length === 6);
    check(await p.evaluate(() => menuNet.latest.cars.filter(c => c.isHuman).length === 1), 'Quick solo reuses authoritative engine with one human and five AI');
    await p.keyboard.down('ArrowUp'); await p.waitForFunction(() => window.menuNet?.latest?.cars[0].speed > 0); await p.keyboard.up('ArrowUp');
    await p.locator('#btn-pause').tap(); await p.locator('#pauseMenu').getByRole('button', { name: 'Main menu', exact: true }).tap();
    await p.locator('#modeMenu').waitFor({ state: 'visible' });
    check(await p.evaluate(() => menuNet.room === null), 'Solo in-race Main menu cleans up the active session');
    await p.getByRole('button', { name: 'Multiplayer', exact: true }).tap(); await p.locator('#roomBrowser').waitFor({ state: 'visible' });
    check(await p.evaluate(() => menuNet.room === null), 'Multiplayer opens existing room interface without auto-starting');
    await p.getByRole('button', { name: '← Main menu', exact: true }).tap(); await p.locator('#modeMenu').waitFor({ state: 'visible' });
    const identity = await p.evaluate(() => menuNet.playerId);
    await p.getByRole('button', { name: 'Change nickname', exact: true }).tap();
    await p.getByLabel('Your nickname').fill('Noura'); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
    await p.locator('#modeMenu').waitFor({ state: 'visible' });
    check((await p.locator('#modeGreeting').textContent()).includes('Noura') && await p.evaluate(id => menuNet.playerId === id, identity), 'Nickname can change from menu while preserving anonymous identity');
    check(errors.length === 0, 'Mode journey has no captured app errors');
    return { checks, errors };
  } finally { await ctx.close(); }
}
