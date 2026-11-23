// run: node analytics/check.mjs
import assert from "node:assert";
import worker from "./worker.js";
const pts = [];
const env = { ANALYTICS_KEY: "k", EVENTS: { writeDataPoint: (p) => pts.push(p) } };
const post = (key, body) => worker.fetch(new Request("https://c/", { method: "POST", headers: { "x-key": key }, body }), env);

assert.equal((await post("bad", "{}")).status, 401, "wrong key rejected");
assert.equal((await post("k", "nope")).status, 400, "bad json rejected");
assert.equal(pts.length, 0, "nothing written yet");
assert.equal((await post("k", JSON.stringify({ card: "stats", user: "octocat", host: "h", app: "acc1", svg: "miss", data: "hit", ttl: 86400, ms: 12, status: 200, w: 2 }))).status, 204);
assert.deepEqual(pts[0], { indexes: ["octocat"], blobs: ["stats", "octocat", "h", "acc1", "miss", "hit"], doubles: [12, 200, 2, 86400] });
assert.equal((await worker.fetch(new Request("https://c/"), env)).status, 200, "GET is harmless");
console.log("ok");
