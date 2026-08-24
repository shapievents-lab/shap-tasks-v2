// Event dates are stored as free-form text so a project can be scheduled precisely
// (YYYY-MM-DD) or loosely (just "YYYY-MM" when only the month is known, or any other
// free text for things like "תחילת נובמבר"). Text sorting already keeps YYYY-MM and
// YYYY-MM-DD values in correct chronological order relative to each other (a bare
// month sorts just before any specific day within that same month), so no schema
// change is needed for correct ordering — only formatting for display.

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

/** Formats a stored event-date string for display. Recognizes YYYY-MM-DD ("5.11.2026"),
 * YYYY-MM ("נובמבר 2026"), and falls back to showing whatever free text was entered. */
export function formatEventDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const full = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    return `${full[3]}.${full[2]}.${full[1]}`;
  }

  const monthOnly = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly) {
    const monthIdx = parseInt(monthOnly[2], 10) - 1;
    const monthName = HEBREW_MONTHS[monthIdx];
    return monthName ? `${monthName} ${monthOnly[1]}` : trimmed;
  }

  return trimmed;
}

/** Formats a start/end pair for display, collapsing to a single date when they match. */
export function formatEventRange(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const startLabel = formatEventDate(start);
  if (!startLabel) return null;
  const endLabel = end && end !== start ? formatEventDate(end) : null;
  return endLabel ? `${startLabel} – ${endLabel}` : startLabel;
}
