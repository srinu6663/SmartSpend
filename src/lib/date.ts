/**
 * Local-timezone date helpers.
 *
 * Every date in this app is a calendar day (`date` column, `YYYY-MM-DD`) — not
 * an instant. `Date.prototype.toISOString()` converts to UTC first, which makes
 * it the wrong tool for that job and was the source of several off-by-one-day
 * bugs:
 *
 *   - In IST (UTC+5:30), `startOfMonth(new Date()).toISOString()` on the 1st
 *     returns the PREVIOUS month's last day — so the Budgets page asked for a
 *     month key that no budget row used.
 *   - "Today"/"Yesterday" headers flipped between 00:00 and 05:30 IST.
 *   - Chart buckets and next-billing dates landed a day early.
 *
 * Always use these helpers to turn a Date into a day string.
 */

/** `YYYY-MM-DD` from the date's LOCAL calendar parts. */
export const toDateString = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** First day of the given date's month, as `YYYY-MM-01`. */
export const monthKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

/**
 * Parses a `YYYY-MM-DD` day string into a local-midnight Date.
 * Bare `new Date("2024-03-01")` is parsed as UTC midnight; appending the time
 * makes the runtime treat it as local, which is what a calendar day means here.
 */
export const parseDateString = (value: string): Date => new Date(`${value.slice(0, 10)}T00:00:00`);

/** True when the day string is today in the user's timezone. */
export const isToday = (value: string): boolean => value.slice(0, 10) === toDateString();

/** True when the day string is yesterday in the user's timezone. */
export const isYesterday = (value: string): boolean => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return value.slice(0, 10) === toDateString(d);
};
