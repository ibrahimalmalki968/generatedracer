import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translations, translate, fault, missingTranslations, DEFAULT_LANGUAGE } from '../shared/translations.js';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { LocalSession } from '../js/simulation.js';

test('Arabic is default; complete dictionaries have identical stable keys and matching placeholders', () => {
  assert.equal(DEFAULT_LANGUAGE, 'ar');
  assert.deepEqual(Object.keys(translations.ar).sort(), Object.keys(translations.en).sort());
  for (const key of Object.keys(translations.en)) {
    const samples = language => typeof translations[language][key] === 'string' ? [translations[language][key]] : Object.values(translations[language][key]);
    for (const language of ['ar', 'en']) for (const text of samples(language)) assert.ok(text.length > 0, key);
    const params = language => [...new Set(samples(language).join(' ').match(/\{\w+\}/g) || [])].sort();
    assert.deepEqual(params('ar'), params('en'), key);
  }
});
test('Arabic pluralization handles zero, one, two, few, many and other without English fallback', () => {
  for (const [count, expected] of [[0, 'لا يوجد لاعبون'], [1, 'لاعب واحد'], [2, 'لاعبان'], [3, '3 لاعبين'], [11, '11 لاعبًا'], [100, '100 لاعب']]) {
    assert.equal(translate('ar', 'players.count', { count }), expected);
  }
  assert.equal(translate('en', 'players.count', { count: 1 }), '1 player');
  assert.equal(translate('en', 'players.count', { count: 2 }), '2 players');
});
test('missing keys and corrupted language preferences fail safely; mixed names are isolated', () => {
  assert.equal(translate('__proto__', 'mode.solo'), 'سباق فردي');
  assert.equal(translate('ar', 'toString'), translations.ar['error.unknown']);
  assert.equal(translate('en', 'missing.key'), translations.en['error.unknown']);
  assert.ok(translate('ar', 'mode.greeting', { name: 'CPU 1 أحمد' }).includes('\u2068CPU 1 أحمد\u2069'));
  assert.ok(translate('en', 'mode.greeting', { name: 'عمر' }).includes('\u2068عمر\u2069'));
  assert.ok(translate('ar', 'hud.lap', { lap: 1, total: 3 }).includes('\u20661 / 3\u2069'), 'numeric lap fraction keeps LTR order inside RTL copy');
  missingTranslations.clear();
});
test('all HTML bindings and literal UI/message keys resolve; forms avoid untranslated native validation', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/data-i18n(?:-(?:aria-label|placeholder|title|content))?="([^"]+)"/g)) assert.ok(Object.hasOwn(translations.ar, match[1]), match[1]);
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.equal((html.match(/<form novalidate /g) || []).length, 3);
  for (const file of ['js/main.js', 'js/lobby.js', 'js/hud.js', 'js/network.js', 'js/ui.js', 'server/game.js', 'server/server.js', 'shared/protocol.js']) {
    const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
    for (const m of source.matchAll(/['"]((?:ui|error|connection|mode|room|lobby|hud|control|results|pause|race|nav|footer|browser|entry|notice)\.[A-Za-z0-9_.]+)['"]/g)) assert.ok(Object.hasOwn(translations.ar, m[1]), file + ': ' + m[1]);
  }
});
test('server errors carry stable codes/values while English protocol diagnostics remain compatible', async t => {
  const s = await createGameServer(); t.after(() => s.close()); const c = await client(s.port, 'عمر');
  const response = await c.request({ type: 'join', code: 'bad' });
  assert.equal(response.code, 'error.roomCode'); assert.equal(response.message, 'Invalid room code.');
  assert.equal(translate('ar', response.code, response.params), 'رمز الغرفة غير صحيح.');
  const error = fault('error.nameLength', { max: 20 }); assert.equal(error.message, 'Use between 1 and 20 characters.');
  assert.equal(translate('ar', error.code, error.params), 'استخدم اسمًا من حرف واحد إلى 20 حرفًا.');
});
test('generated names have localization metadata; human nicknames are never treated as AI labels', async t => {
  const local = new LocalSession(1); assert.equal(local.cars[1].nameKey, 'name.ai');
  const s = await createGameServer({ countdownMs: 0, autoTick: false }); t.after(() => s.close());
  const c = await client(s.port, 'CPU 1'); await c.request({ type: 'solo' }); s.game.step();
  const r = s.game.rooms.get(c.room().code), snapshot = s.game.snapshot(r);
  assert.equal(snapshot.cars[0].nameKey, null); assert.equal(snapshot.cars[0].name, 'CPU 1');
  assert.equal(snapshot.cars[1].nameKey, 'name.ai'); assert.equal(r.nameKey, 'mode.solo');
});
