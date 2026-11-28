import { describe, it, expect } from "@jest/globals";
import {
  calculateStreaks,
  isValidTimeZone,
} from "../src/fetchers/streak-fetcher.js";

// Contributions on Nov 26 and Nov 27. Nov 28 has none yet.
const contributions = { "2026-11-26": 2, "2026-11-27": 1 };

describe("calculateStreaks timezone", () => {
  it("keeps the streak in UTC+5:30 just after local midnight", () => {
    // 2026-11-28 20:00 UTC is 01:30 on Nov 29 in Kolkata, so Nov 28 is
    // yesterday there and had no contributions.
    const now = new Date("2026-11-28T20:00:00Z");
    expect(calculateStreaks(contributions, "UTC", now).currentStreak).toBe(2);
    expect(
      calculateStreaks(contributions, "Asia/Kolkata", now).currentStreak,
    ).toBe(0);
  });

  it("keeps the streak in UTC-8 in the evening before local midnight", () => {
    // 2026-11-29 05:00 UTC is still Nov 28 21:00 in Los Angeles. In UTC
    // Nov 28 is yesterday and empty, so the streak is gone there.
    const now = new Date("2026-11-29T05:00:00Z");
    expect(calculateStreaks(contributions, "UTC", now).currentStreak).toBe(0);
    const res = calculateStreaks(contributions, "America/Los_Angeles", now);
    expect(res.currentStreak).toBe(2);
    expect(res.currentStreakStart).toBe("Nov 26, 2026");
    expect(res.currentStreakEnd).toBe("Nov 27");
  });

  it("counts today in the requested time zone", () => {
    // 2026-11-27 23:30 UTC is already Nov 28 in Tokyo.
    const now = new Date("2026-11-27T23:30:00Z");
    const withToday = { ...contributions, "2026-11-28": 3 };
    expect(calculateStreaks(withToday, "UTC", now).currentStreak).toBe(2);
    expect(calculateStreaks(withToday, "Asia/Tokyo", now).currentStreak).toBe(
      3,
    );
  });

  it("defaults to UTC", () => {
    const now = new Date("2026-11-28T20:00:00Z");
    expect(calculateStreaks(contributions, undefined, now).currentStreak).toBe(
      2,
    );
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and UTC", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects unknown and empty names", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});
