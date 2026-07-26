import {
  clampValue,
  CONSTANTS,
  renderError,
  parseBoolean,
} from "../src/common/utils.js";
import { isLocaleAvailable } from "../src/translations.js";
import { renderGistCard } from "../src/cards/gist.js";
import { fetchGist } from "../src/fetchers/gist.js";
import { microCache } from "../src/common/microCache.js";
import { svgCacheGetOrSet } from "../src/common/svgCache.js";
import { normalizeParams } from "../src/common/normalizeparam.js";

export default async (req, res) => {
  const {
    id,
    title_color,
    icon_color,
    text_color,
    bg_color,
    theme,
    cache_seconds,
    locale,
    border_radius,
    border_color,
    show_owner,
    hide_border,
  } = req.query;

  res.setHeader("Content-Type", "image/svg+xml");

  if (locale && !isLocaleAvailable(locale)) {
    return res.send(
      renderError("Something went wrong", "Language not found", {
        title_color,
        text_color,
        bg_color,
        border_color,
        theme,
      }),
    );
  }

  try {
    const dataKey = `gist:${id}`;
    const gistData = await microCache(dataKey, () => fetchGist(id));

    let cacheSeconds = clampValue(
      parseInt(cache_seconds || CONSTANTS.TWO_DAY, 10),
      CONSTANTS.TWO_DAY,
      CONSTANTS.SIX_DAY,
    );
    cacheSeconds = process.env.CACHE_SECONDS
      ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
      : cacheSeconds;

    res.setHeader(
      "Cache-Control",
      `max-age=${604800}, s-maxage=${604800}`,
    );

    const normalizedParams = normalizeParams({
      title_color,
      icon_color,
      text_color,
      bg_color,
      theme,
      border_radius,
      border_color,
      locale,
      show_owner,
      hide_border,
    });
    const svgKey = `gist-svg:${dataKey}:${JSON.stringify(normalizedParams)}`;
    const svg = await svgCacheGetOrSet(svgKey, () =>
      renderGistCard(gistData, {
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
        border_radius,
        border_color,
        locale: locale ? locale.toLowerCase() : null,
        show_owner: parseBoolean(show_owner),
        hide_border: parseBoolean(hide_border),
      }),
    );
    return res.send(svg);
  } catch (err) {
    res.setHeader(
      "Cache-Control",
      `max-age=${CONSTANTS.ERROR_CACHE_SECONDS / 2}, s-maxage=${
        CONSTANTS.ERROR_CACHE_SECONDS
      }, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    ); // Use lower cache period for errors.
    return res.send(
      renderError(err.message, err.secondaryMessage, {
        title_color,
        text_color,
        bg_color,
        border_color,
        theme,
      }),
    );
  }
};
