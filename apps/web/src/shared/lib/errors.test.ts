import { describe, expect, it } from 'vitest';
import { toAppError } from './errors';

describe('toAppError', () => {
  it('menerjemahkan kode bisnis dari message PostgreSQL, bukan SQLSTATE', () => {
    expect(toAppError({ code: 'P0001', message: 'SHIFT_NOT_OPEN' })).toMatchObject({
      code: 'SHIFT_NOT_OPEN',
      message: 'Belum ada shift terbuka.',
      retryable: false,
    });
  });

  it('menandai timeout dan error server sebagai dapat dicoba ulang', () => {
    expect(toAppError(new DOMException('Waktu habis', 'AbortError')).retryable).toBe(true);
    expect(toAppError({ code: '500', message: 'Server error', status: 500 }).retryable).toBe(true);
  });

  it('mengembalikan error unknown untuk kode yang tidak dikenal', () => {
    expect(toAppError({ code: 'P0001', message: 'INTERNAL_DETAIL' })).toMatchObject({
      code: 'UNKNOWN',
      retryable: false,
    });
  });
});
