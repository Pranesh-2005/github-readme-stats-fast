import { describe, it, expect } from "@jest/globals";
import { renderStreakCard } from "../src/cards/streak-card.js";

const sampleStreak = {
  currentStreak: 5,
  longestStreak: 10,
  totalContributions: 120,
  firstContribution: "Jan 1, 2025",
  currentStreakStart: "Jun 10, 2026",
  currentStreakEnd: "Jun 15",
  longestStreakStart: "Feb 1, 2026",
  longestStreakEnd: "Feb 10",
};

describe("renderStreakCard", () => {
  it("defaults rx to 4.5 when border_radius is not provided", () => {
    const svg = renderStreakCard("octocat", sampleStreak, { theme: "default" });
    expect(svg).toContain('rx="4.5"');
  });

  it("uses custom border_radius for rx including 0", () => {
    const svgCustom = renderStreakCard("octocat", sampleStreak, {
      theme: "default",
      border_radius: "12",
    });
    expect(svgCustom).toContain('rx="12"');

    const svgZero = renderStreakCard("octocat", sampleStreak, {
      theme: "default",
      border_radius: 0,
    });
    expect(svgZero).toContain('rx="0"');
  });
});
