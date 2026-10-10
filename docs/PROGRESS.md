# Progress and handoff

Goal: rebuild the old Python/pygame Connect Four as a deployable web app. A 3D board sits on a table in a cozy cabin with a fireplace. The bot has selectable difficulty up to near-perfect.

Decisions: TypeScript + Vite + Three.js, static deploy (no server), bot runs client-side.

## Done (engine, no UI yet)
Run `npm install`, `npm test` (16 tests), `npx tsc --noEmit`.

- `src/core/bitboard.ts` – 7x6 board with a sentinel row. Each board is two int32 halves, `lo` = columns 0-3 and `hi` = columns 4-6 (JS bitwise ops are 32-bit; BigInt was too slow). `lineCompletions` finds every cell that completes four in a row in one pass.
- `src/core/position.ts` – immutable `Position`: `play`, `canPlay`, `legalMoves`, `isWinningMove`, `heightOf`, `key()`, plus playable and threat masks.
- `src/core/game.ts` – `Game`: turn, history, status (`playing`/`won`/`draw`), `winningCells` for highlighting, and `play(col)` returns the landed `{col,row}`. Player 0 moves first.
- `src/ai/negamax.ts` – `Searcher`: alpha-beta negamax, iterative deepening, transposition table, threat-based move ordering, forced-block and double-threat detection, and a `solve()` weak solver (win/draw/loss).
- `src/ai/bot.ts` – `NegamaxBot(difficulty)` with `chooseMove(pos): number` (synchronous).
- `src/ai/difficulty.ts` – easy / medium / hard / expert. Expert tries `solve()` first.
- `src/ai/evaluate.ts`, `src/ai/transposition.ts` – heuristic and typed-array table.
- `tests/` – bitboard vs a 2D-grid reference over random games, threat masks, weak solver vs full search, and bot tactics.
- `legacy/` – the original Python (MCTS + pygame), kept for reference.

## Measured
- About 900 nodes/ms without move ordering and 400-500 with it (the original BigInt version did about 190).
- Complete win/draw/loss answer: ~4 ms at ply 26, ~40-100 ms at ply 22, ~1-2 s at ply 18, ~2.5 s at ply 14 (some positions hit a 10 s cap), mostly capped at ply 10. So Expert is provably perfect from roughly ply 18-22 on, and depth-limited (about 14-16 plies in 3 s) before that.
- Level-vs-level tournament (10 games per pairing, 0.3 s limits): Medium beat Easy 8-2, Hard beat Medium 8-1, Expert beat Hard 5-2 with 3 draws. The ladder works. Never tested against a human.

## Known gaps
- Search runs on the main thread, so it freezes the page. It needs a Web Worker.
- No opening book, so Expert is not perfect in the early game. Plan: generate one offline and ship it as a static file. An idea for later is a WebAssembly port.
- Optional search speed-ups: use the table's best move for ordering, mirror symmetry in the table, a narrowing window. Move ordering currently allocates arrays per node.
- When Expert has proven a win it plays the first winning move, not the fastest.
- Difficulty levels are untuned. Easy and Medium may feel similar to humans.

## Next (browser part)
1. `src/ai/bot.worker.ts` plus an async wrapper, so the UI stays responsive while the bot thinks.
2. `src/render/` Three.js scene: wooden table, board frame with holes, discs with drop animation and bounce, hover preview, win highlight, cabin, fireplace with a flickering warm light, shadows, limited orbit controls.
3. `src/ui/` HTML overlay: side and difficulty menu, status text, restart.
4. `src/main.ts` glue: a single turn loop with no duplicated human/bot branches.
5. `index.html`, `npm run dev`, and a production build with `vite build` for static hosting (Cloudflare Pages / Netlify / GitHub Pages).

Architecture rule: `core` and `ai` know nothing about rendering, `render` knows nothing about the bot, and only `main.ts` ties them together.

Planned render files: `scene.ts`, `cabin.ts`, `fireplace.ts`, `table.ts`, `board.ts`, `discs.ts`, `lighting.ts`, `input.ts` under `src/render/`. Use procedural geometry plus a few CC0 textures, warm shadow-mapped lighting, and subtle bloom on the fire. Make it work on mobile with pointer events.

## Gotchas
- Moves are 0-indexed columns in code; `Position.fromMoves("4453")` takes 1-indexed digits.
- `Position` stores stones from the point of view of the player to move (`current` / `mask`); the opponent is `current ^ mask`.
- `key()` is one exact double (< 2^49) used by the typed-array table.
