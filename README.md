# Connect Four 3D

A web Connect Four. It's a 3D board on a table in a glass cabin in a snowy forest at night, by a fireplace, playable against a bot with selectable difficulty.

**Status:** playable. Engine, bot, 3D cabin scene and UI are in place. See [docs/PROGRESS.md](docs/PROGRESS.md) for details and next steps.

## Stack
TypeScript, Vite, Three.js, Vitest. Static deploy, no server needed.

## Commands
```
npm install
npm test        # unit tests
npm run dev     # dev server at http://localhost:5173
npm run build   # typecheck + production build
```

## Layout
```
src/core/    bitboard, Position, Game (pure logic, no DOM)
src/ai/      negamax search, weak solver, difficulty levels, bot
src/render/  Three.js scene: cabin, outdoors, fireplace, props, table, board, discs, input
src/ui/      HTML overlay: menu, status, result banner
src/main.ts  turn loop tying game, bot (Web Worker), scene and overlay together
tests/       vitest tests
```

## The bot
Connect Four is a solved game, so the bot uses alpha-beta (negamax) search on a bitboard rather than Monte Carlo tree search. Expert tries an exact win/draw/loss solve first and plays perfectly once the position is solved. Easy, Medium and Hard limit search depth and add random mistakes.

