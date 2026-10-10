# Progress and handoff

Goal: build a deployable web Connect Four app. A 3D board sits on a table in a glass cabin in a snowy forest at night, by a fireplace. The bot has selectable difficulty up to near-perfect.

Decisions: TypeScript + Vite + Three.js, static deploy (no server), bot runs client-side.

## Done: engine
Run `npm install`, `npm test` (16 tests), `npx tsc --noEmit`.

- `src/core/bitboard.ts` – 7x6 board with a sentinel row. Each board is two int32 halves, `lo` = columns 0-3 and `hi` = columns 4-6 (JS bitwise ops are 32-bit; BigInt was too slow). `lineCompletions` finds every cell that completes four in a row in one pass.
- `src/core/position.ts` – immutable `Position`: `play`, `canPlay`, `legalMoves`, `isWinningMove`, `heightOf`, `key()`, plus playable and threat masks.
- `src/core/game.ts` – `Game`: turn, history, status (`playing`/`won`/`draw`), `winningCells` for highlighting, and `play(col)` returns the landed `{col,row}`. Player 0 moves first.
- `src/ai/negamax.ts` – `Searcher`: alpha-beta negamax, iterative deepening, transposition table, threat-based move ordering, forced-block and double-threat detection, and a `solve()` weak solver (win/draw/loss).
- `src/ai/bot.ts` – `NegamaxBot(difficulty)` with `chooseMove(pos): number` (synchronous).
- `src/ai/difficulty.ts` – easy / medium / hard / expert. Expert tries `solve()` first.
- `src/ai/evaluate.ts`, `src/ai/transposition.ts` – heuristic and typed-array table.
- `tests/` – bitboard vs a 2D-grid reference over random games, threat masks, weak solver vs full search, and bot tactics.

## Measured
- About 900 nodes/ms without move ordering and 400-500 with it.
- Complete win/draw/loss answer: ~4 ms at ply 26, ~40-100 ms at ply 22, ~1-2 s at ply 18, ~2.5 s at ply 14 (some positions hit a 10 s cap), mostly capped at ply 10. So Expert is provably perfect from roughly ply 18-22 on, and depth-limited (about 14-16 plies in 3 s) before that.
- Level-vs-level tournament (10 games per pairing, 0.3 s limits): Medium beat Easy 8-2, Hard beat Medium 8-1, Expert beat Hard 5-2 with 3 draws. The ladder works. Never tested against a human.

## Known gaps
- No opening book, so Expert is not perfect in the early game. Plan: generate one offline and ship it as a static file. An idea for later is a WebAssembly port.
- Optional search speed-ups: use the table's best move for ordering, mirror symmetry in the table, a narrowing window. Move ordering currently allocates arrays per node.
- When Expert has proven a win it plays the first winning move, not the fastest.
- Difficulty levels are untuned. Easy and Medium may feel similar to humans.

## Done: browser
Run `npm run dev` (http://localhost:5173) or `npm run build`. `.claude/launch.json` lets the Claude desktop browser pane start the dev server.

### Bot and game loop
- `src/ai/bot.worker.ts` + `src/ai/asyncBot.ts` – `WorkerBot.chooseMove(moves, difficulty, signal)`. The worker rebuilds the Position from the move list (a class doesn't survive structured clone) and keeps one bot, with its transposition table, per level. A search can't be interrupted, so aborting terminates the worker and the next request starts a new one.
- `src/main.ts` – one `playLoop` for every kind of turn: ask the side to move for a column, `game.play`, await the drop animation. Each game has its own AbortController, so New game cleanly cancels a pending click, a bot search or the delay. The bot always appears to think for at least 550 ms.
- `src/ui/overlay.ts` + `style.css` – start menu (Bot/Friend, difficulty, side incl. random), status pill, New game / Settings, end-of-game banner. Settings persist in localStorage and are validated on load. While the menu is open it captures keyboard input.

### Scene (`src/render/`)
Second visual pass (2026-10-10): the scene now recreates a new reference photo the user supplied: a modern timber cabin at blue hour, with floor-to-ceiling glass on the back and right walls looking over snowy spruces, a valley and snowy mountains, a freestanding black stove in front of the glass, a low oak coffee table, a grey sofa with cream and orange throws, a wooden lounge chair with a sheepskin, floor lamps, and shelves with pottery. The board stands on the coffee table and the game is played from the photo's angle: seated, looking straight at the stove. The user chose "photo angle, a bit closer", so the camera is nearer the table than in the photo and the board is big enough to play.

Units are metres; the coffee table stands at the origin (top at `TABLE_TOP` = 0.45) and the camera looks towards -z.

Assets: CC0 textures, models and a sky from Poly Haven live in `public/assets` (about 14 MB, listed in `public/assets/CREDITS.md`). `assets.ts` loads them through one `LoadingManager`. `pbr(name, {size, …})` builds a MeshPhysicalMaterial from `<name>_diff/_nor/_arm.jpg`, assuming UVs in metres (`metricBox`, `projectUVs` make them). Small things (logs, sparks) still use canvas textures from `textures.ts`.

- `scene.ts` (`BoardScene`) – renderer (ACES, exposure 1.25), camera (FOV 50; default offset `VIEW_OFFSET` from the board), orbit controls (no pan, clamped), and an EffectComposer with light bloom. `resize()` uses `setViewOffset` as a lens shift, so the board sits low in the frame with the window, stove and some ceiling above, and verticals stay nearly upright (shifted more on portrait). `bakeEnvironment()` waits for all assets, lights the outdoors with the sky HDR, then captures the room twice with a CubeCamera at `CAPTURE_POS` and uses it (PMREM) as `scene.environment`. That stands in for bounce light, gives glossy things real reflections, and feeds the window glass. In dev, `window.__view` exposes the scene, camera, controls, renderer and `frame()`.
- `cabin.ts` – `ROOM` (x -2.9..2.4, glass at z -3.6, height 2.75) and `WINDOW`. Honey-stained hinoki boards on the walls and ceiling (the ceiling runs out over the deck as an overhang), light oak floor, linen-weave rug, black steel frames and a corner post, recessed downlights (`DOWNLIGHTS`), a framed print. The glass is a reflection-only additive shader that samples the room capture with a crude parallax fix.
- `outdoors.ts` – sky backdrop (the 4k tonemapped Poly Haven JPG, looked up by view direction and graded to blue hour with `SKY_TINT` and `SKY_EXPOSURE`), a fan of ridged-noise mountains coloured by slope and height (forest, rock, snow), near snow ground (`groundHeight`) falling into the valley, a deck with a snow blanket, a lantern, falling snow, and instanced procedural spruces (`firGeometry`: drooping tiers with snowy tops and dark undersides) in three levels of detail. Outdoor materials get the sky HDR as their own `envMap` at intensity `DUSK`; `HAZE` is the fog colour (linear fog from 40 m, so the room is never fogged).
- `fireplace.ts` – freestanding stove (log store, fire box with a smoky glass door, round flue to the ceiling), shader flames, sparks, flickering point light (`FIRE_POWER`).
- `props.ts` – modern sofa (cushions pinched at the seams, `drape()` cloth for the throws), lounge chair, floor lamps with glowing shades and point lights, the left-wall bench with candles, shelves with Poly Haven vases, and the wicker log basket. `table.ts` – coffee table, mug, book and a candle in a glass, with a small light.
- `lighting.ts` – two RectAreaLights for the sky light through the glass, and downlight spots; the one by the table (index 3) casts the board's shadows.

### Lessons from the visual passes
- First pass (night, glass cabin): painted fir billboards replaced procedural cones that looked like shards.
- Second pass: geometric spruces work if they are narrow (about a sixth as wide as tall), have many overlapping tiers and ragged tips, and are wound so the snowy tops face up. Distant trees need to be fuller, or they read as spires. Leave a clearing behind the stove, and let the valley drop fast enough that treetops sit below the mountains.
- Never use `transmission` on small props (candle wax): it makes three.js render the whole scene a second time every frame. Removing it halved the triangle count to about 2.2 M.
- A Poly Haven diffuse map times a strong `color` tint doubles the saturation. For the orange throw, use `noMap` and a plain colour.
- The browser pane often shows a stale image while it's hidden, because rAF stops. To check a frame: call `__view.frame()`, then read `renderer.domElement.toDataURL()` in the same task and post it to a tiny local receiver.

### Verified in the browser pane
Bot vs human, two-player, win highlight, play again, cancel during an Expert search, orbit and zoom, landscape (780x480), portrait and phone (375x812) layouts, tap-to-column mapping with the portrait view offset. `npm run build` works.

Architecture rule: `core` and `ai` know nothing about rendering, `render` knows nothing about the bot, and only `main.ts` ties them together.

## Next
- Visual gaps against the reference photo: the near spruces still look faceted (snow-laden branch cards or a scanned tree would help), the snowy deck barely shows from the lower camera, the walls read a little too orange, the lounge chair is a simple frame rather than the photo's sculpted chair, and there is no contact shadow or AO under the furniture (GTAOPass is an option if the GPU budget allows).
- Performance: about 2.2 M triangles and 210 draw calls per frame, plus two RectAreaLights and about a dozen point and spot lights. Not yet measured with the pane visible or on a phone. If it's slow: fewer valley trees, drop the side RectAreaLight, lower the shadow map.
- Sound: disc clack on landing, fire crackle, with a mute toggle.
- Undo / move history.
- Not yet checked on a real phone. Bloom and the 2048 spot shadow may need a lower-quality path on weak GPUs.
- Opening book for Expert (see Known gaps).

## Gotchas
- Moves are 0-indexed columns in code; `Position.fromMoves("4453")` takes 1-indexed digits.
- `Position` stores stones from the point of view of the player to move (`current` / `mask`); the opponent is `current ^ mask`.
- `key()` is one exact double (< 2^49) used by the typed-array table.
- Vite hot reload during big multi-file edits leaves stale "does not provide an export" errors in the browser console. Reload and check again before treating them as real.
- The browser pane's viewport emulation sometimes renders the page small in the top-left of screenshots, and rAF stops while the pane is hidden. Time frames with `gl.finish()` rather than by counting rAF calls.
