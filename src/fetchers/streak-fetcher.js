import { request, CustomError, logger } from "../common/utils.js";

/**
 * Fetch all years the user has contributed.
 * @param {string} username
 * @param {string} token
 * @returns {Promise<number[]>}
 */
async function fetchContributionYears(username, token) {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionYears
        }
      }
    }
  `;
  const res = await request(
    { query, variables: { login: username } },
    { Authorization: `bearer ${token}` },
  );
  const user = res?.data?.user || res?.data?.data?.user;
  if (!user)
    throw new CustomError("Could not fetch user.", CustomError.USER_NOT_FOUND);
  return user.contributionsCollection.contributionYears;
}

/**
 * Fetch contribution calendars for all years in a single GraphQL request.
 * Uses aliases to combine multiple years into one query, reducing API calls from N to 1.
 * @param {string} username
 * @param {number[]} years - Array of years to fetch
 * @param {string} token
 * @returns {Promise<Record<string, number>>} Map of date string to contribution count
 */
async function fetchAllYearsCalendar(username, years, token) {
  // Build a single query with aliases for each year
  // e.g., y2026: contributionsCollection(from: "2026-01-01", to: "2026-12-31") { ... }
  const yearFragments = years
    .map((year) => {
      const from = `${year}-01-01T00:00:00Z`;
      const to = `${year}-12-31T23:59:59Z`;
      return `
      y${year}: contributionsCollection(from: "${from}", to: "${to}") {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }`;
    })
    .join("\n");

  const query = `
    query($login: String!) {
      user(login: $login) {
        ${yearFragments}
      }
    }
  `;

  const res = await request(
    { query, variables: { login: username } },
    { Authorization: `bearer ${token}` },
  );

  const user = res?.data?.user || res?.data?.data?.user;
  if (!user)
    throw new CustomError("Could not fetch user.", CustomError.USER_NOT_FOUND);

  // Combine all years' contribution data into a single map
  const contributions = {};
  for (const year of years) {
    const yearData = user[`y${year}`];
    if (yearData?.contributionCalendar?.weeks) {
      for (const week of yearData.contributionCalendar.weeks) {
        for (const day of week.contributionDays) {
          contributions[day.date] = day.contributionCount;
        }
      }
    }
  }

  return contributions;
}

/**
 * Format a date for display (YYYY-MM-DD to MMM D or MMM D, YYYY)
 * @param {string} dateString - ISO date string
 * @param {boolean} includeYear - Whether to include the year
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(dateString, includeYear = false) {
  if (!dateString) return "";
  const date = new Date(dateString);

  if (includeYear) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Calculate streaks and totals from all days (GitHub logic, UTC aware).
 * @param {Record<string, number>} contributions - Map of date string to count
 */
function calculateStreaks(contributions) {
  const dates = Object.keys(contributions).sort();
  let totalContributions = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  // For tracking date ranges
  let currentStreakStart = null;
  let currentStreakEnd = null;
  let longestStreakStart = null;
  let longestStreakEnd = null;

  // Find the first actual contribution date
  let firstContribution = null;
  for (const date of dates) {
    if (contributions[date] > 0) {
      firstContribution = date;
      break;
    }
  }

  // Use UTC date for today to match GitHub's calendar
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
    .toISOString()
    .split("T")[0];

  // Calculate yesterday's date
  const yesterdayDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  // Calculate total contributions
  for (const date of dates) {
    totalContributions += contributions[date];
  }

  // Determine where to start counting the streak
  // If today has contributions, start from today
  // If today has no contributions but yesterday does, start from yesterday (streak is still alive)
  // If both today and yesterday have no contributions, streak is broken
  const todayCount = contributions[today] || 0;
  const yesterdayCount = contributions[yesterday] || 0;

  let startDate;
  if (todayCount > 0) {
    startDate = today;
  } else if (yesterdayCount > 0) {
    startDate = yesterday;
  } else {
    // No contributions today or yesterday - streak is broken
    startDate = null;
  }

  // Calculate current streak: walk backward from startDate until a gap is found
  let currentStreak = 0;
  if (startDate !== null) {
    let checkDate = new Date(startDate + "T00:00:00Z");

    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      const count = contributions[dateStr];

      if (count !== undefined && count > 0) {
        currentStreak++;

        // Track the current streak range
        if (currentStreakEnd === null) {
          currentStreakEnd = dateStr;
        }
        currentStreakStart = dateStr;

        // Move to previous day
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        // No contribution on this day - streak ends
        break;
      }
    }
  }

  // Calculate longest streak
  tempStreak = 0;
  prevDate = null;
  let tempStreakStart = null;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const count = contributions[date];

    if (count > 0) {
      if (
        prevDate === null ||
        (new Date(date) - new Date(prevDate)) / (1000 * 60 * 60 * 24) === 1
      ) {
        if (tempStreak === 0) {
          tempStreakStart = date; // Start of a new streak
        }
        tempStreak++;
      } else {
        tempStreak = 1;
        tempStreakStart = date; // Start of a new streak
      }

      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStreakStart = tempStreakStart;
        longestStreakEnd = date;
      }
    } else {
      tempStreak = 0;
    }
    prevDate = date;
  }

  // Format dates for display - include year only for first contribution
  return {
    currentStreak,
    longestStreak,
    totalContributions,
    firstContribution: formatDateForDisplay(firstContribution, true), // Include year
    currentStreakStart: formatDateForDisplay(currentStreakStart),
    currentStreakEnd: formatDateForDisplay(currentStreakEnd),
    longestStreakStart: formatDateForDisplay(longestStreakStart),
    longestStreakEnd: formatDateForDisplay(longestStreakEnd),
  };
}

/**
 * Fetch the user's all-time contribution streak data.
 * @param {string} username
 * @param {string} token
 * @returns {Promise<{
 *   currentStreak: number,
 *   longestStreak: number,
 *   totalContributions: number,
 *   firstContribution: string,
 *   currentStreakStart: string,
 *   currentStreakEnd: string,
 *   longestStreakStart: string,
 *   longestStreakEnd: string
 * }>}
 */
const fetchStreak = async (username, token) => {
  if (!username) {
    throw new CustomError(
      "Missing username parameter",
      CustomError.USER_NOT_FOUND,
    );
  }

  try {
    // 1. Get all years (1 request)
    const years = await fetchContributionYears(username, token);

    // 2. Fetch all years in a single request using aliases (1 request)
    // This reduces API calls from N+1 to just 2
    const contributions = await fetchAllYearsCalendar(username, years, token);

    // 3. Calculate streaks and totals
    return calculateStreaks(contributions);
  } catch (err) {
    logger.error(err);
    throw new CustomError(
      err?.message || "Could not fetch streak data.",
      CustomError.GRAPHQL_ERROR,
    );
  }
};

export { fetchStreak };
export default fetchStreak;
