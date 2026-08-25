const { Op } = require("sequelize");

// Morocco (Africa/Casablanca) — UTC+1 year-round since 2018
const TZ_OFFSET_HOURS = 1;

/**
 * UTC datetime bounds for one calendar day in local business timezone.
 * @param {string} dateStr - YYYY-MM-DD
 */
function buildLocalDayBounds(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day, -TZ_OFFSET_HOURS, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(year, month - 1, day, 23 - TZ_OFFSET_HOURS, 59, 59, 999),
  );
  return { start, end };
}

/**
 * Sequelize date filter using local calendar-day boundaries.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
function buildLocalDateFilter(startDate, endDate) {
  const { start } = buildLocalDayBounds(startDate);
  const { end } = buildLocalDayBounds(endDate);
  return {
    [Op.gte]: start,
    [Op.lte]: end,
  };
}

function isDateInLocalRange(dateValue, startDate, endDate) {
  if (!dateValue || !startDate || !endDate) return false;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return false;
  const { start } = buildLocalDayBounds(startDate);
  const { end } = buildLocalDayBounds(endDate);
  return time >= start.getTime() && time <= end.getTime();
}

module.exports = {
  TZ_OFFSET_HOURS,
  buildLocalDayBounds,
  buildLocalDateFilter,
  isDateInLocalRange,
};
