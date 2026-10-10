import { describe, expect, it } from 'vitest';
import { FORCED_SCORE, Searcher } from '../src/ai/negamax';
import { Position } from '../src/core/position';

function randomPosition(plies: number, seed: number): Position {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (;;) {
    let pos = Position.empty();
    for (let i = 0; i < plies; i++) {
      const legal = pos.legalMoves().filter((c) => !pos.play(c).previousPlayerWon());
      if (!legal.length) break;
      pos = pos.play(legal[Math.floor(rand() * legal.length)]!);
    }
    if (pos.moveCount === plies && !pos.previousPlayerWon()) return pos;
  }
}

describe('weak solver', () => {
  it('agrees with the full-score search on win/draw/loss', () => {
    for (let k = 0; k < 40; k++) {
      const pos = randomPosition(24 + (k % 6), 5000 + k);
      const full = new Searcher().search(pos, { maxDepth: 42 - pos.moveCount });
      const weak = new Searcher().solve(pos, 60_000)!;
      const fullOutcome = full.score >= FORCED_SCORE ? 1 : full.score <= -FORCED_SCORE ? -1 : 0;
      expect(weak.outcome, `position #${k} (${pos.moveCount} plies)`).toBe(fullOutcome);
    }
  }, 300_000);

  it('returns a move that keeps the outcome', () => {
    for (let k = 0; k < 20; k++) {
      const pos = randomPosition(26, 9000 + k);
      const weak = new Searcher().solve(pos, 60_000)!;
      expect(pos.canPlay(weak.move)).toBe(true);
      if (weak.outcome === 1 && !pos.isWinningMove(weak.move)) {
        // after the move, the opponent must be lost
        const reply = new Searcher().solve(pos.play(weak.move), 60_000)!;
        expect(reply.outcome).toBe(-1);
      }
    }
  }, 300_000);
});
