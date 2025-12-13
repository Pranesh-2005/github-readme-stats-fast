const cache = new Map(); // { key: { data, timestamp, promise } }
const INTERNAL_TTL = 5000; // 5 seconds internal cache ONLY

export async function microCache(key, fetchFn) {
  const now = Date.now();
  const cached = cache.get(key);

  // Return fresh cached data
  if (cached && cached.data && now - cached.timestamp < INTERNAL_TTL) {
    return cached.data;
  }

  // Dedupe: If a promise already exists, wait for it
  if (cached && cached.promise) {
    return await cached.promise;
  }

  // Create a new fetch request
  const promise = fetchFn()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .finally(() => {
      const entry = cache.get(key);
      if (entry) entry.promise = null;
    });

  cache.set(key, { promise });

  return await promise;
}
