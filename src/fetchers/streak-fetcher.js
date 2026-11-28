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
 * Fetch contribution calendars for all years in a single GraphQL query using aliases.
 * Avoids N+1 requests and drastically improves performance.
 */
async function fetchAllYearsCalendar(username, years, token) {
  const fragments = years
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
        ${fragments}
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

  const contributions = {};
  for (const year of years) {
    const weeks = user[`y${year}`]?.contributionCalendar?.weeks || [];
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        if (day.contributionCount > 0) {
          contributions[day.date] = day.contributionCount;
        }
      }
    }
  }

  return contributions;
}

/**
 * Format a date for display (YYYY-MM-DD to "MMM D" or "MMM D, YYYY").
 */
function formatDateForDisplay(dateString, includeYear = false) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

/**
 * Whether `timeZone` is an IANA time zone name that Intl accepts, such as
 * "Asia/Kolkata" or "UTC".
 * @param {string} timeZone
 * @returns {boolean}
 */
function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone === "") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The calendar date (YYYY-MM-DD) of `date` in `timeZone`.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {string}
 */
function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Calculate streaks and totals from all contribution days. "Today" and
 * "yesterday" are the calendar days in `timeZone` (UTC by default).
 * @param {Record<string, number>} contributions
 * @param {string} [timeZone]
 * @param {Date} [now]
 */
function calculateStreaks(contributions, timeZone = "UTC", now = new Date()) {
  const dates = Object.keys(contributions).sort();
  if (dates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalContributions: 0,
      firstContribution: "",
      currentStreakStart: "",
      currentStreakEnd: "",
      longestStreakStart: "",
      longestStreakEnd: "",
    };
  }

  let totalContributions = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;
  let currentStreak = 0;

  let currentStreakStart = null;
  let currentStreakEnd = null;
  let longestStreakStart = null;
  let longestStreakEnd = null;

  // find first contribution date
  const firstContribution = dates.find((d) => contributions[d] > 0);

  // today and yesterday in the requested time zone
  const today = dateInTimeZone(now, timeZone);
  const yesterdayDate = new Date(today + "T00:00:00Z");
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  for (const date of dates) totalContributions += contributions[date];

  // Determine current streak starting point
  const todayCount = contributions[today] || 0;
  const yesterdayCount = contributions[yesterday] || 0;
  let startDate = todayCount > 0 ? today : yesterdayCount > 0 ? yesterday : null;

  // Walk backward for current streak
  if (startDate) {
    let d = new Date(startDate + "T00:00:00Z");
    while (true) {
      const dateStr = d.toISOString().split("T")[0];
      const count = contributions[dateStr];
      if (count && count > 0) {
        currentStreak++;
        currentStreakEnd ??= dateStr;
        currentStreakStart = dateStr;
        d.setUTCDate(d.getUTCDate() - 1);
      } else break;
    }
  }

  // longest streak
  tempStreak = 0;
  prevDate = null;
  let tempStreakStart = null;

  for (const date of dates) {
    const count = contributions[date];
    if (count > 0) {
      const gap =
        prevDate == null
          ? 1
          : (new Date(date) - new Date(prevDate)) / (1000 * 60 * 60 * 24);
      if (gap === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
        tempStreakStart = date;
      }

      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
        longestStreakStart = tempStreakStart || date;
        longestStreakEnd = date;
      }
    } else {
      tempStreak = 0;
    }
    prevDate = date;
  }

  const currentYear = Number(today.slice(0, 4));
  const longestEndIncludeYear = longestStreakEnd && new Date(longestStreakEnd).getUTCFullYear() !== currentYear;

  return {
    currentStreak,
    longestStreak,
    totalContributions,
    firstContribution: formatDateForDisplay(firstContribution, true),
    currentStreakStart: formatDateForDisplay(currentStreakStart, true),
    currentStreakEnd: formatDateForDisplay(currentStreakEnd),
    longestStreakStart: formatDateForDisplay(longestStreakStart, true),
    longestStreakEnd: formatDateForDisplay(longestStreakEnd, longestEndIncludeYear),
  };
}

/**
 * Fetch the user's all-time contribution streak data.
 * Optimized for performance (2 GraphQL calls total).
 */
const fetchStreak = async (username, token, timeZone = "UTC") => {
  if (!username) {
    throw new CustomError("Missing username parameter", CustomError.USER_NOT_FOUND);
  }

  try {
    // 1. fetch all contribution years
    const years = await fetchContributionYears(username, token);
    if (!years || years.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalContributions: 0,
        firstContribution: "",
        currentStreakStart: "",
        currentStreakEnd: "",
        longestStreakStart: "",
        longestStreakEnd: "",
      };
    }

    // 2. single query for all years (alias-based)
    const contributions = await fetchAllYearsCalendar(username, years, token);

    // 3. compute streaks
    return calculateStreaks(contributions, timeZone);
  } catch (err) {
    logger.error(err);
    throw new CustomError(
      err?.message || "Could not fetch streak data.",
      CustomError.GRAPHQL_ERROR,
    );
  }
};

export { fetchStreak, formatDateForDisplay, calculateStreaks, isValidTimeZone };
export default fetchStreak;
