// usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... node analytics/report.mjs [days=30]
// CF_API_TOKEN needs "Account Analytics: Read". Counts are scaled by sample weight (double3).
const days = Number(process.argv[2]) || 30;
const sql = {
  "Per day (events, distinct users)": `SELECT toDate(timestamp) AS day, SUM(_sample_interval * double3) AS events, COUNT(DISTINCT blob2) AS users FROM ghstats_events WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY day ORDER BY day`,
  "Top users": `SELECT blob2 AS user, SUM(_sample_interval * double3) AS events FROM ghstats_events WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY user ORDER BY events DESC LIMIT 20`,
  "By card": `SELECT blob1 AS card, SUM(_sample_interval * double3) AS events, COUNT(DISTINCT blob2) AS users, AVG(double1) AS avg_ms FROM ghstats_events WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY card ORDER BY events DESC`,
  "By deployment": `SELECT blob3 AS host, SUM(_sample_interval * double3) AS events FROM ghstats_events WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY host ORDER BY events DESC`,
};
for (const [title, q] of Object.entries(sql)) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
    body: q,
  });
  const j = await r.json().catch(() => ({}));
  console.log(`\n== ${title}`);
  console.table(r.ok ? j.data : [{ error: r.status, detail: JSON.stringify(j).slice(0, 200) }]);
}
