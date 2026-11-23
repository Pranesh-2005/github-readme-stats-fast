// Usage events, fire-and-forget. Zero cost when ANALYTICS_URL is unset (default).
// Never awaited on the request path: the response is already sent when emit() runs,
// and the POST is handed to Vercel's waitUntil so it finishes after the response.
export const track = (card, handler) => async (req, res) => {
  const t = Date.now();
  try {
    return await handler(req, res);
  } finally {
    emit(card, req, res, t);
  }
};

function emit(card, req, res, t) {
  try {
    const url = process.env.ANALYTICS_URL;
    if (!url) return;
    const rate = Number(process.env.ANALYTICS_SAMPLE) || 1; // send 1 in N, weight w=N
    if (rate > 1 && Math.random() * rate >= 1) return;
    // ponytail: same context @vercel/functions reads; avoids a new dependency
    const ctx = globalThis[Symbol.for("@vercel/request-context")]?.get?.();
    if (!ctx?.waitUntil) return; // no safe way to finish after the response: skip, never block
    ctx.waitUntil(
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-key": process.env.ANALYTICS_KEY || "" },
        body: JSON.stringify({
          card,
          user: req.query?.username || req.query?.id || "",
          host: req.headers?.host || "",
          ms: Date.now() - t,
          status: res.statusCode,
          w: rate,
        }),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {}),
    );
  } catch {} // analytics must never break a card
}
