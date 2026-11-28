import { describe, expect, it } from "@jest/globals";
import { renderStreakCard } from "../src/cards/streak-card.js";
import { availableLocales, streakCardLocales } from "../src/translations.js";

const mockStreak = {
  currentStreak: 5,
  longestStreak: 12,
  totalContributions: 340,
  currentStreakStart: "May 1, 2025",
  currentStreakEnd: "May 5",
  longestStreakStart: "Jan 1, 2025",
  longestStreakEnd: "Jan 12",
  firstContribution: "Jan 1, 2024",
};

describe("Test renderStreakCard", () => {
  it("should render default English labels when locale is omitted", () => {
    const svg = renderStreakCard("octocat", mockStreak, { theme: "default" });
    expect(svg).toContain("Total Contributions");
    expect(svg).toContain("Current Streak");
    expect(svg).toContain("Longest Streak");
    expect(svg).toContain("Jan 1, 2024 - Present");
  });

  it("should translate labels when a supported locale is passed", () => {
    const svg = renderStreakCard("octocat", mockStreak, {
      theme: "default",
      locale: "fr",
    });
    expect(svg).toContain("Contributions totales");
    expect(svg).toContain("Série actuelle");
    expect(svg).toContain("Plus longue série");
    expect(svg).toContain("Jan 1, 2024 - Présent");
  });

  it("should support all available locales in streakCardLocales", () => {
    for (const locale of availableLocales) {
      expect(streakCardLocales["streakcard.totalcontributions"][locale]).toBeTruthy();
      expect(streakCardLocales["streakcard.currentstreak"][locale]).toBeTruthy();
      expect(streakCardLocales["streakcard.longeststreak"][locale]).toBeTruthy();
      expect(streakCardLocales["streakcard.present"][locale]).toBeTruthy();
    }
  });
});
