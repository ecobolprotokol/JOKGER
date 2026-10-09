import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeReceipt, fallbackPrintReceipt, type ReceiptData } from './receipt';

const receipt: ReceiptData = {
  storeName: 'JOKGER',
  orderNo: 'JKG-20261009-0001',
  orderType: 'takeaway',
  items: [
    {
      name: '<img src=x onerror=alert(1)>',
      qty: 1,
      unitPrice: 12_500,
      modifierLabels: ['<script>alert(1)</script>'],
      note: '<svg onload=alert(1)>',
      lineTotal: 12_500,
    },
  ],
  subtotal: 12_500,
  discountTotal: 0,
  serviceAmount: 0,
  taxAmount: 0,
  roundingAmount: 0,
  grandTotal: 12_500,
  payments: [],
  createdAt: new Date('2026-10-09T00:00:00.000Z'),
  cashierName: 'Kasir',
};

describe('receipt printer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encodes a receipt with the installed v3 encoder API', () => {
    const encoded = encodeReceipt(receipt);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.byteLength).toBeGreaterThan(0);
  });

  it('escapes user-controlled content before browser printing', () => {
    const document = { write: vi.fn(), close: vi.fn() };
    const printWindow = {
      document,
      focus: vi.fn(),
      print: vi.fn(),
    } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    fallbackPrintReceipt(receipt);

    const html = document.write.mock.calls[0]?.[0] as string;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
