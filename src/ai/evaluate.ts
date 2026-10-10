import { COLS, columnBits, popcount32 } from '../core/bitboard';
import { Position } from '../core/position';

const CENTRE_BITS = columnBits(Math.floor(COLS / 2)); // the centre column lives in `lo`

/**
 * Heuristic score for the player to move (positive = good), always far below
 * a forced win: centre control plus the number of empty cells that would
 * complete four for each side.
 */
export function evaluate(pos: Position): number {
  const centre = popcount32(pos.currentLo & CENTRE_BITS) - popcount32(pos.opponentLo & CENTRE_BITS);
  const mine = popcount32(pos.myThreatsLo) + popcount32(pos.myThreatsHi);
  const theirs = popcount32(pos.opponentThreatsLo) + popcount32(pos.opponentThreatsHi);
  return 3 * centre + 4 * (mine - theirs);
}
