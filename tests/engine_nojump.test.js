const L = require('../js/ludo-engine.js'); const assert = require('assert');
const mk = (o) => L.newGame(Object.assign({ pawns: 2, capture: true, safeTiles: false, needSix: false }, o), ['red', 'yellow'], 'red');
// red pawn at p5 (idx6); yellow pawn on idx 8 (p = 8-27+52 = 33)
let g = mk({}); g.pawns.red = [5, -1]; g.pawns.yellow = [33, -1];
assert.strictEqual(L.trackIdx('yellow', 33), 8);
assert.strictEqual(L.evalMove(g, 'red', 0, 1) !== null, true, 'stop behind is fine (idx7)');
assert.ok(L.evalMove(g, 'red', 0, 2).captures.length === 1, 'land exactly on it = kick');
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null, 'passing over is illegal');
assert.strictEqual(L.evalMove(g, 'red', 0, 6), null);
// rule off -> can jump
g.settings.noJump = false; assert.ok(L.evalMove(g, 'red', 0, 3));
// capture off: landing on it allowed (coexist), passing still illegal
g = mk({ capture: false }); g.pawns.red = [5, -1]; g.pawns.yellow = [33, -1];
assert.ok(L.evalMove(g, 'red', 0, 2) && L.evalMove(g, 'red', 0, 2).captures.length === 0);
assert.strictEqual(L.evalMove(g, 'red', 0, 4), null);
// own pawn also blocks
g = mk({}); g.pawns.red = [5, 7]; g.pawns.yellow = [-1, -1];
assert.strictEqual(L.evalMove(g, 'red', 0, 3), null, 'own pawn blocks too');
assert.ok(L.evalMove(g, 'red', 0, 2), 'landing on own pawn ok');
// home lane is private: no blocking there
g = mk({}); g.pawns.red = [49, 52]; assert.ok(L.evalMove(g, 'red', 0, 5));
// whole games still finish (no deadlock) with noJump on
let done = 0;
for (let t = 0; t < 300; t++) {
  let gg = L.newGame({ noJump: true, pawns: 1 + t % 4, blockade: t % 2 === 0, capture: t % 3 !== 0, safeTiles: t % 5 !== 0, exactFinish: t % 7 !== 0 }, ['red','green','yellow','blue'].filter(() => Math.random() < .8).concat(['red','blue']).filter((c,i,a)=>a.indexOf(c)===i));
  let n = 0;
  while (gg.phase !== 'over' && n++ < 80000) { gg = L.roll(gg, 1 + Math.floor(Math.random() * 6)); if (gg.phase === 'move') gg = L.move(gg, L.botChoose(gg, gg.turn)); }
  if (gg.phase === 'over') done++; else console.log('STUCK', JSON.stringify(gg.settings), JSON.stringify(gg.pawns));
}
console.log('noJump fuzz', done, '/ 300'); assert.strictEqual(done, 300);
console.log('NOJUMP TESTS PASSED');
