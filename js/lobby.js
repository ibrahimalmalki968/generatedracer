import { displayName } from '../shared/protocol.js';

/** Entry, discovery and lobby UI. All state transitions are confirmed by the server. */
export class LobbyUI extends EventTarget {
  constructor(network) {
    super();
    this.pending = false; this.leaveDestination = 'browser';
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
      } catch (error) { this.message(error.message); }
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
      try { await navigator.clipboard.writeText(input.value); this.message('Invitation link copied.'); }
      catch { this.message('Copy the selected invitation link.'); }
    });
    network.addEventListener('error', e => this.message(e.detail));
    network.addEventListener('status', e => { this.status.textContent = e.detail; this.status.classList.toggle('offline', !network.ready); this.busyButtons(); });
    network.addEventListener('rooms', e => this.rooms(e.detail));
    network.addEventListener('room', e => this.lobby(e.detail));
    network.addEventListener('welcome', e => {
      el('playerGreeting').textContent = `Welcome, ${network.nickname}`;
      el('modeGreeting').textContent = 'Ready to race, ' + e.detail.nickname + '?';
      if (this.invite && !this.inviteAttempted) { this.inviteAttempted = true; this.action('join', { code: this.invite }); }
    });
    if (this.invite) el('entryHint').textContent = 'Enter your nickname to join the invitation.';
    // A reload restores the tab's short-lived anonymous session; a first visit still asks for a nickname.
    if (network.token && el('nickname').value.trim()) {
      try { network.connect(displayName(el('nickname').value)); } catch { /* fall back to entry validation */ }
    }
  }

  message(text) { this.error.textContent = text; this.error.classList.toggle('hidden', !text); }
  navigate(state) {
    if (this.pending || this.network.room) return;
    this.message(''); this.dispatchEvent(new CustomEvent('navigate', { detail: state }));
  }
  clearInvite() {
    this.invite = null; this.inviteAttempted = true;
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
    for (const id of ['btn-solo', 'btn-multiplayer', 'btn-change-name', 'btn-browser-menu', 'btn-lobby-menu']) {
      document.getElementById(id).disabled = this.pending || !this.network.ready;
    }
    document.getElementById('modeMenu').setAttribute('aria-busy', String(this.pending));
    document.getElementById('modeHint').textContent = this.pending ? 'Starting your race…' : '3 laps · one Turbo per lap · no weapons';
  }
  async action(type, payload = {}) {
    if (this.pending) return false;
    this.pending = true; this.busyButtons();
    this.message('');
    try { await this.network.command(type, payload); return true; }
    catch (e) { this.message(e.message); return false; }
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
    const list = document.getElementById('publicRooms'); list.replaceChildren();
    if (!rooms.length) {
      const empty = document.createElement('p'); empty.className = 'help'; empty.textContent = 'No public rooms yet. Create one and invite a friend.'; list.append(empty);
    }
    for (const r of rooms) {
      const row = document.createElement('li'); row.className = 'room-row';
      const info = document.createElement('div'), name = document.createElement('strong'), detail = document.createElement('small');
      name.textContent = r.name; detail.textContent = `${r.count} / 6 players · ${r.phase === 'lobby' ? r.count === 6 ? 'Full' : 'Open' : 'Race in Progress'}`;
      info.append(name, detail);
      const join = document.createElement('button'); join.textContent = 'Join'; join.className = 'btn small secondary';
      join.disabled = !r.available; join.setAttribute('aria-label', `Join ${r.name}`);
      join.addEventListener('click', () => this.action('join', { code: r.code })); row.append(info, join); list.append(row);
    }
  }
  lobby(room) {
    const el = id => document.getElementById(id);
    el('lobbyName').textContent = room.name;
    el('lobbyInfo').textContent = `${room.private ? 'Private' : 'Public'} room · ${room.players.length} / 6 players · 3 laps`;
    el('lobbyCode').textContent = room.code;
    const link = new URL(location.href); link.search = ''; link.searchParams.set('room', room.code); link.hash = '';
    el('inviteLink').value = link.href;
    const list = el('lobbyPlayers'); list.replaceChildren();
    room.players.forEach((p, i) => {
      const item = document.createElement('li'); item.className = 'player-row';
      const name = document.createElement('span'); name.textContent = `${i + 1}. ${p.nickname}${p.id === this.network.playerId ? ' (you)' : ''}`;
      const ready = document.createElement('strong'); ready.textContent = p.ready ? 'Ready ✓' : 'Waiting'; ready.className = p.ready ? 'ready-label' : '';
      item.append(name, ready); list.append(item);
    });
    const solo = room.players.length === 1, me = room.players.find(p => p.id === this.network.playerId);
    el('btn-room-start').textContent = solo ? 'Start Race' : me?.ready ? 'Not ready' : 'Ready';
    el('btn-room-start').disabled = !['lobby', 'countdown'].includes(room.phase) || (solo && room.phase === 'countdown');
    el('lobbyHint').textContent = room.phase === 'countdown' ? 'Starting soon. Changing readiness or leaving cancels the countdown.' :
      solo ? 'Start against 5 AI, or wait here for friends. The race never starts automatically.' : 'Human racers only. Everyone must press Ready.';
  }
}
