# Cờ Cá Ngựa (Ludo)

Browser Ludo built in the same style/stack as Boardwalk Night: plain HTML/CSS/JS, optional
Firebase Realtime Database for online rooms, free static hosting (GitHub Pages).
Vietnamese by default, English via the 🌐 button.

## Play modes
- **Create / Join room** – online, up to 4 players (+ bots). Share the 5-letter code.
- **Play Offline** – one device: hot-seat with friends and/or bots. Needs no network or Firebase.
- Bots are driven by the host; if a human disconnects for 20 s a bot plays for them until they return.

## Host rule toggles (waiting room)
| Rule | Default |
|---|---|
| **Capture pawns** (landing on an opponent sends it home) | on |
| Safe tiles (start + ★ can't be captured on) | on |
| Need a 6 to leave base / 3 tries when no pawn is out | on / on |
| Roll again on 6 / after capture / when a pawn gets home | on / on / on |
| N sixes in a row lose the turn (0 = unlimited) | 3 |
| Exact roll to finish (off = bounce back) | on |
| Blockades (2 same-colour pawns form a wall) | off |
| **No jumping over pawns** (blocked path = illegal move, unless you land on it or stop behind it) | on |
| Pawns per player (1–4) | 4 |
| Game end: first home wins, or play on for rankings | first |
| Auto-move when only one move is possible | on |

## Setup
Same Firebase project as Boardwalk Night (`js/firebase-config.js` is copied from it). Ludo rooms are
stored at `rooms/ludo_<CODE>`, which is already covered by the existing rules
(`rooms/$roomId` read/write), so **no rule changes are needed**. Push the folder to GitHub Pages
like the original.

## Adding a language
Copy the `en: { ... }` block in `js/i18n.js`, rename it to the language code (e.g. `ja`), translate it and set
`meta.name`. Nothing else: the language picker, the saved choice and all screens pick it up automatically.
Missing keys fall back to English (the console lists them). Use `meta.dir: 'rtl'` for right-to-left scripts.
The bundled web fonts are Latin; other scripts use the system font.

## Files
- `js/ludo-engine.js` – pure rules (no DOM/Firebase); unit-tested in `tests/engine.test.js` (`node tests/engine.test.js`).
- `js/ludo-net.js` – room store: Firebase (transactions) or in-memory local mode.
- `js/ludo-ui.js` – screens, board, animations, bot driver. `js/i18n.js` – vi/en strings.
- Add a rule: add a key to `DEFAULT_SETTINGS` + `SETTINGS_META` in the engine, use it in `evalMove`/`move`,
  and add its label to `i18n.js` (`set.<key>`).
