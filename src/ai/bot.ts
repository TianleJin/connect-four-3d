import { Position } from '../core/position';
import { DIFFICULTIES, Difficulty, DifficultyConfig } from './difficulty';
import { Searcher } from './negamax';

/** Anything that can pick a column for the player to move. */
export interface Bot {
  chooseMove(pos: Position): number;
}

/** Alpha-beta bot whose strength is set by search depth, time budget and blunder rate. */
export class NegamaxBot implements Bot {
  private searcher = new Searcher();

  constructor(
    private difficulty: Difficulty,
    private random: () => number = Math.random,
  ) {}

  chooseMove(pos: Position): number {
    const cfg = DIFFICULTIES[this.difficulty];
    const legal = pos.legalMoves();
    if (legal.length === 0) throw new Error('No legal moves');

    const best = this.pickMove(pos, cfg);
    // A "blunder" is a random move, but never one that skips an immediate win or block.
    if (this.random() < cfg.blunderRate && !this.hasTacticalMove(pos, legal)) {
      return legal[Math.floor(this.random() * legal.length)]!;
    }
    return best;
  }

  /**
   * Expert tries a full weak solve first (perfect play once it finishes) and
   * falls back to the iterative-deepening search if time runs out or the
   * position is lost (then we want the move that resists longest).
   */
  private pickMove(pos: Position, cfg: DifficultyConfig): number {
    if (cfg.solve) {
      const solved = this.searcher.solve(pos, cfg.timeMs * 0.6);
      if (solved && solved.outcome >= 0) return solved.move;
    }
    return this.searcher.search(pos, cfg).move;
  }

  /** True if the mover can win now, or must block an immediate opponent win. */
  private hasTacticalMove(pos: Position, legal: number[]): boolean {
    if (legal.some((c) => pos.isWinningMove(c))) return true;
    return legal.some((c) => pos.isOpponentWinningMove(c));
  }
}
