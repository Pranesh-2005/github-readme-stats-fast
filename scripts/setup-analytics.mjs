// Wire a Vercel account's project to analytics. Run once per account (new accounts too):
//   VERCEL_TOKEN=<that account's token> node scripts/setup-analytics.mjs <label> [project-name-contains]
// Reads AXIOM_TOKEN / AXIOM_DATASET / AXIOM_DOMAIN from .env. Idempotent (upsert), production only.
import "dotenv/config";

const [label, match = "stats"] = process.argv.slice(2);
const { VERCEL_TOKEN, AXIOM_TOKEN, AXIOM_DATASET, AXIOM_DOMAIN } = process.env;
if (
  !label ||
  !VERCEL_TOKEN ||
  !AXIOM_TOKEN ||
  !AXIOM_DATASET ||
  !AXIOM_DOMAIN
) {
  console.error(
    "need: <label> arg, VERCEL_TOKEN env, and AXIOM_TOKEN/AXIOM_DATASET/AXIOM_DOMAIN in .env",
  );
  process.exit(1);
}
const hosts =
  process.env.ANALYTICS_HOSTS || "github-readme-stats-fast.vercel.app";
const api = async (path, method = "GET", body) => {
  const r = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `${method} ${path} -> ${r.status} ${JSON.stringify(j).slice(0, 160)}`,
    );
  return j;
};

const projects = (await api("/v9/projects?limit=100")).projects.filter((p) =>
  p.name.includes(match),
);
if (projects.length !== 1) {
  console.error(
    `expected 1 project matching "${match}", found: ${projects.map((p) => p.name).join(", ") || "none"}`,
  );
  process.exit(1);
}
const [p] = projects;
const vars = [
  [
    "ANALYTICS_URL",
    `https://${AXIOM_DOMAIN}/v1/ingest/${AXIOM_DATASET}`,
    "plain",
  ],
  ["ANALYTICS_AUTH", `Bearer ${AXIOM_TOKEN}`, "sensitive"],
  ["ANALYTICS_BATCH", "1", "plain"],
  ["ANALYTICS_APP", label, "plain"],
  ["ANALYTICS_HOSTS", hosts, "plain"],
];
for (const [key, value, type] of vars) {
  await api(`/v10/projects/${p.id}/env?upsert=true`, "POST", {
    key,
    value,
    type,
    target: ["production"],
  });
}
console.log(
  `${label}: set ${vars.map((v) => v[0]).join(", ")} on ${p.name} (redeploy to apply)`,
);
