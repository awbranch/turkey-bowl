/** ISO date (YYYY-MM-DD) of the Friday after US Thanksgiving (4th Thursday of November). */
export function dayAfterThanksgiving(year: number): string {
  const nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 = Sunday
  const firstThursday = 1 + ((4 - nov1 + 7) % 7);
  const friday = firstThursday + 21 + 1;
  return `${year}-11-${String(friday).padStart(2, "0")}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Whole years old on `onDate` (both ISO dates). */
export function ageOn(birthdate: string, onDate: string): number {
  const [by, bm, bd] = birthdate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDate.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}
