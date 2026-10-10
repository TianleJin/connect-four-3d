import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../src/core/bitboard';
import { Game } from '../src/core/game';
import { Position } from '../src/core/position';

/** Slow, obviously-correct reference: a plain 2D grid. */
class GridGame {
  grid: number[][] = Array.from({ length: COLS }, () => []);
  turn = 0;

  canPlay(c: number): boolean {
    return this.grid[c]!.length < ROWS;
  }

  play(c: number): void {
    this.grid[c]!.push(this.turn);
    this.turn = 1 - this.turn;
  }

  /** True if `player` has four in a row. */
  hasWon(player: number): boolean {
    const at = (c: number, r: number) => this.grid[c]?.[r] === player;
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        for (const [dc, dr] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const)
          if ([0, 1, 2, 3].every((k) => at(c + k * dc, r + k * dr))) return true;
    return false;
  }
}

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe('bitboard vs 2D-grid reference', () => {
  it('agrees on wins, draws, heights and legal moves over 400 random games', () => {
    const rand = rng(12345);
    for (let g = 0; g < 400; g++) {
      const ref = new GridGame();
      let pos = Position.empty();
      while (true) {
        const legal = [...Array(COLS).keys()].filter((c) => ref.canPlay(c));
        expect(pos.legalMoves()).toEqual(legal);
        if (legal.length === 0) break;

        // every move's immediate-win flag must match the reference
        for (const c of legal) {
          const probe = new GridGame();
          probe.grid = ref.grid.map((col) => [...col]);
          probe.turn = ref.turn;
          probe.play(c);
          expect(pos.isWinningMove(c)).toBe(probe.hasWon(ref.turn));
        }

        const col = legal[Math.floor(rand() * legal.length)]!;
        expect(pos.heightOf(col)).toBe(ref.grid[col]!.length);
        const mover = ref.turn;
        ref.play(col);
        pos = pos.play(col);
        expect(pos.previousPlayerWon()).toBe(ref.hasWon(mover));
        if (ref.hasWon(mover)) break;
      }
    }
  }, 60_000);

  it('reports winning cells that match the reference line', () => {
    const g = new Game();
    for (const c of [3, 0, 4, 0, 5, 0, 6]) g.play(c);
    expect(g.status).toBe('won');
    expect(g.winningCells.map((c) => c.col).sort()).toEqual([3, 4, 5, 6]);
  });

  it('gives distinct keys to distinct positions reached by random play', () => {
    const rand = rng(99);
    const seen = new Map<number, string>();
    for (let g = 0; g < 300; g++) {
      let pos = Position.empty();
      let path = '';
      while (!pos.isFull && !pos.previousPlayerWon()) {
        const legal = pos.legalMoves();
        const c = legal[Math.floor(rand() * legal.length)]!;
        pos = pos.play(c);
        path += c;
        // positions are identified by their final board, so compare stones
        const board = `${pos.currentLo}/${pos.currentHi}/${pos.maskLo}/${pos.maskHi}`;
        const prev = seen.get(pos.key());
        if (prev !== undefined) expect(prev).toBe(board);
        else seen.set(pos.key(), board);
      }
      void path;
    }
  });
});

describe('threat masks', () => {
  it('playable ∩ threats matches isWinningMove / isOpponentWinningMove', () => {
    const rand = rng(777);
    for (let g = 0; g < 400; g++) {
      let pos = Position.empty();
      while (!pos.isFull && !pos.previousPlayerWon()) {
        const mine = [pos.playableLo & pos.myThreatsLo, pos.playableHi & pos.myThreatsHi];
        const theirs = [pos.playableLo & pos.opponentThreatsLo, pos.playableHi & pos.opponentThreatsHi];
        for (let c = 0; c < COLS; c++) {
          const half = c < 4 ? 0 : 1;
          const bits = ((1 << ROWS) - 1) << ((c < 4 ? c : c - 4) * 7);
          expect((mine[half]! & bits) !== 0).toBe(pos.isWinningMove(c));
          expect((theirs[half]! & bits) !== 0).toBe(pos.isOpponentWinningMove(c));
        }
        const legal = pos.legalMoves();
        pos = pos.play(legal[Math.floor(rand() * legal.length)]!);
      }
    }
  });
});
