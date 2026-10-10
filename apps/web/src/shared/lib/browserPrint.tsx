import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptPrintView } from '../components/ReceiptPrintView';
import type { ReceiptData } from './receipt';

export function printReceiptInBrowser(
  data: ReceiptData,
  paperWidthMm: 58 | 80 = 58,
  reprint = false,
): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) throw new Error('Popup tidak dapat dibuka.');
  const content = renderToStaticMarkup(
    <ReceiptPrintView data={data} paperWidthMm={paperWidthMm} reprint={reprint} />,
  );
  printWindow.document.open();
  printWindow.document
    .write(`<!doctype html><html><head><meta charset="utf-8"><title>${data.orderNo}</title><style>
    @page { size: ${paperWidthMm}mm auto; margin: 3mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; font: 10pt ui-monospace, monospace; }
    .receipt-print { max-width: 100%; margin: 0 auto; }
    h1, .receipt-print__center { text-align: center; }
    h1 { margin: 4mm 0 2mm; font-size: 14pt; }
    p { margin: 2mm 0; }
    hr { border: 0; border-top: 1px dashed #333; margin: 3mm 0; }
    dl { margin: 0; }
    dl div, .receipt-print__line { display: flex; justify-content: space-between; gap: 4mm; }
    dt, dd { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; }
    th:last-child, td:last-child { text-align: right; white-space: nowrap; }
    td { vertical-align: top; padding: 1mm 0; }
    td small, .receipt-print__payment small { display: block; }
    .receipt-print__reprint { display: block; text-align: center; border: 1px solid #111; padding: 1mm; }
    @media print { body { print-color-adjust: exact; } }
  </style></head><body>${content}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
