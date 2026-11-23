import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { track, note } from "../src/common/analytics.js";
import { svgCacheGetOrSet, svgCache } from "../src/common/svgCache.js";
import { microCache, microCacheStore } from "../src/common/microCache.js";

const CTX = Symbol.for("@vercel/request-context");
const req = { query: { username: "octocat" }, headers: { host: "h.vercel.app" } };
const mkRes = () => ({ statusCode: 200, send: jest.fn() });

afterEach(() => {
  delete process.env.ANALYTICS_URL;
  delete process.env.ANALYTICS_SAMPLE;
  delete process.env.ANALYTICS_APP;
  delete process.env.ANALYTICS_AUTH;
  delete process.env.ANALYTICS_HOSTS;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.ANALYTICS_BATCH;
  svgCache.clear();
  microCacheStore.clear();
  delete globalThis[CTX];
  delete global.fetch;
});

describe("analytics track()", () => {
  it("is a no-op and returns the handler result when ANALYTICS_URL is unset", async () => {
    global.fetch = jest.fn();
    const out = await track("stats", async () => "done")(req, mkRes());
    expect(out).toBe("done");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("posts one event via waitUntil after the handler finishes", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    process.env.ANALYTICS_KEY = "k";
    const waitUntil = jest.fn();
    globalThis[CTX] = { get: () => ({ waitUntil }) };
    global.fetch = jest.fn(() => Promise.resolve());
    const order = [];
    await track("stats", async () => { order.push("handler"); })(req, mkRes());
    expect(order).toEqual(["handler"]);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ card: "stats", user: "octocat", host: "h.vercel.app", status: 200, w: 1 });
  });

  it("skips (never blocks) when there is no waitUntil", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    global.fetch = jest.fn();
    await track("stats", async () => {})(req, mkRes());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("never breaks the card if fetch throws, and still rethrows handler errors", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => { throw new Error("boom"); });
    await expect(track("stats", async () => "ok")(req, mkRes())).resolves.toBe("ok");
    await expect(track("stats", async () => { throw new Error("h"); })(req, mkRes())).rejects.toThrow("h");
  });

  it("reports app label, ttl and in-process cache hit/miss/dedup", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    process.env.ANALYTICS_APP = "acc2";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => Promise.resolve());
    const res = { ...mkRes(), getHeader: () => "max-age=86400, s-maxage=86400" };
    const run = () =>
      track("stats", async () => {
        await microCache("k", async () => 1);
        await svgCacheGetOrSet("s", async () => "<svg/>");
      })(req, res);
    await run(); // cold
    await run(); // warm
    const [cold, warm] = global.fetch.mock.calls.map((c) => JSON.parse(c[1].body));
    expect(cold).toMatchObject({ app: "acc2", ttl: 86400, svg: "miss", data: "miss" });
    expect(warm).toMatchObject({ svg: "hit", data: "hit" });
  });

  it("note() outside a tracked request is a harmless no-op", () => {
    expect(() => note("svg", "hit")).not.toThrow();
  });

  it("speaks Axiom: bearer auth header and array body", async () => {
    process.env.ANALYTICS_URL = "https://api.axiom.co/v1/datasets/d/ingest";
    process.env.ANALYTICS_AUTH = "Bearer t0k";
    process.env.ANALYTICS_BATCH = "1";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => Promise.resolve());
    await track("stats", async () => {})(req, mkRes());
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer t0k");
    expect(init.headers["x-key"]).toBeUndefined();
    expect(Array.isArray(JSON.parse(init.body))).toBe(true);
  });

  it("labels each deployment by itself: ANALYTICS_APP, else Vercel production URL, else host", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => Promise.resolve());
    const app = async () => {
      global.fetch.mockClear();
      await track("stats", async () => {})(req, mkRes());
      return JSON.parse(global.fetch.mock.calls[0][1].body).app;
    };
    expect(await app()).toBe("h.vercel.app");
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "proj-1.vercel.app";
    expect(await app()).toBe("proj-1.vercel.app");
    process.env.ANALYTICS_APP = "acc3";
    expect(await app()).toBe("acc3");
  });

  it("only emits for hosts in ANALYTICS_HOSTS (any account serving that host counts)", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    process.env.ANALYTICS_HOSTS = "main.vercel.app, other.example.com";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => Promise.resolve());
    const run = (host) => track("stats", async () => {})({ ...req, headers: { host } }, mkRes());
    await run("main.vercel.app");
    await run("MAIN.vercel.app:443");
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await run("github-readme-stats-fast-1.vercel.app");
    await run("");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("records repo, a stable query hash and the Vercel regions", async () => {
    process.env.ANALYTICS_URL = "https://collector";
    globalThis[CTX] = { get: () => ({ waitUntil: jest.fn() }) };
    global.fetch = jest.fn(() => Promise.resolve());
    const mk = (url) => ({
      query: { username: "u", repo: "r" },
      url,
      headers: { host: "h", "x-vercel-id": "sin1::iad1::abc-123" },
    });
    await track("pin", async () => {})(mk("/api/pin?username=u&repo=r"), mkRes());
    await track("pin", async () => {})(mk("/api/pin?username=u&repo=r"), mkRes());
    await track("pin", async () => {})(mk("/api/pin?username=u&repo=r2"), mkRes());
    const [a, b, c] = global.fetch.mock.calls.map((x) => JSON.parse(x[1].body));
    expect(a).toMatchObject({ repo: "r", edge: "sin1", fn: "iad1" });
    expect(a.q).toMatch(/^[0-9a-f]{10}$/);
    expect(a.q).toBe(b.q); // same URL, same hash
    expect(a.q).not.toBe(c.q); // different URL, different hash
    expect(a.q).not.toContain("username"); // hash only, no raw query stored
  });
});
