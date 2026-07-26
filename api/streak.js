import { renderStreakCard } from "../src/cards/streak-card.js";
import { CONSTANTS, renderError, parseBoolean } from "../src/common/utils.js";
import { svgCacheGetOrSet } from "../src/common/svgCache.js";
import { normalizeParams } from "../src/common/normalizeparam.js";
import { fetchStreak } from "../src/fetchers/streak-fetcher.js";
import { microCache } from "../src/common/microCache.js";

// Module scope so rotation survives across requests on a warm instance
let tokenIndex = 0;

function getNextToken() {
  const tokens = Object.keys(process.env)
    .filter((key) => key.startsWith("PAT_"))
    .map((key) => process.env[key])
    .filter(Boolean);

  if (tokens.length === 0) {
    return process.env.GITHUB_TOKEN;
  }

  const token = tokens[tokenIndex % tokens.length];
  tokenIndex++;
  return token;
}

export default async (req, res) => {
  const {
    username,
    theme,
    hide_border,
    title_color,
    text_color,
    bg_color,
    border_color,
  } = req.query;

  res.setHeader("Content-Type", "image/svg+xml");

  if (!username) {
    return res.send(
      renderError("Something went wrong", "Missing `username` parameter", {
        title_color,
        text_color,
        bg_color,
        border_color,
        theme,
      }),
    );
  }

  try {
    const token = getNextToken();
    if (!token) {
      return res.send(
        renderError("Something went wrong", "GitHub token is not configured", {
          title_color,
          text_color,
          bg_color,
          border_color,
          theme,
        }),
      );
    }

    const dataKey = `streak:${username}`;
    const streak = await microCache(dataKey, () => fetchStreak(username, token));

    // Streaks are pinned to a fixed 1 hour CDN cache; `cache_seconds` is
    // deliberately not honoured here.
    res.setHeader("Cache-Control", `max-age=${3600}, s-maxage=${3600}`);

    const normalizedParams = normalizeParams({
      theme,
      hide_border,
      title_color,
      text_color,
      bg_color,
      border_color,
    });
    const svgKey = `streak-svg:${dataKey}:${JSON.stringify(normalizedParams)}`;
    const svg = await svgCacheGetOrSet(svgKey, () =>
      renderStreakCard(username, streak, {
        theme,
        hide_border: parseBoolean(hide_border),
        title_color,
        text_color,
        bg_color,
        border_color,
      })
    );
    return res.send(svg);
  } catch (err) {
    res.setHeader(
      "Cache-Control",
      `max-age=${CONSTANTS.ERROR_CACHE_SECONDS / 2}, s-maxage=${CONSTANTS.ERROR_CACHE_SECONDS}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    );
    return res.send(
      renderError(
        err.message || "Something went wrong",
        err.secondaryMessage,
        {
          title_color,
          text_color,
          bg_color,
          border_color,
          theme,
        },
      ),
    );
  }
};