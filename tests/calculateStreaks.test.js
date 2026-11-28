import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { calculateStreaks } from "../src/fetchers/streak-fetcher.js";

describe("calculateStreaks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns zeros and empty strings when there are no contributions", () => {
    expect(calculateStreaks({})).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalContributions: 0,
      firstContribution: "",
      currentStreakStart: "",
      currentStreakEnd: "",
      longestStreakStart: "",
      longestStreakEnd: "",
    });

    expect(
      calculateStreaks({
        "2026-06-14": 0,
        "2026-06-15": 0,
      }),
    ).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalContributions: 0,
      firstContribution: "",
      currentStreakStart: "",
      currentStreakEnd: "",
      longestStreakStart: "",
      longestStreakEnd: "",
    });
  });

  it("counts a current streak that includes today", () => {
    const res = calculateStreaks({
      "2026-06-13": 2,
      "2026-06-14": 1,
      "2026-06-15": 4,
    });

    expect(res.currentStreak).toBe(3);
    expect(res.longestStreak).toBe(3);
    expect(res.totalContributions).toBe(7);
    expect(res.currentStreakStart).toBe("Jun 13, 2026");
    expect(res.currentStreakEnd).toBe("Jun 15");
  });

  it("counts a current streak that ended yesterday", () => {
    const res = calculateStreaks({
      "2026-06-12": 1,
      "2026-06-13": 3,
      "2026-06-14": 2,
    });

    expect(res.currentStreak).toBe(3);
    expect(res.longestStreak).toBe(3);
    expect(res.totalContributions).toBe(6);
    expect(res.currentStreakStart).toBe("Jun 12, 2026");
    expect(res.currentStreakEnd).toBe("Jun 14");
  });

  it("resets the current streak when there is a one-day gap before yesterday", () => {
    const res = calculateStreaks({
      "2026-06-11": 5,
      "2026-06-12": 5,
      "2026-06-13": 5,
    });

    expect(res.currentStreak).toBe(0);
    expect(res.longestStreak).toBe(3);
    expect(res.currentStreakStart).toBe("");
    expect(res.currentStreakEnd).toBe("");
    expect(res.longestStreakStart).toBe("Jun 11, 2026");
    expect(res.longestStreakEnd).toBe("Jun 13");
  });

  it("tracks a longest streak in an earlier year and across Dec 31 to Jan 1", () => {
    const res = calculateStreaks({
      "2024-12-30": 1,
      "2024-12-31": 2,
      "2025-01-01": 3,
      "2025-01-02": 1,
      "2026-06-15": 1,
    });

    expect(res.currentStreak).toBe(1);
    expect(res.longestStreak).toBe(4);
    expect(res.totalContributions).toBe(8);
    expect(res.longestStreakStart).toBe("Dec 30, 2024");
    expect(res.longestStreakEnd).toBe("Jan 2, 2025");
  });
});
