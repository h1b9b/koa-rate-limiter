import Koa from "koa";
import request from "supertest";
import { Server } from "http";
import ratelimiter from "../src";

const db = new Map();

describe("ratelimit middleware with memory driver", () => {
  const duration = 1000;
  const goodBody = "Num times hit:";

  beforeEach(async () => db.clear());

  describe("limit", () => {
    let guard: number;
    let app: Koa;
    let server: Server;

    beforeEach(async () => {
      app = new Koa();

      app.use(ratelimiter({ driver: "memory", duration, db, max: 1 }));
      app.use(async (ctx) => {
        guard++;
        ctx.body = `${goodBody} ${guard}`;
      });

      guard = 0;

      await sleep(duration);
      server = app.listen();
      const res = await request(server)
        .get("/");
      expect(res.status).toBe(200);
      expect(res.text).toBe(`${goodBody} 1`);
      expect(guard).toBe(1);
    });

    afterEach(() => {
      server.close();
    });

    it("responds with 429 when rate limit is exceeded", async () => {
      const res = await request(server)
        .get("/");
      expect(res.status).toBe(429);
      expect(res.headers["x-ratelimit-remaining"]).toBe("0");
    });

    it("responds with 429 when rate limit is exceeded and remaining is 0", async () => {
      await request(server).get("/");

      const res = await request(server)
        .get("/");
      expect(res.status).toBe(429);
      expect(res.headers["x-ratelimit-remaining"]).toBe("0");
    });

    it("should not yield downstream if ratelimit is exceeded", async () => {
      const res = await request(server)
        .get("/");
        
      expect(res.status).toBe(429);
      expect(guard).toBe(1);
    });
  });

  describe("limit with throw", () => {
    let guard: number;
    let app: Koa;
    let server: Server;

    beforeEach(async () => {
      app = new Koa();

      app.use(async (ctx, next) => {
        try {
          await next();
        } catch (e) {
          ctx.body = e.message;
          ctx.set(Object.assign({ "X-Custom": "foobar" }, e.headers));
        }
      });

      app.use(ratelimiter({
        driver: "memory",
        db,
        duration,
        max: 1,
        throw: true
      }));

      app.use(async (ctx) => {
        guard++;
        ctx.body = `${goodBody} ${guard}`;
      });

      guard = 0;

      await sleep(duration);
      server = app.listen();
      const res = await request(server).get("/");
        
      expect(res.status).toBe(200);
      expect(res.text).toBe(`${goodBody} 1`);
      expect(guard).toBe(1);
    });

    afterEach(() => {
      server.close();
    });

    it("responds with 429 when rate limit is exceeded", async () => {
      const res = await request(server).get("/");
        
      expect(res.status).toBe(429);
      expect(res.headers["x-ratelimit-remaining"]).toBe("0");
      expect(res.headers["x-custom"]).toBe("foobar");
      expect(res.text).toMatch(/^Rate limit exceeded, retry in.*/);
    });
  });

  describe("id", () => {
    it("should allow specifying a custom `id` function", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        id: (ctx) => ctx.headers["foo"],
        max: 1
      }));
      const server = app.listen();
      const res = await request(server)
        .get("/")
        .set("foo", "bar");
      
      expect(res.headers["x-ratelimit-remaining"]).toBe("0");
      server.close();
    });

    it("should not limit if `id` returns `false`", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        id: () => false,
        max: 5
      }));

      const server = app.listen();
      const res = await request(server)
        .get("/");
      expect(res.headers["x-ratelimit-remaining"]).toBeUndefined();
      
      server.close();
    });

    it("should limit using the `id` value", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        id: (ctx) => ctx.headers["foo"],
        max: 1
      }));

      app.use(async (ctx) => {
        ctx.body = ctx.request.header.foo;
      });

      const server = app.listen();
      let res = await request(server)
        .get("/")
        .set("foo", "fiz");
      expect(res.status).toBe(200);
      expect(res.text).toBe("fiz");

      res = await request(server)
        .get("/")
        .set("foo", "biz");
      expect(res.status).toBe(200);
      expect(res.text).toBe("biz");

      server.close();
    });
  });

  describe("allowlist", () => {
    const duration = 1000;
    let guard: number;
    let app: Koa;
    let server: Server;

    const hitOnce = () => expect(guard).toBe(1);

    beforeEach(async () => {
      app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        allowlist: (ctx) => ctx.headers["foo"] === "allow-me",
        max: 1
      }));
      app.use(async (ctx) => {
        guard++;
        ctx.body = "foo";
      });

      guard = 0;

      await sleep(duration);
      server = app.listen();
      await request(server)
        .get("/")
        .expect(200)
        .expect(hitOnce);
      
    });
    afterEach(() => {
      server.close();
    });

    it("should not limit if satisfy allowlist function", async () => {
      let res = await request(server).get("/").set("foo", "allow-me");
      expect(res.status).toBe(200);

      res = await request(server).get("/").set("foo", "allow-me");
      expect(res.status).toBe(200);
    });

    it("should limit as usual if allowlist return false", async () => {
      const res = await request(server).get("/").set("foo", "don-t-allow-me");
      expect(res.status).toBe(429);
    });
  });

  describe("blocklist", () => {
    let app: Koa;
    let server: Server;

    beforeEach(async () => {
      app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        blocklist: (ctx) => ctx.headers["foo"] === "block-me",
        max: 1
      }));
      app.use(async (ctx) => {
        ctx.body = "foo";
      });
      server = app.listen();
    });

    afterEach(() => {
      server.close();
    });

    it("should throw 403 if blocked", async () => {
      const res = await request(server).get("/").set("foo", "block-me");
      expect(res.status).toBe(403);
    });

    it("should return 200 when not blocked", async () => {
      const res = await request(server).get("/").set("foo", "don-t-block-me");
      expect(res.status).toBe(200);
    });
  });

  describe("custom headers", () => {
    it("should allow specifying custom header names", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        headers: {
          remaining: "Rate-Limit-Remaining",
          reset: "Rate-Limit-Reset",
          total: "Rate-Limit-Total"
        },
        max: 1
      }));

      const server = app.listen();
      const res = await request(server).get("/").set("foo", "bar");
      server.close();
      expect(res.headers).toHaveProperty("rate-limit-remaining");
      expect(res.headers).toHaveProperty("rate-limit-reset");
      expect(res.headers).toHaveProperty("rate-limit-total");
      expect(res.headers).not.toHaveProperty("x-ratelimit-limit");
      expect(res.headers).not.toHaveProperty("x-ratelimit-remaining");
      expect(res.headers).not.toHaveProperty("x-ratelimit-reset");
    });
  });

  describe("custom error message", () => {
    it("should allow specifying a custom error message", async () => {
      const app = new Koa();
      const errorMessage = "Sometimes You Just Have to Slow Down.";

      app.use(ratelimiter({
        driver: "memory",
        db,
        errorMessage,
        max: 1
      }));

      app.use(async (ctx) => {
        ctx.body = "foo";
      });

      const server = app.listen();
      let res = await request(server).get("/");
      expect(res.status).toBe(200);

      res = await request(server).get("/");
      server.close();
      expect(res.status).toBe(429);
      expect(res.text).toBe(errorMessage);
    });

    it("should return default error message when not specifying", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        max: 1
      }));

      app.use(async (ctx) => {
        ctx.body = "foo";
      });

      const server = app.listen();
      let res = await request(server).get("/");
      expect(res.status).toBe(200);

      res = await request(server).get("/").set("foo", "bar");
      expect(res.status).toBe(429);
      expect(res.text).toMatch(/Rate limit exceeded, retry in \d+ minutes\./);
      server.close();
    });
  });

  describe("disable headers", () => {
    it("should disable headers when set opts.disableHeader", async () => {
      const app = new Koa();

      app.use(ratelimiter({
        driver: "memory",
        db,
        headers: {
          remaining: "Rate-Limit-Remaining",
          reset: "Rate-Limit-Reset",
          total: "Rate-Limit-Total"
        },
        max: 1,
        disableHeader: true,
      }));
      const server = app.listen();
      const res = await request(server).get("/").set("foo", "bar");
      server.close();
      expect(res.headers).not.toHaveProperty("rate-limit-remaining");
      expect(res.headers).not.toHaveProperty("rate-limit-reset");
      expect(res.headers).not.toHaveProperty("rate-limit-total");
      expect(res.headers).not.toHaveProperty("x-ratelimit-limit");
      expect(res.headers).not.toHaveProperty("x-ratelimit-remaining");
      expect(res.headers).not.toHaveProperty("x-ratelimit-total");
    });
  });
});

async function sleep (ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}