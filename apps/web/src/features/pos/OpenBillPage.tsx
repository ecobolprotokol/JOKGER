import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useActivePaymentAccounts } from '../payment-accounts';
import { useActiveShift } from '../shift';
import { useOrderDetail } from '../orders';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { Money } from '../../shared/components/Money';
import { MoneyField } from '../../shared/components/MoneyField';
import { ModifierPicker } from './components/ModifierPicker';
import { useAddItemsToOpenBill, useCloseOpenBill, useVoidOpenBillItem } from './hooks';
import { useMenuCatalog, type MenuItem } from '../menu';
import type { CartLine } from '../../shared/stores/cart';
import { useConnectionStore } from '../../shared/stores/connection';
import { strings } from '../../shared/strings/id';
import { formatDateTime } from '../../shared/lib/format';

type PaymentMethod = 'cash' | 'transfer' | 'ewallet';
type PaymentMode = PaymentMethod | 'split';
type SplitPaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  receivedAmount: string;
  accountId: string;
  referenceNo: string;
};

function newPaymentLine(): SplitPaymentLine {
  return {
    id: crypto.randomUUID(),
    method: 'cash',
    amount: '',
    receivedAmount: '',
    accountId: '',
    referenceNo: '',
  };
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function OpenBillPage() {
  const { orderId = '' } = useParams();
  const online = useConnectionStore((state) => state.online);
  const menuQuery = useMenuCatalog();
  const orderQuery = useOrderDetail(orderId, false);
  const shiftQuery = useActiveShift();
  const accountsQuery = useActivePaymentAccounts();
  const addItemsMutation = useAddItemsToOpenBill(orderId);
  const closeMutation = useCloseOpenBill(orderId);
  const voidMutation = useVoidOpenBillItem(orderId);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [stagedLines, setStagedLines] = useState<CartLine[]>([]);
  const [addItemsClientRef, setAddItemsClientRef] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; name: string } | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [splitPayments, setSplitPayments] = useState<SplitPaymentLine[]>([
    newPaymentLine(),
    newPaymentLine(),
  ]);
  const [closeClientRef, setCloseClientRef] = useState<string | null>(null);

  const order = orderQuery.data;
  const canEdit = Boolean(
    order?.bill_state === 'open' &&
    shiftQuery.data?.id === order.shift_id &&
    online &&
    !shiftQuery.isError,
  );
  const stagedQuantity = stagedLines.reduce((sum, line) => sum + line.qty, 0);
  const splitTotal = splitPayments.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const activeAccounts = accountsQuery.data ?? [];
  const paymentRowsValid = order
    ? paymentMode !== 'split'
      ? paymentMode === 'cash'
        ? Number(receivedAmount || 0) >= order.grand_total
        : Boolean(
            activeAccounts.some(
              (account) => account.id === paymentAccountId && account.method === paymentMode,
            ) && /^[A-Za-z0-9]{4,40}$/.test(referenceNo.trim()),
          )
      : splitPayments.length >= 2 &&
        splitTotal === order.grand_total &&
        splitPayments.every((line) => {
          const amount = Number(line.amount);
          if (!Number.isSafeInteger(amount) || amount <= 0) return false;
          if (line.method === 'cash') return Number(line.receivedAmount) >= amount;
          return Boolean(
            activeAccounts.some(
              (account) => account.id === line.accountId && account.method === line.method,
            ) && /^[A-Za-z0-9]{4,40}$/.test(line.referenceNo.trim()),
          );
        })
    : false;

  if (orderQuery.isPending || menuQuery.isPending || shiftQuery.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (orderQuery.isError || menuQuery.isError || !order || !menuQuery.data) {
    const error = orderQuery.error ?? menuQuery.error;
    return (
      <main className="page-state" role="alert">
        <h1>{strings.openBill.loadError}</h1>
        <p>{error ? getErrorMessage(error) : strings.openBill.notFound}</p>
        <button
          className="button button--secondary"
          onClick={() => {
            void orderQuery.refetch();
            void menuQuery.refetch();
          }}
        >
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const isClosed = order.bill_state === 'closed';
  const isNotOpenBill = order.bill_state === null;
  const editable = canEdit && order.bill_state === 'open';
  const itemsByTime = new Map<string, typeof order.order_items>();
  for (const item of order.order_items) {
    const key = timeLabel(item.created_at);
    itemsByTime.set(key, [...(itemsByTime.get(key) ?? []), item]);
  }

  function stageItem(
    item: MenuItem,
    optionIds: string[],
    labels: string[],
    extra: number,
    quantity: number,
    note: string,
  ): void {
    const newLine: CartLine = {
      lineId: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      modifierExtra: extra,
      modifierOptionIds: optionIds,
      modifierLabels: labels,
      qty: quantity,
      note: note.trim() || null,
    };
    setStagedLines((lines) => [...lines, newLine]);
  }

  function submitItems(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!editable || !stagedLines.length) return;
    const clientRef = addItemsClientRef ?? crypto.randomUUID();
    setAddItemsClientRef(clientRef);
    addItemsMutation.mutate(
      {
        clientRef,
        items: stagedLines.map((line) => ({
          menu_item_id: line.menuItemId,
          qty: line.qty,
          modifier_option_ids: line.modifierOptionIds,
          note: line.note,
        })),
      },
      {
        onSuccess: () => {
          setStagedLines([]);
          setAddItemsClientRef(null);
          toast.success(strings.openBill.itemsAdded);
        },
        onError: (error) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'BILL_CLOSED'
          ) {
            void orderQuery.refetch();
          }
        },
      },
    );
  }

  function paymentPayload() {
    if (!order) return [];
    if (paymentMode !== 'split') {
      return [
        {
          method: paymentMode,
          amount: order.grand_total,
          received_amount: paymentMode === 'cash' ? Number(receivedAmount) : null,
          payment_account_id: paymentMode === 'cash' ? null : paymentAccountId,
          reference_no: paymentMode === 'cash' ? null : referenceNo.trim(),
          proof_path: null,
        },
      ];
    }
    return splitPayments.map((line) => ({
      method: line.method,
      amount: Number(line.amount),
      received_amount: line.method === 'cash' ? Number(line.receivedAmount) : null,
      payment_account_id: line.method === 'cash' ? null : line.accountId,
      reference_no: line.method === 'cash' ? null : line.referenceNo.trim(),
      proof_path: null,
    }));
  }

  function closeBill(): void {
    if (!editable || !paymentRowsValid || closeMutation.isPending) return;
    const clientRef = closeClientRef ?? crypto.randomUUID();
    setCloseClientRef(clientRef);
    closeMutation.mutate(
      { clientRef, payments: paymentPayload(), voucherCode: voucherCode.trim() || null },
      {
        onSuccess: () => {
          toast.success(strings.openBill.closed);
          setCloseClientRef(null);
        },
        onError: (error) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'BILL_CLOSED'
          ) {
            void orderQuery.refetch();
          }
        },
      },
    );
  }

  function updateSplitLine(id: string, values: Partial<SplitPaymentLine>): void {
    setSplitPayments((lines) =>
      lines.map((line) => (line.id === id ? { ...line, ...values } : line)),
    );
  }

  return (
    <main className="open-bill-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.openBill.title}</p>
          <h1>{order.order_no}</h1>
          <p className="open-bill__meta">
            {order.table_label || order.customer_name || strings.orderDetail.notProvided}
            {' · '}
            {strings.openBill.openedAt} {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="open-bill__header-actions">
          <Link className="button button--secondary" to={`/orders/${order.id}`}>
            {strings.openBill.viewOrder}
          </Link>
          <Link className="button button--secondary" to="/pos">
            {strings.pos.title}
          </Link>
        </div>
      </header>

      {isClosed ? (
        <section className="open-bill__notice" role="status">
          <h2>{strings.openBill.closed}</h2>
          <p>{strings.openBill.readOnly}</p>
          <Link className="button button--primary" to={`/orders/${order.id}`}>
            {strings.openBill.viewOrder}
          </Link>
        </section>
      ) : isNotOpenBill ? (
        <section className="open-bill__notice" role="status">
          <h2>{strings.openBill.notOpenBill}</h2>
          <p>{strings.openBill.notOpenBillDescription}</p>
        </section>
      ) : !editable ? (
        <section className="open-bill__notice" role="status">
          <h2>{strings.openBill.shiftClosed}</h2>
          <p>{strings.openBill.shiftClosedDescription}</p>
        </section>
      ) : null}

      <div className="open-bill-layout">
        <section className="open-bill-menu" aria-labelledby="open-bill-menu-title">
          <h2 id="open-bill-menu-title">{strings.openBill.addItems}</h2>
          <div className="open-bill-menu__grid">
            {menuQuery.data.items.map((item) => (
              <button
                className="menu-tile"
                key={item.id}
                disabled={!editable || !item.is_available}
                onClick={() => {
                  if (item.modifierGroups.length) setModifierItem(item);
                  else stageItem(item, [], [], 0, 1, '');
                }}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt="" width="320" height="240" loading="lazy" />
                ) : null}
                <span className="menu-tile__name">{item.name}</span>
                <Money value={item.price} />
                {!item.is_available && <span className="sold-out-pill">{strings.pos.soldOut}</span>}
              </button>
            ))}
          </div>
          {stagedLines.length > 0 && (
            <form className="open-bill-staged" onSubmit={submitItems}>
              <h3>
                {strings.openBill.staged} ({stagedQuantity})
              </h3>
              <ul>
                {stagedLines.map((line) => (
                  <li key={line.lineId}>
                    <span>
                      {line.qty}x {line.name}
                    </span>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={`${strings.openBill.removeStaged} ${line.name}`}
                      onClick={() =>
                        setStagedLines((lines) =>
                          lines.filter((entry) => entry.lineId !== line.lineId),
                        )
                      }
                    >
                      {strings.openBill.removeStaged}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="button button--primary" disabled={addItemsMutation.isPending}>
                {addItemsMutation.isPending ? strings.app.loading : strings.openBill.addToBill}
              </button>
              {addItemsMutation.isError && (
                <p className="form-alert" role="alert">
                  {getErrorMessage(addItemsMutation.error)}
                </p>
              )}
            </form>
          )}
        </section>

        <aside className="open-bill-panel" aria-labelledby="bill-panel-title">
          <div className="open-bill-panel__heading">
            <h2 id="bill-panel-title">{strings.openBill.bill}</h2>
            <span>
              {order.order_items
                .filter((item) => !item.is_voided)
                .reduce((sum, item) => sum + item.qty, 0)}
            </span>
          </div>
          <div className="open-bill-item-groups">
            {[...itemsByTime.entries()].map(([time, items]) => (
              <section key={time} aria-label={`${strings.openBill.addedAt} ${time}`}>
                <h3>
                  {strings.openBill.addedAt} {time}
                </h3>
                {items.map((item) => (
                  <div
                    className={item.is_voided ? 'open-bill-item is-voided' : 'open-bill-item'}
                    key={item.id}
                  >
                    <div>
                      <strong>{item.item_name}</strong>
                      <span>
                        {item.qty}x · <Money value={item.line_total} />
                      </span>
                      {item.modifiers.length > 0 && (
                        <small>
                          {item.modifiers
                            .map((modifier) => `${modifier.group}: ${modifier.name}`)
                            .join(', ')}
                        </small>
                      )}
                      {order.status !== 'new' && !item.is_voided && (
                        <small className="open-bill-item__sent">{strings.openBill.sent}</small>
                      )}
                      {item.is_voided && <small>{item.void_reason}</small>}
                    </div>
                    {editable && !item.is_voided && (
                      <button
                        className="text-button"
                        onClick={() => setVoidTarget({ id: item.id, name: item.item_name })}
                      >
                        {strings.openBill.voidItem}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
          {stagedLines.length > 0 && (
            <p className="open-bill-panel__staged" role="status">
              {strings.openBill.itemsNotAdded}: {stagedQuantity}
            </p>
          )}
          <div className="open-bill-total">
            <span>{strings.pos.total}</span>
            <Money value={order.grand_total} />
          </div>
          {editable && (
            <div className="open-bill-close">
              <h3>{strings.openBill.closeBill}</h3>
              <label className="field">
                <span>{strings.pos.paymentMethod}</span>
                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
                >
                  <option value="cash">{strings.pos.cash}</option>
                  <option value="transfer">{strings.pos.transfer}</option>
                  <option value="ewallet">{strings.pos.ewallet}</option>
                  <option value="split">{strings.openBill.split}</option>
                </select>
              </label>
              {paymentMode === 'cash' && (
                <MoneyField
                  id="open-bill-cash-received"
                  label={strings.pos.amountReceived}
                  min={order.grand_total}
                  value={receivedAmount}
                  onChange={setReceivedAmount}
                />
              )}
              {paymentMode !== 'cash' && paymentMode !== 'split' && (
                <>
                  <label className="field">
                    <span>{strings.pos.paymentAccount}</span>
                    <select
                      value={paymentAccountId}
                      onChange={(event) => setPaymentAccountId(event.target.value)}
                    >
                      <option value="">{strings.openBill.selectAccount}</option>
                      {activeAccounts
                        .filter((account) => account.method === paymentMode)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.provider} · {account.account_name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{strings.pos.paymentReference}</span>
                    <input
                      value={referenceNo}
                      maxLength={40}
                      onChange={(event) =>
                        setReferenceNo(event.target.value.replace(/[^A-Za-z0-9]/g, ''))
                      }
                    />
                  </label>
                </>
              )}
              {paymentMode === 'split' && (
                <div className="open-bill-split">
                  {splitPayments.map((line) => (
                    <fieldset className="open-bill-split__line" key={line.id}>
                      <legend>{strings.openBill.paymentLine}</legend>
                      <select
                        aria-label={strings.pos.paymentMethod}
                        value={line.method}
                        onChange={(event) =>
                          updateSplitLine(line.id, {
                            method: event.target.value as PaymentMethod,
                            accountId: '',
                            referenceNo: '',
                          })
                        }
                      >
                        <option value="cash">{strings.pos.cash}</option>
                        <option value="transfer">{strings.pos.transfer}</option>
                        <option value="ewallet">{strings.pos.ewallet}</option>
                      </select>
                      <MoneyField
                        id={`${line.id}-amount`}
                        label={strings.orderDetail.amount}
                        min={1}
                        value={line.amount}
                        onChange={(value) => updateSplitLine(line.id, { amount: value })}
                      />
                      {line.method === 'cash' ? (
                        <MoneyField
                          id={`${line.id}-received`}
                          label={strings.pos.amountReceived}
                          min={Number(line.amount) || 0}
                          value={line.receivedAmount}
                          onChange={(value) => updateSplitLine(line.id, { receivedAmount: value })}
                        />
                      ) : (
                        <>
                          <select
                            aria-label={strings.pos.paymentAccount}
                            value={line.accountId}
                            onChange={(event) =>
                              updateSplitLine(line.id, { accountId: event.target.value })
                            }
                          >
                            <option value="">{strings.openBill.selectAccount}</option>
                            {activeAccounts
                              .filter((account) => account.method === line.method)
                              .map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.provider}
                                </option>
                              ))}
                          </select>
                          <input
                            aria-label={strings.pos.paymentReference}
                            value={line.referenceNo}
                            maxLength={40}
                            onChange={(event) =>
                              updateSplitLine(line.id, {
                                referenceNo: event.target.value.replace(/[^A-Za-z0-9]/g, ''),
                              })
                            }
                          />
                        </>
                      )}
                      <button
                        type="button"
                        className="text-button"
                        disabled={splitPayments.length <= 2}
                        onClick={() =>
                          setSplitPayments((lines) => lines.filter((entry) => entry.id !== line.id))
                        }
                      >
                        {strings.openBill.removePaymentLine}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setSplitPayments((lines) => [...lines, newPaymentLine()])}
                  >
                    {strings.openBill.addPaymentLine}
                  </button>
                  <div className="open-bill-total">
                    <span>{strings.openBill.remaining}</span>
                    <Money value={order.grand_total - splitTotal} signed />
                  </div>
                </div>
              )}
              <label className="field">
                <span>{strings.pos.voucher}</span>
                <input
                  value={voucherCode}
                  maxLength={32}
                  onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                />
              </label>
              {closeMutation.isError && (
                <p className="form-alert" role="alert">
                  {getErrorMessage(closeMutation.error)}
                </p>
              )}
              <button
                className="button button--primary"
                disabled={!online || !paymentRowsValid || closeMutation.isPending}
                onClick={closeBill}
              >
                {closeMutation.isPending ? strings.app.loading : strings.openBill.closeBill}
              </button>
            </div>
          )}
        </aside>
      </div>

      {modifierItem && (
        <ModifierPicker
          key={modifierItem.id}
          item={modifierItem}
          onClose={() => setModifierItem(null)}
          onAdd={(ids, labels, extra, quantity, note) =>
            stageItem(modifierItem, ids, labels, extra, quantity, note)
          }
        />
      )}
      {voidTarget && (
        <ConfirmAction
          title={`${strings.openBill.voidTitle} ${voidTarget.name}?`}
          description={strings.openBill.voidDescription}
          confirmLabel={strings.openBill.voidItem}
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await voidMutation.mutateAsync({ itemId: voidTarget.id, reason: reason ?? '' });
            toast.success(strings.openBill.itemVoided);
            setVoidTarget(null);
          }}
        />
      )}
    </main>
  );
}
