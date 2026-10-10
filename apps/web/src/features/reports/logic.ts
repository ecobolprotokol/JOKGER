import { reportRangeSchema, type ReportRange, type SalesReport } from './schemas';

export function inclusiveRangeDays(range: ReportRange): number | null {
  if (!reportRangeSchema.safeParse(range).success || range.from > range.to) return null;
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000) + 1;
}

export function hourlySeries(report: SalesReport): { labels: string[]; values: number[] } {
  const totals = new Map(report.hourly.map((entry) => [entry.hour, entry.totalSales]));
  return {
    labels: Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
    values: Array.from({ length: 24 }, (_, hour) => totals.get(hour) ?? 0),
  };
}

export function jakartaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
