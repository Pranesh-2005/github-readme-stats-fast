import { renderWakatimeCard } from "../src/cards/wakatime.js";
import {
  clampValue,
  CONSTANTS,
  parseArray,
  parseBoolean,
  renderError,
} from "../src/common/utils.js";
import { fetchWakatimeStats } from "../src/fetchers/wakatime.js";
import { isLocaleAvailable } from "../src/translations.js";
import { microCache } from "../src/common/microCache.js";
import { svgCacheGetOrSet } from "../src/common/svgCache.js";
import { normalizeParams } from "../src/common/normalizeparam.js";

export default async (req, res) => {
  const {
    username,
    title_color,
    icon_color,
    hide_border,
    line_height,
    text_color,
    bg_color,
    theme,
    cache_seconds,
    hide_title,
    hide_progress,
    custom_title,
    locale,
    layout,
    langs_count,
    hide,
    api_domain,
    border_radius,
    border_color,
    display_format,
    disable_animations,
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
    const dataKey = `wakatime:${username}:${api_domain}`;
    const stats = await microCache(dataKey, () =>
      fetchWakatimeStats({ username, api_domain }),
    );

    let cacheSeconds = clampValue(
      parseInt(cache_seconds || CONSTANTS.CARD_CACHE_SECONDS, 10),
      CONSTANTS.SIX_HOURS,
      CONSTANTS.TWO_DAY,
    );
    cacheSeconds = process.env.CACHE_SECONDS
      ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
      : cacheSeconds;

    res.setHeader(
      "Cache-Control",
      `max-age=${
        86400
      }, s-maxage=${86400}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    );

    const normalizedParams = normalizeParams({
      custom_title,
      hide_title,
      hide_border,
      hide,
      line_height,
      title_color,
      icon_color,
      text_color,
      bg_color,
      theme,
      hide_progress,
      border_radius,
      border_color,
      locale,
      layout,
      langs_count,
      display_format,
      disable_animations,
    });
    const svgKey = `wakatime-svg:${dataKey}:${JSON.stringify(normalizedParams)}`;
    const svg = await svgCacheGetOrSet(svgKey, () =>
      renderWakatimeCard(stats, {
        custom_title,
        hide_title: parseBoolean(hide_title),
        hide_border: parseBoolean(hide_border),
        hide: parseArray(hide),
        line_height,
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
        hide_progress,
        border_radius,
        border_color,
        locale: locale ? locale.toLowerCase() : null,
        layout,
        langs_count,
        display_format,
        disable_animations: parseBoolean(disable_animations),
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
