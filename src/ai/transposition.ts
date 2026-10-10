export type Bound = 0 | 1 | 2; // 0 = exact, 1 = lower bound, 2 = upper bound
export const EXACT: Bound = 0;
export const LOWER: Bound = 1;
export const UPPER: Bound = 2;

/**
 * Fixed-size transposition table backed by typed arrays (no per-entry
 * objects, so no GC pressure). Always-replace on collision.
 */
export class TranspositionTable {
  private keys: Float64Array;
  private scores: Int16Array;
  private depths: Int8Array;
  private bounds: Int8Array;

  /** Last probe result, read by the caller to avoid allocating a result object. */
  score = 0;
  depth = 0;
  bound: Bound = EXACT;

  constructor(private readonly size = 1 << 20) {
    this.keys = new Float64Array(size); // 0 = empty (real keys are always > 0)
    this.scores = new Int16Array(size);
    this.depths = new Int8Array(size);
    this.bounds = new Int8Array(size);
  }

  clear(): void {
    this.keys.fill(0);
  }

  /** Looks up `key`; on a hit fills score/depth/bound and returns true. */
  probe(key: number): boolean {
    const i = key % this.size;
    if (this.keys[i] !== key) return false;
    this.score = this.scores[i]!;
    this.depth = this.depths[i]!;
    this.bound = this.bounds[i]! as Bound;
    return true;
  }

  store(key: number, score: number, depth: number, bound: Bound): void {
    const i = key % this.size;
    this.keys[i] = key;
    this.scores[i] = score;
    this.depths[i] = depth;
    this.bounds[i] = bound;
  }
}
