/**
 * Normalize query params to avoid cache-key explosion
 * - removes undefined / empty values
 * - sorts keys
 * - stable JSON string
 */
export function normalizeParams(params) {
  return Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort()
    .reduce((acc, key) => {
      acc[key] = String(params[key]);
      return acc;
    }, {});
}
