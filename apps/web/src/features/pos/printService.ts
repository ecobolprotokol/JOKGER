import { readOrderDetail, readOrderDetailByNumber } from '../orders/api';
import { readStoreSettings } from '../settings/api';
import { encodeReceipt, type ReceiptData } from '../../shared/lib/receipt';
import { printReceiptInBrowser } from '../../shared/lib/browserPrint';
import { connectedPrinter, writePrinterBytes } from '../../shared/lib/printerConnection';
import { enqueuePrintJob, type PrintJob } from '../../shared/lib/printQueue';
import { useDeviceStore } from '../../shared/stores/device';

export type PrintResult = { status: 'printed' } | { status: 'queued'; droppedOldest: boolean };

async function loadReceipt(
  orderId: string,
): Promise<{ receipt: ReceiptData; paperWidth: 58 | 80 }> {
  const [orderResult, settingsResult] = await Promise.all([
    readOrderDetail(orderId, false),
    readStoreSettings(),
  ]);
  if (!orderResult.ok) throw orderResult.error;
  if (!orderResult.data) throw new Error('Pesanan tidak ditemukan.');
  if (!settingsResult.ok) throw settingsResult.error;
  const order = orderResult.data;
  const settings = settingsResult.data;
  const receipt: ReceiptData = {
    storeName: settings.store_name,
    ...(settings.address ? { address: settings.address } : {}),
    ...(settings.phone ? { phone: settings.phone } : {}),
    orderNo: order.order_no,
    orderType: order.order_type,
    tableLabel: order.table_label,
    customerName: order.customer_name,
    items: order.order_items
      .filter((item) => !item.is_voided)
      .map((item) => ({
        name: item.item_name,
        qty: item.qty,
        unitPrice: item.unit_price,
        modifierLabels: item.modifiers.map((modifier) => `${modifier.group}: ${modifier.name}`),
        note: item.note,
        lineTotal: item.line_total,
      })),
    subtotal: order.subtotal,
    discountTotal: order.discount_total,
    serviceAmount: order.service_amount,
    taxAmount: order.tax_amount,
    roundingAmount: order.rounding_amount,
    grandTotal: order.grand_total,
    voucherCode: order.voucher_code,
    payments: order.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      receivedAmount: payment.received_amount,
      changeAmount: payment.change_amount,
      referenceNo: payment.reference_no,
      ...(payment.payment_accounts?.account_name
        ? { accountName: payment.payment_accounts.account_name }
        : {}),
    })),
    createdAt: new Date(order.created_at),
    cashierName: order.created_by_name,
    ...(settings.receipt_header ? { receiptHeader: settings.receipt_header } : {}),
    ...(settings.receipt_footer ? { receiptFooter: settings.receipt_footer } : {}),
  };
  return {
    receipt,
    paperWidth: useDeviceStore.getState().paperWidthOverride ?? settings.paper_width_mm,
  };
}

function queueReceipt(orderNo: string, type: PrintJob['type'] = 'receipt'): PrintResult {
  const result = enqueuePrintJob({ orderNo, type, createdAt: new Date().toISOString() });
  return { status: 'queued', droppedOldest: result.droppedOldest };
}

export async function printSavedOrder(orderId: string, orderNo: string): Promise<PrintResult> {
  try {
    const { receipt, paperWidth } = await loadReceipt(orderId);
    if (!connectedPrinter()) return queueReceipt(orderNo);
    await writePrinterBytes(encodeReceipt(receipt, paperWidth));
    return { status: 'printed' };
  } catch {
    return queueReceipt(orderNo);
  }
}

export async function retryPrintJob(job: PrintJob): Promise<void> {
  const result = await readOrderDetailByNumber(job.orderNo);
  if (!result.ok) throw result.error;
  if (!result.data) throw new Error('Pesanan tidak ditemukan.');
  const { receipt, paperWidth } = await loadReceipt(result.data.id);
  if (!connectedPrinter()) throw new Error('Printer belum terhubung.');
  await writePrinterBytes(encodeReceipt(receipt, paperWidth));
}

export async function printOrderInBrowser(orderId: string, reprint = false): Promise<void> {
  const { receipt, paperWidth } = await loadReceipt(orderId);
  printReceiptInBrowser(receipt, paperWidth, reprint);
}

export async function printOrderToPrinter(orderId: string, reprint = false): Promise<void> {
  const { receipt, paperWidth } = await loadReceipt(orderId);
  if (!connectedPrinter()) throw new Error('Printer belum terhubung.');
  await writePrinterBytes(encodeReceipt({ ...receipt, reprint }, paperWidth));
}

export async function reprintOrder(orderId: string): Promise<void> {
  const { receipt, paperWidth } = await loadReceipt(orderId);
  if (connectedPrinter()) {
    await writePrinterBytes(encodeReceipt({ ...receipt, reprint: true }, paperWidth));
  } else {
    printReceiptInBrowser(receipt, paperWidth, true);
  }
}
