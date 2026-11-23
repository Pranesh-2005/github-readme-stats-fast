import { jest, describe, it, expect, afterEach } from "@jest/globals";
import { track } from "../src/common/analytics.js";

const CTX = Symbol.for("@vercel/request-context");
const req = { query: { username: "octocat" }, headers: { host: "h.vercel.app" } };
const mkRes = () => ({ statusCode: 200, send: jest.fn() });

afterEach(() => {
  delete process.env.ANALYTICS_URL;
  delete process.env.ANALYTICS_SAMPLE;
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
});
