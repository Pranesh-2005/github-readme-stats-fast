// Collector: receives usage events from the app and writes them to Workers Analytics Engine.
// The shared key stops strangers from burning the free 100K writes/day.
export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("ok");
    if (!env.ANALYTICS_KEY || req.headers.get("x-key") !== env.ANALYTICS_KEY) {
      return new Response("unauthorized", { status: 401 });
    }
    let e;
    try {
      e = await req.json();
    } catch {
      return new Response("bad json", { status: 400 });
    }
    const user = String(e.user ?? "").slice(0, 64);
    env.EVENTS.writeDataPoint({
      indexes: [(user || String(e.card ?? "")).slice(0, 96)], // index = who, so sampling never drops a user
      blobs: [String(e.card ?? "").slice(0, 32), user, String(e.host ?? "").slice(0, 96)],
      doubles: [Number(e.ms) || 0, Number(e.status) || 0, Number(e.w) || 1],
    });
    return new Response(null, { status: 204 });
  },
};
