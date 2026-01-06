import { renderStreakCard } from "../src/cards/streak-card.js";
import {
  clampValue,
  CONSTANTS,
  renderError,
  parseBoolean,
} from "../src/common/utils.js";
import { fetchStreak } from "../src/fetchers/streak-fetcher.js";
import { microCache } from "../src/common/microCache.js";
export default async (req, res) => {
  const {
    username,
    theme,
    hide_border,
    title_color,
    text_color,
    bg_color,
    border_color,
    cache_seconds,
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

    const streak = await microCache(
      `streak:${username}`,
      () => fetchStreak(username, token)
    );

    let cacheSeconds = clampValue(
      parseInt(cache_seconds || CONSTANTS.CARD_CACHE_SECONDS, 10),
      CONSTANTS.TWO_HOURS,
      CONSTANTS.ONE_DAY,
    );
    cacheSeconds = process.env.CACHE_SECONDS
      ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
      : cacheSeconds;

    res.setHeader(
      "Cache-Control",
      `max-age=${cacheSeconds * 60}, s-maxage=${cacheSeconds * 60}`,
    );

    const normalizedParams = normalizeParams({
      theme,
      hide_border,
      title_color,
      text_color,
      bg_color,
      border_color,
    });
    const svgKey = `streak-svg:${username}:${JSON.stringify(normalizedParams)}`;
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