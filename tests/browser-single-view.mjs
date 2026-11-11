/** Verify the actual Canvas render path, not just its full-size outer element. */
export async function singleDeviceView(page, check, label) {
  const result = await page.evaluate(async () => {
    const canvas = document.getElementById('gameCanvas'), bounds = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d'), transform = ctx.setTransform, translate = ctx.translate, frames = [];
    ctx.setTransform = function(...args) { frames.push({ centers: 0 }); return transform.apply(this, args); };
    ctx.translate = function(x, y) {
      if (frames.length && x === canvas.clientWidth / 2 && y === canvas.clientHeight / 2) frames.at(-1).centers++;
      return translate.call(this, x, y);
    };
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { huds: document.querySelectorAll('.hud').length, removed: !!document.querySelector('#hud2, #btn-splitscreen, .local-play, .split-hint'),
        full: bounds.x === 0 && bounds.y === 0 && bounds.width === innerWidth && bounds.height === innerHeight,
        frames, modes: [...document.querySelectorAll('.mode-options button')].map(e => e.id) };
    } finally { ctx.setTransform = transform; ctx.translate = translate; }
  });
  check(result.huds === 1 && !result.removed, label + ': exactly one HUD and no local two-player entry/components');
  check(result.full && result.frames.length > 0 && result.frames.every(frame => frame.centers === 1), label + ': each Canvas frame renders one full-viewport camera');
  check(JSON.stringify(result.modes) === JSON.stringify(['btn-solo', 'btn-multiplayer']), label + ': only Solo Race and Multiplayer mode actions');
}
