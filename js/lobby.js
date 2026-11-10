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

  message(value) { this.lastMessage = value; this.error.textContent = textMessage(value); this.error.classList.toggle('hidden', !value); }
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
      const empty = document.createElement('p'); empty.className = 'help'; empty.textContent = t('browser.empty'); list.append(empty);
    }
    for (const r of rooms) {
      const row = document.createElement('li'); row.className = 'room-row'; row.dataset.roomCode = r.code;
      const info = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('small');
      const roomName = displayNameOf(r); name.textContent = roomName; name.dir = 'auto';
      detail.textContent = t('room.detail', { count: r.count, capacity: r.capacity, players: t('players.count', { count: r.count }), availability: t(r.phase === 'lobby' ? r.count === 6 ? 'room.full' : 'room.open' : 'room.racing') });
      info.append(name, detail);
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
      const item = document.createElement('li'); item.className = 'player-row';
      const name = document.createElement('span'), nickname = document.createElement('bdi'); nickname.dir = 'auto'; nickname.textContent = p.nickname;
      const number = document.createElement('bdi'); number.dir = 'ltr'; number.textContent = (i + 1) + '. ';
      name.append(number, nickname, p.id === this.network.playerId ? t('lobby.you') : '');
      const ready = document.createElement('strong'); ready.textContent = t(p.ready ? 'lobby.readyStatus' : 'lobby.waiting'); ready.className = p.ready ? 'ready-label' : '';
      item.append(name, ready); list.append(item);
    });
    const solo = room.players.length === 1, me = room.players.find(p => p.id === this.network.playerId);
    el('btn-room-start').textContent = t(solo ? 'lobby.start' : me?.ready ? 'lobby.notReady' : 'lobby.ready');
    el('btn-room-start').disabled = !['lobby', 'countdown'].includes(room.phase) || (solo && room.phase === 'countdown');
    el('lobbyHint').textContent = t(room.phase === 'countdown' ? 'lobby.countdownHint' : solo ? 'lobby.soloHint' : 'lobby.multiHint');
    this.busyButtons();
  }
}
