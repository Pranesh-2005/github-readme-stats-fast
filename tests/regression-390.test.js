/**
 * @jest-environment node
 *
 * Regression test for stats-organization/github-stats-extended#390:
 * "Resource not accessible by integration".
 *
 * GitHub restricted the `stargazers` *connection* on Repository — a
 * public-only token (including the Actions GITHUB_TOKEN) now gets
 *
 *   path:    user.repositories.nodes[N].stargazers
 *   message: Resource not accessible by personal access token
 *
 * The `stargazerCount` scalar is still readable for public repos, so the
 * queries must use it instead. These tests assert on the query text the
 * fetchers actually send, so a revert to `stargazers { totalCount }` fails
 * here rather than in production.
 */
import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

import { fetchStats } from "../src/fetchers/stats.js";
import { fetchRepo } from "../src/fetchers/repo.js";

const mock = new MockAdapter(axios);

process.env.PAT_1 = "test-token-1";

const statsResponse = {
  data: {
    user: {
      name: "Test User",
      login: "testuser",
      contributionsCollection: {
        totalCommitContributions: 100,
        totalPullRequestReviewContributions: 10,
      },
      repositoriesContributedTo: { totalCount: 5 },
      pullRequests: { totalCount: 20 },
      openIssues: { totalCount: 3 },
      closedIssues: { totalCount: 7 },
      followers: { totalCount: 50 },
      repositories: {
        totalCount: 2,
        nodes: [
          { name: "repoA", stargazerCount: 100 },
          { name: "repoB", stargazerCount: 50 },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  },
};

const repoResponse = {
  data: {
    user: {
      repository: {
        name: "repoA",
        nameWithOwner: "testuser/repoA",
        isPrivate: false,
        isArchived: false,
        isTemplate: false,
        stargazerCount: 38000,
        description: "a repo",
        primaryLanguage: { color: "#2b7489", id: "1", name: "TypeScript" },
        forkCount: 100,
      },
    },
    organization: null,
  },
};

/** The restricted connection, as it appeared in the failing query. */
const RESTRICTED = /stargazers\s*\{/;

beforeEach(() => mock.reset());
afterEach(() => mock.reset());

describe("#390: stats query must not use the restricted stargazers connection", () => {
  it("sends stargazerCount and never `stargazers { ... }`", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, statsResponse);

    await fetchStats("testuser");

    expect(mock.history.post.length).toBeGreaterThan(0);
    for (const req of mock.history.post) {
      expect(req.data).toContain("stargazerCount");
      expect(req.data).not.toMatch(RESTRICTED);
    }
  });

  it("still sums stars correctly from the scalar", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, statsResponse);

    const stats = await fetchStats("testuser");

    expect(stats.totalStars).toBe(150);
  });

  it("still honours exclude_repo when summing the scalar", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, statsResponse);

    const stats = await fetchStats("testuser", false, ["repoA"]);

    expect(stats.totalStars).toBe(50);
  });
});

describe("#390: repo query must not use the restricted stargazers connection", () => {
  it("sends stargazerCount and never `stargazers { ... }`", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, repoResponse);

    await fetchRepo("testuser", "repoA");

    expect(mock.history.post.length).toBeGreaterThan(0);
    for (const req of mock.history.post) {
      expect(req.data).toContain("stargazerCount");
      expect(req.data).not.toMatch(RESTRICTED);
    }
  });

  it("still reads the star count from the scalar", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, repoResponse);

    const repo = await fetchRepo("testuser", "repoA");

    expect(repo.starCount).toBe(38000);
  });
});
