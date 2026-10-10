// i18n.js — all UI text. Vietnamese (default, like Boardwalk Night) + English.
//
// ADD A LANGUAGE: copy the whole `en: { ... }` block below, rename the key to the language code
// (e.g. `ja`), translate the values, and set `meta.name` (shown in the language picker).
// That's it — the picker, saving the choice and every screen pick it up automatically.
//   * Keep every key (see the console warning listing anything you missed). A missing key just
//     falls back to English, so a half-finished language still works.
//   * Values that are functions (like `turnOf: n => ...`) receive the arguments in the same order
//     as the English version; `log.*` entries too.
//   * meta.htmlLang (optional) = value for <html lang>; meta.dir = 'rtl' for right-to-left scripts.
//
// t('key.path', ...args) looks the text up. Values may be strings or functions of the args.

const I18N = {
  vi: {
    meta: { name: 'Tiếng Việt', htmlLang: 'vi' },
    title: 'Cờ Cá Ngựa',
    subtitle: 'Đá qua đá lại',
    yourName: 'Tên cậu là gì',
    namePh: 'e.g. Sơn Tùng MVP',
    tabCreate: 'Tạo Phòng', tabJoin: 'Tham Gia', tabOffline: 'Chơi Offline',
    createRoom: 'Tạo Phòng', joinRoom: 'Tham Gia', roomCode: 'Code Phòng', codePh: 'e.g. K7XPS',
    offlineHint: 'Chơi trên cùng một máy: nhiều người thay nhau hoặc đấu với bot. Nhưng vẫn cần mạng.',
    startOffline: 'Chơi Offline',
    onlineOff: 'Không kết nối được với CSDL — chơi tạm offline đi.',
    roomCodeShare: 'Code Phòng — chia sẻ cho người khác',
    offlineRoom: 'Phòng Offline',
    seats: 'Chỗ ngồi', empty: 'Trống', host: 'Chủ phòng', bot: 'Máy', you: 'Tôi',
    sit: 'Đổi sang màu này', addBot: '+ Máy', addHuman: '+ Người', remove: 'Xóa', kick: 'cook',
    houseRules: 'Luật Trực Nội', hostOnly: 'Chỉ chủ phòng mới đổi được luật.',
    start: 'Bắt Đầu', waitHost: 'Chờ chủ phòng Bắt Đầu...', needTwo: 'Cần ít nhất 2 người.',
    leave: 'Rời', rules: 'Luật', sound: 'Âm thanh', copied: 'Đã copy code',
    colors: { red: 'Đỏ', green: 'Xanh Lá', yellow: 'Vàng', blue: 'Xanh Dương' },
    player: 'Người chơi',
    yourTurn: 'Tới lượt cậu đó!', turnOf: n => `Lượt của ${n}`, rollBtn: '🎲 Đổ xúc xắc', rolling: 'Đang đổ…',
    pickPawn: 'Chọn ngựa để đi', waiting: 'Chờ…', spectating: '👀 Đang xem', tries: n => `Còn ${n} lần đổ`,
    finishedCount: (a, b) => `${a}/${b} về đích`,
    offline: 'mất kết nối', autoplay: 'bot vào thay',
    log: {
      roll: (n, d) => `${n} đổ ra ${d}`,
      leave: n => `${n} xuất ngựa`,
      capture: (n, o) => `${n} đá văng ngựa của ${o} 💥`,
      home: n => `${n} đưa một ngựa về đích 🏁`,
      pass: n => `${n} không được đi, mất lượt`,
      sixes: n => `${n} cheat đổ 6 liên tiếp quá nhiều lần — mất lượt!`,
      extra: n => `${n} được đổ thêm lượt`,
      rank: (n, d) => `${n} hoàn thành — rank ${d} 🏆`
    },
    winTitle: n => `${n} chiến thắng!`, winFinal: 'Bảng xếp hạng', backToLobby: 'Về Menu', playAgainHint: 'Chờ chủ phòng mở ván mới…',
    place: n => `Hạng ${n}`,
    kicked: 'Cậu đã bị cho cút', noRoom: 'Không có phòng như vậy nhé!', roomFull: 'Phòng đầy rồi',
    spectatorToast: 'Game đã bắt đầu — cậu vào xem và giữ trật tự thôi nhé', nameNeeded: 'Nhập tên đã nào',
    on: 'Bật', off: 'Tắt',
    set: {
      capture: ['Đá ngựa', 'Bật: đáp xuống ô có ngựa đối thủ thì ngựa đó bị đá về chuồng. Tắt: đi cùng ô, không ai bị đá.'],
      safeTiles: ['Ô an toàn', 'Bật: ô xuất phát và ô ★ không bị đá. Tắt: đá được ở mọi ô.'],
      needSix: ['Cần đổ 6 để xuất ngựa', 'Bật: phải đổ [6] mới ra khỏi chuồng. Tắt: số nào cũng xuất ngựa được.'],
      triesWhenStuck: ['Được đổ 3 lần khi chưa có ngựa', 'Chưa có ngựa nào ngoài chuồng thì được đổ tối đa 3 lần để tìm [6].'],
      sixExtra: ['Đổ [6] được đổ tiếp', 'Đổ ra [6] thì được thêm một lượt đổ.'],
      maxSixes: ['Số lần [6] liên tiếp bị mất lượt', 'Đổ [6] liên tiếp đủ số lần này thì mất lượt, không được đi (0 = không giới hạn).'],
      captureExtra: ['Đá ngựa xong được đổ tiếp', 'Đá được ngựa đối thủ thì được thêm một lượt đổ.'],
      homeExtra: ['Về đích được đổ tiếp', 'Đưa một ngựa về đích thì được thêm một lượt đổ.'],
      exactFinish: ['Phải đổ đúng số để về đích', 'Bật: phải đổ đúng số bước còn lại. Tắt: đổ dư thì nẩy lùi lại.'],
      blockade: ['Rào chắn', 'Bật: hai ngựa cùng màu chung ô thì tạo thành rào, ngựa khác không đi qua và không đáp vào được.'],
      noJump: ['Không được nhảy qua ngựa', 'Bật: đường đi bị ngựa khác (của ai cũng được) chắn thì không đi được, trừ khi số xúc xắc đá trúng ngựa đó hoặc dừng lại phía sau nó.'],
      pawns: ['Số ngựa mỗi người', 'Từ 1 đến 4 ngựa (ván nhanh hơn khi ít ngựa).'],
      finishMode: ['Kết thúc ván', 'Người đầu tiên về đích thắng, hoặc chơi tiếp để xếp hạng hết mọi người.'],
      autoMove: ['Tự đi khi chỉ có 1 nước', 'Chỉ có một ngựa đi được thì tự đi luôn, đỡ phải bấm.']
    },
    choice: { first: 'Người về đích đầu tiên thắng', ranking: 'Chơi tiếp để xếp hạng' }
  },
  en: {
    meta: { name: 'English', htmlLang: 'en' },
    title: 'Ludo',
    subtitle: 'Knock them out — shock \'em loud.',
    yourName: 'Your name',
    namePh: 'e.g. Jane Doe',
    tabCreate: 'Create Room', tabJoin: 'Join', tabOffline: 'Play Offline',
    createRoom: 'Create Room', joinRoom: 'Join', roomCode: 'Room code', codePh: 'e.g. K7XPS',
    offlineHint: 'Play on one device: take turns with friends or face bots. But internet needed.',
    startOffline: 'Play Offline',
    onlineOff: "Couldn't reach Firebase — offline play instead.",
    roomCodeShare: 'Room code — share it with your homies',
    offlineRoom: 'Offline room',
    seats: 'Seats', empty: 'Empty', host: 'Host', bot: 'Bot', you: 'You',
    sit: 'Sit here', addBot: '+ Bot', addHuman: '+ Human', remove: 'Remove', kick: 'Kick',
    houseRules: 'House Rules', hostOnly: 'Only the host can change the rules.',
    start: 'Start Game', waitHost: 'Waiting for the host to start…', needTwo: 'Need at least 2 players/bots.',
    leave: 'Leave', rules: 'Rules', sound: 'Sound', copied: 'Code copied',
    colors: { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' },
    player: 'Player',
    yourTurn: "It's your turn!", turnOf: n => `${n}'s turn`, rollBtn: '🎲 Roll the die', rolling: 'Rolling…',
    pickPawn: 'Pick a pawn to move', waiting: 'Waiting…', spectating: '👀 Spectating', tries: n => `${n} tries left`,
    finishedCount: (a, b) => `${a}/${b} home`,
    offline: 'disconnected', autoplay: 'bot is playing',
    log: {
      roll: (n, d) => `${n} rolled ${d}`,
      leave: n => `${n} brought a pawn out`,
      capture: (n, o) => `${n} knocked out a pawn of ${o} 💥`,
      home: n => `${n} got a pawn home 🏁`,
      pass: n => `${n} has no move — turn lost`,
      sixes: n => `${n} rolled too many 6s in a row — turn lost!`,
      extra: n => `${n} rolls again`,
      rank: (n, d) => `${n} finished — place ${d} 🏆`
    },
    winTitle: n => `${n} wins!`, winFinal: 'Final standings', backToLobby: 'Back to lobby', playAgainHint: 'Waiting for the host to start a new game…',
    place: n => `Place ${n}`,
    kicked: 'You were removed from the room', noRoom: 'No such room!', roomFull: 'Room is full',
    spectatorToast: 'Game already started — you are watching', nameNeeded: 'Enter a name first',
    on: 'On', off: 'Off',
    set: {
      capture: ['Capture pawns', 'On: landing on an opponent sends it back to base. Off: pawns share tiles, nobody is knocked out.'],
      safeTiles: ['Safe tiles', 'On: start tiles and ★ tiles can’t be captured on. Off: capture anywhere.'],
      needSix: ['Need a [6] to leave base', 'On: you must roll a [6] to bring a pawn out. Off: any number works.'],
      triesWhenStuck: ['3 tries with no pawn out', 'With no pawn on the board you get up to 3 rolls to find a [6].'],
      sixExtra: ['Roll again on a [6]', 'Rolling a [6] gives you another roll.'],
      maxSixes: ['Sixes in a row that forfeit', 'Rolling this many [6] in a row loses the turn (0 = unlimited).'],
      captureExtra: ['Roll again after capture', 'Knocking out an opponent gives another roll.'],
      homeExtra: ['Roll again when a pawn gets home', 'Getting a pawn home gives another roll.'],
      exactFinish: ['Exact roll to finish', 'On: you need the exact number to get home. Off: overshooting bounces you back.'],
      blockade: ['Blockades', 'On: two same-coloured pawns on a tile form a wall — others can’t pass or land there.'],
      noJump: ['No jumping over pawns', 'On: a move is illegal if any other pawn (anyone’s) is in the way — unless the roll lands exactly on it (capture) or stops behind it.'],
      pawns: ['Pawns per player', '1 to 4 pawns (fewer = shorter game).'],
      finishMode: ['Game end', 'First player home wins, or keep playing to rank everyone.'],
      autoMove: ['Auto-move when only one move', 'If just one pawn can move, it moves automatically.']
    },
    choice: { first: 'First home wins', ranking: 'Play on for rankings' }
  }
};


// ---------------------------------------------------------------------------------------------
// Language engine — nothing below needs editing when you add a language.
// ---------------------------------------------------------------------------------------------
const DEFAULT_LANG = 'vi';    // used on a first visit
const FALLBACK_LANG = 'en';   // used for any key the current language doesn't translate

const hasLang = c => !!c && Object.prototype.hasOwnProperty.call(I18N, c);
const availableLangs = () => Object.keys(I18N);
const langName = c => (hasLang(c) && I18N[c].meta && I18N[c].meta.name) || String(c).toUpperCase();

let LANG = (function () {
  try { const s = localStorage.getItem('ludo_lang'); if (hasLang(s)) return s; } catch (e) {}
  return hasLang(DEFAULT_LANG) ? DEFAULT_LANG : availableLangs()[0];
})();
function setLang(l) {
  if (!hasLang(l)) return;
  LANG = l;
  try { localStorage.setItem('ludo_lang', l); } catch (e) {}
}

function _lookup(code, parts) {
  let v = hasLang(code) ? I18N[code] : null;
  for (const p of parts) v = v == null ? v : v[p];
  return v;
}
function t(key, ...args) {
  const parts = key.split('.');
  let v = _lookup(LANG, parts);
  if (v == null) v = _lookup(FALLBACK_LANG, parts);
  if (v == null) v = _lookup(DEFAULT_LANG, parts);
  if (v == null) return key;
  return typeof v === 'function' ? v(...args) : v;
}

// Dev helper: warn in the console about keys a language hasn't translated yet.
(function checkI18n() {
  const flat = (o, pre = '') => Object.keys(o || {}).flatMap(k => {
    if (!pre && k === 'meta') return [];
    const v = o[k], path = pre + k;
    return v && typeof v === 'object' && !Array.isArray(v) ? flat(v, path + '.') : [path];
  });
  if (!hasLang(FALLBACK_LANG)) return;
  const ref = flat(I18N[FALLBACK_LANG]);
  availableLangs().forEach(code => {
    if (code === FALLBACK_LANG) return;
    const have = new Set(flat(I18N[code]));
    const missing = ref.filter(k => !have.has(k));
    if (missing.length) console.warn(`[i18n] "${code}" is missing ${missing.length} key(s) (English is shown instead):`, missing);
  });
})();
