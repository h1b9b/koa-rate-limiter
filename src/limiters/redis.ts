import Redis from "ioredis";
import * as microtime from "../utils/microtime";
import { Limit, Limiter, LimiterOptions } from ".";

export interface RedisLimiterOptions extends LimiterOptions { db: Redis.Redis }

const toNumber = (str: string): number => parseInt(str, 10);

export class RedisLimiter extends Limiter {
  db: Redis.Redis;

  constructor(options: RedisLimiterOptions) {
    super(options);
    this.db = options.db || new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined
    });
  }

  async get(): Promise<Limit> {
    const { duration, max, key } = this;
    const now = microtime.now();
    const start = now - duration * 1000;

    const operations = [
      ["zremrangebyscore", key, "0", start.toString()],
      ["zcard", key],
      ["zrange", key, "0", "0"],
      ["zrange", key, (-max).toString(), (-max).toString()],
      ["pexpire", key, duration.toString()]
    ];

    operations.splice(2, 0, ["zadd", key, now.toString(), now.toString()]);

    const res = await this.db.multi(operations).exec();
    const count = toNumber(res[1][1]);
    const oldest = toNumber(res[3][1]);
    const oldestInRange = toNumber(res[4][1]);
    const resetMicro =
      (Number.isNaN(oldestInRange) ? oldest : oldestInRange) + duration * 1000;

    return {
      id: this.id,
      remaining: count < max ? max - count : 0,
      reset: Math.floor(resetMicro / 1000000),
      total: max
    };
  }
}