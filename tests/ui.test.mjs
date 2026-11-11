import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shareInvitation } from '../js/ui.js';
import { createGameServer } from '../server/server.js';

test('native invitation sharing uses the real URL and never copies after success', async () => {
  let received; let copies = 0;
  const outcome = await shareInvitation('https://racer.example/?room=A123456789', 'GenerateRacer', {
    share: async data => { received = data; }, clipboard: { writeText: async () => copies++ },
  });
  assert.equal(outcome, 'shared'); assert.equal(copies, 0);
  assert.deepEqual(received, { title: 'GenerateRacer', url: 'https://racer.example/?room=A123456789' });
});

test('cancelling the native share sheet is quiet and does not unexpectedly copy', async () => {
  const outcome = await shareInvitation('https://racer.example/', 'GenerateRacer', {
    share: async () => { const e = new Error(); e.name = 'AbortError'; throw e; },
    clipboard: { writeText: async () => assert.fail('Cancellation must not copy') },
  });
  assert.equal(outcome, 'cancelled');
});

test('unsupported or denied native sharing falls back to clipboard, then manual selection', async () => {
  for (const share of [undefined, async () => { throw new Error('Permission denied'); }]) {
    let copied;
    assert.equal(await shareInvitation('https://racer.example/', 'GenerateRacer', { share, clipboard: { writeText: async value => { copied = value; } } }), 'copied');
    assert.equal(copied, 'https://racer.example/');
    assert.equal(await shareInvitation('https://racer.example/', 'GenerateRacer', { share }), 'manual');
  }
});

test('production serves only the named lightweight artwork with its proper MIME type', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  const asset = await fetch(`http://127.0.0.1:${s.port}/assets/menu-kart.webp`);
  assert.equal(asset.status, 200); assert.match(asset.headers.get('content-type'), /image\/webp/);
  const bytes = new Uint8Array(await asset.arrayBuffer()); assert.ok(bytes.length < 80000);
  for (const path of ['/assets/other.webp', '/assets/menu-kart.webp.js', '/assets/.env', '/assets%5c..%5cserver%5cgame.js']) {
    assert.equal((await fetch(`http://127.0.0.1:${s.port}${path}`)).status, 404);
  }
});

test('design token foregrounds meet WCAG AA for normal text on their intended surfaces', async () => {
  const css = await readFile(new URL('../game.css', import.meta.url), 'utf8');
  const color = name => css.match(new RegExp('--' + name + ': (#[0-9a-f]{6})'))[1];
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  for (const [fg, bg] of [['text', 'ink'], ['muted', 'ink'], ['text', 'surface'], ['muted', 'raised'], ['ink', 'accent'], ['cyan', 'ink'], ['danger', 'surface'], ['gold', 'ink']]) {
    const a = luminance(color(fg)), b = luminance(color(bg));
    assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, fg + '/' + bg);
  }
});
