// "Today" and "this week" are from sher's point of view (Asia/Jerusalem), not
// the server's local time. Postgres timestamptz columns come back as real JS
// Date objects, so these helpers just need to produce a correct UTC instant
// for "midnight in Jerusalem" — no string-format juggling required.

const TZ = "Asia/Jerusalem";

function jerusalemOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const match = tzName.match(/GMT([+-]\d+)(?::(\d+))?/);
  const hours = match ? parseInt(match[1], 10) : 2;
  const minutes = match?.[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

/** Start of "today" in Jerusalem time, as a real UTC Date instant. */
export function startOfToday(now = new Date()): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now); // YYYY-MM-DD
  const offsetMin = jerusalemOffsetMinutes(now);
  const localMidnightUtcMs = Date.parse(`${dateStr}T00:00:00Z`) - offsetMin * 60000;
  return new Date(localMidnightUtcMs);
}

/** Start of the current week (Sunday) in Jerusalem time, as a real UTC Date instant. */
export function startOfWeek(now = new Date()): Date {
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(
    now
  );
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysSinceSunday = Math.max(order.indexOf(weekdayName), 0);
  const today = startOfToday(now);
  today.setUTCDate(today.getUTCDate() - daysSinceSunday);
  return today;
}
