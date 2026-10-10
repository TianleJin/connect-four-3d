import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { Position } from '../src/core/position';

function playAll(moves: number[]): Game {
  const g = new Game();
  for (const c of moves) g.play(c);
  return g;
}

describe('Game', () => {
  it('detects a vertical win', () => {
    const g = playAll([0, 1, 0, 1, 0, 1, 0]);
    expect(g.status).toBe('won');
    expect(g.winner).toBe(0);
    expect(g.winningCells).toHaveLength(4);
  });

  it('detects a horizontal win for player 2', () => {
    expect(playAll([0, 6, 0, 5, 1, 4, 1, 3]).winner).toBe(1);
  });

  it('detects both diagonals', () => {
    expect(playAll([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]).winner).toBe(0);
    expect(playAll([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3]).winner).toBe(0);
  });

  it('does not wrap a horizontal line around column edges', () => {
    // cols 5,6 and 0,1 are adjacent in bit order but not on the board
    expect(playAll([5, 0, 6, 1, 5, 2, 6]).status).toBe('playing');
  });

  it('refuses moves after the game ends', () => {
    const g = playAll([0, 1, 0, 1, 0, 1, 0]);
    expect(g.canPlay(3)).toBe(false);
  });
});

describe('Position', () => {
  it('rejects moves in a full column', () => {
    const p = Position.fromMoves('111111');
    expect(p.canPlay(0)).toBe(false);
    expect(() => p.play(0)).toThrow();
  });

  it('reports height and legal moves', () => {
    const p = Position.fromMoves('4433');
    expect(p.heightOf(3)).toBe(2);
    expect(p.legalMoves()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
