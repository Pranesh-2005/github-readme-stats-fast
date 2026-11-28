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

describe("renderStreakCard disable_animations", () => {
  it("renders animations by default", () => {
    const svg = renderStreakCard("octocat", sampleStreak, { theme: "default" });
    expect(svg).toContain("animation:");
    expect(svg).toContain("@keyframes fadein");
  });

  it("drops animations and sets full opacity when disable_animations is true", () => {
    const svg = renderStreakCard("octocat", sampleStreak, {
      theme: "default",
      disable_animations: true,
    });
    expect(svg).not.toContain("animation:");
    expect(svg).not.toContain("@keyframes");
    expect(svg).not.toMatch(/(?:^|[;\s])opacity:\s*0(?:\s|;|$)/);
    expect(svg).toContain("opacity: 1");
  });
});
