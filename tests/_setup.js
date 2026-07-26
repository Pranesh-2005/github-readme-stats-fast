/**
 * Global test setup.
 *
 * Two things make the ported upstream tests non-hermetic in this fork:
 *
 * 1. `.env` is loaded by dotenv at import time, and a local CACHE_SECONDS
 *    overrides every computed Cache-Control value. CI has no .env, a dev
 *    machine usually does — so tests would pass or fail depending on whose
 *    machine they run on. Drop it.
 *
 * 2. This fork adds process-global caches (microCache for fetched data,
 *    svgCache for rendered SVGs). Upstream's tests all use the same
 *    username, so without a reset the second test in a file is served the
 *    first one's cached result — error-path tests in particular never see
 *    their error. Clear both before every test.
 */
import { beforeEach } from "@jest/globals";
import { microCacheStore } from "../src/common/microCache.js";
import { svgCache } from "../src/common/svgCache.js";

beforeEach(() => {
  // Deleted per-test, not once: the fetchers call dotenv.config() at module
  // import time, which re-injects .env values after this file first runs.
  delete process.env.CACHE_SECONDS;

  microCacheStore.clear();
  svgCache.clear();
});
