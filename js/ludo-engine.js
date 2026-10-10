// ludo-engine.js — pure Ludo rules. No DOM, no Firebase: every function takes a
// game object and returns a NEW one (or a list), so it can be unit-tested in Node
// and re-used by both online (Firebase) and offline (local) modes.
//
// Coordinates / progress model
//   Each pawn has a "progress" number relative to its own colour:
//     -1        in base (yard)
//     0 .. 50   on the shared 52-tile track (0 = that colour's start tile)
//     51 .. 55  in its private home lane
//     56        finished (centre)
//   Track index of a pawn = (START[color] + progress) % 52.

(function (root) {
  'use strict';

  const COLORS = ['red', 'green', 'yellow', 'blue'];      // clockwise seat order
  const START = { red: 1, green: 14, yellow: 27, blue: 40 };
  const TRACK = 52, LAST_TRACK = 50, FINISH = 56;

  // Safe tiles: every start tile + the star tile 8 steps after it.
  const SAFE = new Set();
  COLORS.forEach(c => { SAFE.add(START[c]); SAFE.add((START[c] + 8) % TRACK); });

  // 15x15 grid coordinates [col,row] of the 52 track tiles, clockwise.
  const TRACK_XY = (function () {
    const L = [];
    for (let c = 0; c <= 5; c++) L.push([c, 6]);
    for (let r = 5; r >= 0; r--) L.push([6, r]);
    L.push([7, 0]);
    for (let r = 0; r <= 5; r++) L.push([8, r]);
    for (let c = 9; c <= 14; c++) L.push([c, 6]);
    L.push([14, 7]);
    for (let c = 14; c >= 9; c--) L.push([c, 8]);
    for (let r = 9; r <= 14; r++) L.push([8, r]);
    L.push([7, 14]);
    for (let r = 14; r >= 9; r--) L.push([6, r]);
    for (let c = 5; c >= 0; c--) L.push([c, 8]);
    L.push([0, 7]);
    return L;
  })();

  const LANE_XY = {
    red:    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    green:  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    blue:   [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
  };

  // Host-editable rules. `type` drives the lobby UI; labels live in the UI i18n.
  const DEFAULT_SETTINGS = {
    capture: true,          // landing on an opponent sends it back to base
    safeTiles: true,        // start tiles + stars can't be captured on
    needSix: true,          // need a 6 to leave base
    triesWhenStuck: true,   // 3 rolls when no pawn is on the board
    sixExtra: true,         // rolling a 6 gives another roll
    maxSixes: 3,            // N sixes in a row cancels the move (0 = unlimited)
    captureExtra: true,     // capturing gives another roll
    homeExtra: true,        // finishing a pawn gives another roll
    exactFinish: true,      // need exact roll to finish (off = bounce back)
    blockade: false,        // 2+ same-colour pawns on a tile can't be passed
    noJump: true,           // can't move past ANY pawn: you may only stop behind it or land on it
    autoMove: true,         // auto-play when only one move is possible
    pawns: 4,               // pawns per player (1-4)
    finishMode: 'first'     // 'first' = first finisher wins, 'ranking' = play for places
  };
  const SETTINGS_META = [
    { key: 'capture', type: 'bool' },
    { key: 'safeTiles', type: 'bool', dependsOn: 'capture' },
    { key: 'needSix', type: 'bool' },
    { key: 'triesWhenStuck', type: 'bool', dependsOn: 'needSix' },
    { key: 'sixExtra', type: 'bool' },
    { key: 'maxSixes', type: 'num', min: 0, max: 6, step: 1 },
    { key: 'captureExtra', type: 'bool', dependsOn: 'capture' },
    { key: 'homeExtra', type: 'bool' },
    { key: 'exactFinish', type: 'bool' },
    { key: 'blockade', type: 'bool' },
    { key: 'noJump', type: 'bool' },
    { key: 'pawns', type: 'num', min: 1, max: 4, step: 1 },
    { key: 'finishMode', type: 'choice', options: ['first', 'ranking'] },
    { key: 'autoMove', type: 'bool' }
  ];

  const clone = o => JSON.parse(JSON.stringify(o));
  const trackIdx = (color, p) => (p >= 0 && p <= LAST_TRACK) ? (START[color] + p) % TRACK : null;

  function normalizeSettings(s) {
    const out = Object.assign({}, DEFAULT_SETTINGS, s || {});
    out.pawns = Math.max(1, Math.min(4, parseInt(out.pawns, 10) || 4));
    out.maxSixes = Math.max(0, Math.min(6, parseInt(out.maxSixes, 10) || 0));
    if (out.finishMode !== 'ranking') out.finishMode = 'first';
    return out;
  }

  // Firebase drops empty arrays and may turn arrays into objects; put things back.
  function normalize(g) {
    if (!g) return g;
    g.ranking = g.ranking ? Object.values(g.ranking) : [];
    g.log = g.log ? Object.values(g.log) : [];
    g.order = Object.values(g.order || []);
    Object.keys(g.pawns || {}).forEach(c => { g.pawns[c] = Object.values(g.pawns[c]); });
    return g;
  }

  function newGame(settings, colors, firstColor) {
    const s = normalizeSettings(settings);
    const order = COLORS.filter(c => colors.includes(c));
    const pawns = {};
    order.forEach(c => { pawns[c] = Array(s.pawns).fill(-1); });
    return {
      v: 0, settings: s, order, pawns,
      turn: order.includes(firstColor) ? firstColor : order[0],
      phase: 'roll', die: 0, tries: 3, sixes: 0, rollSeq: 0, moveSeq: 0,
      lastRoll: null, lastMove: null, ranking: [], winner: null, log: []
    };
  }

  const isDone = (g, c) => g.pawns[c].every(p => p === FINISH);
  const anyOnBoard = (g, c) => g.pawns[c].some(p => p >= 0 && p < FINISH);

  function pawnsAt(g, idx, exceptColor) {
    const out = [];
    g.order.forEach(c => {
      if (c === exceptColor) return;
      g.pawns[c].forEach((p, i) => { if (trackIdx(c, p) === idx) out.push({ color: c, pawn: i }); });
    });
    return out;
  }
  function anyPawnAt(g, idx, color, pawn) {
    return g.order.some(c => g.pawns[c].some((p, j) => !(c === color && j === pawn) && trackIdx(c, p) === idx));
  }
  function isBlockade(g, idx, forColor) {
    if (!g.settings.blockade) return false;
    return g.order.some(c => c !== forColor &&
      g.pawns[c].filter(p => trackIdx(c, p) === idx).length >= 2);
  }

  // Evaluate moving pawn i of `color` by `die`. Returns null when illegal.
  function evalMove(g, color, i, die) {
    const s = g.settings, p = g.pawns[color][i];
    if (p === FINISH) return null;
    let to; const path = [];
    if (p === -1) {
      if (s.needSix && die !== 6) return null;
      to = 0; path.push(0);
    } else {
      to = p + die;
      if (to > FINISH) {
        if (s.exactFinish) return null;
        to = FINISH - (to - FINISH);
        if (to === p) return null;
        for (let q = p + 1; q <= FINISH; q++) path.push(q);
        for (let q = FINISH - 1; q >= to; q--) path.push(q);
      } else {
        for (let q = p + 1; q <= to; q++) path.push(q);
      }
    }
    for (let k = 0; k < path.length; k++) {
      const idx = trackIdx(color, path[k]);
      if (idx === null) continue;
      if (isBlockade(g, idx, color)) return null;
      // noJump: any pawn (own or not) on a tile we would pass over (not the final tile) blocks this move
      if (s.noJump && k < path.length - 1 && anyPawnAt(g, idx, color, i)) return null;
    }
    const captures = [];
    const destIdx = trackIdx(color, to);
    if (s.capture && destIdx !== null && !(s.safeTiles && SAFE.has(destIdx))) {
      pawnsAt(g, destIdx, color).forEach(o => captures.push(o));
    }
    return { pawn: i, from: p, to, path, captures, finishes: to === FINISH, leaves: p === -1 };
  }

  function legalMoves(g, color, die) {
    const out = [];
    g.pawns[color].forEach((_, i) => { const m = evalMove(g, color, i, die); if (m) out.push(m); });
    return out;
  }

  function pushLog(g, entry) { g.log.push(entry); if (g.log.length > 40) g.log.shift(); }

  function nextColor(g, from) {
    const n = g.order.length;
    let k = g.order.indexOf(from);
    for (let step = 1; step <= n; step++) {
      const c = g.order[(k + step) % n];
      if (!isDone(g, c)) return c;
    }
    return from;
  }
  function passTurn(g) {
    g.turn = nextColor(g, g.turn);
    g.phase = 'roll'; g.sixes = 0; g.tries = 3;
  }

  // Apply a dice value for the player whose turn it is. Returns a new game.
  function roll(game, value) {
    const g = clone(game);
    if (g.phase !== 'roll') return game;
    const color = g.turn, s = g.settings;
    g.die = value; g.rollSeq++;
    g.lastRoll = { seq: g.rollSeq, color, value };
    pushLog(g, { k: 'roll', c: color, d: value });
    if (value === 6) g.sixes++; else g.sixes = 0;
    if (value === 6 && s.maxSixes && g.sixes >= s.maxSixes) {
      pushLog(g, { k: 'sixes', c: color });
      passTurn(g); return g;
    }
    const moves = legalMoves(g, color, value);
    if (!moves.length) {
      if (s.needSix && s.triesWhenStuck && !anyOnBoard(g, color) && g.tries > 1) {
        g.tries--; return g;                     // stays in 'roll' phase: try again
      }
      pushLog(g, { k: 'pass', c: color });
      passTurn(g); return g;
    }
    g.phase = 'move';
    return g;
  }

  // Move pawn `i` using the pending die. Returns a new game.
  function move(game, i) {
    const g = clone(game);
    if (g.phase !== 'move') return game;
    const color = g.turn, s = g.settings;
    const m = evalMove(g, color, i, g.die);
    if (!m) return game;
    g.pawns[color][i] = m.to;
    m.captures.forEach(o => { g.pawns[o.color][o.pawn] = -1; });
    g.moveSeq++;
    g.lastMove = { seq: g.moveSeq, color, pawn: i, from: m.from, to: m.to, path: m.path,
      captured: m.captures, die: g.die };
    if (m.leaves) pushLog(g, { k: 'leave', c: color });
    m.captures.forEach(o => pushLog(g, { k: 'capture', c: color, o: o.color }));
    if (m.finishes) pushLog(g, { k: 'home', c: color });

    let extra = (g.die === 6 && s.sixExtra) || (m.captures.length > 0 && s.captureExtra) ||
                (m.finishes && s.homeExtra);

    if (isDone(g, color)) {
      g.ranking.push(color);
      pushLog(g, { k: 'rank', c: color, d: g.ranking.length });
      extra = false;
      const left = g.order.filter(c => !isDone(g, c));
      if (s.finishMode === 'first' || left.length <= 1) {
        if (left.length === 1 && s.finishMode !== 'first') g.ranking.push(left[0]);
        g.winner = g.ranking[0]; g.phase = 'over'; return g;
      }
    }
    if (extra) {
      g.phase = 'roll'; g.tries = 3;
      pushLog(g, { k: 'extra', c: color });
    } else passTurn(g);
    return g;
  }

  // ---- Bot -------------------------------------------------------------------
  function danger(g, color, idx) {
    if (idx === null || (g.settings.safeTiles && SAFE.has(idx)) || !g.settings.capture) return 0;
    let n = 0;
    g.order.forEach(c => {
      if (c === color) return;
      g.pawns[c].forEach(p => {
        const j = trackIdx(c, p);
        if (j === null) return;
        const d = (idx - j + TRACK) % TRACK;
        if (d >= 1 && d <= 6) n++;
      });
    });
    return n;
  }
  function botChoose(g, color) {
    const moves = legalMoves(g, color, g.die);
    if (!moves.length) return null;
    let best = null, bestScore = -1e9;
    moves.forEach(m => {
      let sc = m.to * 0.4 + Math.random() * 4;
      if (m.finishes) sc += 100;
      if (m.captures.length) {
        sc += 70;
        m.captures.forEach(o => { sc += Math.max(0, g.pawns[o.color][o.pawn]) * 0.6; });
      }
      if (m.leaves) sc += 45;
      if (m.to > LAST_TRACK && m.from <= LAST_TRACK) sc += 30;       // into the home lane
      const fromIdx = trackIdx(color, m.from), toIdx = trackIdx(color, m.to);
      const dFrom = danger(g, color, fromIdx), dTo = danger(g, color, toIdx);
      if (dFrom && !dTo) sc += 28;
      if (dTo) sc -= 22 * dTo;
      if (toIdx !== null && g.settings.safeTiles && SAFE.has(toIdx)) sc += 10;
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return best.pawn;
  }

  const api = {
    COLORS, START, TRACK, LAST_TRACK, FINISH, SAFE, TRACK_XY, LANE_XY,
    DEFAULT_SETTINGS, SETTINGS_META,
    normalizeSettings, normalize, newGame, legalMoves, evalMove, roll, move, botChoose,
    trackIdx, isDone, nextColor, clone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ludo = api;
})(typeof window !== 'undefined' ? window : globalThis);
