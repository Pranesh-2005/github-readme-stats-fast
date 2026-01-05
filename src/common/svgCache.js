// SVG cache configuration
const SVG_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const svgCache = new Map();

export async function svgCacheGetOrSet(key, renderFn) {
  const now = Date.now();
  const cached = svgCache.get(key);

  if (cached && now - cached.time < SVG_TTL) {
    return cached.svg;
  }

  const svg = await renderFn();

  svgCache.set(key, {
    svg,
    time: now,
  });

  // Optional: Clean up old entries to prevent memory leaks
  if (svgCache.size > 1000) {
    const cutoff = now - SVG_TTL;
    for (const [k, v] of svgCache.entries()) {
      if (v.time < cutoff) {
        svgCache.delete(k);
      }
    }
  }

  return svg;
}

export { svgCache, SVG_TTL };