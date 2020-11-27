import * as microtime from "../utils/microtime";
import { Limit, Limiter, LimiterOptions } from ".";

export interface MemoryLimiterOptions extends LimiterOptions { db: Map<string, Limit> }

export class MemoryLimiter extends Limiter {
  db: Map<string, Limit>;

  constructor(options: MemoryLimiterOptions) {
    super(options);
    this.db = options.db || new Map();
  }

  
  async get (): Promise<Limit> {
    const { id, db, duration, key, max } = this;

    const hasKey = db.has(key);
    const now = microtime.now();
    const reset = now + duration * 1e3;

    if (hasKey) {
      const entry = db.get(key);
      if (entry) {
        const expired = entry.reset * 1e6 < now;
        if (expired) {
          const initState: Limit = {
            id,
            reset: reset / 1e6,
            remaining: max,
            total: max
          };
          db.set(key, initState);

          return initState;
        }

        entry.remaining = entry.remaining > 0 ? entry.remaining - 1 : 0;
        return entry;
      }
    }
    const initState: Limit = {
      id,
      reset: reset / 1e6,
      remaining: max,
      total: max
    };
    db.set(key, initState);

    return initState;
  }
}