import {
  BOARD_HI,
  BOARD_LO,
  BOTTOM_HI,
  BOTTOM_LO,
  COLS,
  ROWS,
  bottomBit,
  columnBits,
  columnShift,
  hasFourInARow,
  isLoColumn,
  lineCompletions,
  popcount32,
  topBit,
} from './bitboard';

const HALF = 2 ** 28; // weight of `hi` when packing both halves into one number

/**
 * Immutable Connect Four position, stored from the point of view of the
 * player to move:
 *   current = stones of the player to move
 *   mask    = stones of both players
 * The opponent's stones are `current ^ mask`. Each bitboard is two int32
 * halves (see bitboard.ts).
 */
export class Position {
  private constructor(
    readonly currentLo: number,
    readonly currentHi: number,
    readonly maskLo: number,
    readonly maskHi: number,
    readonly moveCount: number,
  ) {}

  static empty(): Position {
    return new Position(0, 0, 0, 0, 0);
  }

  /** Build a position from a string of 1-based column digits, e.g. "4453". */
  static fromMoves(moves: string): Position {
    let pos = Position.empty();
    for (const ch of moves) {
      const col = Number(ch) - 1;
      if (!pos.canPlay(col)) throw new Error(`Illegal move ${ch} in "${moves}"`);
      pos = pos.play(col);
    }
    return pos;
  }

  /** Stones of the player who just moved. */
  get opponentLo(): number {
    return this.currentLo ^ this.maskLo;
  }
  get opponentHi(): number {
    return this.currentHi ^ this.maskHi;
  }

  get isFull(): boolean {
    return this.moveCount === COLS * ROWS;
  }

  canPlay(col: number): boolean {
    if (col < 0 || col >= COLS) return false;
    return ((isLoColumn(col) ? this.maskLo : this.maskHi) & topBit(col)) === 0;
  }

  legalMoves(): number[] {
    const moves: number[] = [];
    for (let c = 0; c < COLS; c++) if (this.canPlay(c)) moves.push(c);
    return moves;
  }

  /** Cells a disc could be dropped into right now (lowest empty cell of each column). */
  get playableLo(): number {
    return (this.maskLo + BOTTOM_LO) & BOARD_LO;
  }
  get playableHi(): number {
    return (this.maskHi + BOTTOM_HI) & BOARD_HI;
  }

  /** Empty cells that would complete four in a row for the player to move. */
  get myThreatsLo(): number {
    return lineCompletions(this.currentLo, this.currentHi, false) & ~this.maskLo;
  }
  get myThreatsHi(): number {
    return lineCompletions(this.currentLo, this.currentHi, true) & ~this.maskHi;
  }

  /** Empty cells that would complete four in a row for the opponent. */
  get opponentThreatsLo(): number {
    return lineCompletions(this.opponentLo, this.opponentHi, false) & ~this.maskLo;
  }
  get opponentThreatsHi(): number {
    return lineCompletions(this.opponentLo, this.opponentHi, true) & ~this.maskHi;
  }

  /** True if playing `col` wins immediately for the player to move. */
  isWinningMove(col: number): boolean {
    return this.canPlay(col) && this.wouldWin(col, false);
  }

  /** True if the opponent would win by playing `col` were it their turn. */
  isOpponentWinningMove(col: number): boolean {
    return this.canPlay(col) && this.wouldWin(col, true);
  }

  private wouldWin(col: number, forOpponent: boolean): boolean {
    // Adding the bottom bit to the mask carries into the first empty cell of the column.
    const lo = isLoColumn(col);
    const mask = lo ? this.maskLo : this.maskHi;
    const landed = (mask + bottomBit(col)) & ~mask & columnBits(col);
    let sLo = forOpponent ? this.opponentLo : this.currentLo;
    let sHi = forOpponent ? this.opponentHi : this.currentHi;
    if (lo) sLo |= landed;
    else sHi |= landed;
    return hasFourInARow(sLo, sHi);
  }

  /** Returns the position after the player to move drops a disc in `col`. */
  play(col: number): Position {
    if (!this.canPlay(col)) throw new Error(`Column ${col} is not playable`);
    // Swap sides: the mover's stones become the "opponent" of the next position.
    const nextCurrentLo = this.currentLo ^ this.maskLo;
    const nextCurrentHi = this.currentHi ^ this.maskHi;
    if (isLoColumn(col)) {
      return new Position(nextCurrentLo, nextCurrentHi, this.maskLo + bottomBit(col) | this.maskLo, this.maskHi, this.moveCount + 1);
    }
    return new Position(nextCurrentLo, nextCurrentHi, this.maskLo, this.maskHi + bottomBit(col) | this.maskHi, this.moveCount + 1);
  }

  /** Row (0 = bottom) where a disc dropped in `col` would land. */
  heightOf(col: number): number {
    const mask = isLoColumn(col) ? this.maskLo : this.maskHi;
    return popcount32((mask >>> columnShift(col)) & ((1 << ROWS) - 1));
  }

  /** True if the player who just moved has four in a row. */
  previousPlayerWon(): boolean {
    return hasFourInARow(this.opponentLo, this.opponentHi);
  }

  /**
   * Unique key for transposition tables (Pons: current + mask + bottom row),
   * packed into one exact double (< 2^49).
   */
  key(): number {
    return (this.currentHi + this.maskHi + BOTTOM_HI) * HALF + (this.currentLo + this.maskLo + BOTTOM_LO);
  }
}
