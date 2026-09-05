/**
 * Helper utilities for timezone-safe date calculations and formatting.
 */

/**
 * Converts a Date object to local "YYYY-MM-DD" string without timezone conversion shift.
 * Standard d.toISOString() converts to UTC, causing local midnight in positive offsets (e.g. IST +5:30)
 * or negative offsets to shift to the previous day or next day.
 */
export function formatLocalDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a "YYYY-MM-DD" date string (or ISO date string) safely for display without timezone offset shift.
 * Standard `new Date("2026-08-12")` parses date-only ISO strings in UTC.
 * Calling `.toLocaleDateString()` on a UTC date in negative timezones (e.g. EDT -4:00) converts UTC 00:00 to previous day (Aug 11).
 * This function constructs a local Date instance to preserve exact calendar dates.
 */
export function formatDisplayDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "";

  const cleanStr = dateStr.split("T")[0];
  const parts = cleanStr.split("-").map(Number);

  if (parts.length === 3 && !parts.some(isNaN)) {
    const [year, month, day] = parts;
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString("default", options || {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const fallbackDate = new Date(dateStr);
  return isNaN(fallbackDate.getTime())
    ? dateStr
    : fallbackDate.toLocaleDateString("default", options);
}
