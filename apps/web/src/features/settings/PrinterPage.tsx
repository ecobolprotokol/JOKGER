import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '../../shared/components/ErrorState';
import { ReceiptPrintView } from '../../shared/components/ReceiptPrintView';
import { useStoreSettings } from './hooks';
import { toAppError } from '../../shared/lib/errors';
import { encodeReceipt } from '../../shared/lib/receipt';
import { printReceiptInBrowser } from '../../shared/lib/browserPrint';
import {
  connectPrinter,
  connectedPrinter,
  disconnectPrinter,
  subscribePrinterState,
  supportsBluetoothPrinter,
  writePrinterBytes,
} from '../../shared/lib/printerConnection';
import {
  enqueuePrintJob,
  readPrintQueue,
  removePrintJob,
  type PrintJob,
} from '../../shared/lib/printQueue';
import { retryPrintJob } from '../pos/printService';
import { formatDateTime } from '../../shared/lib/format';
import { useDeviceStore } from '../../shared/stores/device';
import { strings } from '../../shared/strings/id';
import type { ReceiptData } from '../../shared/lib/receipt';

function sampleReceipt(storeName: string): ReceiptData {
  return {
    storeName,
    orderNo: strings.printer.testOrder,
    orderType: 'takeaway',
    items: [
      {
        name: strings.printer.testPrint,
        qty: 1,
        unitPrice: 1000,
        modifierLabels: [],
        lineTotal: 1000,
      },
    ],
    subtotal: 1000,
    discountTotal: 0,
    serviceAmount: 0,
    taxAmount: 0,
    roundingAmount: 0,
    grandTotal: 1000,
    payments: [{ method: 'cash', amount: 1000, receivedAmount: 1000, changeAmount: 0 }],
    createdAt: new Date(),
    cashierName: strings.app.name,
  };
}

export function PrinterPage(): JSX.Element {
  const settings = useStoreSettings();
  const paperWidthOverride = useDeviceStore((state) => state.paperWidthOverride);
  const setPaperWidthOverride = useDeviceStore((state) => state.setPaperWidthOverride);
  const setStoredPrinter = useDeviceStore((state) => state.setPrinter);
  const [printer, setPrinter] = useState(connectedPrinter());
  const [jobs, setJobs] = useState<PrintJob[]>(() => readPrintQueue());
  const [working, setWorking] = useState(false);
  const supported = supportsBluetoothPrinter();
  const effectiveWidth = paperWidthOverride ?? settings.data?.paper_width_mm ?? 58;

  useEffect(
    () =>
      subscribePrinterState((next) => {
        setPrinter(next);
        setStoredPrinter(next);
      }),
    [setStoredPrinter],
  );

  async function connect(): Promise<void> {
    setWorking(true);
    try {
      await connectPrinter();
    } catch {
      toast.error(strings.printer.connectError);
    } finally {
      setWorking(false);
    }
  }

  async function testPrint(browserFallback = false): Promise<void> {
    const receipt = sampleReceipt(settings.data?.store_name ?? strings.app.name);
    try {
      if (browserFallback || !printer) printReceiptInBrowser(receipt, effectiveWidth);
      else await writePrinterBytes(encodeReceipt(receipt, effectiveWidth));
      toast.success(strings.printer.printed);
    } catch {
      const result = enqueuePrintJob({
        orderNo: strings.printer.testOrder,
        type: 'receipt',
        createdAt: new Date().toISOString(),
      });
      setJobs(result.jobs);
      toast.warning(
        result.droppedOldest ? strings.printer.queueDropped : strings.printer.printError,
      );
    }
  }

  async function retry(index: number, job: PrintJob): Promise<void> {
    setWorking(true);
    try {
      if (job.orderNo === strings.printer.testOrder) await testPrint(!printer);
      else await retryPrintJob(job);
      setJobs(removePrintJob(index));
      toast.success(strings.printer.printed);
    } catch {
      toast.error(strings.printer.printError);
    } finally {
      setWorking(false);
    }
  }

  if (settings.isPending)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  if (settings.isError)
    return (
      <main className="page-state">
        <h1>{strings.printer.title}</h1>
        <ErrorState error={toAppError(settings.error)} onRetry={() => void settings.refetch()} />
      </main>
    );

  return (
    <main className="settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.printer.title}</h1>
        </div>
      </header>
      <section className="settings-section">
        <h2>{strings.printer.status}</h2>
        <p role="status">
          {!supported
            ? strings.printer.unsupported
            : printer
              ? `${strings.printer.connected} ${printer.name}`
              : strings.printer.disconnected}
        </p>
        {supported && !printer && (
          <button
            className="button button--primary"
            disabled={working}
            onClick={() => void connect()}
          >
            {strings.printer.connect}
          </button>
        )}
        {printer && (
          <button className="button button--secondary" onClick={() => disconnectPrinter()}>
            {strings.printer.disconnect}
          </button>
        )}
        {!supported && <p>{strings.printer.browserHint}</p>}
        <div className="printer-actions">
          <button className="button button--primary" onClick={() => void testPrint()}>
            {strings.printer.testPrint}
          </button>
          {!supported && (
            <button className="button button--secondary" onClick={() => void testPrint(true)}>
              {strings.printer.browserPrint}
            </button>
          )}
        </div>
      </section>
      <section className="settings-section">
        <h2>{strings.printer.paperWidth}</h2>
        <label className="field">
          <span>{strings.printer.paperWidth}</span>
          <select
            value={paperWidthOverride ?? ''}
            onChange={(event) =>
              setPaperWidthOverride(
                event.target.value === '' ? null : (Number(event.target.value) as 58 | 80),
              )
            }
          >
            <option value="">
              {strings.printer.followStore} ({settings.data?.paper_width_mm} mm)
            </option>
            <option value={58}>58 mm</option>
            <option value={80}>80 mm</option>
          </select>
        </label>
      </section>
      <section className="settings-section">
        <h2>
          {strings.printer.queue} ({jobs.length}/20)
        </h2>
        {jobs.length === 0 ? (
          <p>{strings.printer.queueEmpty}</p>
        ) : (
          <ul className="printer-queue">
            {jobs.map((job, index) => (
              <li key={`${job.orderNo}-${job.createdAt}`}>
                <div>
                  <strong>{job.orderNo}</strong>
                  <span>
                    {job.type === 'receipt'
                      ? strings.printer.receipt
                      : strings.printer.shiftSummary}
                  </span>
                  <time>{formatDateTime(job.createdAt)}</time>
                </div>
                <div>
                  <button
                    className="button button--secondary"
                    disabled={working}
                    onClick={() => void retry(index, job)}
                  >
                    {strings.printer.retry}
                  </button>
                  <button
                    className="button button--secondary"
                    aria-label={`${strings.printer.remove} ${job.orderNo}`}
                    onClick={() => setJobs(removePrintJob(index))}
                  >
                    {strings.printer.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="visually-hidden" aria-hidden="true">
        <ReceiptPrintView
          data={sampleReceipt(settings.data?.store_name ?? strings.app.name)}
          paperWidthMm={effectiveWidth}
        />
      </div>
    </main>
  );
}
