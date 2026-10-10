/**
 * Bitboard layout (same idea as Pascal Pons' solver).
 *
 * Each column uses ROWS + 1 bits: ROWS playable cells plus one always-empty
 * "sentinel" bit on top. Global bit index = col * (ROWS + 1) + row, row 0 = bottom.
 * The sentinel stops shifts in the win check from leaking into the next column.
 *
 *   .  .  .  .  .  .  .   <- sentinel row (always 0)
 *   5 12 19 26 33 40 47
 *   4 11 18 25 32 39 46
 *   3 10 17 24 31 38 45
 *   2  9 16 23 30 37 44
 *   1  8 15 22 29 36 43
 *   0  7 14 21 28 35 42   <- bottom row
 *
 * The board needs 49 bits but JS bitwise operators are 32-bit, and BigInt is
 * slow. So a board is stored as two int32 halves:
 *   lo = columns 0..3 (global bits 0..27)
 *   hi = columns 4..6 (global bits 28..48, stored as bits 0..20)
 * A column never straddles the halves, so adding a disc to a column is a plain
 * add inside one half, and only shifts have to move bits across the boundary.
 */

export const COLS = 7;
export const ROWS = 6;
export const COLUMN_BITS = ROWS + 1;

/** Columns stored in the `lo` half. */
export const LO_COLS = 4;
const LO_BITS = LO_COLS * COLUMN_BITS; // 28
const LO_MASK = (1 << LO_BITS) - 1;
const HI_BITS = (COLS - LO_COLS) * COLUMN_BITS; // 21
const HI_MASK = (1 << HI_BITS) - 1;

/** Shift distances for the four line directions: vertical, horizontal, two diagonals. */
const DIRECTIONS = [1, COLUMN_BITS, COLUMN_BITS - 1, COLUMN_BITS + 1] as const;

/** Bit offset of `col`'s bottom cell inside its half. */
export function columnShift(col: number): number {
  return (col < LO_COLS ? col : col - LO_COLS) * COLUMN_BITS;
}

export function isLoColumn(col: number): boolean {
  return col < LO_COLS;
}

/** Mask of a column's bottom cell, inside its half. */
export function bottomBit(col: number): number {
  return 1 << columnShift(col);
}

/** Mask of a column's top playable cell, inside its half. */
export function topBit(col: number): number {
  return 1 << (columnShift(col) + ROWS - 1);
}

/** Mask of all playable cells of a column, inside its half. */
export function columnBits(col: number): number {
  return ((1 << ROWS) - 1) << columnShift(col);
}

/** Bottom cell of every column that lives in each half. */
export const BOTTOM_LO = [0, 1, 2, 3].reduce((m, c) => m | bottomBit(c), 0);
export const BOTTOM_HI = [4, 5, 6].reduce((m, c) => m | bottomBit(c), 0);

/** Number of set bits in a 32-bit integer. */
export function popcount32(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** True if the stones (lo, hi) contain four in a row in any direction. */
export function hasFourInARow(lo: number, hi: number): boolean {
  for (const d of DIRECTIONS) {
    // pairs: cell and its neighbour d bits up are both set
    const pairsLo = lo & (((lo >>> d) | (hi << (LO_BITS - d))) & LO_MASK);
    const pairsHi = hi & (hi >>> d);
    // quads: two pairs 2d apart
    const d2 = 2 * d;
    if (pairsLo & (((pairsLo >>> d2) | (pairsHi << (LO_BITS - d2))) & LO_MASK)) return true;
    if (pairsHi & (pairsHi >>> d2)) return true;
  }
  return false;
}

/** Whether the cell (col, row) is set in the stones (lo, hi). */
export function hasStone(lo: number, hi: number, col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  const half = col < LO_COLS ? lo : hi;
  return ((half >>> (columnShift(col) + row)) & 1) === 1;
}

export interface Cell {
  col: number;
  row: number;
}

/** Every cell that belongs to some four-in-a-row of the stones (empty if none). */
export function winningCells(lo: number, hi: number): Cell[] {
  const steps: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  const found = new Map<number, Cell>();
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      for (const [dc, dr] of steps) {
        let line = true;
        for (let k = 0; k < 4 && line; k++) line = hasStone(lo, hi, col + k * dc, row + k * dr);
        if (!line) continue;
        for (let k = 0; k < 4; k++) {
          const c = col + k * dc;
          const r = row + k * dr;
          found.set(c * ROWS + r, { col: c, row: r });
        }
      }
    }
  }
  return [...found.values()];
}

// ---- whole-board shifts on a (lo, hi) pair, one half at a time ----

/** `half` of (lo,hi) shifted towards higher bits by d. */
function shl(lo: number, hi: number, d: number, upper: boolean): number {
  return upper ? ((hi << d) | (lo >>> (LO_BITS - d))) & HI_MASK : (lo << d) & LO_MASK;
}

/** `half` of (lo,hi) shifted towards lower bits by d. */
function shr(lo: number, hi: number, d: number, upper: boolean): number {
  return upper ? hi >>> d : ((lo >>> d) | (hi << (LO_BITS - d))) & LO_MASK;
}

/** Playable-cell mask of each half (sentinel bits excluded). */
export const BOARD_LO = [0, 1, 2, 3].reduce((m, c) => m | columnBits(c), 0);
export const BOARD_HI = [4, 5, 6].reduce((m, c) => m | columnBits(c), 0);

/**
 * Cells that would complete four in a row for `stones`, in one half of the
 * board (empty or not; callers mask with the empty cells they care about).
 * Pons' trick: a cell completes a line if it is the 4th member of three
 * stones shifted in the same direction, from any of the 4 positions in the line.
 */
export function lineCompletions(lo: number, hi: number, upper: boolean): number {
  let r = shl(lo, hi, 1, upper) & shl(lo, hi, 2, upper) & shl(lo, hi, 3, upper); // vertical
  for (const d of [COLUMN_BITS, COLUMN_BITS - 1, COLUMN_BITS + 1]) {
    let p = shl(lo, hi, d, upper) & shl(lo, hi, 2 * d, upper);
    r |= p & shl(lo, hi, 3 * d, upper);
    r |= p & shr(lo, hi, d, upper);
    p = shr(lo, hi, d, upper) & shr(lo, hi, 2 * d, upper);
    r |= p & shl(lo, hi, d, upper);
    r |= p & shr(lo, hi, 3 * d, upper);
  }
  return upper ? r & BOARD_HI : r & BOARD_LO;
}
