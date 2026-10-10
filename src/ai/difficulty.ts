export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyConfig {
  maxDepth: number;
  timeMs: number;
  /** Probability of playing a random legal move instead of the best one. */
  blunderRate: number;
  /** Try an exact win/draw/loss solve before falling back to depth-limited search. */
  solve: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { maxDepth: 2, timeMs: 200, blunderRate: 0.3, solve: false },
  medium: { maxDepth: 5, timeMs: 500, blunderRate: 0.1, solve: false },
  hard: { maxDepth: 9, timeMs: 1500, blunderRate: 0, solve: false },
  expert: { maxDepth: 42, timeMs: 3000, blunderRate: 0, solve: true },
};
