import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import { formatRupiah } from './format';

type ReceiptEncoderAdapter = ReceiptPrinterEncoder & {
  setAlignment: (value: 'left' | 'center' | 'right') => ReceiptEncoderAdapter;
  setTextSize: (width: number, height: number) => ReceiptEncoderAdapter;
  write: (value: string) => ReceiptEncoderAdapter;
  feed: (lines: number) => ReceiptEncoderAdapter;
};

type PrinterCharacteristic = { writeValue: (value: Uint8Array) => Promise<void> };
type PrinterService = {
  getCharacteristic: (characteristic: string) => Promise<PrinterCharacteristic>;
};
type PrinterGattServer = { getPrimaryService: (service: string) => Promise<PrinterService> };
type PrinterDevice = {
  gatt?: {
    connect: () => Promise<PrinterGattServer>;
    disconnect: () => void;
  };
};
type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice: (options: {
      filters: Array<{ services: string[] }>;
      optionalServices: string[];
    }) => Promise<PrinterDevice>;
  };
};

export interface ReceiptData {
  storeName: string;
  address?: string;
  phone?: string;
  orderNo: string;
  orderType: 'dine_in' | 'takeaway';
  tableLabel?: string | null;
  customerName?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  serviceAmount: number;
  taxAmount: number;
  roundingAmount: number;
  grandTotal: number;
  voucherCode?: string | null;
  voucherDiscount?: number;
  payments: ReceiptPayment[];
  createdAt: Date;
  cashierName: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  modifierLabels: string[];
  note?: string | null;
  lineTotal: number;
}

export interface ReceiptPayment {
  method: 'cash' | 'transfer' | 'ewallet';
  amount: number;
  receivedAmount?: number | null;
  changeAmount?: number;
  referenceNo?: string | null;
  accountName?: string;
  accountNo?: string;
}

const PAPER_WIDTHS = {
  58: 32,
  80: 48,
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createReceiptEncoder(): ReceiptEncoderAdapter {
  const encoder = new ReceiptPrinterEncoder() as ReceiptEncoderAdapter;
  encoder.setAlignment = (value) => encoder.align(value);
  encoder.setTextSize = (width, height) => encoder.size(width, height);
  encoder.write = (value) => encoder.text(value);
  encoder.feed = (lines) => encoder.newline(lines);
  return encoder;
}

export function encodeReceipt(data: ReceiptData, paperWidthMm: 58 | 80 = 58): Uint8Array {
  const encoder = createReceiptEncoder();
  const width = PAPER_WIDTHS[paperWidthMm];

  encoder.initialize();
  encoder.setAlignment('center');

  if (data.receiptHeader) {
    encoder.setTextSize(1, 1);
    encoder.write(data.receiptHeader);
    encoder.feed(1);
  }

  encoder.setTextSize(2, 2);
  encoder.write(data.storeName);
  encoder.feed(1);

  encoder.setTextSize(1, 1);
  if (data.address) {
    encoder.write(data.address);
  }
  if (data.phone) {
    encoder.write(`Telp: ${data.phone}`);
  }
  encoder.feed(1);

  encoder.setAlignment('left');
  encoder.write('='.repeat(width));
  encoder.feed(1);

  encoder.write(`No. Pesanan: ${data.orderNo}`);
  encoder.feed(1);
  encoder.write(`Tipe: ${data.orderType === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}`);
  if (data.tableLabel) {
    encoder.write(`Meja: ${data.tableLabel}`);
  }
  if (data.customerName) {
    encoder.write(`Pelanggan: ${data.customerName}`);
  }
  encoder.write(`Kasir: ${data.cashierName}`);
  encoder.write(`Waktu: ${data.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
  encoder.feed(1);
  encoder.write('-'.repeat(width));
  encoder.feed(1);

  for (const item of data.items) {
    encoder.write(`${item.qty}x ${item.name}`);
    encoder.feed(1);
    if (item.modifierLabels.length > 0) {
      encoder.write(`  ${item.modifierLabels.join(', ')}`);
      encoder.feed(1);
    }
    if (item.note) {
      encoder.write(`  Catatan: ${item.note}`);
      encoder.feed(1);
    }
    encoder.setAlignment('right');
    encoder.write(formatRupiah(item.lineTotal));
    encoder.setAlignment('left');
    encoder.feed(1);
  }

  encoder.write('-'.repeat(width));
  encoder.feed(1);

  const printLine = (label: string, value: number) => {
    encoder.setAlignment('left');
    encoder.write(label);
    encoder.setAlignment('right');
    encoder.write(formatRupiah(value));
    encoder.setAlignment('left');
    encoder.feed(1);
  };

  printLine('Subtotal', data.subtotal);
  if (data.discountTotal > 0) {
    if (data.voucherCode) {
      printLine(`Diskon (${data.voucherCode})`, -data.discountTotal);
    } else {
      printLine('Diskon', -data.discountTotal);
    }
  }
  if (data.serviceAmount > 0) {
    printLine('Layanan', data.serviceAmount);
  }
  if (data.taxAmount > 0) {
    printLine('Pajak', data.taxAmount);
  }
  if (data.roundingAmount !== 0) {
    printLine('Pembulatan', data.roundingAmount);
  }

  encoder.write('='.repeat(width));
  encoder.feed(1);
  printLine('TOTAL', data.grandTotal);
  encoder.write('='.repeat(width));
  encoder.feed(1);

  encoder.write('PEMBAYARAN:');
  encoder.feed(1);
  for (const payment of data.payments) {
    const methodLabel =
      payment.method === 'cash' ? 'Tunai' : payment.method === 'transfer' ? 'Transfer' : 'E-Wallet';
    encoder.write(`${methodLabel}: ${formatRupiah(payment.amount)}`);
    encoder.feed(1);
    if (payment.method === 'cash' && payment.receivedAmount != null) {
      encoder.write(`  Diterima: ${formatRupiah(payment.receivedAmount)}`);
      encoder.feed(1);
      if ((payment.changeAmount ?? 0) > 0) {
        encoder.write(`  Kembalian: ${formatRupiah(payment.changeAmount ?? 0)}`);
        encoder.feed(1);
      }
    }
    if (payment.referenceNo) {
      encoder.write(`  Ref: ${payment.referenceNo}`);
      encoder.feed(1);
    }
    if (payment.accountName && payment.accountNo) {
      encoder.write(`  ${payment.accountName} (${payment.accountNo})`);
      encoder.feed(1);
    }
  }

  encoder.feed(1);
  encoder.write('='.repeat(width));
  encoder.feed(1);

  if (data.receiptFooter) {
    encoder.setAlignment('center');
    encoder.write(data.receiptFooter);
    encoder.feed(1);
  }

  encoder.write('Terima kasih!');
  encoder.feed(2);
  encoder.cut('full');
  encoder.feed(1);

  return encoder.encode();
}

export async function printReceipt(data: ReceiptData, paperWidthMm: 58 | 80 = 58): Promise<void> {
  const encoded = encodeReceipt(data, paperWidthMm);
  const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth;

  if (!bluetooth) {
    throw new Error('Web Bluetooth API tidak didukung di browser ini.');
  }

  const device = await bluetooth.requestDevice({
    filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
  });
  if (!device.gatt) {
    throw new Error('Printer tidak menyediakan koneksi Bluetooth.');
  }
  const gatt = device.gatt;
  const server = await gatt.connect();
  try {
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    const chunkSize = 100;
    for (let i = 0; i < encoded.length; i += chunkSize) {
      await characteristic.writeValue(encoded.slice(i, i + chunkSize));
      if (i + chunkSize < encoded.length) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 20));
      }
    }
  } finally {
    gatt.disconnect();
  }
}

export function fallbackPrintReceipt(data: ReceiptData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup diblokir. Izinkan popup untuk mencetak struk.');
  }

  const html = generateReceiptHtml(data);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function generateReceiptHtml(data: ReceiptData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(`${item.qty}x ${item.name}`)}</td>
      <td style="text-align: right;">${formatRupiah(item.lineTotal)}</td>
    </tr>
    ${
      item.modifierLabels.length > 0
        ? `<tr><td colspan="2" style="padding-left: 20px;">${item.modifierLabels.map(escapeHtml).join(', ')}</td></tr>`
        : ''
    }
    ${item.note ? `<tr><td colspan="2" style="padding-left: 20px; font-style: italic;">Catatan: ${escapeHtml(item.note)}</td></tr>` : ''}
  `,
    )
    .join('');

  const paymentsHtml = data.payments
    .map((payment) => {
      const methodLabel =
        payment.method === 'cash'
          ? 'Tunai'
          : payment.method === 'transfer'
            ? 'Transfer'
            : 'E-Wallet';
      let extra = '';
      if (payment.method === 'cash' && payment.receivedAmount != null) {
        extra += `<br>Diterima: ${formatRupiah(payment.receivedAmount)}`;
        if ((payment.changeAmount ?? 0) > 0) {
          extra += `<br>Kembalian: ${formatRupiah(payment.changeAmount ?? 0)}`;
        }
      }
      if (payment.referenceNo) {
        extra += `<br>Ref: ${escapeHtml(payment.referenceNo)}`;
      }
      if (payment.accountName && payment.accountNo) {
        extra += `<br>${escapeHtml(payment.accountName)} (${escapeHtml(payment.accountNo)})`;
      }
      return `<div>${methodLabel}: ${formatRupiah(payment.amount)}${extra}</div>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk ${escapeHtml(data.orderNo)}</title>
  <style>
    body { font-family: monospace; font-size: 12px; margin: 0; padding: 20px; }
    .receipt { max-width: 300px; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .large { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="receipt">
    ${data.receiptHeader ? `<div class="center">${escapeHtml(data.receiptHeader)}</div><br>` : ''}
    <div class="center large bold">${escapeHtml(data.storeName)}</div>
    ${data.address ? `<div class="center">${escapeHtml(data.address)}</div>` : ''}
    ${data.phone ? `<div class="center">Telp: ${escapeHtml(data.phone)}</div>` : ''}
    <div class="line"></div>
    <div>No. Pesanan: ${escapeHtml(data.orderNo)}</div>
    <div>Tipe: ${data.orderType === 'dine_in' ? 'Makan di Tempat' : 'Bawa Pulang'}</div>
    ${data.tableLabel ? `<div>Meja: ${escapeHtml(data.tableLabel)}</div>` : ''}
    ${data.customerName ? `<div>Pelanggan: ${escapeHtml(data.customerName)}</div>` : ''}
    <div>Kasir: ${escapeHtml(data.cashierName)}</div>
    <div>Waktu: ${data.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
    <div class="line" style="border-top: 1px solid #000;"></div>
    <table>
      ${itemsHtml}
    </table>
    <div class="line" style="border-top: 1px solid #000;"></div>
    <tr><td>Subtotal</td><td style="text-align: right;">${formatRupiah(data.subtotal)}</td></tr>
    ${data.discountTotal > 0 ? `<tr><td>Diskon${data.voucherCode ? ` (${escapeHtml(data.voucherCode)})` : ''}</td><td style="text-align: right;">-${formatRupiah(data.discountTotal)}</td></tr>` : ''}
    ${data.serviceAmount > 0 ? `<tr><td>Layanan</td><td style="text-align: right;">${formatRupiah(data.serviceAmount)}</td></tr>` : ''}
    ${data.taxAmount > 0 ? `<tr><td>Pajak</td><td style="text-align: right;">${formatRupiah(data.taxAmount)}</td></tr>` : ''}
    ${data.roundingAmount !== 0 ? `<tr><td>Pembulatan</td><td style="text-align: right;">${formatRupiah(data.roundingAmount)}</td></tr>` : ''}
    <tr class="bold"><td>TOTAL</td><td style="text-align: right;">${formatRupiah(data.grandTotal)}</td></tr>
    <div class="line" style="border-top: 1px solid #000;"></div>
    <div class="bold">PEMBAYARAN:</div>
    ${paymentsHtml}
    <div class="line" style="border-top: 1px solid #000;"></div>
    ${data.receiptFooter ? `<div class="center">${escapeHtml(data.receiptFooter)}</div><br>` : ''}
    <div class="center">Terima kasih!</div>
  </div>
  <button class="no-print" onclick="window.print()">Cetak</button>
  <button class="no-print" onclick="window.close()">Tutup</button>
</body>
</html>
`;
}
