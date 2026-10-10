import { LO_COLS, columnBits, popcount32 } from '../core/bitboard';
import { Position } from '../core/position';
import { evaluate } from './evaluate';
import { EXACT, LOWER, TranspositionTable, UPPER, Bound } from './transposition';

export const WIN_SCORE = 10_000;
/** A score at or beyond this magnitude is a forced win/loss (a game lasts at most 42 plies). */
export const FORCED_SCORE = WIN_SCORE - 42;

/** Columns ordered centre-first; good ordering makes alpha-beta prune far more. */
const CENTRE_FIRST = [3, 2, 4, 1, 5, 0, 6];

export interface SearchLimits {
  maxDepth: number;
  /** Wall-clock budget in ms; the last fully searched depth is used. */
  timeMs?: number;
}

export interface SearchResult {
  /** Best column, or -1 if the game is over. */
  move: number;
  /** Score for the player to move; |score| >= FORCED_SCORE means a forced win/loss. */
  score: number;
  /** Deepest fully completed search depth. */
  depth: number;
}

class OutOfTime extends Error {}

/** Alpha-beta negamax with a transposition table and iterative deepening. */
export class Searcher {
  private table = new TranspositionTable();
  private deadline = Infinity;
  nodes = 0;

  clear(): void {
    this.table.clear();
  }

  search(pos: Position, limits: SearchLimits): SearchResult {
    const legal = CENTRE_FIRST.filter((c) => pos.canPlay(c));
    const result: SearchResult = { move: legal[0] ?? -1, score: 0, depth: 0 };
    if (legal.length <= 1) return result;

    this.deadline = limits.timeMs === undefined ? Infinity : performance.now() + limits.timeMs;
    this.nodes = 0;

    for (let depth = 1; depth <= limits.maxDepth; depth++) {
      try {
        const best = this.searchRoot(pos, legal, depth);
        Object.assign(result, { ...best, depth });
        if (Math.abs(best.score) >= FORCED_SCORE) break; // outcome is decided
      } catch (e) {
        if (e instanceof OutOfTime) break;
        throw e;
      }
    }
    return result;
  }

  /**
   * Weak solve: finds the game-theoretic outcome (win / draw / loss) for the
   * player to move, and a move that achieves it. A (-1, 1) window prunes far
   * more than a full-score search. Returns null if the time budget runs out.
   */
  solve(pos: Position, timeMs: number): { move: number; outcome: 1 | 0 | -1 } | null {
    const legal = CENTRE_FIRST.filter((c) => pos.canPlay(c));
    if (legal.length === 0) return null;
    this.deadline = performance.now() + timeMs;
    try {
      let best = { move: legal[0]!, outcome: -1 as 1 | 0 | -1 };
      for (const col of legal) {
        const v = pos.isWinningMove(col) ? 1 : -this.negamax(pos.play(col), 42, -1, 1);
        const outcome = v > 0 ? 1 : v < 0 ? -1 : 0;
        if (outcome > best.outcome || (col === legal[0] && outcome === best.outcome)) {
          best = { move: col, outcome };
        }
        if (outcome === 1) break;
      }
      return best;
    } catch (e) {
      if (e instanceof OutOfTime) return null;
      throw e;
    }
  }

  private searchRoot(pos: Position, legal: number[], depth: number): { move: number; score: number } {
    let best = { move: legal[0]!, score: -Infinity };
    let alpha = -WIN_SCORE;
    for (const col of legal) {
      const score = pos.isWinningMove(col)
        ? WIN_SCORE - pos.moveCount
        : -this.negamax(pos.play(col), depth - 1, -WIN_SCORE, -alpha);
      if (score > best.score) best = { move: col, score };
      if (score > alpha) alpha = score;
    }
    return best;
  }

  private negamax(pos: Position, depth: number, alpha: number, beta: number): number {
    if ((++this.nodes & 4095) === 0 && performance.now() > this.deadline) throw new OutOfTime();

    if (pos.isFull) return 0;
    const playableLo = pos.playableLo;
    const playableHi = pos.playableHi;

    // I can win right now.
    if ((pos.myThreatsLo & playableLo) | (pos.myThreatsHi & playableHi)) return WIN_SCORE - pos.moveCount;

    // The opponent threatens to win: I must block, and two threats cannot both be blocked.
    const oppThreatsLo = pos.opponentThreatsLo;
    const oppThreatsHi = pos.opponentThreatsHi;
    let allowedLo = playableLo;
    let allowedHi = playableHi;
    const forcedLo = oppThreatsLo & playableLo;
    const forcedHi = oppThreatsHi & playableHi;
    if (forcedLo | forcedHi) {
      if (popcount32(forcedLo) + popcount32(forcedHi) > 1) return -(WIN_SCORE - (pos.moveCount + 1));
      allowedLo = forcedLo;
      allowedHi = forcedHi;
    }
    // Never play directly beneath a cell where the opponent would win.
    allowedLo &= ~(oppThreatsLo >>> 1);
    allowedHi &= ~(oppThreatsHi >>> 1);
    if ((allowedLo | allowedHi) === 0) return -(WIN_SCORE - (pos.moveCount + 2));

    if (depth <= 0) return evaluate(pos);

    const key = pos.key();
    const origAlpha = alpha;
    if (this.table.probe(key) && this.table.depth >= depth) {
      const { score, bound } = this.table;
      if (bound === EXACT) return score;
      if (bound === LOWER) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) return score;
    }

    // Order moves: most threats created first, centre-first on ties.
    const children: Position[] = [];
    const priority: number[] = [];
    for (const c of CENTRE_FIRST) {
      if (((c < LO_COLS ? allowedLo : allowedHi) & columnBits(c)) === 0) continue;
      const child = pos.play(c);
      const p = popcount32(child.opponentThreatsLo) + popcount32(child.opponentThreatsHi);
      let i = children.length;
      while (i > 0 && priority[i - 1]! < p) i--;
      children.splice(i, 0, child);
      priority.splice(i, 0, p);
    }

    let best = -Infinity;
    for (const child of children) {
      const score = -this.negamax(child, depth - 1, -beta, -alpha);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }

    const bound: Bound = best <= origAlpha ? UPPER : best >= beta ? LOWER : EXACT;
    this.table.store(key, best, depth, bound);
    return best;
  }
}
