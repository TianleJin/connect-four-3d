import { describe, expect, it } from 'vitest';
import { NegamaxBot } from '../src/ai/bot';
import { Position } from '../src/core/position';

describe('NegamaxBot', () => {
  it('takes an immediate win', () => {
    // P0 holds columns 1-3 of the bottom row; P0 to move wins in column 4.
    const pos = Position.fromMoves('172737');
    expect(new NegamaxBot('expert').chooseMove(pos)).toBe(3);
  });

  it('blocks an immediate loss', () => {
    // P0 threatens column 4 on the bottom row; P1 to move must block.
    const pos = Position.fromMoves('17273');
    expect(new NegamaxBot('hard').chooseMove(pos)).toBe(3);
  });

  it('never blunders away a forced result', () => {
    // P0 has three stacked in column 7; random()=0 would otherwise pick column 1.
    const pos = Position.fromMoves('71717');
    const bot = new NegamaxBot('easy', () => 0);
    expect(bot.chooseMove(pos)).toBe(6);
  });
});
