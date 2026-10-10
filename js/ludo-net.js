// ludo-net.js — room storage + all room-level actions.
// Two backends behind one interface:
//   online : Firebase Realtime Database, room at rooms/ludo_<CODE>
//   local  : in-memory (offline / hot-seat / vs bots), no network at all
//
// Every write is a pure function  room -> room  (or undefined to abort). Online it runs
// inside a Firebase transaction (so racing clients can't clobber each other), locally it
// just runs. Game rules themselves live in ludo-engine.js.

const Net = (function () {
  const L = Ludo;
  const MY_UID = (function () {
    try {
      let id = localStorage.getItem('ludo_uid');
      if (!id) { id = 'u_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('ludo_uid', id); }
      return id;
    } catch (e) { return 'u_' + Math.random().toString(36).slice(2, 10); }
  })();

  const ONLINE_OK = typeof db !== 'undefined' && db !== null;
  const AFK_MS = 20000;

  const S = {
    mode: null,        // 'online' | 'local'
    code: null,
    room: null,        // normalized mirror of the room
    onChange: null,    // callback(room, prevRoom)
    ref: null,
    connRef: null
  };

  function codeGen() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
  const keyOf = code => 'ludo_' + code;

  function normalizeRoom(r) {
    if (!r) return r;
    r.seats = r.seats || {};
    r.settings = L.normalizeSettings(r.settings);
    if (r.g) {
      L.normalize(r.g);
      if (r.g.lastMove) r.g.lastMove.captured = r.g.lastMove.captured ? Object.values(r.g.lastMove.captured) : [];
      if (r.g.lastMove && r.g.lastMove.path) r.g.lastMove.path = Object.values(r.g.lastMove.path);
    }
    return r;
  }

  function emit(prev) { if (S.onChange) S.onChange(S.room, prev); }

  // ---- generic mutate ---------------------------------------------------------
  async function mutate(fn) {
    if (S.mode === 'local') {
      const prev = S.room;
      const next = fn(JSON.parse(JSON.stringify(S.room)));
      if (!next) return false;
      S.room = normalizeRoom(next);
      emit(prev);
      return true;
    }
    if (S.mode === 'online') {
      const res = await S.ref.transaction(cur => {
        if (cur === null) return cur;
        const c = normalizeRoom(JSON.parse(JSON.stringify(cur)));
        const out = fn(c);
        return out === undefined || out === false ? undefined : out;
      }, undefined, false);
      return !!(res && res.committed);
    }
    return false;
  }

  // ---- connect / disconnect -----------------------------------------------------
  function attach(code) {
    S.mode = 'online'; S.code = code;
    S.ref = db.ref('rooms/' + keyOf(code));
    S.ref.on('value', snap => {
      const prev = S.room;
      const val = snap.val();
      if (!val) { S.room = null; emit(prev); return; }
      S.room = normalizeRoom(val);
      emit(prev);
    });
    // presence: flag my seat as connected, and clear it automatically on disconnect
    S.connRef = db.ref('.info/connected');
    S.connRef.on('value', snap => {
      if (snap.val() !== true || !S.room) return;
      armPresence();
    });
  }
  function mySeatColor(room) {
    room = room || S.room; if (!room) return null;
    return Object.keys(room.seats).find(c => room.seats[c] && room.seats[c].uid === MY_UID) || null;
  }
  function armPresence() {
    const c = mySeatColor(); if (!c || S.mode !== 'online') return;
    const r = S.ref.child('seats/' + c);
    r.child('connected').onDisconnect().set(false);
    r.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    r.child('connected').set(true);
    r.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  }
  function detach() {
    if (S.ref) { S.ref.off(); S.ref = null; }
    if (S.connRef) { S.connRef.off(); S.connRef = null; }
    S.mode = null; S.code = null; S.room = null;
  }

  // ---- lobby actions ------------------------------------------------------------
  function freeColor(room, prefer) {
    const order = Object.keys(room.seats).length === 0 ? ['red', 'yellow', 'green', 'blue']
                                                       : ['yellow', 'green', 'blue', 'red'];
    if (prefer && !room.seats[prefer]) return prefer;
    return order.find(c => !room.seats[c]) || null;
  }
  const baseRoom = (host) => ({
    game: 'ludo', hostUid: host, status: 'lobby', settings: Object.assign({}, L.DEFAULT_SETTINGS),
    seats: {}, g: null, createdAt: Date.now()
  });

  async function createOnline(name) {
    if (!ONLINE_OK) throw new Error('offline');
    const code = codeGen();
    const room = baseRoom(MY_UID);
    room.seats.red = { uid: MY_UID, name, connected: true, bot: false };
    await db.ref('rooms/' + keyOf(code)).set(room);
    attach(code);
    return code;
  }

  async function joinOnline(code, name) {
    if (!ONLINE_OK) throw new Error('offline');
    code = code.toUpperCase().trim();
    const snap = await db.ref('rooms/' + keyOf(code)).get();
    if (!snap.exists()) return { ok: false, reason: 'noRoom' };
    attach(code);
    // wait for first snapshot to land so we can decide
    await new Promise(res => { const t0 = Date.now(); (function w() { if (S.room || Date.now() - t0 > 4000) res(); else setTimeout(w, 30); })(); });
    if (!S.room) { detach(); return { ok: false, reason: 'noRoom' }; }
    if (mySeatColor()) { return { ok: true, resumed: true }; }
    if (S.room.status === 'lobby') {
      const ok = await mutate(r => {
        if (r.status !== 'lobby') return undefined;
        if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) return r;
        const c = freeColor(r);
        if (!c) return undefined;
        r.seats[c] = { uid: MY_UID, name, connected: true, bot: false };
        return r;
      });
      if (!ok) { detach(); return { ok: false, reason: 'roomFull' }; }
      return { ok: true };
    }
    return { ok: true, spectator: true };
  }

  async function tryRejoin(code) {
    if (!ONLINE_OK || !code) return null;
    const snap = await db.ref('rooms/' + keyOf(code.toUpperCase())).get();
    if (!snap.exists()) return null;
    const r = normalizeRoom(snap.val());
    if (Object.values(r.seats).some(s => s && s.uid === MY_UID)) { attach(code.toUpperCase()); return code.toUpperCase(); }
    return null;
  }

  function createLocal(name) {
    S.mode = 'local'; S.code = 'LOCAL';
    const room = baseRoom('local_host');
    room.seats.red = { uid: 'local_1', name, local: true, bot: false, connected: true };
    room.seats.yellow = { uid: 'bot_1', name: t('colors.yellow') + ' Bot', bot: true, connected: true };
    S.room = normalizeRoom(room);
    return 'LOCAL';
  }

  const isHost = (room) => S.mode === 'local' || (room && room.hostUid === MY_UID);

  function setSetting(key, value) {
    return mutate(r => { if (r.status !== 'lobby') return undefined; r.settings[key] = value; r.settings = L.normalizeSettings(r.settings); return r; });
  }
  // Relative change applied inside the transaction, so rapid +/- clicks never act on a stale value.
  function stepSetting(key, delta, min, max) {
    return mutate(r => {
      if (r.status !== 'lobby') return undefined;
      r.settings[key] = Math.max(min, Math.min(max, (parseInt(r.settings[key], 10) || 0) + delta));
      r.settings = L.normalizeSettings(r.settings); return r;
    });
  }
  function sit(color) {
    if (S.mode !== 'online') return;
    return mutate(r => {
      if (r.status !== 'lobby' || r.seats[color]) return undefined;
      const old = Object.keys(r.seats).find(c => r.seats[c] && r.seats[c].uid === MY_UID);
      if (!old) return undefined;
      r.seats[color] = r.seats[old]; delete r.seats[old];
      return r;
    }).then(ok => { if (ok) armPresence(); return ok; });
  }
  function addSeat(color, kind, name) {
    return mutate(r => {
      if (r.status !== 'lobby' || r.seats[color]) return undefined;
      const n = Object.values(r.seats).filter(x => x && !x.bot).length + 1;
      if (kind === 'bot') r.seats[color] = { uid: 'bot_' + color, name: t('colors.' + color) + ' Bot', bot: true, connected: true };
      else r.seats[color] = { uid: 'local_' + color, name: name || (t('player') + ' ' + n), local: true, bot: false, connected: true };
      return r;
    });
  }
  function removeSeat(color) {
    return mutate(r => { if (r.status !== 'lobby' || !r.seats[color]) return undefined; delete r.seats[color]; return r; });
  }
  function renameSeat(color, name) {
    return mutate(r => { if (!r.seats[color]) return undefined; r.seats[color].name = name.slice(0, 16); return r; });
  }
  function leaveSeat() {
    // online: free my seat in the lobby; during a game the seat is kept (bot plays for me)
    if (S.mode !== 'online') return Promise.resolve();
    const c = mySeatColor(); if (!c) return Promise.resolve();
    return mutate(r => {
      if (r.status === 'lobby') {
        delete r.seats[c];
        const rest = Object.keys(r.seats).filter(k => r.seats[k] && !r.seats[k].bot);
        if (r.hostUid === MY_UID && rest.length) r.hostUid = r.seats[rest[0]].uid;
        return r;
      }
      r.seats[c].connected = false; r.seats[c].lastSeen = Date.now(); return r;
    });
  }

  function startGame() {
    return mutate(r => {
      if (r.status !== 'lobby') return undefined;
      const colors = Object.keys(r.seats).filter(c => r.seats[c]);
      if (colors.length < 2) return undefined;
      r.g = L.newGame(r.settings, colors, colors[Math.floor(Math.random() * colors.length)]);
      r.status = 'playing';
      return r;
    });
  }
  function backToLobby() {
    return mutate(r => { r.status = 'lobby'; r.g = null; return r; });
  }

  // ---- in-game actions ----------------------------------------------------------
  // `expect` = {v} protects against acting on stale state (double clicks, races).
  function doRoll(expectV, value) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || r.g.v !== expectV || r.g.phase !== 'roll') return undefined;
      r.g = L.roll(r.g, value); r.g.v++;
      if (r.g.phase === 'over') r.status = 'ended';
      return r;
    });
  }
  function doMove(expectV, pawn) {
    return mutate(r => {
      if (r.status !== 'playing' || !r.g || r.g.v !== expectV || r.g.phase !== 'move') return undefined;
      const next = L.move(r.g, pawn);
      if (next === r.g) return undefined;
      r.g = next; r.g.v++;
      if (r.g.phase === 'over') r.status = 'ended';
      return r;
    });
  }

  // Who may act for seat `color` on THIS client?
  function canActFor(room, color) {
    const seat = room && room.seats[color]; if (!seat) return false;
    if (S.mode === 'local') return !seat.bot;
    return seat.uid === MY_UID;
  }
  // Who drives bots / absent players? Host, or the first connected human if the host is gone.
  function isDriver(room) {
    if (S.mode === 'local') return true;
    const humans = Object.keys(room.seats).map(c => room.seats[c]).filter(s => s && !s.bot);
    const hostSeat = humans.find(s => s.uid === room.hostUid);
    if (hostSeat && hostSeat.connected) return room.hostUid === MY_UID;
    const first = humans.find(s => s.connected);
    return !!first && first.uid === MY_UID;
  }
  const seatIsAutoplayed = (seat, now) => !!seat && (seat.bot || (!seat.local && seat.connected === false && now - (seat.lastSeen || 0) > AFK_MS));

  return {
    MY_UID, ONLINE_OK, S, AFK_MS,
    mutate, createOnline, joinOnline, tryRejoin, createLocal, detach, mySeatColor, isHost,
    setSetting, stepSetting, sit, addSeat, removeSeat, renameSeat, leaveSeat, startGame, backToLobby,
    doRoll, doMove, canActFor, isDriver, seatIsAutoplayed, freeColor
  };
})();
