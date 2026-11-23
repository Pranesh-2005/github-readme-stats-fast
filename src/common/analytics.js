// Usage events, fire-and-forget. Zero cost when ANALYTICS_URL is unset (default).
// Never awaited on the request path: the response is already sent when emit() runs,
// and the POST is handed to Vercel's waitUntil so it finishes after the response.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

const als = new AsyncLocalStorage();

// In-process cache layers call this to report hit/miss for the current request.
export const note = (key, value) => {
  const store = als.getStore();
  if (store) store[key] = value;
};

export const track = (card, handler) => async (req, res) => {
  if (!process.env.ANALYTICS_URL) return handler(req, res); // disabled: no wrapper cost
  const t = Date.now();
  const store = {};
  try {
    return await als.run(store, () => handler(req, res));
  } finally {
    emit(card, req, res, t, store);
  }
};

function emit(card, req, res, t, store) {
  try {
    // Only count the hosts you list (e.g. your public *.vercel.app). Unset = all hosts.
    // Filtering by host, not by project, keeps logging correct when the domain moves between accounts.
    const hosts = process.env.ANALYTICS_HOSTS;
    const reqHost = (req.headers?.host || "").toLowerCase().split(":")[0];
    if (
      hosts &&
      !hosts
        .toLowerCase()
        .split(",")
        .map((h) => h.trim())
        .includes(reqHost)
    )
      return;
    const rate = Number(process.env.ANALYTICS_SAMPLE) || 1; // send 1 in N, weight w=N
    if (rate > 1 && Math.random() * rate >= 1) return;
    // ponytail: same context @vercel/functions reads; avoids a new dependency
    const ctx = globalThis[Symbol.for("@vercel/request-context")]?.get?.();
    if (!ctx?.waitUntil) return; // no safe way to finish after the response: skip, never block
    const host = req.headers?.host || "";
    const ttl = /max-age=(\d+)/.exec(
      String(res.getHeader?.("cache-control") ?? ""),
    )?.[1];
    // request x-vercel-id = "<edge region>::<request id>"; the function region is VERCEL_REGION
    const edge = String(req.headers?.["x-vercel-id"] ?? "").split("::")[0];
    const query = String(req.url ?? "").split("?")[1] ?? "";
    const event = {
      card,
      user: req.query?.username || req.query?.id || "",
      host,
      app:
        process.env.ANALYTICS_APP ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        host, // per-deployment label, no code change needed
      svg: store.svg || "", // in-process SVG cache: hit | miss
      data: store.data || "", // in-process data cache: hit | dedup | miss
      ttl: Number(ttl) || 0, // max-age the CDN/browsers were told
      ms: Date.now() - t,
      status: res.statusCode,
      w: rate,
      repo: req.query?.repo || "", // pin cards are keyed per repo
      q: query
        ? createHash("sha1").update(query).digest("hex").slice(0, 10)
        : "", // same hash = same exact URL
      edge,
      region: process.env.VERCEL_REGION || "", // where the function ran
    };
    // Axiom: ANALYTICS_AUTH="Bearer <token>" + ANALYTICS_BATCH=1 (array body).
    // Own Cloudflare collector: ANALYTICS_KEY (sent as x-key), plain object body.
    const auth = process.env.ANALYTICS_AUTH;
    ctx.waitUntil(
      fetch(process.env.ANALYTICS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth
            ? { authorization: auth }
            : { "x-key": process.env.ANALYTICS_KEY || "" }),
        },
        body: JSON.stringify(process.env.ANALYTICS_BATCH ? [event] : event),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {}),
    );
  } catch {} // analytics must never break a card
}
