/**
 * @jest-environment node
 *
 * Cache-layer tests for the "fast" fork.
 *
 * Upstream github-readme-stats has no caching layer, so its tests cover
 * fetchers/renderers only. These cover what this fork adds: microCache
 * (data) + svgCache (rendered SVG), and the cache keys that feed them.
 *
 * Style follows upstream tests/api.test.js: @jest/globals, MockAdapter,
 * and a faker() helper building plain req/res objects.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import statsApi from "../api/index.js";
import topLangsApi from "../api/top-langs.js";
import pinApi from "../api/pin.js";
import gistApi from "../api/gist.js";
import wakatimeApi from "../api/wakatime.js";
import streakApi from "../api/streak.js";

const mock = new MockAdapter(axios);

process.env.PAT_1 = "test-token-1";
process.env.GITHUB_TOKEN = "test-token-1";

// --- fixtures ------------------------------------------------------------
// Values deliberately > 999 so number_format=short/long actually differ.
const statsUser = {
  name: "Test User",
  login: "testuser",
  contributionsCollection: {
    totalCommitContributions: 123456,
    totalPullRequestReviewContributions: 12345,
    restrictedContributionsCount: 5432,
    contributionYears: [2024],
  },
  repositoriesContributedTo: { totalCount: 5678 },
  pullRequests: { totalCount: 20123 },
  mergedPullRequests: { totalCount: 15987 },
  openIssues: { totalCount: 3456 },
  closedIssues: { totalCount: 7654 },
  followers: { totalCount: 50321 },
  repositoryDiscussions: { totalCount: 4321 },
  repositoryDiscussionComments: { totalCount: 2109 },
  repositories: {
    totalCount: 8765,
    nodes: [{ name: "repoA", stargazerCount: 42999 }],
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

const langNodes = {
  nodes: [
    {
      name: "repoA",
      languages: {
        edges: [{ size: 1000, node: { color: "#f00", name: "JavaScript" } }],
      },
    },
    {
      name: "repoB",
      languages: {
        edges: [{ size: 500, node: { color: "#0f0", name: "Python" } }],
      },
    },
  ],
};

const repoData = {
  user: {
    repository: {
      name: "repoA",
      nameWithOwner: "testuser/repoA",
      isPrivate: false,
      isArchived: false,
      isTemplate: false,
      stargazerCount: 42999,
      description: "a repo",
      primaryLanguage: { color: "#f00", id: "1", name: "JavaScript" },
      forkCount: 7654,
    },
  },
  organization: null,
};

const gistData = {
  viewer: {
    gist: {
      name: "gist-id",
      description: "a gist",
      owner: { login: "testuser" },
      stargazerCount: 5432,
      forks: { totalCount: 2109 },
      files: [{ name: "a.js", language: { name: "JavaScript" }, size: 100 }],
    },
  },
};

// WakaTime payload differs per api_domain so an SVG collision is visible.
const wakaTimeData = (host) => {
  const isDefault = host === "wakatime.com";
  return {
    data: {
      human_readable_range: `range-from-${host}`,
      languages: [
        {
          name: isDefault ? "JavaScript" : "Rust",
          text: isDefault ? "10 hrs" : "99 hrs",
          hours: isDefault ? 10 : 99,
          minutes: 0,
          percent: 100,
          digital: isDefault ? "10:00" : "99:00",
        },
      ],
    },
  };
};

// --- mock wiring ---------------------------------------------------------
beforeEach(() => {
  mock.reset();

  mock.onGet(/\/api\/v1\/users\/.+\/stats/).reply((config) => {
    return [200, wakaTimeData(new URL(config.url).host)];
  });

  mock.onPost("https://api.github.com/graphql").reply((config) => {
    const body = typeof config.data === "string" ? config.data : "";
    if (body.includes("contributionYears") && !body.includes("repositories(")) {
      return [200, { data: { user: { contributionsCollection: { contributionYears: [2024] } } } }];
    }
    if (body.includes("contributionCalendar")) {
      return [
        200,
        {
          data: {
            user: {
              y2024: {
                contributionCalendar: {
                  weeks: [
                    {
                      contributionDays: [
                        { date: "2024-01-01", contributionCount: 3 },
                        { date: "2024-01-02", contributionCount: 1 },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      ];
    }
    if (body.includes("gist")) {
      return [200, { data: gistData }];
    }
    if (body.includes("repository(")) {
      return [200, { data: repoData }];
    }
    if (body.includes("languages(first")) {
      return [200, { data: { user: { repositories: langNodes } } }];
    }
    return [200, { data: { user: statsUser } }];
  });
});

afterEach(() => {
  mock.reset();
  jest.clearAllMocks();
});

/**
 * Build req/res the way upstream tests/api.test.js does, and return the
 * SVG the handler sent.
 */
const faker = async (api, query) => {
  const req = { query };
  const res = { setHeader: jest.fn(), send: jest.fn() };
  await api(req, res);
  return res.send.mock.calls[0][0];
};

/** Total upstream calls made (GraphQL POSTs + WakaTime GETs). */
const netCalls = () => mock.history.post.length + mock.history.get.length;

const isSvg = (s) => typeof s === "string" && s.trim().startsWith("<svg");
const isErrorCard = (s) =>
  typeof s === "string" && s.includes("Something went wrong");

// A fresh username per test keeps the module-level caches from leaking
// state between tests (the caches are process-global by design).
let n = 0;
const uniq = (p) => `${p}-${Date.now()}-${n++}`;

describe("Cache keys: data-affecting params must not collide", () => {
  it("top-langs: size_weight/count_weight are part of the data key", async () => {
    const u = uniq("tl");
    const a = await faker(topLangsApi, { username: u, size_weight: "1", count_weight: "0" });
    const b = await faker(topLangsApi, { username: u, size_weight: "0", count_weight: "1" });

    expect(isSvg(a)).toBe(true);
    expect(isSvg(b)).toBe(true);
    expect(netCalls()).toBe(2);
    expect(a).not.toBe(b);
  });

  it("top-langs: exclude_repo is part of the data key", async () => {
    const u = uniq("tl");
    await faker(topLangsApi, { username: u, exclude_repo: "repoA" });
    await faker(topLangsApi, { username: u, exclude_repo: "repoB" });

    expect(netCalls()).toBe(2);
  });

  it("stats: `show` is part of the data key", async () => {
    const u = uniq("st");
    const a = await faker(statsApi, { username: u });
    const b = await faker(statsApi, { username: u, show: "prs_merged" });

    expect(netCalls()).toBe(2);
    expect(a).not.toBe(b);
  });

  it("stats: exclude_repo is part of the data key", async () => {
    const u = uniq("st");
    await faker(statsApi, { username: u, exclude_repo: "x" });
    await faker(statsApi, { username: u, exclude_repo: "y" });

    expect(netCalls()).toBe(2);
  });

  it("wakatime: api_domain is part of both the data key and the svg key", async () => {
    const u = uniq("wk");
    const a = await faker(wakatimeApi, { username: u });
    const b = await faker(wakatimeApi, { username: u, api_domain: "hackatime.dev" });

    expect(netCalls()).toBe(2);
    expect(mock.history.get.some((c) => c.url.includes("wakatime.com"))).toBe(true);
    expect(mock.history.get.some((c) => c.url.includes("hackatime.dev"))).toBe(true);
    expect(a).not.toBe(b);
  });

  it("pin: repo is part of the data key", async () => {
    const u = uniq("pin");
    await faker(pinApi, { username: u, repo: "r1" });
    await faker(pinApi, { username: u, repo: "r2" });

    expect(netCalls()).toBe(2);
  });

  it("gist: id is part of the data key", async () => {
    await faker(gistApi, { id: uniq("g") });
    await faker(gistApi, { id: uniq("g") });

    expect(netCalls()).toBe(2);
  });
});

describe("Caching still works", () => {
  it("serves an identical repeat request from cache (1 upstream call)", async () => {
    const q = { username: uniq("c"), theme: "dark" };
    const a = await faker(topLangsApi, q);
    const b = await faker(topLangsApi, q);

    expect(netCalls()).toBe(1);
    expect(a).toBe(b);
  });

  it("dedupes 10 concurrent identical requests into 1 upstream call", async () => {
    const q = { username: uniq("c") };
    const rs = await Promise.all(Array.from({ length: 10 }, () => faker(statsApi, q)));

    expect(netCalls()).toBe(1);
    rs.forEach((r) => expect(r).toBe(rs[0]));
  });

  it("render-only params reuse cached data but produce different SVGs", async () => {
    const u = uniq("c");
    const a = await faker(topLangsApi, { username: u, theme: "dark" });
    const b = await faker(topLangsApi, { username: u, theme: "radical" });

    expect(netCalls()).toBe(1);
    expect(a).not.toBe(b);
  });

  it("every render param busts the svg cache without refetching", async () => {
    const username = uniq("c");
    const variants = [
      { hide_border: "true" }, { hide_title: "true" }, { show_icons: "true" },
      { text_bold: "false" }, { card_width: "500" }, { border_radius: "10" },
      { title_color: "f00" }, { icon_color: "0f0" }, { text_color: "00f" },
      { bg_color: "fff" }, { border_color: "000" }, { custom_title: "Hi" },
      { rank_icon: "percentile" }, { number_format: "long" }, { hide_rank: "true" },
      { disable_animations: "true" }, { line_height: "30" }, { hide: "issues" },
    ];

    const seen = new Map([[await faker(statsApi, { username }), "base"]]);
    for (const v of variants) {
      const key = Object.keys(v)[0];
      const out = await faker(statsApi, { username, ...v });
      expect(isSvg(out)).toBe(true);
      expect(seen.has(out)).toBe(false); // collision => svg cache key too coarse
      seen.set(out, key);
    }

    expect(netCalls()).toBe(1);
  });
});

describe("Safety", () => {
  it("returns an SVG from every endpoint on the happy path", async () => {
    const u = uniq("h");
    const outs = [
      await faker(statsApi, { username: u }),
      await faker(topLangsApi, { username: u }),
      await faker(pinApi, { username: u, repo: "repoA" }),
      await faker(gistApi, { id: u }),
      await faker(wakatimeApi, { username: u }),
      await faker(streakApi, { username: u }),
    ];

    outs.forEach((o) => expect(isSvg(o)).toBe(true));
  });

  it("renders an error card instead of crashing when username is missing", async () => {
    expect(isErrorCard(await faker(streakApi, {}))).toBe(true);
  });

  it("handles repeated array query params (?hide=a&hide=b)", async () => {
    const out = await faker(statsApi, { username: uniq("a"), hide: ["issues", "prs"] });
    expect(isSvg(out)).toBe(true);
  });

  it("short-circuits blacklisted usernames without hitting the network", async () => {
    expect(isErrorCard(await faker(statsApi, { username: "renovate-bot" }))).toBe(true);
    expect(netCalls()).toBe(0);
  });

  it("does not poison the cache with a failed fetch", async () => {
    const u = uniq("flaky");
    mock.reset();
    mock.onGet(/\/api\/v1\/users\/.+\/stats/).networkErrorOnce();
    mock.onGet(/\/api\/v1\/users\/.+\/stats/).reply((config) => [
      200,
      wakaTimeData(new URL(config.url).host),
    ]);

    await faker(wakatimeApi, { username: u }); // fails
    const second = await faker(wakatimeApi, { username: u }); // must retry

    expect(isSvg(second)).toBe(true);
    expect(isErrorCard(second)).toBe(false);
  });
});

describe("Streak PAT rotation", () => {
  it("advances the token across requests (tokenIndex is module-scoped)", async () => {
    process.env.PAT_1 = "tok-A";
    process.env.PAT_2 = "tok-B";

    await faker(streakApi, { username: uniq("rot") });
    await faker(streakApi, { username: uniq("rot") });

    const auths = new Set(
      mock.history.post.map((c) => c.headers?.Authorization || ""),
    );

    delete process.env.PAT_2;
    process.env.PAT_1 = "test-token-1";

    expect(auths.size).toBeGreaterThanOrEqual(2);
  });
});
