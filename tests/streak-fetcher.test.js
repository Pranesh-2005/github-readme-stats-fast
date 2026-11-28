import { describe, it, expect, afterAll } from "@jest/globals";
import { formatDateForDisplay } from "../src/fetchers/streak-fetcher.js";

describe("formatDateForDisplay", () => {
  const originalTz = process.env.TZ;

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("formats YYYY-MM-DD in UTC even when TZ is west of UTC", () => {
    process.env.TZ = "America/New_York";
    expect(formatDateForDisplay("2026-11-27")).toBe("Nov 27");
    expect(formatDateForDisplay("2026-11-27", true)).toBe("Nov 27, 2026");
  });

  it("returns empty string for empty input", () => {
    expect(formatDateForDisplay("")).toBe("");
  });
});
