import { BaseContext, Middleware, Next } from "koa";
import ms from "ms";
import { Limiter, LimiterOptions } from "./limiters";
import { MemoryLimiter, MemoryLimiterOptions } from "./limiters/memory";
import { RedisLimiter, RedisLimiterOptions } from "./limiters/redis";

export interface RateLimitOptions {
  driver?: "redis" | "memory"
  /**
   * database connection
   */
  db?: unknown;
  /**
   * limit duration in milliseconds [1 hour]
   */
  duration?: number;
  /**
   * max requests per 'id' default: 2500
   */
  max?: number;
  /**
   * id to compare requests default: ip
   */
  id?: (ctx: BaseContext) => string | false;
  /**
   * logic that decides to black list a client based on the context
   */
  allowlist?(ctx: BaseContext): boolean;
  /**
   * logic that decides to black list a client based on the context
   */
  blocklist?(ctx: BaseContext): boolean;
  /**
   * throw on rate limit exceeded default: false
   */
  throw?: boolean;
  /**
   * error returned as the body of the response
   */
  errorMessage?: string;
  /**
   * error return in the http status of the response
   */
  status?: number;
  /**
   * Disable headers
   */
  disableHeader?: boolean;
  /**
   * custom header names
   */
  headers?: {
    /**
     * remaining number of requests default: 'X-RateLimit-Remaining'
     */
    remaining?: string;
    /**
     * reset timestamp default: 'X-RateLimit-Reset'
     */
    reset?: string;
    /**
     * total number of requests default: 'X-RateLimit-Limit'
     */
    total?: string;
  };
}

function getLimiter(driver: string, options: LimiterOptions): Limiter {
  if (driver === "memory") {
    return new MemoryLimiter(<MemoryLimiterOptions> options);
  } else if (driver === "redis") {
    return new RedisLimiter(<RedisLimiterOptions> options);
  } else {
    throw new Error(`invalid driver. Expecting memory or redis, got ${driver}`);
  }
}

export default function ratelimiter(opts: RateLimitOptions): Middleware {
  const options = {
    driver: "memory",
    db: new Map(),
    max: 2500,
    duration: 3600000,
    throw: true,
    disableHeader: false,
    id: (ctx: BaseContext): string => ctx.ip,
    allowlist: () => false,
    blocklist: () => false,
    headers: {
      remaining: "X-RateLimit-Remaining",
      reset: "X-RateLimit-Reset",
      total: "X-RateLimit-Limit",
    },
    status: 429,
    ...opts,
  };
  const {
    remaining = "X-RateLimit-Remaining",
    reset = "X-RateLimit-Reset",
    total = "X-RateLimit-Limit",
  } = options.headers || {};

  return async (ctx: BaseContext, next: Next) => {
    const id = options.id(ctx);

    if (id === false) {
      return next();
    }

    const allowed = options.allowlist != null && await options.allowlist(ctx);
    const blocked = options.blocklist != null && await options.blocklist(ctx);

    if (blocked) {
      return ctx.throw(403);
    }

    if (allowed) {
      return next();
    }


    const limiter = getLimiter(options.driver, {
      id,
      db: options.db,
      max: options.max || 2500,
      duration: options.duration || 3600000,
      namespace: "limit"
    });

    // check limit
    const limit = await limiter.get();

    // check if current call is legit
    const calls = limit.remaining > 0 ? limit.remaining - 1 : 0;

    let headers = {};
    if (options.disableHeader === false) {
      headers = {
        [remaining]: calls.toString(),
        [reset]: limit.reset.toString(),
        [total]: limit.total.toString()
      };

      ctx.set(headers);
    }


    if (limit.remaining) return await next();

    const delta = (limit.reset * 1000) - Date.now() | 0;
    const after = limit.reset - (Date.now() / 1000) | 0;
    ctx.set("Retry-After", after.toString());

    ctx.status = options.status || 429;
    ctx.body = options.errorMessage || `Rate limit exceeded, retry in ${ms(delta, { long: true })}.`;

    if (options.throw) {
      ctx.throw(ctx.status, ctx.body, { headers });
    }
  };
}
