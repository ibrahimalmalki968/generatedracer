import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translations } from '../shared/translations.js';

test('browser offers one HUD/input/camera and only server-backed race entry', async () => {
  const source = async file => readFile(new URL('../' + file, import.meta.url), 'utf8');
  const [html, css, main, input] = await Promise.all(['index.html', 'game.css', 'js/main.js', 'js/input.js'].map(source));
  assert.equal((html.match(/class="hud hidden"/g) || []).length, 1);
  assert.doesNotMatch(html + css + main, /splitscreen|split-hint|hud2|inputP[12]|control\.splitKeys|local\.title/i);
  assert.doesNotMatch(main, /LocalSession|activeInputs|cameras|session\.humans|viewWidth/);
  assert.match(main, /ctx\.translate\(width \/ 2, height \/ 2\)/);
  assert.match(main, /const input = new InputHandler\(\)/);
  assert.doesNotMatch(input, /keySet/);
  for (const locale of ['ar', 'en']) {
    for (const key of ['local.title', 'local.description', 'local.start', 'control.splitKeys', 'control.turbo2', 'hud.p2Position', 'pause.description', 'race.localWaiting']) {
      assert.equal(Object.hasOwn(translations[locale], key), false, key);
    }
  }
});
