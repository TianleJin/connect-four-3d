# Connect Four 3D

A web rebuild of an older Python/pygame Connect Four. The goal is a 3D board on a table in a cozy cabin with a fireplace, playable against a bot with selectable difficulty.

**Status:** the game engine and bot are done and tested; the 3D scene and UI are not built yet. See [docs/PROGRESS.md](docs/PROGRESS.md) for details and next steps.

## Stack
TypeScript, Vite, Three.js, Vitest. Static deploy, no server needed.

## Commands
```
npm install
npm test        # unit tests
npm run dev     # dev server (needs index.html, not added yet)
npm run build   # typecheck + production build
```

## Layout
```
src/core/    bitboard, Position, Game (pure logic, no DOM)
src/ai/      negamax search, weak solver, difficulty levels, bot
src/render/  Three.js scene (planned)
src/ui/      HTML overlay (planned)
tests/       vitest tests
legacy/      original Python version (MCTS + pygame)
```

## The bot
Connect Four is a solved game, so the bot uses alpha-beta (negamax) search on a bitboard rather than Monte Carlo tree search. Expert tries an exact win/draw/loss solve first and plays perfectly once the position is solved. Easy, Medium and Hard limit search depth and add random mistakes.

The original Python version is in `legacy/`; install `pygame` and run `python legacy/ConnectFourGame.py` to play it.
