/** Presentation primitives only: no simulation, room transitions or socket ownership. */
const paths = {
  flag: '<path d="M5 21V4m0 1c4-5 10 5 14 0v10c-4 5-10-5-14 0"/><path d="m10 4-1 10m6-8-1 10M5 10c4-5 10 5 14 0"/>',
  racers: '<path d="m3 14 2-5h9l2 5v5H3zm2 0h9M6 19v2m7-2v2m-5-12 2-5h9l2 5v6h-3m-6-6h8"/><path d="M6 16h1m5 0h1m4-5h1"/>',
  left: '<path d="m14 5-7 7 7 7M7 12h12"/>',
  right: '<path d="m10 5 7 7-7 7m7-7H5"/>',
  gas: '<path d="m6 11 6-6 6 6m-6-6v15m-6-6 6-6 6 6"/>',
  brake: '<path d="M5 5h14M6 12l6 6 6-6M12 7v11"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  share: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',
  edit: '<path d="m14 5 5 5m-2-7 4 4-12 12-6 2 2-6Z"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0Zm0 2H3v3c0 3 2 4 5 4m9-7h4v3c0 3-2 4-5 4m-4 3v5m-4 1h8"/>',
  replay: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
};
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.flag}</svg>`;
}
export function setButtonLabel(button, value) {
  const target = button.querySelector('.button-label') || button;
  if (target.textContent !== value) target.textContent = value;
}

/** Native mobile sharing; cancellation is deliberately quiet, denial falls back. */
export async function shareInvitation(url, title, api = navigator) {
  if (typeof api.share === 'function') {
    try { await api.share({ title, url }); return 'shared'; }
    catch (error) { if (error.name === 'AbortError') return 'cancelled'; }
  }
  try { await api.clipboard.writeText(url); return 'copied'; }
  catch { return 'manual'; }
}

export class Presentation {
  constructor() {
    this.screen = null;
    for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
    document.querySelectorAll('h1, h2').forEach(el => el.tabIndex = -1);
    document.addEventListener('keydown', e => {
      const modal = document.querySelector('.overlay[aria-modal="true"]:not(.hidden)');
      if (!modal || e.key !== 'Tab') return;
      // Keep live language selection available even while a game dialog is open.
      const elements = [...document.querySelectorAll('#languageSwitcher button, #messageActions button:not(.hidden)'), ...modal.querySelectorAll('button:not(:disabled), a, input, .standings-scroll')].filter(el => el.getClientRects().length);
      const i = elements.indexOf(document.activeElement);
      if (i === -1 || (!e.shiftKey && i === elements.length - 1) || (e.shiftKey && i === 0)) {
        e.preventDefault(); elements[e.shiftKey ? elements.length - 1 : 0]?.focus();
      }
    });
    document.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => {
      if (details.open && details.closest('.overlay:not(.hidden)')) details.scrollIntoView({ block: 'nearest' });
    }));
  }
  update(screen) {
    if (screen === this.screen) return;
    this.screen = screen; document.body.dataset.screen = screen;
    const ids = { menu: 'mainMenu', modes: 'modeMenu', browser: 'roomBrowser', lobby: 'lobbyScreen', paused: 'pauseMenu', finished: 'raceOver' };
    const panel = document.getElementById(ids[screen])?.querySelector('.panel');
    if (panel) {
      panel.scrollTop = 0;
      // Do not pop the mobile keyboard on screen transitions.
      const focus = screen === 'paused' ? panel.querySelector('#btn-resume') : screen === 'finished' ? panel.querySelector('#resultsTitle') : panel.querySelector('h1, h2');
      focus?.focus({ preventScroll: true });
    }
  }
}
