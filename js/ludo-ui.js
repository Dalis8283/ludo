// ludo-ui.js — screens, board rendering, animations, bot/autoplay driver.
// Reads room state from Net, writes only through Net's actions.

(function () {
  'use strict';
  const L = Ludo;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const COLOR_HEX = { red: '#ef4444', green: '#22c55e', yellow: '#facc15', blue: '#3b82f6' };
  const DIE_PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const BASE_ORG = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };
  const BASE_SLOTS = [[2, 2], [4, 2], [2, 4], [4, 4]];
  const HOME_DIR = { red: [-1, 0], green: [0, -1], yellow: [1, 0], blue: [0, 1] };
  const DICE_MS = 650, HOP_MS = 150;

  const U = {
    screen: 'loading', dp: null, pending: 0, gen: 0, chain: Promise.resolve(),
    seenMove: 0, seenRoll: 0, dieReveal: true, dieValue: 1, dieColor: 'red', dieTimer: null,
    driven: null, wasSeated: false, boardBuilt: false, lastGameKey: null, modalFor: null, hoverMove: null
  };

  const nameOf = (room, c) => (room && room.seats[c] && room.seats[c].name) || t('colors.' + c);

  // ============================== screens =====================================
  function showScreen(name) {
    U.screen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
  }
  let toastTimer;
  function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function closeModal() { $('modal').innerHTML = ''; $('modal').classList.remove('open'); U.modalFor = null; }
  function openModal(html, key) {
    $('modal').innerHTML = `<div class="modal-backdrop"></div><div class="modal-card">${html}</div>`;
    $('modal').classList.add('open'); U.modalFor = key || null;
  }

  // Language pickers are built from whatever is in I18N, so a new language shows up automatically.
  function buildLangSelects() {
    ['lang-select-lobby', 'lang-select-game'].forEach(id => {
      const sel = $(id); if (!sel) return;
      const codes = availableLangs();
      if (sel.options.length !== codes.length || codes.some((c, i) => sel.options[i].value !== c)) {
        sel.innerHTML = codes.map(c => `<option value="${esc(c)}">🌐 ${esc(langName(c))}</option>`).join('');
      }
      sel.value = LANG;
    });
  }

  function applyStaticText() {
    const meta = (I18N[LANG] && I18N[LANG].meta) || {};
    document.documentElement.lang = meta.htmlLang || LANG;
    document.documentElement.dir = meta.dir === 'rtl' ? 'rtl' : 'ltr';
    buildLangSelects();
    $('lobby-title').textContent = t('title'); $('lobby-sub').textContent = t('subtitle');
    $('lbl-name').textContent = t('yourName'); $('input-name').placeholder = t('namePh');
    $('tab-btn-create').textContent = t('tabCreate'); $('tab-btn-join').textContent = t('tabJoin'); $('tab-btn-offline').textContent = t('tabOffline');
    $('btn-create-room').textContent = t('createRoom'); $('btn-join-room').textContent = t('joinRoom');
    $('lbl-code').textContent = t('roomCode'); $('input-room-code').placeholder = t('codePh');
    $('offline-hint').textContent = t('offlineHint'); $('btn-start-offline').textContent = t('startOffline');
    $('online-off-note').textContent = t('onlineOff');
    $('seats-title').textContent = t('seats'); $('rules-title').textContent = t('houseRules');
    $('rules-readonly-hint').textContent = t('hostOnly');
    $('btn-leave-waiting').textContent = t('leave'); $('btn-leave-game').textContent = t('leave');
    $('btn-rules').textContent = '📋 ' + t('rules');
    $('game-title').textContent = t('title'); $('spectator-badge').textContent = t('spectating');
    $('room-code-label').textContent = t('roomCodeShare');
    $('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
    document.title = t('title');
  }

  // ============================== board =======================================
  function buildBoard() {
    const b = $('board'); b.innerHTML = '';
    const grid = document.createElement('div'); grid.className = 'board-grid'; b.appendChild(grid);
    const put = (el, c, r, cs = 1, rs = 1) => { el.style.gridColumn = `${c + 1} / span ${cs}`; el.style.gridRow = `${r + 1} / span ${rs}`; grid.appendChild(el); return el; };
    L.COLORS.forEach(c => {
      const [ox, oy] = BASE_ORG[c];
      const base = put(document.createElement('div'), ox, oy, 6, 6); base.className = `base c-${c}`; base.dataset.color = c;
      const yard = document.createElement('div'); yard.className = 'yard';
      for (let i = 0; i < 4; i++) { const s = document.createElement('i'); yard.appendChild(s); }
      base.appendChild(yard);
    });
    L.TRACK_XY.forEach(([x, y], idx) => {
      const el = put(document.createElement('div'), x, y); el.className = 'cell track';
      const startOf = L.COLORS.find(c => L.START[c] === idx);
      if (startOf) { el.classList.add('start', 'c-' + startOf); el.textContent = '➜'; el.dataset.dir = startOf; }
      else if (L.SAFE.has(idx)) { el.classList.add('star'); el.textContent = '★'; }
    });
    L.COLORS.forEach(c => L.LANE_XY[c].forEach(([x, y]) => { const el = put(document.createElement('div'), x, y); el.className = `cell lane c-${c}`; }));
    const center = put(document.createElement('div'), 6, 6, 3, 3); center.className = 'center';
    const layer = document.createElement('div'); layer.className = 'pawn-layer'; layer.id = 'pawn-layer'; b.appendChild(layer);
    const marker = document.createElement('div'); marker.className = 'dest-marker'; marker.id = 'dest-marker'; layer.appendChild(marker);
    U.boardBuilt = true; U.lastGameKey = null;
  }

  function cellPos(color, p, i) {
    if (p === -1) { const o = BASE_ORG[color], s = BASE_SLOTS[i]; return { x: o[0] + s[0], y: o[1] + s[1], key: null }; }
    if (p <= L.LAST_TRACK) { const idx = L.trackIdx(color, p); const [x, y] = L.TRACK_XY[idx]; return { x: x + .5, y: y + .5, key: 't' + idx }; }
    if (p < L.FINISH) { const [x, y] = L.LANE_XY[color][p - 51]; return { x: x + .5, y: y + .5, key: 'l' + color + p }; }
    return { x: 7.5, y: 7.5, key: 'h' + color, home: true };
  }

  function renderPawns(room) {
    const g = room.g, layer = $('pawn-layer');
    const dp = U.dp || g.pawns;
    const info = [];
    g.order.forEach(c => {
      for (let i = 0; i < (dp[c] || []).length; i++) { const p = dp[c][i]; info.push({ c, i, p, pos: cellPos(c, p, i) }); }
    });
    const groups = {};
    info.forEach(o => { if (o.pos.key) (groups[o.pos.key] = groups[o.pos.key] || []).push(o); });
    info.forEach(o => { if (!o.pos.key) { o.x = o.pos.x; o.y = o.pos.y; o.scale = 1; } });
    Object.values(groups).forEach(arr => {
      const n = arr.length;
      arr.forEach((o, k) => {
        if (o.pos.home) {
          const d = HOME_DIR[o.c]; const off = (k - (n - 1) / 2) * 0.36;
          o.x = 7.5 + d[0] * 0.95 - d[1] * off; o.y = 7.5 + d[1] * 0.95 + d[0] * off; o.scale = .62;
        } else if (n === 1) { o.x = o.pos.x; o.y = o.pos.y; o.scale = 1; }
        else {
          const spread = n === 2 ? [[-.2, 0], [.2, 0]] : n === 3 ? [[-.22, .08], [.22, .08], [0, -.2]] : [[-.2, -.15], [.2, -.15], [-.2, .2], [.2, .2]];
          const s = spread[k % spread.length]; o.x = o.pos.x + s[0]; o.y = o.pos.y + s[1]; o.scale = n === 2 ? .82 : .72;
        }
      });
    });
    const canPick = canPickNow(room);
    const moves = canPick ? L.legalMoves(g, g.turn, g.die) : [];
    const movable = {}; moves.forEach(m => { movable[g.turn + m.pawn] = m; });
    const seen = new Set();
    info.forEach(o => {
      const id = 'pawn-' + o.c + o.i; seen.add(id);
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div'); el.id = id; el.className = `pawn c-${o.c}`;
        el.innerHTML = '<i class="p-shadow"></i><i class="p-body"></i><i class="p-head"></i>';
        el.addEventListener('click', () => onPawnClick(o.c, +el.dataset.i));
        el.addEventListener('mouseenter', () => showDest(el.dataset.color, +el.dataset.i));
        el.addEventListener('mouseleave', hideDest);
        layer.appendChild(el);
      }
      el.dataset.i = o.i; el.dataset.color = o.c;
      el.style.left = (o.x / 15 * 100) + '%'; el.style.top = (o.y / 15 * 100) + '%';
      el.style.setProperty('--scale', o.scale == null ? 1 : o.scale);
      el.style.zIndex = 10 + Math.round(o.y * 4) + (U.pending && U.movingId === id ? 300 : 0);
      el.classList.toggle('movable', !!movable[o.c + o.i]);
      el.classList.toggle('done', o.p === L.FINISH);
    });
    layer.querySelectorAll('.pawn').forEach(el => { if (!seen.has(el.id)) el.remove(); });

    // Clickable tiles: a steady highlighted square under every movable pawn (the pawn itself hops,
    // so it is a bad click target). Updated in place so a click is never lost to a re-render.
    const wantHits = new Set();
    info.forEach(o => {
      if (!movable[o.c + o.i]) return;
      const hid = 'hit-' + o.c + o.i; wantHits.add(hid);
      let h = document.getElementById(hid);
      if (!h) {
        h = document.createElement('div'); h.id = hid; h.className = `tile-hit c-${o.c}`;
        h.addEventListener('click', () => onPawnClick(h.dataset.color, +h.dataset.i));
        h.addEventListener('mouseenter', () => showDest(h.dataset.color, +h.dataset.i));
        h.addEventListener('mouseleave', hideDest);
        layer.appendChild(h);
      }
      h.dataset.i = o.i; h.dataset.color = o.c;
      h.style.left = (o.pos.x / 15 * 100) + '%'; h.style.top = (o.pos.y / 15 * 100) + '%';
    });
    layer.querySelectorAll('.tile-hit').forEach(h => { if (!wantHits.has(h.id)) h.remove(); });
    document.querySelectorAll('.base').forEach(b => b.classList.toggle('active', room.status === 'playing' && g.turn === b.dataset.color));
  }

  function showDest(color, i) {
    const room = Net.S.room; if (!room || !room.g || !canPickNow(room) || room.g.turn !== color) return;
    const m = L.legalMoves(room.g, color, room.g.die).find(x => x.pawn === i); if (!m) return;
    const pos = cellPos(color, m.to, i), mk = $('dest-marker');
    mk.style.left = (pos.x / 15 * 100) + '%'; mk.style.top = (pos.y / 15 * 100) + '%'; mk.className = 'dest-marker show c-' + color;
  }
  function hideDest() { const mk = $('dest-marker'); if (mk) mk.classList.remove('show'); }

  // ============================== dice ========================================
  function renderDie(value, tumbling) {
    const d = $('die'); d.className = 'die' + (tumbling ? ' tumble' : '') + ' c-' + U.dieColor;
    const pips = DIE_PIPS[value] || [];
    let h = ''; for (let i = 0; i < 9; i++) h += `<i class="${pips.includes(i) ? 'on' : ''}"></i>`;
    d.innerHTML = h;
  }
  function startDiceAnim(lr) {
    clearInterval(U.dieTimer);
    U.dieReveal = false; U.dieColor = lr.color;
    playSound('diceRoll');
    let n = 0; U.dieTimer = setInterval(() => { renderDie(1 + Math.floor(Math.random() * 6), true); n++; }, 80);
    U.dieUntil = Date.now() + DICE_MS;
    setTimeout(() => {
      clearInterval(U.dieTimer); U.dieReveal = true; U.dieValue = lr.value; renderDie(lr.value, false);
      const room = Net.S.room; if (room && U.screen === 'game') { renderGame(room); }
      driver();
    }, DICE_MS);
  }
  async function waitDice() { while (!U.dieReveal) await sleep(40); }

  // ============================== animation ===================================
  function enqueueMove(lm, room) {
    const gen = U.gen; U.pending++;
    const id = 'pawn-' + lm.color + lm.pawn;
    U.chain = U.chain.then(async () => {
      if (gen !== U.gen) return;
      await waitDice(); await sleep(60);
      U.movingId = id;
      for (let k = 0; k < lm.path.length; k++) {
        if (gen !== U.gen) return;
        U.dp[lm.color][lm.pawn] = lm.path[k];
        const r = Net.S.room; if (r && r.g) renderPawns(r);
        playSound(lm.from === -1 ? 'leaveBase' : 'footstep');
        await sleep(HOP_MS);
      }
      if (gen !== U.gen) return;
      lm.captured.forEach(o => { U.dp[o.color][o.pawn] = -1; });
      if (lm.captured.length) playSound('capture');
      if (lm.to === L.FINISH) playSound('home');
      U.movingId = null;
      const r = Net.S.room; if (r && r.g) renderPawns(r);
      await sleep(lm.captured.length ? 450 : 120);
    }).then(() => {
      if (gen !== U.gen) return;
      U.pending = Math.max(0, U.pending - 1);
      const r = Net.S.room; if (r && U.screen === 'game') renderGame(r);
      driver();
    });
  }

  // ============================== game rendering ==============================
  function canPickNow(room) {
    const g = room.g;
    return !!g && room.status === 'playing' && g.phase === 'move' && U.pending === 0 && U.dieReveal &&
      Net.canActFor(room, g.turn) && !Net.seatIsAutoplayed(room.seats[g.turn], Date.now());
  }
  function canRollNow(room) {
    const g = room.g;
    return !!g && room.status === 'playing' && g.phase === 'roll' && U.pending === 0 && U.dieReveal &&
      Net.canActFor(room, g.turn) && !Net.seatIsAutoplayed(room.seats[g.turn], Date.now());
  }

  function renderGame(room) {
    const g = room.g; if (!g) return;
    if (!U.boardBuilt) buildBoard();
    if (!U.dp) U.dp = L.clone(g.pawns);
    $('game-room-code-label').textContent = Net.S.mode === 'local' ? t('offlineRoom') : Net.S.code;
    $('spectator-badge').style.display = (Net.S.mode === 'online' && !Net.mySeatColor(room)) ? '' : 'none';
    renderPawns(room);

    const turnColor = g.turn, over = g.phase === 'over';
    const tb = $('turn-banner');
    const mine = Net.canActFor(room, turnColor) && Net.S.mode === 'online';
    const auto = Net.seatIsAutoplayed(room.seats[turnColor], Date.now()) && !room.seats[turnColor].bot;
    if (over) tb.innerHTML = `<span class="dot" style="background:${COLOR_HEX[g.winner]}"></span> ${esc(t('winTitle', nameOf(room, g.winner)))}`;
    else tb.innerHTML = `<span class="dot" style="background:${COLOR_HEX[turnColor]}"></span> <b>${esc(mine ? t('yourTurn') : t('turnOf', nameOf(room, turnColor)))}</b>` +
      (auto ? ` <small class="muted">(${t('autoplay')})</small>` : '') +
      (g.phase === 'roll' && g.tries < 3 && g.settings.triesWhenStuck ? ` <small class="muted">· ${t('tries', g.tries)}</small>` : '');
    tb.style.borderColor = over ? COLOR_HEX[g.winner] : COLOR_HEX[turnColor];

    const roll = $('btn-roll'), rollable = canRollNow(room), pick = canPickNow(room);
    roll.disabled = !rollable;
    roll.textContent = !U.dieReveal ? t('rolling') : pick ? t('pickPawn') : t('rollBtn');
    $('die-btn').classList.toggle('ready', rollable);
    if (U.dieReveal && !$('die').firstChild) renderDie(U.dieValue, false);

    // players
    let ph = '';
    g.order.forEach(c => {
      const seat = room.seats[c] || {}; const done = g.pawns[c].filter(p => p === L.FINISH).length;
      const rank = g.ranking.indexOf(c);
      const away = !seat.bot && !seat.local && seat.connected === false;
      ph += `<div class="player-card c-${c}${c === turnColor && !over ? ' active' : ''}${away ? ' away' : ''}">
        <span class="swatch"></span>
        <div class="pc-main"><div class="pc-name">${esc(nameOf(room, c))}${seat.bot ? ` <em class="tag">${t('bot')}</em>` : ''}${seat.uid === Net.MY_UID && Net.S.mode === 'online' ? ` <em class="tag you">${t('you')}</em>` : ''}${away ? ` <em class="tag warn">${t('offline')}</em>` : ''}</div>
        <div class="pc-sub">${t('finishedCount', done, g.pawns[c].length)} <span class="pips">${g.pawns[c].map(p => `<i class="${p === L.FINISH ? 'on' : ''}"></i>`).join('')}</span></div></div>
        ${rank >= 0 ? `<span class="medal">${['🥇', '🥈', '🥉', '4️⃣'][rank]}</span>` : ''}</div>`;
    });
    $('player-panel').innerHTML = ph;

    // log (newest first)
    $('log-panel').innerHTML = g.log.slice().reverse().map(e => {
      const n = `<b style="color:${COLOR_HEX[e.c]}">${esc(nameOf(room, e.c))}</b>`;
      const o = e.o ? `<b style="color:${COLOR_HEX[e.o]}">${esc(nameOf(room, e.o))}</b>` : '';
      return `<div class="log-line k-${e.k}">${t('log.' + e.k, n, e.o ? o : e.d)}</div>`;
    }).join('');

    if (over && U.modalFor !== 'win') showWinModal(room);
    if (!over && U.modalFor === 'win') closeModal();
  }

  function showWinModal(room) {
    const g = room.g;
    const rows = g.ranking.map((c, i) => `<li><span class="medal">${['🥇', '🥈', '🥉', '4️⃣'][i]}</span><span class="dot" style="background:${COLOR_HEX[c]}"></span>${esc(nameOf(room, c))}</li>`).join('');
    const host = Net.isHost(room);
    openModal(`<h2>🏆 ${esc(t('winTitle', nameOf(room, g.winner)))}</h2><h3>${t('winFinal')}</h3><ol class="rank-list">${rows}</ol>
      ${host ? `<button class="btn btn-block" id="btn-rematch">${t('backToLobby')}</button>` : `<p class="muted" style="text-align:center">${t('playAgainHint')}</p>`}`, 'win');
    playSound('gameOver');
    const b = $('btn-rematch'); if (b) b.onclick = () => Net.backToLobby();
  }

  function showRulesModal(room) {
    openModal(`<h2>📋 ${t('houseRules')}</h2><div id="rules-modal-list"></div><button class="btn btn-secondary btn-block" id="btn-close-modal">OK</button>`, 'rules');
    renderRules($('rules-modal-list'), room.settings, false);
    $('btn-close-modal').onclick = closeModal;
    $('modal').querySelector('.modal-backdrop').onclick = closeModal;
  }

  // ============================== actions =====================================
  function onRoll() {
    const room = Net.S.room; if (!room || !canRollNow(room)) return;
    Net.doRoll(room.g.v, 1 + Math.floor(Math.random() * 6));
  }
  function onPawnClick(color, i) {
    const room = Net.S.room; if (!room || !canPickNow(room) || room.g.turn !== color) return;
    if (!L.legalMoves(room.g, color, room.g.die).some(m => m.pawn === i)) return;
    hideDest(); Net.doMove(room.g.v, i);
  }

  // Bot / AFK / auto-move driver. Safe to call often.
  function driver() {
    const room = Net.S.room;
    if (!room || room.status !== 'playing' || !room.g || U.screen !== 'game') return;
    const g = room.g;
    if (U.pending > 0 || !U.dieReveal) return;
    const seat = room.seats[g.turn]; const now = Date.now();
    let action = null, delay = 0;
    if (Net.seatIsAutoplayed(seat, now) && Net.isDriver(room)) {
      delay = g.phase === 'roll' ? 750 : 650;
      action = g.phase === 'roll'
        ? () => Net.doRoll(g.v, 1 + Math.floor(Math.random() * 6))
        : () => { const p = L.botChoose(g, g.turn); return p === null ? null : Net.doMove(g.v, p); };
    } else if (Net.canActFor(room, g.turn) && g.phase === 'move' && g.settings.autoMove) {
      const moves = L.legalMoves(g, g.turn, g.die);
      if (moves.length === 1) { delay = 500; action = () => Net.doMove(g.v, moves[0].pawn); }
    }
    if (!action) {
      if (seat && !seat.bot && !seat.local && seat.connected === false) setTimeout(driver, 1500); // wait out AFK grace
      return;
    }
    const key = g.v + ':' + g.phase;
    if (U.driven === key) return;
    U.driven = key;
    setTimeout(async () => {
      const cur = Net.S.room;
      if (cur && cur.g && cur.g.v === g.v) { try { await action(); } catch (e) { console.error(e); } }
      if (U.driven === key) U.driven = null;
      setTimeout(driver, 50);
    }, delay);
  }

  // ============================== state changes ===============================
  function onRoomChange(room, prev) {
    if (!room) {
      if (Net.S.mode === 'online') { toast(t('noRoom')); leaveToLobby(); }
      return;
    }
    const seated = Net.S.mode === 'local' || !!Net.mySeatColor(room);
    if (U.wasSeated && !seated && room.status === 'lobby' && Net.S.mode === 'online') { toast(t('kicked')); leaveToLobby(); return; }
    U.wasSeated = seated;

    if (room.status === 'lobby') {
      U.dp = null; U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.boardBuilt = false; U.driven = null;
      if (U.screen !== 'waiting') U.rulesKey = null;
      if (U.modalFor === 'win') closeModal();
      showScreen('waiting'); renderWaiting(room); return;
    }
    // playing / ended
    const g = room.g;
    const fresh = U.screen !== 'game' || !prev || prev.status === 'lobby' || !prev.g || g.v < prev.g.v || !U.dp;
    if (fresh) {
      U.gen++; U.pending = 0; U.chain = Promise.resolve(); U.boardBuilt = false;
      U.dp = L.clone(g.pawns); U.seenMove = g.moveSeq; U.seenRoll = g.rollSeq;
      U.dieReveal = true; U.dieValue = g.lastRoll ? g.lastRoll.value : 1; U.dieColor = g.lastRoll ? g.lastRoll.color : g.turn;
      U.driven = null;
      showScreen('game'); renderDie(U.dieValue, false);
      if (prev && prev.status === 'lobby') playSound('gameStart');
    } else {
      if (g.rollSeq > U.seenRoll) { U.seenRoll = g.rollSeq; startDiceAnim(g.lastRoll); }
      if (g.moveSeq > U.seenMove) { U.seenMove = g.moveSeq; enqueueMove(g.lastMove, room); }
      if (g.phase === 'roll' && prev && prev.g && prev.g.turn !== g.turn && g.moveSeq === U.seenMove && U.pending === 0) playSound('endTurn');
      if (g.phase === 'roll' && g.log.length && g.log[g.log.length - 1].k === 'pass') playSound('pass');
    }
    renderGame(room);
    driver();
  }

  function leaveToLobby() {
    clearInterval(U.dieTimer); U.gen++; U.pending = 0; U.dp = null; U.boardBuilt = false; U.wasSeated = false; U.driven = null;
    closeModal();
    Net.detach(); try { history.replaceState(null, '', location.pathname); } catch (e) {}
    showScreen('lobby');
  }

  // ============================== waiting room ================================
  function renderRules(container, settings, editable) {
    container.innerHTML = '';
    L.SETTINGS_META.forEach(m => {
      const [label, desc] = t('set.' + m.key).constructor === Array ? t('set.' + m.key) : [m.key, ''];
      const row = document.createElement('div');
      const dep = m.dependsOn && !settings[m.dependsOn];
      row.className = 'rule-row' + (dep ? ' dim' : '');
      let ctl = '';
      if (m.type === 'bool') {
        ctl = `<label class="switch"><input type="checkbox" data-key="${m.key}" ${settings[m.key] ? 'checked' : ''} ${editable ? '' : 'disabled'}><span class="slider"></span></label>`;
      } else if (m.type === 'num') {
        ctl = `<div class="stepper"><button type="button" data-step="-1" data-key="${m.key}" ${editable ? '' : 'disabled'}>−</button><b>${settings[m.key]}</b><button type="button" data-step="1" data-key="${m.key}" ${editable ? '' : 'disabled'}>+</button></div>`;
      } else {
        ctl = `<div class="radio-pair">${m.options.map(o => `<label class="radio-option"><input type="radio" name="r-${m.key}" data-key="${m.key}" value="${o}" ${settings[m.key] === o ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${t('choice.' + o)}</span></label>`).join('')}</div>`;
      }
      row.innerHTML = `<div class="rule-text"><strong>${esc(label)}</strong><small>${esc(desc)}</small>${m.type === 'choice' ? ctl : ''}</div>${m.type === 'choice' ? '' : ctl}`;
      container.appendChild(row);
    });
    if (!editable) return;
    container.querySelectorAll('input[type=checkbox]').forEach(i => i.onchange = () => Net.setSetting(i.dataset.key, i.checked));
    container.querySelectorAll('input[type=radio]').forEach(i => i.onchange = () => Net.setSetting(i.dataset.key, i.value));
    container.querySelectorAll('.stepper button').forEach(b => b.onclick = () => {
      const m = L.SETTINGS_META.find(x => x.key === b.dataset.key);
      Net.stepSetting(m.key, +b.dataset.step, m.min, m.max);
    });
  }

  function renderWaiting(room) {
    const local = Net.S.mode === 'local', host = Net.isHost(room);
    $('room-code-box').style.display = local ? 'none' : '';
    $('room-code-display').textContent = Net.S.code || '-----';
    const grid = $('seat-grid'); grid.innerHTML = '';
    const me = Net.mySeatColor(room);
    L.COLORS.forEach(c => {
      const s = room.seats[c]; const card = document.createElement('div');
      card.className = `seat c-${c}${s ? ' taken' : ''}`;
      let inner = `<span class="swatch"></span><div class="seat-main"><div class="seat-color">${t('colors.' + c)}</div>`;
      if (s) {
        inner += `<div class="seat-name">${esc(s.name)} ${s.bot ? `<em class="tag">${t('bot')}</em>` : ''}${s.uid === room.hostUid ? `<em class="tag host">${t('host')}</em>` : ''}${s.uid === Net.MY_UID ? `<em class="tag you">${t('you')}</em>` : ''}</div></div>`;
        const canRemove = host && (local ? true : s.uid !== Net.MY_UID);
        if (canRemove) inner += `<button class="mini-btn danger" data-act="remove" data-color="${c}">${s.bot || local ? t('remove') : t('kick')}</button>`;
      } else {
        inner += `<div class="seat-name muted">${t('empty')}</div></div>`;
        if (local || host) inner += `<button class="mini-btn" data-act="bot" data-color="${c}">${t('addBot')}</button>`;
        if (local) inner += `<button class="mini-btn" data-act="human" data-color="${c}">${t('addHuman')}</button>`;
        else if (me) inner += `<button class="mini-btn" data-act="sit" data-color="${c}">${t('sit')}</button>`;
      }
      card.innerHTML = inner; grid.appendChild(card);
    });
    grid.querySelectorAll('button').forEach(b => b.onclick = () => {
      const c = b.dataset.color, a = b.dataset.act;
      if (a === 'bot') Net.addSeat(c, 'bot'); else if (a === 'human') Net.addSeat(c, 'human');
      else if (a === 'remove') Net.removeSeat(c); else if (a === 'sit') Net.sit(c);
    });
    if (local) grid.querySelectorAll('.seat.taken .seat-name').forEach(el => {
      el.style.cursor = 'pointer';
      el.onclick = () => {
        const c = [...grid.children].indexOf(el.closest('.seat')); const col = L.COLORS[c];
        const seat = room.seats[col]; if (!seat || seat.bot) return;
        const n = prompt(t('yourName'), seat.name); if (n && n.trim()) Net.renameSeat(col, n.trim());
      };
    });
    const rk = JSON.stringify([room.settings, host, LANG]);
    if (U.rulesKey !== rk) { U.rulesKey = rk; renderRules($('rules-list'), room.settings, host); }   // only rebuild when rules changed
    $('rules-readonly-hint').style.display = host ? 'none' : '';
    const count = Object.keys(room.seats).length;
    $('btn-start-game').style.display = host ? '' : 'none';
    $('btn-start-game').textContent = t('start'); $('btn-start-game').disabled = count < 2;
    $('waiting-hint').textContent = host ? (count < 2 ? t('needTwo') : '') : t('waitHost');
  }

  // ============================== lobby wiring ================================
  function myName() {
    const n = $('input-name').value.trim();
    try { if (n) localStorage.setItem('ludo_name', n); } catch (e) {}
    return n;
  }
  function wire() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active'); $('tab-' + btn.dataset.tab).classList.add('active');
    }));
    const onLang = e => { setLang(e.target.value); applyStaticText(); const r = Net.S.room; if (r) onRoomChangeRerender(r); };
    $('lang-select-lobby').onchange = onLang; $('lang-select-game').onchange = onLang;
    $('btn-sound').onclick = () => { setSoundEnabled(!soundEnabled); applyStaticText(); };
    $('btn-create-room').onclick = async () => {
      const n = myName(); if (!n) return toast(t('nameNeeded'));
      if (!Net.ONLINE_OK) return toast(t('onlineOff'));
      try { const code = await Net.createOnline(n); location.hash = code; } catch (e) { console.error(e); toast(t('onlineOff')); }
    };
    $('btn-join-room').onclick = async () => {
      const n = myName(); if (!n) return toast(t('nameNeeded'));
      const code = $('input-room-code').value.trim(); if (!code) return;
      if (!Net.ONLINE_OK) return toast(t('onlineOff'));
      try {
        const r = await Net.joinOnline(code, n);
        if (!r.ok) return toast(t(r.reason));
        location.hash = code.toUpperCase();
        if (r.spectator) toast(t('spectatorToast'));
      } catch (e) { console.error(e); toast(t('onlineOff')); }
    };
    $('btn-start-offline').onclick = () => {
      const n = myName() || (t('player') + ' 1');
      Net.createLocal(n); onRoomChange(Net.S.room, null);
    };
    $('btn-start-game').onclick = () => Net.startGame();
    $('btn-leave-waiting').onclick = async () => { await Net.leaveSeat(); leaveToLobby(); };
    $('btn-leave-game').onclick = async () => { await Net.leaveSeat(); leaveToLobby(); };
    $('btn-rules').onclick = () => { const r = Net.S.room; if (r) showRulesModal(r); };
    $('btn-roll').onclick = onRoll; $('die-btn').onclick = onRoll;
    $('room-code-display').onclick = () => { try { navigator.clipboard.writeText(location.href); toast(t('copied')); } catch (e) {} };
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && U.screen === 'game' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); onRoll(); }
    });
  }
  function onRoomChangeRerender(room) {
    if (U.screen === 'waiting') renderWaiting(room);
    else if (U.screen === 'game') { renderGame(room); if (U.modalFor === 'win') showWinModal(room); }
  }

  async function init() {
    applyStaticText();
    try { $('input-name').value = localStorage.getItem('ludo_name') || ''; } catch (e) {}
    if (!Net.ONLINE_OK) $('online-off-note').style.display = '';
    Net.S.onChange = onRoomChange;
    wire();
    showScreen('lobby');
    const hash = location.hash.replace('#', '').trim();
    if (hash && Net.ONLINE_OK) {
      try { const code = await Net.tryRejoin(hash); if (!code) { $('input-room-code').value = hash.toUpperCase(); document.querySelector('[data-tab=join]').click(); } }
      catch (e) { console.error(e); }
    }
  }
  window.LudoUI = { U, init, driver, applyStaticText };   // exposed for tests / debugging
  init();
})();
