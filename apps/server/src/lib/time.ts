/** Local calendar date (YYYY-MM-DD) in the founder's timezone. */
export function localDate(timezone = 'UTC', at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function localTime(timezone = 'UTC', at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(at);
  } catch {
    return at.toISOString();
  }
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
