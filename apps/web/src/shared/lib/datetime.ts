export const TIME_ZONE = 'Asia/Jakarta';

export function getJakartaNow(): Date {
  return new Date();
}

export function toJakartaDate(date: Date): Date {
  const jakartaString = date.toLocaleString('en-US', { timeZone: TIME_ZONE });
  return new Date(jakartaString);
}

export function startOfDayJakarta(date: Date): Date {
  const jakarta = toJakartaDate(date);
  jakarta.setHours(0, 0, 0, 0);
  return jakarta;
}

export function endOfDayJakarta(date: Date): Date {
  const jakarta = toJakartaDate(date);
  jakarta.setHours(23, 59, 59, 999);
  return jakarta;
}

export function formatDateForInput(date: Date): string {
  const jakarta = toJakartaDate(date);
  const year = jakarta.getFullYear();
  const month = String(jakarta.getMonth() + 1).padStart(2, '0');
  const day = String(jakarta.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function getTodayJakarta(): Date {
  return startOfDayJakarta(getJakartaNow());
}

export function addDaysJakarta(date: Date, days: number): Date {
  const jakarta = toJakartaDate(date);
  jakarta.setDate(jakarta.getDate() + days);
  return jakarta;
}
