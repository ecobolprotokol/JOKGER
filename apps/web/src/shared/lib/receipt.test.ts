import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeReceipt, fallbackPrintReceipt, printReceipt, type ReceiptData } from './receipt';

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
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'bluetooth');
  });

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

  it('mencetak detail struk lengkap ke encoder dan fallback HTML', () => {
    const detailedReceipt: ReceiptData = {
      ...receipt,
      address: 'Jalan Uji',
      phone: '081234567890',
      tableLabel: 'A1',
      customerName: 'Pelanggan',
      receiptHeader: 'Header Kedai',
      receiptFooter: 'Footer Kedai',
      discountTotal: 1000,
      voucherCode: 'HEMAT',
      serviceAmount: 500,
      taxAmount: 250,
      roundingAmount: 50,
      payments: [
        { method: 'cash', amount: 12000, receivedAmount: 15000, changeAmount: 3000 },
        {
          method: 'transfer',
          amount: 1000,
          referenceNo: '<ref>',
          accountName: '<bank>',
          accountNo: '123456',
        },
        { method: 'ewallet', amount: 500 },
      ],
    };
    const encoded = encodeReceipt(detailedReceipt, 80);
    const document = { write: vi.fn(), close: vi.fn() };
    const printWindow = { document, focus: vi.fn(), print: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(printWindow);

    fallbackPrintReceipt(detailedReceipt);

    const html = document.write.mock.calls[0]?.[0] as string;
    expect(encoded.byteLength).toBeGreaterThan(0);
    expect(html).toContain('Header Kedai');
    expect(html).toContain('Jalan Uji');
    expect(html).toContain('Meja: A1');
    expect(html).toContain('Diskon (HEMAT)');
    expect(html).toContain('Layanan');
    expect(html).toContain('Pajak');
    expect(html).toContain('Pembulatan');
    expect(html).toContain('Kembalian:');
    expect(html).toContain('&lt;ref&gt;');
    expect(html).toContain('Footer Kedai');
  });

  it('menangani printer Bluetooth yang tidak tersedia atau tidak memiliki GATT', async () => {
    await expect(printReceipt(receipt)).rejects.toThrow('tidak didukung');
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: { requestDevice: vi.fn().mockResolvedValue({}) },
    });
    await expect(printReceipt(receipt)).rejects.toThrow('tidak menyediakan koneksi Bluetooth');
  });

  it('mengirim struk per potongan dan selalu memutuskan koneksi', async () => {
    const characteristic = { writeValue: vi.fn().mockResolvedValue(undefined) };
    const service = { getCharacteristic: vi.fn().mockResolvedValue(characteristic) };
    const server = { getPrimaryService: vi.fn().mockResolvedValue(service) };
    const gatt = { connect: vi.fn().mockResolvedValue(server), disconnect: vi.fn() };
    const bluetooth = { requestDevice: vi.fn().mockResolvedValue({ gatt }) };
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: bluetooth });
    vi.spyOn(window, 'setTimeout').mockImplementation((handler: TimerHandler) => {
      if (typeof handler === 'function') handler();
      return 1;
    });
    const longReceipt: ReceiptData = {
      ...receipt,
      items: Array.from({ length: 20 }, (_, index) => ({
        ...receipt.items[0]!,
        name: `Menu ${index}`,
      })),
    };

    await printReceipt(longReceipt);

    expect(characteristic.writeValue.mock.calls.length).toBeGreaterThan(1);
    expect(gatt.disconnect).toHaveBeenCalledOnce();
  });
});
