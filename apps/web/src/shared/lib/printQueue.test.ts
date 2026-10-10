import { describe, expect, it } from 'vitest';
import { enqueuePrintJob, PRINT_QUEUE_KEY, readPrintQueue, removePrintJob } from './printQueue';

function createStorage(): Storage {
  const values: Array<[string, string]> = [];
  return {
    get length() {
      return values.length;
    },
    clear: () => values.splice(0),
    getItem: (key) => values.find(([storedKey]) => storedKey === key)?.[1] ?? null,
    key: (index) => values[index]?.[0] ?? null,
    removeItem: (key) => {
      const index = values.findIndex(([storedKey]) => storedKey === key);
      if (index >= 0) values.splice(index, 1);
    },
    setItem: (key, value) => {
      const index = values.findIndex(([storedKey]) => storedKey === key);
      if (index >= 0) values[index] = [key, value];
      else values.push([key, value]);
    },
  };
}

describe('print queue', () => {
  it('stores only order number, type, and timestamp', () => {
    const storage = createStorage();
    enqueuePrintJob(
      { orderNo: 'JKG-20261010-0001', type: 'receipt', createdAt: '2026-10-10T03:00:00Z' },
      storage,
    );

    const stored = storage.getItem(PRINT_QUEUE_KEY) ?? '';
    expect(stored).toContain('JKG-20261010-0001');
    expect(stored).not.toContain('items');
    expect(stored).not.toContain('grand_total');
    expect(readPrintQueue(storage)).toHaveLength(1);
  });

  it('keeps at most twenty recent jobs and reports an evicted oldest job', () => {
    const storage = createStorage();
    for (let index = 1; index <= 20; index += 1) {
      enqueuePrintJob(
        { orderNo: `ORDER-${index}`, type: 'receipt', createdAt: `${index}` },
        storage,
      );
    }
    const result = enqueuePrintJob(
      { orderNo: 'ORDER-21', type: 'receipt', createdAt: '21' },
      storage,
    );
    expect(result.droppedOldest).toBe(true);
    expect(result.jobs).toHaveLength(20);
    expect(result.jobs[0]?.orderNo).toBe('ORDER-2');
  });

  it('removes a selected job and treats malformed local data as an empty queue', () => {
    const storage = createStorage();
    storage.setItem(PRINT_QUEUE_KEY, '{invalid');
    expect(readPrintQueue(storage)).toEqual([]);
    enqueuePrintJob({ orderNo: 'ORDER-1', type: 'receipt', createdAt: 'now' }, storage);
    enqueuePrintJob({ orderNo: 'ORDER-2', type: 'receipt', createdAt: 'later' }, storage);
    expect(removePrintJob(0, storage).map((job) => job.orderNo)).toEqual(['ORDER-2']);
  });
});
