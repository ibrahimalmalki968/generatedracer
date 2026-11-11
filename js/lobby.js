import { icon, setButtonLabel, shareInvitation } from './ui.js';
import { displayName } from '../shared/protocol.js';
import { message } from '../shared/translations.js';
import { t, textMessage, displayNameOf, languageEvents } from './i18n.js';

/** Entry, discovery and lobby UI. All state transitions are confirmed by the server. */
export class LobbyUI extends EventTarget {
  constructor(network) {
    super();
    this.pending = false; this.leaveDestination = 'browser';
    this.lastRooms = []; this.lastMessage = null; this.lastStatus = message('connection.connecting');
    this.network = network; this.invite = new URL(location.href).searchParams.get('room'); this.inviteAttempted = false;
    const el = id => document.getElementById(id);
    this.error = el('appMessage'); this.status = el('connectionStatus');
    try { el('nickname').value = sessionStorage.getItem('racer-nickname') || ''; } catch { /* optional session storage */ }
    el('nicknameForm').addEventListener('submit', e => {
      e.preventDefault();
      try {
        const nickname = displayName(el('nickname').value);
        try { sessionStorage.setItem('racer-nickname', nickname); } catch { /* memory-only session is fine */ }
        this.message('');
        if (network.ready) this.navigate('modes');
        else network.connect(nickname);
      } catch (error) { this.message(error); }
    });
    el('createForm').addEventListener('submit', e => {
      e.preventDefault(); this.action('create', { name: el('roomName').value.trim() || undefined, private: el('roomPrivacy').value === 'private' });
    });
    el('joinForm').addEventListener('submit', e => { e.preventDefault(); this.action('join', { code: el('roomCode').value.trim() }); });
    el('btn-refresh').addEventListener('click', () => this.action('list'));
    el('btn-solo').addEventListener('click', () => this.action('solo'));
    el('btn-multiplayer').addEventListener('click', () => { this.navigate('browser'); this.action('list'); });
    el('btn-browser-menu').addEventListener('click', () => this.home());
    el('btn-lobby-menu').addEventListener('click', () => this.home());
    el('btn-change-name').addEventListener('click', () => {
      if (this.pending || network.room) return;
      network.destroy(); network.socket = null; network.ready = false;
      this.navigate('menu'); el('nickname').focus();
    });
    el('btn-lobby-leave').addEventListener('click', () => this.leave());
    el('btn-room-start').addEventListener('click', () => {
      const room = network.room;
      if (!room) return;
      if (room.players.length === 1) this.action('start');
      else this.action('ready', { ready: !room.players.find(p => p.id === network.playerId)?.ready });
    });
    el('btn-message-dismiss').addEventListener('click', () => this.message(''));
    el('btn-reconnect').addEventListener('click', () => {
      this.message(''); network.destroy(); network.socket = null; network.ready = false; network.connect(network.nickname || el('nickname').value);
    });
    el('btn-share').addEventListener('click', async () => {
      if (this.sharing) return;
      this.sharing = true; el('btn-share').disabled = true;
      try {
        const outcome = await shareInvitation(el('inviteLink').value, 'GenerateRacer');
        if (outcome === 'shared') this.message(message('ui.shared'));
        else if (outcome === 'copied') this.message(message('notice.copied'));
        else if (outcome === 'manual') {
          el('inviteLink').closest('details').open = true; el('inviteLink').focus(); el('inviteLink').select(); this.message(message('notice.copyManually'));
        }
      } finally { this.sharing = false; el('btn-share').disabled = false; }
    });
    el('btn-invite').addEventListener('click', async () => {
      const input = el('inviteLink'); input.select();
      try { await navigator.clipboard.writeText(input.value); this.message(message('notice.copied')); }
      catch { this.message(message('notice.copyManually')); }
    });
    network.addEventListener('error', e => this.message(e.detail));
    network.addEventListener('status', e => { this.lastStatus = e.detail; this.status.textContent = textMessage(e.detail); this.status.classList.toggle('offline', !network.ready); this.busyButtons(); });
    network.addEventListener('rooms', e => this.rooms(e.detail));
    network.addEventListener('room', e => this.lobby(e.detail));
    network.addEventListener('welcome', e => {
      this.greeting();
      if (this.invite && !this.inviteAttempted) { this.inviteAttempted = true; this.action('join', { code: this.invite }); }
    });
    if (this.invite) { el('entryHint').dataset.i18n = 'entry.inviteHint'; el('entryHint').textContent = t('entry.inviteHint'); }
    languageEvents.addEventListener('change', () => this.refresh());
    // A reload restores the tab's short-lived anonymous session; a first visit still asks for a nickname.
    if (network.token && el('nickname').value.trim()) {
      try { network.connect(displayName(el('nickname').value)); } catch { /* fall back to entry validation */ }
    }
  }

  message(value) {
    this.lastMessage = value; this.error.textContent = textMessage(value); this.error.classList.toggle('hidden', !value);
    const key = value?.key || value?.code || value;
    this.error.dataset.kind = typeof key === 'string' && (key.startsWith('error.') || key.startsWith('connection.')) ? 'error' : 'notice';
    document.getElementById('messageActions').classList.toggle('hidden', !value);
    this.recoveryButton();
    for (const id of ['nickname', 'roomCode', 'roomName']) document.getElementById(id).removeAttribute('aria-invalid');
    const field = key === 'error.roomCode' || key === 'error.roomMissing' ? 'roomCode' : key === 'error.nameLength' ? (document.getElementById('mainMenu').classList.contains('hidden') ? 'roomName' : 'nickname') : null;
    if (field) { document.getElementById(field).setAttribute('aria-invalid', 'true'); document.getElementById(field).setAttribute('aria-describedby', 'appMessage'); }
  }
  recoveryButton() {
    const key = this.lastMessage?.key || this.lastMessage?.code || '';
    document.getElementById('btn-reconnect').classList.toggle('hidden', this.network.ready || !this.network.nickname || !(key.startsWith('connection.') || ['error.connectionLost', 'error.notConnected', 'error.timeout', 'error.sessionElsewhere'].includes(key)));
  }
  greeting() {
    if (!this.network.nickname) return;
    document.getElementById('playerGreeting').textContent = t('browser.greeting', { name: this.network.nickname });
    document.getElementById('modeGreeting').textContent = t('mode.greeting', { name: this.network.nickname });
  }
  refresh() {
    this.greeting(); this.message(this.lastMessage); this.status.textContent = textMessage(this.lastStatus);
    this.rooms(this.lastRooms); if (this.network.room) this.lobby(this.network.room); this.busyButtons();
  }
  navigate(state) {
    if (this.pending || this.network.room) return;
    this.message(''); this.dispatchEvent(new CustomEvent('navigate', { detail: state }));
  }
  clearInvite() {
    this.invite = null; this.inviteAttempted = true;
    document.getElementById('entryHint').dataset.i18n = 'entry.hint';
    document.getElementById('entryHint').textContent = t('entry.hint');
    const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
  }
  home() {
    if (this.pending) return;
    this.clearInvite();
    if (this.network.room) this.leave('modes');
    else this.navigate(this.network.ready ? 'modes' : 'menu');
  }
  async leave(destination = 'browser') {
    if (this.pending) return;
    this.leaveDestination = this.network.room?.solo ? 'modes' : destination;
    this.clearInvite();
    await this.action('leave');
  }
  busyButtons() {
    this.recoveryButton();
    const connecting = Boolean(!this.network.ready && this.network.socket && this.network.socket.readyState < 2);
    document.querySelector('#nicknameForm button').disabled = connecting;
    document.getElementById('nicknameForm').setAttribute('aria-busy', String(connecting));
    if (this.network.socket) this.status.classList.remove('hidden');
    document.getElementById('roomBrowser').setAttribute('aria-busy', String(this.pending));
    for (const id of ['btn-solo', 'btn-multiplayer', 'btn-change-name', 'btn-browser-menu', 'btn-lobby-menu', 'btn-refresh', 'btn-lobby-leave']) {
      document.getElementById(id).disabled = this.pending || !this.network.ready;
    }
    for (const el of document.querySelectorAll('#createForm button, #joinForm button')) el.disabled = this.pending || !this.network.ready;
    for (const el of document.querySelectorAll('#publicRooms button')) el.disabled = this.pending || !this.network.ready || el.dataset.available !== 'true';
    const room = this.network.room;
    document.getElementById('btn-room-start').disabled = this.pending || !this.network.ready || !room || !['lobby', 'countdown'].includes(room.phase) || (room.players.length === 1 && room.phase === 'countdown');
    document.getElementById('btn-cancel-countdown').disabled = this.pending || !this.network.ready || room?.phase !== 'countdown';
    document.getElementById('modeMenu').setAttribute('aria-busy', String(this.pending));
    document.getElementById('modeHint').textContent = t(this.pending ? 'mode.starting' : 'mode.hint');
  }
  async action(type, payload = {}) {
    if (this.pending) return false;
    this.pending = true; this.busyButtons();
    this.message('');
    try { await this.network.command(type, payload); return true; }
    catch (e) { this.message(e); return false; }
    finally { this.pending = false; this.busyButtons(); }
  }
  view(state) {
    for (const [id, visible] of [['mainMenu', state === 'menu'], ['modeMenu', state === 'modes'], ['roomBrowser', state === 'browser'], ['lobbyScreen', state === 'lobby']]) {
      document.getElementById(id).classList.toggle('hidden', !visible);
    }
    const entry = state === 'menu';
    document.getElementById('connectionStatus').classList.toggle('hidden', entry && !this.network.socket);
  }
  rooms(rooms) {
    this.lastRooms = rooms;
    const list = document.getElementById('publicRooms'); list.replaceChildren();
    if (!rooms.length) {
      const empty = document.createElement('li'); empty.className = 'empty-state';
      const symbol = document.createElement('span'); symbol.innerHTML = icon('flag'); symbol.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('p'); copy.textContent = t('browser.empty'); empty.append(symbol, copy); list.append(empty);
    }
    for (const r of rooms) {
      const row = document.createElement('li'); row.className = 'room-row'; row.dataset.roomCode = r.code; row.dataset.available = String(r.available);
      const info = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('small');
      const roomName = displayNameOf(r); name.textContent = roomName; name.dir = 'auto';
      detail.textContent = t('room.detail', { count: r.count, capacity: r.capacity, players: t('players.count', { count: r.count }), availability: t(r.phase === 'lobby' ? r.count === 6 ? 'room.full' : 'room.open' : 'room.racing') });
      const slots = document.createElement('div'); slots.className = 'room-slots'; slots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < r.capacity; i++) { const slot = document.createElement('i'); slot.classList.toggle('occupied', i < r.count); slots.append(slot); }
      info.append(name, detail, slots);
      const join = document.createElement('button'); join.textContent = t('room.joinShort'); join.className = 'btn small secondary';
      join.dataset.available = String(r.available); join.disabled = this.pending || !this.network.ready || !r.available; join.setAttribute('aria-label', t('room.joinNamed', { name: roomName }));
      join.addEventListener('click', () => this.action('join', { code: r.code })); row.append(info, join); list.append(row);
    }
  }
  lobby(room) {
    const el = id => document.getElementById(id);
    el('lobbyName').textContent = displayNameOf(room); el('lobbyName').dir = 'auto';
    el('lobbyInfo').textContent = t('room.info', { privacy: t(room.private ? 'room.private' : 'room.public'), count: room.players.length, capacity: room.capacity, players: t('players.count', { count: room.players.length }) });
    el('lobbyCode').textContent = room.code;
    const link = new URL(location.href); link.search = ''; link.searchParams.set('room', room.code); link.hash = '';
    el('inviteLink').value = link.href;
    const list = el('lobbyPlayers'); list.replaceChildren();
    room.players.forEach((p, i) => {
      const item = document.createElement('li'); item.className = 'player-row'; item.classList.toggle('is-ready', p.ready);
      const name = document.createElement('span'); name.className = 'player-identity';
      const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = Array.from(p.nickname)[0]; avatar.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.className = 'player-name';
      const nickname = document.createElement('bdi'); nickname.dir = 'auto'; nickname.textContent = p.nickname;
      text.append(nickname, p.id === this.network.playerId ? t('lobby.you') : ''); name.append(avatar, text);
      const ready = document.createElement('strong'); ready.textContent = t(p.ready ? 'lobby.readyStatus' : 'lobby.waiting'); ready.className = p.ready ? 'ready-label' : '';
      item.append(name, ready); list.append(item);
    });
    const solo = room.players.length === 1, me = room.players.find(p => p.id === this.network.playerId);
    setButtonLabel(el('btn-room-start'), t(solo ? 'lobby.start' : me?.ready ? 'ui.cancelReady' : 'lobby.ready'));
    if (solo) el('btn-room-start').removeAttribute('aria-pressed'); else el('btn-room-start').setAttribute('aria-pressed', String(Boolean(me?.ready)));
    const readyCount = room.players.filter(p => p.ready).length;
    el('readyProgress').textContent = t(solo ? 'lobby.start' : 'ui.readyProgress');
    el('readyFraction').textContent = solo ? '1 / 6' : `${readyCount} / ${room.players.length}`;
    const meter = el('readyMeter'); meter.setAttribute('aria-label', t('ui.readyCount', { ready: readyCount, count: room.players.length }));
    meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', String(room.players.length)); meter.setAttribute('aria-valuenow', String(readyCount));
    meter.style.setProperty('--ready-progress', `${readyCount / room.players.length * 100}%`);
    document.querySelector('.readiness').classList.toggle('hidden', solo);
    el('btn-room-start').disabled = !['lobby', 'countdown'].includes(room.phase) || (solo && room.phase === 'countdown');
    const waiting = room.players.find(p => !p.ready);
    el('lobbyHint').textContent = t(room.phase === 'countdown' ? 'lobby.countdownHint' : solo ? 'lobby.soloHint' : waiting ? 'ui.waitingFor' : 'ui.everyoneReady', { name: waiting?.nickname });
    this.busyButtons();
  }
}
