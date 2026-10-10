import { Cell, winningCells } from './bitboard';
import { Position } from './position';

export type Player = 0 | 1; // 0 moves first
export type GameStatus = 'playing' | 'won' | 'draw';

export type { Cell };

/** Game rules on top of Position: who is to move, move history, result. */
export class Game {
  private position = Position.empty();
  private moves: number[] = [];
  private _status: GameStatus = 'playing';
  private _winningCells: Cell[] = [];

  get status(): GameStatus {
    return this._status;
  }
  get currentPlayer(): Player {
    return (this.moves.length % 2) as Player;
  }
  /** The player who made the winning move, or null. */
  get winner(): Player | null {
    return this._status === 'won' ? ((1 - this.currentPlayer) as Player) : null;
  }
  get winningCells(): readonly Cell[] {
    return this._winningCells;
  }
  get history(): readonly number[] {
    return this.moves;
  }
  get current(): Position {
    return this.position;
  }

  canPlay(col: number): boolean {
    return this._status === 'playing' && this.position.canPlay(col);
  }

  /** Drops a disc for the current player; returns the cell it landed in. */
  play(col: number): Cell {
    if (!this.canPlay(col)) throw new Error(`Illegal move: column ${col}`);
    const row = this.position.heightOf(col);
    this.position = this.position.play(col);
    this.moves.push(col);

    if (this.position.previousPlayerWon()) {
      this._status = 'won';
      this._winningCells = winningCells(this.position.opponentLo, this.position.opponentHi);
    } else if (this.position.isFull) {
      this._status = 'draw';
    }
    return { col, row };
  }

  reset(): void {
    this.position = Position.empty();
    this.moves = [];
    this._status = 'playing';
    this._winningCells = [];
  }
}
