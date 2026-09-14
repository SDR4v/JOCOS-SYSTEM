// Standard Philippine holidays, computed for any year. Fixed regular
// holidays are set by law (RA 9849 and related issuances) and don't change
// year to year; movable ones (Holy Week, Chinese New Year, National Heroes
// Day) are computed below. Note: the exact yearly list of SPECIAL_NON_WORKING
// days is set by a Malacañang proclamation issued each year — the ones
// below are the ones that recur almost every year, but an admin should
// still check the actual proclamation for the year in question and add or
// remove entries as needed.

export type StandardHoliday = {
  month: number; // 1-12
  day: number;
  name: string;
  type: "REGULAR" | "SPECIAL_NON_WORKING";
};

// Meeus/Jones/Butcher Gregorian algorithm for the date of Easter Sunday.
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function addDays(month: number, day: number, year: number, delta: number): { month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function lastMondayOfAugust(year: number): number {
  const lastDay = new Date(Date.UTC(year, 8, 0)).getUTCDate(); // last day of August
  const lastDate = new Date(Date.UTC(year, 7, lastDay));
  const offset = (lastDate.getUTCDay() + 6) % 7; // days since the most recent Monday
  return lastDay - offset;
}

// Lunar New Year has no simple formula — known dates only, sourced from
// published astronomical calendars. Years outside this table are skipped.
const CHINESE_NEW_YEAR: Record<number, { month: number; day: number }> = {
  2024: { month: 2, day: 10 },
  2025: { month: 1, day: 29 },
  2026: { month: 2, day: 17 },
  2027: { month: 2, day: 6 },
  2028: { month: 1, day: 26 },
  2029: { month: 2, day: 13 },
  2030: { month: 2, day: 3 },
  2031: { month: 1, day: 23 },
  2032: { month: 2, day: 11 },
};

export function getStandardPhilippineHolidays(year: number): StandardHoliday[] {
  const easter = easterSunday(year);
  const maundyThursday = addDays(easter.month, easter.day, year, -3);
  const goodFriday = addDays(easter.month, easter.day, year, -2);
  const blackSaturday = addDays(easter.month, easter.day, year, -1);

  const holidays: StandardHoliday[] = [
    { month: 1, day: 1, name: "New Year's Day", type: "REGULAR" },
    { month: 4, day: 9, name: "Araw ng Kagitingan", type: "REGULAR" },
    { month: maundyThursday.month, day: maundyThursday.day, name: "Maundy Thursday", type: "REGULAR" },
    { month: goodFriday.month, day: goodFriday.day, name: "Good Friday", type: "REGULAR" },
    { month: blackSaturday.month, day: blackSaturday.day, name: "Black Saturday", type: "SPECIAL_NON_WORKING" },
    { month: 5, day: 1, name: "Labor Day", type: "REGULAR" },
    { month: 6, day: 12, name: "Independence Day", type: "REGULAR" },
    { month: 8, day: lastMondayOfAugust(year), name: "National Heroes Day", type: "REGULAR" },
    { month: 8, day: 21, name: "Ninoy Aquino Day", type: "SPECIAL_NON_WORKING" },
    { month: 11, day: 1, name: "All Saints' Day", type: "SPECIAL_NON_WORKING" },
    { month: 11, day: 2, name: "All Souls' Day", type: "SPECIAL_NON_WORKING" },
    { month: 11, day: 30, name: "Bonifacio Day", type: "REGULAR" },
    { month: 12, day: 8, name: "Feast of the Immaculate Conception", type: "SPECIAL_NON_WORKING" },
    { month: 12, day: 24, name: "Christmas Eve", type: "SPECIAL_NON_WORKING" },
    { month: 12, day: 25, name: "Christmas Day", type: "REGULAR" },
    { month: 12, day: 30, name: "Rizal Day", type: "REGULAR" },
    { month: 12, day: 31, name: "Last Day of the Year", type: "SPECIAL_NON_WORKING" },
  ];

  const cny = CHINESE_NEW_YEAR[year];
  if (cny) {
    holidays.push({ month: cny.month, day: cny.day, name: "Chinese New Year", type: "SPECIAL_NON_WORKING" });
  }

  return holidays.sort((a, b) => a.month - b.month || a.day - b.day);
}
