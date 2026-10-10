export type PrintJob = {
  orderNo: string;
  type: 'receipt' | 'shift_summary';
  createdAt: string;
};

export const PRINT_QUEUE_KEY = 'jokger.print-queue.v1';
const MAX_PRINT_JOBS = 20;

function parseJobs(value: string | null): PrintJob[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((entry): PrintJob[] => {
        if (typeof entry !== 'object' || entry === null) return [];
        if (!('orderNo' in entry) || typeof entry.orderNo !== 'string') return [];
        if (!('type' in entry) || (entry.type !== 'receipt' && entry.type !== 'shift_summary'))
          return [];
        if (!('createdAt' in entry) || typeof entry.createdAt !== 'string') return [];
        return [{ orderNo: entry.orderNo, type: entry.type, createdAt: entry.createdAt }];
      })
      .slice(-MAX_PRINT_JOBS);
  } catch {
    return [];
  }
}

export function readPrintQueue(storage: Storage = localStorage): PrintJob[] {
  return parseJobs(storage.getItem(PRINT_QUEUE_KEY));
}

export function enqueuePrintJob(
  job: PrintJob,
  storage: Storage = localStorage,
): { jobs: PrintJob[]; droppedOldest: boolean } {
  const current = readPrintQueue(storage);
  const next = [...current, job];
  const droppedOldest = next.length > MAX_PRINT_JOBS;
  const jobs = next.slice(-MAX_PRINT_JOBS);
  storage.setItem(PRINT_QUEUE_KEY, JSON.stringify(jobs));
  return { jobs, droppedOldest };
}

export function removePrintJob(index: number, storage: Storage = localStorage): PrintJob[] {
  const jobs = readPrintQueue(storage).filter((_job, jobIndex) => jobIndex !== index);
  storage.setItem(PRINT_QUEUE_KEY, JSON.stringify(jobs));
  return jobs;
}
