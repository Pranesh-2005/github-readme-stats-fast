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
    { Authorization: `bearer ${token}` }
  );
  const user = res?.data?.user || res?.data?.data?.user;
  if (!user) throw new CustomError("Could not fetch user.", CustomError.USER_NOT_FOUND);
  return user.contributionsCollection.contributionYears;
}

/**
 * Fetch contribution calendar for a given year.
 * @param {string} username
 * @param {number} year
 * @param {string} token
 * @returns {Promise<any[]>}
 */
async function fetchYearCalendar(username, year, token) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;
  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;
  const res = await request(
    { query, variables: { login: username, from, to } },
    { Authorization: `bearer ${token}` }
  );
  const user = res?.data?.user || res?.data?.data?.user;
  if (!user) throw new CustomError("Could not fetch user.", CustomError.USER_NOT_FOUND);
  return user.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
}

/**
 * Format a date for display (YYYY-MM-DD to MMM D or MMM D, YYYY)
 * @param {string} dateString - ISO date string
 * @param {boolean} includeYear - Whether to include the year
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(dateString, includeYear = false) {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  if (includeYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .split("T")[0];

  // Calculate total contributions
  for (const date of dates) {
    totalContributions += contributions[date];
  }

  // Calculate current streak: walk backward from today until a zero is found
  let currentStreak = 0;
  let streaking = true;
  for (let i = dates.length - 1; i >= 0; i--) {
    const date = dates[i];
    const count = contributions[date];

    // Only count up to today (not future dates)
    if (date > today) continue;

    if (streaking) {
      if (count > 0) {
        currentStreak++;
        
        // Track the current streak range
        if (currentStreakEnd === null) {
          currentStreakEnd = date;
        }
        currentStreakStart = date;
      } else {
        // Only break if date is today or before
        if (date === today || date < today) {
          streaking = false;
        }
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
      if (prevDate === null || 
          (new Date(date) - new Date(prevDate)) / (1000 * 60 * 60 * 24) === 1) {
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
    throw new CustomError("Missing username parameter", CustomError.USER_NOT_FOUND);
  }

  try {
    // 1. Get all years
    const years = await fetchContributionYears(username, token);

    // 2. Fetch all days for all years and build a date->count map
    let contributions = {};
    for (const year of years) {
      const days = await fetchYearCalendar(username, year, token);
      for (const day of days) {
        contributions[day.date] = day.contributionCount;
      }
    }

    // 3. Calculate streaks and totals
    return calculateStreaks(contributions);
  } catch (err) {
    logger.error(err);
    throw new CustomError(
      err?.message || "Could not fetch streak data.",
      CustomError.GRAPHQL_ERROR
    );
  }
};

export { fetchStreak };
export default fetchStreak;