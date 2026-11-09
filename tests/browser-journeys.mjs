// Browser journeys previously verified during Phases 3 and 4.
export const roomJourney = async (page, baseUrl, evidenceDir) => {
  const contexts = [], checks = [], errors = [], browser = page.context().browser();
  const ok = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const customer = async (name, url = baseUrl) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); contexts.push(ctx);
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(url);
    await p.evaluate(async () => { const { Network } = await import('/js/network.js'); const old = Network.prototype.apply;
      Network.prototype.apply = function(s) { window.lastSnapshot = s; return old.call(this, s); }; });
    await p.getByLabel('Your nickname').fill(name); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
    return p;
  };
  const makeRoom = async (p, privacy, name) => {
    await p.getByText('Create a room', { exact: true }).click();
    await p.getByLabel('Room name', { exact: true }).fill(name); await p.getByLabel('Room visibility').selectOption(privacy);
    await p.getByRole('button', { name: 'Create Room', exact: true }).tap(); await p.locator('#lobbyScreen').waitFor({ state: 'visible' });
  };
  try {
    const host = await customer('Maha'), guest = await customer('عمر'), outsider = await customer('Visitor');
    await host.locator('#roomBrowser').waitFor({ state: 'visible' });
    await makeRoom(host, 'public', 'Table race');
    const code = await host.locator('#lobbyCode').textContent();
    await guest.getByRole('button', { name: 'Join Table race', exact: true }).tap();
    await guest.locator('#lobbyScreen').waitFor({ state: 'visible' });
    ok((await host.locator('#lobbyPlayers').innerText()).includes('عمر'), 'Nicknames propagate to lobby');
    ok(await guest.locator('#lobbyPlayers li').count() === 2, 'Public room joining');
    await host.getByRole('button', { name: 'Ready', exact: true }).tap();
    ok(await host.locator('#lobbyScreen').isVisible(), 'One Ready does not start race');
    await guest.getByRole('button', { name: 'Ready', exact: true }).tap();
    await host.locator('#btn-cancel-countdown').waitFor({ state: 'visible' });
    await host.locator('#btn-cancel-countdown').tap();
    await guest.locator('#lobbyScreen').waitFor({ state: 'visible' });
    ok((await guest.locator('#lobbyPlayers').innerText()).includes('Waiting'), 'Countdown cancellation resets readiness');
    for (const p of [host, guest]) await p.getByRole('button', { name: 'Ready', exact: true }).tap();
    await Promise.all([host, guest].map(p => p.waitForFunction(() => window.lastSnapshot?.cars.length === 2)));
    await host.keyboard.down('ArrowUp'); await guest.keyboard.down('ArrowUp');
    await host.waitForTimeout(1300); await host.keyboard.up('ArrowUp'); await guest.keyboard.up('ArrowUp');
    ok(await guest.evaluate(() => lastSnapshot.cars.every(c => c.speed > 0)), 'Browser controls move both authoritative cars');
    ok(await host.evaluate(() => lastSnapshot.cars.some(c => c.name === 'عمر')), 'Nicknames visible in racing state');
    await outsider.getByText('Join with a room code', { exact: true }).click(); await outsider.getByLabel('Room code', { exact: true }).fill(code);
    await outsider.getByRole('button', { name: 'Join Room', exact: true }).tap();
    await outsider.getByRole('alert').filter({ hasText: 'Race in Progress' }).waitFor(); checks.push('Late race joining clearly rejected');
    await host.locator('#btn-pause').tap(); await host.locator('#btn-leave').tap();
    await host.locator('#roomBrowser').waitFor({ state: 'visible' });
    await guest.waitForFunction(() => window.lastSnapshot?.cars.some(c => c.disconnected));
    ok(await guest.locator('#hud').isVisible(), 'Opponent departure does not stop remaining racer');
    await guest.locator('#btn-pause').tap(); await guest.locator('#btn-leave').tap();
    await guest.locator('#roomBrowser').waitFor({ state: 'visible' });
    // Create details is still open from the first room.
    await host.getByLabel('Room name', { exact: true }).fill('Private table'); await host.getByLabel('Room visibility').selectOption('private');
    await host.getByRole('button', { name: 'Create Room', exact: true }).tap(); await host.locator('#lobbyScreen').waitFor({ state: 'visible' });
    const invite = await host.locator('#inviteLink').inputValue();
    const invited = await customer('Noura', invite); await invited.locator('#lobbyScreen').waitFor({ state: 'visible' });
    ok(await invited.locator('#lobbyName').innerText() === 'Private table', 'Invitation opens exact private room after nickname entry');
    await outsider.locator('#btn-refresh').tap();
    ok(!(await outsider.locator('#publicRooms').innerText()).includes('Private table'), 'Private room is absent from public browser');
    await host.screenshot({ path: `${evidenceDir}/mvp-lobby.png`, scale: 'css' });
    await invited.locator('#btn-lobby-leave').tap();
    await host.getByRole('button', { name: 'Start Race', exact: true }).waitFor();
    ok(await host.locator('#lobbyScreen').isVisible(), 'One remaining player waits for explicit solo Start');
    await host.getByRole('button', { name: 'Start Race', exact: true }).tap();
    await host.waitForFunction(() => window.lastSnapshot?.cars.length === 6);
    ok(await host.evaluate(() => lastSnapshot.cars.filter(c => !c.isHuman).length === 5), 'Same lobby starts solo with five AI');
    await host.screenshot({ path: `${evidenceDir}/mvp-racing.png`, scale: 'css' });
    ok(errors.length === 0, `No browser errors: ${errors.join(';')}`);
    return { checks, errors };
  } finally { for (const ctx of contexts) await ctx.close(); }
};
export const rematchJourney = async (page, baseUrl, evidenceDir) => {
  const contexts = [], pages = [], errors = [], checks = [];
  const browser = page.context().browser();
  const ok = (v, text) => { if (!v) throw new Error(text); checks.push(text); };
  try {
    for (const name of ['Maha', 'Noura', 'Omar']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); contexts.push(ctx);
      const p = await ctx.newPage(); pages.push(p); p.on('pageerror', e => errors.push(String(e)));
      await p.goto(baseUrl);
      await p.evaluate(async () => {
        const { Network } = await import('/js/network.js');
        const { AiController } = await import('/js/ai.js'); const { Car } = await import('/js/car.js');
        const apply = Network.prototype.apply, predict = Network.prototype.predict;
        Network.prototype.apply = function(s) { window.testNet = this; return apply.call(this, s); };
        Network.prototype.predict = function(input) {
          const c = this.latest?.cars.find(c => c.participantId === this.playerId);
          if (window.drive && c && !c.finished) {
            const ghost = new Car(c.id, c.x, c.y, c.angle, { isHuman: false }); Object.assign(ghost, { speed: c.speed, lap: c.lap, turboAvailable: c.turboAvailable });
            const driver = new AiController(ghost); if (window.factor) driver._speedFactor = window.factor;
            driver.update(1 / 60); input = ghost.input;
          }
          return predict.call(this, input);
        };
        window.drive = true;
      });
      await p.getByLabel('Your nickname').fill(name); await p.getByRole('button', { name: 'Continue →', exact: true }).tap();
      await p.locator('#roomBrowser').waitFor({ state: 'visible' });
    }
    const [host, guest, third] = pages;
    await host.getByText('Create a room', { exact: true }).click(); await host.getByLabel('Room name', { exact: true }).fill('Rematch table');
    await host.getByRole('button', { name: 'Create Room', exact: true }).tap();
    await host.locator('#lobbyScreen').waitFor({ state: 'visible' }); const code = await host.locator('#lobbyCode').textContent();
    await guest.getByRole('button', { name: 'Join Rematch table', exact: true }).tap();
    for (let round = 0; round < 2; round++) {
      const racers = round === 0 ? [host, guest] : pages;
      for (const p of racers) await p.getByRole('button', { name: 'Ready', exact: true }).tap();
      await Promise.all(racers.map(p => p.waitForFunction(() => window.testNet?.room.phase === 'racing', { timeout: 15000 })));
      await Promise.all(racers.map(p => p.locator('#raceOver').waitFor({ state: 'visible', timeout: 110000 })));
      const rendered = await Promise.all(racers.map(p => p.locator('#results').innerText()));
      ok(rendered.every(r => r === rendered[0]), `Round ${round + 1}: identical rendered standings`);
      ok(await host.locator('#results li').count() === racers.length, `Round ${round + 1}: correct human-only results`);
      ok(await host.evaluate(() => testNet.room.results.every(r => r.lap === 3 && r.status === 'finished')), `Round ${round + 1}: all three-lap finishers`);
      ok(await host.evaluate(() => testNet.latest.cars.every(c => c.turboUses <= 3)), `Round ${round + 1}: per-lap Turbo bounded`);
      if (round === 0) await host.screenshot({ path: `${evidenceDir}/mvp-results.png`, scale: 'css' });
      await host.getByRole('button', { name: 'Return room to lobby', exact: true }).tap();
      await Promise.all(racers.map(p => p.locator('#lobbyScreen').waitFor({ state: 'visible' })));
      ok(await host.locator('#lobbyCode').textContent() === code, `Round ${round + 1}: same room retained`);
      ok(await host.getByRole('button', { name: 'Ready', exact: true }).isVisible(), `Round ${round + 1}: no automatic rematch`);
      ok((await host.locator('#lobbyPlayers').innerText()).split('Waiting').length - 1 === racers.length, `Round ${round + 1}: readiness reset`);
      if (round === 0) {
        await third.getByRole('button', { name: 'Join Rematch table', exact: true }).tap();
        await third.locator('#lobbyScreen').waitFor({ state: 'visible' });
        ok(await third.locator('#lobbyPlayers li').count() === 3, 'New player joins reopened room');
      }
    }
    ok(errors.length === 0, 'No captured browser exceptions');
    return { checks, errors };
  } finally { for (const ctx of contexts) await ctx.close(); }
};
