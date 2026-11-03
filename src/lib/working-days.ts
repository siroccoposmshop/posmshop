// Working days are Monday–Friday (the UAE weekend is Saturday and Sunday). Dates are "yyyy-mm-dd".

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** Today's date in Dubai. */
export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

/** The date `days` working days after `from` (a stage of 5 days starting Monday is due the next Monday). */
export function addWorkingDays(from: string, days: number) {
  const d = toDate(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) left--;
  }
  return toIso(d);
}

/** Working days from `from` to `to` (negative when `to` is earlier). */
export function workingDaysBetween(from: string, to: string) {
  if (from === to) return 0;
  const sign = from < to ? 1 : -1;
  const [a, b] = sign > 0 ? [toDate(from), toDate(to)] : [toDate(to), toDate(from)];
  let n = 0;
  while (a < b) {
    a.setUTCDate(a.getUTCDate() + 1);
    if (!isWeekend(a)) n++;
  }
  return n * sign;
}

/** Plans stages back to back from a start date: each is due `days` working days after the previous. */
export function planStages<T extends { days: number }>(start: string, stages: T[]) {
  let at = start;
  return stages.map((s) => {
    at = addWorkingDays(at, s.days);
    return { ...s, due_date: at };
  });
}
