import { supportedLanguage, translate, DEFAULT_LANGUAGE, missingTranslations } from '../shared/translations.js';

export const LANGUAGE_STORAGE_KEY = 'racer-language';
let language = DEFAULT_LANGUAGE;
try { const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY); if (supportedLanguage(saved)) language = saved; } catch { /* memory-only preference */ }
export const languageEvents = new EventTarget();
export const getLanguage = () => language;
export const t = (key, params) => translate(language, key, params);
export { missingTranslations };
export function textMessage(value) {
  if (!value) return '';
  return t(value.key || value.code || (typeof value === 'string' ? value : 'error.unknown'), value.params);
}
export function displayNameOf(value) { return value.nameKey ? t(value.nameKey, value.nameParams) : value.name; }
export function ordinal(position) { return t('position.' + Math.max(1, Math.min(6, position || 1))); }
export function translateDOM(root = document) {
  root.documentElement?.setAttribute('lang', language); root.documentElement?.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : undefined;
    el.textContent = t(el.dataset.i18n, params);
  }
  for (const attr of ['aria-label', 'placeholder', 'title', 'content']) {
    for (const el of root.querySelectorAll('[data-i18n-' + attr + ']')) el.setAttribute(attr, t(el.getAttribute('data-i18n-' + attr)));
  }
  for (const el of root.querySelectorAll('[data-language]')) el.setAttribute('aria-pressed', String(el.dataset.language === language));
  root.documentElement?.setAttribute('data-language-ready', 'true');
}
export function setLanguage(next, { persist = true } = {}) {
  language = supportedLanguage(next) ? next : DEFAULT_LANGUAGE;
  if (persist) try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* no storage available */ }
  if (typeof document !== 'undefined') translateDOM();
  languageEvents.dispatchEvent(new Event('change'));
}
export function initLanguage() {
  translateDOM();
  document.querySelectorAll('[data-language]').forEach(el => el.addEventListener('click', () => setLanguage(el.dataset.language)));
  window.addEventListener('storage', e => { if (e.key === LANGUAGE_STORAGE_KEY) setLanguage(e.newValue, { persist: false }); });
}
