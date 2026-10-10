import { formatDateTime } from '../lib/format';
import { strings } from '../strings/id';
import type { ReceiptData } from '../lib/receipt';
import { Money } from './Money';

export function ReceiptPrintView({
  data,
  reprint = false,
  paperWidthMm = 58,
}: {
  data: ReceiptData;
  reprint?: boolean;
  paperWidthMm?: 58 | 80;
}): JSX.Element {
  return (
    <article className="receipt-print" style={{ width: `${paperWidthMm}mm` }}>
      {reprint && <strong className="receipt-print__reprint">REPRINT</strong>}
      {data.receiptHeader && <p className="receipt-print__center">{data.receiptHeader}</p>}
      <h1>{data.storeName}</h1>
      {data.address && <p className="receipt-print__center">{data.address}</p>}
      {data.phone && <p className="receipt-print__center">{data.phone}</p>}
      {data.receiptHeader && <hr />}
      <dl>
        <div>
          <dt>{strings.orderDetail.orderType}</dt>
          <dd>{data.orderType === 'dine_in' ? strings.orders.dineIn : strings.orders.takeaway}</dd>
        </div>
        <div>
          <dt>{strings.orderDetail.createdAt}</dt>
          <dd>{formatDateTime(data.createdAt)}</dd>
        </div>
        <div>
          <dt>{strings.orderDetail.createdBy}</dt>
          <dd>{data.cashierName}</dd>
        </div>
        <div>
          <dt>{strings.orderDetail.customer}</dt>
          <dd>{data.tableLabel ?? data.customerName ?? strings.orderDetail.notProvided}</dd>
        </div>
      </dl>
      <p>{data.orderNo}</p>
      <hr />
      <table>
        <thead>
          <tr>
            <th>{strings.orderDetail.item}</th>
            <th>{strings.orderDetail.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>
                {item.qty}x {item.name}
                {item.modifierLabels.map((label) => (
                  <small key={label}>{label}</small>
                ))}
                {item.note && <small>{item.note}</small>}
              </td>
              <td>
                <Money value={item.lineTotal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <ReceiptLine label={strings.pos.subtotal} value={data.subtotal} />
      {data.discountTotal > 0 && (
        <ReceiptLine
          label={`${strings.orderDetail.discount}${data.voucherCode ? ` (${data.voucherCode})` : ''}`}
          value={-data.discountTotal}
        />
      )}
      {data.serviceAmount > 0 && (
        <ReceiptLine label={strings.pos.serviceFee} value={data.serviceAmount} />
      )}
      {data.taxAmount > 0 && <ReceiptLine label={strings.pos.tax} value={data.taxAmount} />}
      {data.roundingAmount !== 0 && (
        <ReceiptLine label={strings.pos.rounding} value={data.roundingAmount} />
      )}
      <ReceiptLine label={strings.pos.total} value={data.grandTotal} />
      <hr />
      <strong>{strings.pos.payment}</strong>
      {data.payments.map((payment, index) => (
        <div key={`${payment.method}-${index}`} className="receipt-print__payment">
          <ReceiptLine label={strings.orderDetail.methods[payment.method]} value={payment.amount} />
          {payment.method === 'cash' && payment.receivedAmount != null && (
            <ReceiptLine label={strings.pos.amountReceived} value={payment.receivedAmount} />
          )}
          {payment.changeAmount ? (
            <ReceiptLine label={strings.pos.change} value={payment.changeAmount} />
          ) : null}
          {payment.referenceNo && <small>{payment.referenceNo}</small>}
          {payment.accountName && <small>{payment.accountName}</small>}
        </div>
      ))}
      {data.receiptFooter && <p className="receipt-print__center">{data.receiptFooter}</p>}
    </article>
  );
}

function ReceiptLine({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="receipt-print__line">
      <span>{label}</span>
      <Money value={value} signed />
    </div>
  );
}
