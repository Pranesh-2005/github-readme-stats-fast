import { beforeEach, expect, jest, test } from "@jest/globals";

import { svgCache, svgCacheGetOrSet } from "../src/common/svgCache.js";

beforeEach(() => {
  svgCache.clear();
});

test("concurrent calls for same key render once", async () => {
  const renderFn = jest.fn(async () => "svg");

  const results = await Promise.all([
    svgCacheGetOrSet("k", renderFn),
    svgCacheGetOrSet("k", renderFn),
    svgCacheGetOrSet("k", renderFn),
  ]);

  expect(results).toEqual(["svg", "svg", "svg"]);
  expect(renderFn).toHaveBeenCalledTimes(1);
});

test("cached value is reused after resolution", async () => {
  const renderFn = jest.fn(async () => "svg");
  await svgCacheGetOrSet("k", renderFn);
  expect(await svgCacheGetOrSet("k", renderFn)).toBe("svg");
  expect(renderFn).toHaveBeenCalledTimes(1);
});

test("failed render is not cached", async () => {
  const renderFn = jest
    .fn()
    .mockRejectedValueOnce(new Error("boom"))
    .mockResolvedValueOnce("svg");

  await expect(svgCacheGetOrSet("k", renderFn)).rejects.toThrow("boom");
  expect(await svgCacheGetOrSet("k", renderFn)).toBe("svg");
  expect(renderFn).toHaveBeenCalledTimes(2);
});
