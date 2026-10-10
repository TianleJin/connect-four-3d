import { Position } from '../core/position';
import { NegamaxBot } from './bot';
import type { Difficulty } from './difficulty';

export interface BotRequest {
  id: number;
  /** 0-indexed columns played so far. Position is a class, so it is rebuilt here rather than cloned. */
  moves: number[];
  difficulty: Difficulty;
}

export interface BotResponse {
  id: number;
  move: number;
}

// One bot per level, so each keeps its transposition table between moves.
const bots = new Map<Difficulty, NegamaxBot>();

self.onmessage = (e: MessageEvent<BotRequest>) => {
  const { id, moves, difficulty } = e.data;
  let pos = Position.empty();
  for (const col of moves) pos = pos.play(col);

  let bot = bots.get(difficulty);
  if (!bot) {
    bot = new NegamaxBot(difficulty);
    bots.set(difficulty, bot);
  }
  const response: BotResponse = { id, move: bot.chooseMove(pos) };
  self.postMessage(response);
};
