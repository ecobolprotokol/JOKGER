import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMenuCatalog, type MenuItem } from '../menu';
import { useStoreSettings } from '../settings';
import { useActivePaymentAccounts } from '../payment-accounts';
import { useActiveShift } from '../shift';
import { useValidateVoucher, useVoucherPreview } from '../vouchers';
import { useCreateOrder } from './hooks';
import { calculateLineTotal, calculateTotals } from './logic';
import { ModifierPicker } from './components/ModifierPicker';
import { Money } from '../../shared/components/Money';
import { MoneyField } from '../../shared/components/MoneyField';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { calculateChange, quickCashAmounts } from '../../shared/lib/money';
import { useCartStore } from '../../shared/stores/cart';
import { useConnectionStore } from '../../shared/stores/connection';
import { strings } from '../../shared/strings/id';

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function PosPage() {
  const menuQuery = useMenuCatalog();
  const settingsQuery = useStoreSettings();
  const accountsQuery = useActivePaymentAccounts();
  const shiftQuery = useActiveShift();
  const createOrder = useCreateOrder();
  const validateVoucher = useValidateVoucher();
  const cart = useCartStore();
  const online = useConnectionStore((state) => state.online);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [received, setReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'ewallet'>('cash');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [voucherInput, setVoucherInput] = useState(cart.voucherCode ?? '');
  const [createdOrder, setCreatedOrder] = useState<{ orderNo: string; total: number } | null>(null);
  const menu = menuQuery.data;
  const settings = settingsQuery.data;
  const subtotal = calculateTotals(cart.lines, 0, 0, 0, 'none').subtotal;
  const voucherPreview = useVoucherPreview(cart.voucherCode, subtotal);

  if (shiftQuery.isSuccess && !shiftQuery.data) {
    return <Navigate to="/shift" replace />;
  }

  if (menuQuery.isPending || settingsQuery.isPending || shiftQuery.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (menuQuery.isError || settingsQuery.isError || shiftQuery.isError || !menu || !settings) {
    const error = menuQuery.error ?? settingsQuery.error ?? shiftQuery.error;
    return (
      <main className="page-state" role="alert">
        <h1>{strings.pos.menuLoadError}</h1>
        <p>{getErrorMessage(error)}</p>
        <button className="button button--secondary" onClick={() => void menuQuery.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const totals = calculateTotals(
    cart.lines,
    voucherPreview.data?.discount ?? 0,
    settings.service_percent,
    settings.tax_percent,
    settings.rounding_rule,
  );
  const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
  const visibleItems = menu.items.filter((item) => {
    const inCategory = !categoryId || item.category_id === categoryId;
    const matchesSearch =
      !normalizedSearch || item.name.toLocaleLowerCase('id-ID').includes(normalizedSearch);
    return inCategory && matchesSearch;
  });
  const cashReceived = Number(received || 0);
  const change = calculateChange(cashReceived, totals.grandTotal);
  const accountChoices = (accountsQuery.data ?? []).filter(
    (account) => account.method === paymentMethod,
  );
  const referenceIsValid = /^[A-Za-z0-9]{4,40}$/.test(paymentReference.trim());
  const paymentInputIsValid =
    paymentMethod === 'cash'
      ? cashReceived >= totals.grandTotal
      : Boolean(
          accountChoices.some((account) => account.id === paymentAccountId) && referenceIsValid,
        );
  const canPay = cart.lines.length > 0 && paymentInputIsValid && online;
  const voucherBlocksCheckout = Boolean(
    cart.voucherCode && (voucherPreview.isPending || voucherPreview.isError),
  );

  function addToCart(
    item: MenuItem,
    optionIds: string[],
    labels: string[],
    extra: number,
    qty: number,
    note: string,
  ): void {
    cart.addLine({
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      modifierExtra: extra,
      modifierOptionIds: optionIds,
      modifierLabels: labels,
      qty,
      note: note.trim() || null,
    });
  }

  function checkout(): void {
    if (!canPay || !online || voucherBlocksCheckout) {
      return;
    }
    const clientRef = cart.ensureClientRef();
    createOrder.mutate(
      {
        clientRef,
        orderType: cart.orderType,
        billMode: 'none',
        voucherCode: cart.voucherCode,
        tableLabel: cart.tableLabel,
        customerName: cart.customerName,
        items: cart.lines.map((line) => ({
          menu_item_id: line.menuItemId,
          qty: line.qty,
          modifier_option_ids: line.modifierOptionIds,
          note: line.note,
        })),
        payments: [
          {
            method: paymentMethod,
            amount: totals.grandTotal,
            received_amount: paymentMethod === 'cash' ? cashReceived : null,
            payment_account_id: paymentMethod === 'cash' ? null : paymentAccountId,
            reference_no: paymentMethod === 'cash' ? null : paymentReference.trim(),
            proof_path: null,
          },
        ],
      },
      {
        onSuccess: (order) => {
          setCreatedOrder({ orderNo: order.order_no, total: order.grand_total });
          setReceived('');
          setPaymentReference('');
          setPaymentAccountId('');
          setPaymentMethod('cash');
          cart.clear();
        },
        onError: (error: unknown) => {
          const code = getErrorCode(error);
          if (code === 'PAYMENT_EXCEEDS_OUTSTANDING' || code === 'CASH_RECEIVED_INSUFFICIENT') {
            toast.error(strings.pos.priceChanged);
            void menuQuery.refetch();
          } else if (code?.startsWith('VOUCHER_')) {
            cart.setVoucher(null);
            toast.error(getErrorMessage(error));
          } else if (code === 'REQUEST_TIMEOUT') {
            toast.error(strings.errors.REQUEST_TIMEOUT);
          } else {
            toast.error(getErrorMessage(error));
          }
        },
      },
    );
  }

  return (
    <main className="pos-page">
      <header className="pos-header">
        <div className="pos-brand">
          <span className="brand-mark" aria-hidden="true">
            J
          </span>
          <div>
            <p className="eyebrow">{strings.app.name}</p>
            <h1>{strings.pos.title}</h1>
          </div>
        </div>
        <div className="pos-header__actions">
          <span className="connection-status" role="status">
            <span
              aria-hidden="true"
              className={`connection-dot ${online ? 'is-online' : 'is-offline'}`}
            />
            {online ? strings.pos.online : strings.pos.offline}
          </span>
          <Link className="button button--secondary" to="/shift">
            {strings.shift.title}
          </Link>
          <Link className="button button--secondary" to="/orders">
            {strings.orders.title}
          </Link>
          <Link className="button button--secondary" to="/inventory">
            {strings.inventory.title}
          </Link>
          <Link className="button button--secondary" to="/payment-verification">
            {strings.paymentVerification.title}
          </Link>
          <Link className="button button--secondary" to="/payment-accounts">
            {strings.paymentAccounts.title}
          </Link>
          <Link className="button button--secondary" to="/account/password">
            {strings.auth.passwordChangeTitle}
          </Link>
        </div>
      </header>

      <div className="pos-layout">
        <section className="catalog-panel" aria-label={strings.pos.categories}>
          <div className="catalog-toolbar">
            <div className="category-tabs" role="tablist" aria-label={strings.pos.categories}>
              <button
                className={!categoryId ? 'category-tab is-selected' : 'category-tab'}
                role="tab"
                aria-selected={!categoryId}
                onClick={() => setCategoryId(null)}
              >
                {strings.pos.allCategories}
              </button>
              {menu.categories.map((category) => (
                <button
                  className={
                    categoryId === category.id ? 'category-tab is-selected' : 'category-tab'
                  }
                  key={category.id}
                  role="tab"
                  aria-selected={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <label className="search-field">
              <span className="visually-hidden">{strings.pos.search}</span>
              <input
                type="search"
                value={search}
                placeholder={strings.pos.search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          {menu.items.length === 0 ? (
            <div className="empty-inline">
              <h2>{strings.pos.noMenuItems}</h2>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-inline">
              <h2>{strings.pos.noMenuItems}</h2>
            </div>
          ) : (
            <div className="menu-grid">
              {visibleItems.map((item) => (
                <button
                  className="menu-tile"
                  key={item.id}
                  disabled={!item.is_available}
                  aria-disabled={!item.is_available}
                  onClick={() => {
                    if (item.modifierGroups.length > 0) {
                      setModifierItem(item);
                    } else {
                      addToCart(item, [], [], 0, 1, '');
                    }
                  }}
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      width="320"
                      height="240"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="menu-tile__image-placeholder" aria-hidden="true">
                      {item.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="menu-tile__name">{item.name}</span>
                  <Money value={item.price} />
                  {!item.is_available && (
                    <span className="sold-out-pill">{strings.pos.soldOut}</span>
                  )}
                  {item.modifierGroups.length > 0 && (
                    <span className="menu-tile__modifier">{strings.pos.modifierTitle}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="cart-panel" aria-labelledby="cart-title">
          <div className="cart-panel__heading">
            <h2 id="cart-title">{strings.pos.cart}</h2>
            <span>{cart.lines.reduce((count, line) => count + line.qty, 0)}</span>
          </div>
          <div className="segmented-control" role="group" aria-label={strings.pos.orderType}>
            <button
              className={cart.orderType === 'dine_in' ? 'is-selected' : ''}
              onClick={() => cart.setOrderType('dine_in')}
            >
              {strings.pos.dineIn}
            </button>
            <button
              className={cart.orderType === 'takeaway' ? 'is-selected' : ''}
              onClick={() => cart.setOrderType('takeaway')}
            >
              {strings.pos.takeaway}
            </button>
          </div>
          {cart.orderType === 'dine_in' ? (
            <label className="compact-field">
              <span>{strings.pos.table}</span>
              <input
                maxLength={30}
                value={cart.tableLabel ?? ''}
                onChange={(event) => cart.setTableLabel(event.target.value || null)}
              />
            </label>
          ) : (
            <label className="compact-field">
              <span>{strings.pos.customer}</span>
              <input
                maxLength={60}
                value={cart.customerName ?? ''}
                onChange={(event) => cart.setCustomerName(event.target.value || null)}
              />
            </label>
          )}
          <div className="cart-voucher">
            <label className="compact-field" htmlFor="pos-voucher-code">
              <span>{strings.pos.voucher}</span>
              <input
                id="pos-voucher-code"
                maxLength={32}
                value={voucherInput}
                disabled={Boolean(cart.voucherCode)}
                onChange={(event) => setVoucherInput(event.target.value.toUpperCase())}
              />
            </label>
            {cart.voucherCode ? (
              <div className="cart-voucher__applied">
                <span>{cart.voucherCode}</span>
                {voucherPreview.isPending ? (
                  <span role="status">{strings.app.loading}</span>
                ) : voucherPreview.isError ? (
                  <span role="alert">{getErrorMessage(voucherPreview.error)}</span>
                ) : (
                  <Money value={-(voucherPreview.data?.discount ?? 0)} signed />
                )}
                <button
                  className="button button--ghost"
                  onClick={() => {
                    cart.setVoucher(null);
                    validateVoucher.reset();
                  }}
                >
                  {strings.pos.removeVoucher}
                </button>
              </div>
            ) : (
              <button
                className="button button--secondary"
                disabled={!online || !voucherInput.trim() || validateVoucher.isPending}
                onClick={() =>
                  validateVoucher.mutate(
                    { code: voucherInput.trim(), subtotal },
                    { onSuccess: (voucher) => cart.setVoucher(voucher.code) },
                  )
                }
              >
                {validateVoucher.isPending ? strings.app.loading : strings.pos.applyVoucher}
              </button>
            )}
            {validateVoucher.isError && !cart.voucherCode && (
              <p className="form-alert" role="alert">
                {getErrorMessage(validateVoucher.error)}
              </p>
            )}
          </div>
          {cart.lines.length === 0 ? (
            <div className="cart-empty">
              <p>{strings.pos.emptyCart}</p>
              <span>{strings.pos.addMenu}</span>
            </div>
          ) : (
            <ul className="cart-lines">
              {cart.lines.map((line) => (
                <li className="cart-line" key={line.lineId}>
                  <div className="cart-line__description">
                    <strong>{line.name}</strong>
                    {line.modifierLabels.length > 0 && (
                      <span>{line.modifierLabels.join(', ')}</span>
                    )}
                    {line.note && <span>{line.note}</span>}
                    <Money value={calculateLineTotal(line)} />
                  </div>
                  <div className="quantity-control">
                    <button
                      aria-label={strings.pos.decreaseQty}
                      disabled={line.qty <= 1}
                      onClick={() => cart.updateQty(line.lineId, line.qty - 1)}
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      aria-label={strings.pos.increaseQty}
                      disabled={line.qty >= 100}
                      onClick={() => cart.updateQty(line.lineId, line.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="remove-line"
                    aria-label={`${strings.common.cancel} ${line.name}`}
                    onClick={() => {
                      cart.removeLine(line.lineId);
                      toast(strings.pos.removedLine, {
                        action: {
                          label: strings.pos.undo,
                          onClick: () => cart.addLine({ ...line, qty: line.qty }),
                        },
                      });
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="cart-summary">
            <div>
              <span>{strings.pos.subtotal}</span>
              <Money value={totals.subtotal} />
            </div>
            {totals.discount > 0 && (
              <div>
                <span>
                  {strings.pos.voucherDiscount} · {cart.voucherCode}
                </span>
                <Money value={-totals.discount} signed />
              </div>
            )}
            {totals.serviceAmount > 0 && (
              <div>
                <span>{strings.pos.serviceFee}</span>
                <Money value={totals.serviceAmount} />
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div>
                <span>{strings.pos.tax}</span>
                <Money value={totals.taxAmount} />
              </div>
            )}
            {totals.roundingAmount !== 0 && (
              <div>
                <span>{strings.pos.rounding}</span>
                <Money value={totals.roundingAmount} signed />
              </div>
            )}
            <div className="cart-summary__total">
              <strong>{strings.pos.total}</strong>
              <Money value={totals.grandTotal} />
            </div>
          </div>
          <div className="cart-actions">
            <button
              className="button button--secondary"
              disabled={cart.lines.length === 0}
              onClick={() => setClearConfirmation(true)}
            >
              {strings.pos.clearCart}
            </button>
            <button
              className="button button--primary"
              disabled={cart.lines.length === 0 || voucherBlocksCheckout}
              onClick={() => setPaymentOpen(true)}
            >
              {strings.pos.pay}
            </button>
          </div>
        </aside>
      </div>

      {paymentOpen && (
        <section
          className="payment-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
        >
          <div className="payment-drawer__header">
            <h2 id="payment-title">{strings.pos.payment}</h2>
            <button className="button button--secondary" onClick={() => setPaymentOpen(false)}>
              {strings.pos.cancelPayment}
            </button>
          </div>
          <div className="payment-total">
            <span>{strings.pos.total}</span>
            <Money value={totals.grandTotal} />
          </div>
          <fieldset className="payment-method-picker">
            <legend>{strings.pos.paymentMethod}</legend>
            {(['cash', 'transfer', 'ewallet'] as const).map((method) => (
              <label
                className={
                  paymentMethod === method ? 'payment-method is-selected' : 'payment-method'
                }
                key={method}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                />
                <span>
                  {method === 'cash'
                    ? strings.pos.cash
                    : method === 'transfer'
                      ? strings.pos.transfer
                      : strings.pos.ewallet}
                </span>
              </label>
            ))}
          </fieldset>
          {paymentMethod === 'cash' ? (
            <>
              <MoneyField
                id="cash-received"
                label={strings.pos.amountReceived}
                value={received}
                onChange={setReceived}
                autoFocus
              />
              <div className="quick-cash" aria-label={strings.pos.amountReceived}>
                {quickCashAmounts(totals.grandTotal).map((amount) => (
                  <button
                    className="button button--secondary"
                    key={amount}
                    onClick={() => setReceived(String(amount))}
                  >
                    <Money value={amount} />
                  </button>
                ))}
              </div>
              {received && (
                <div className={change < 0 ? 'change-summary is-short' : 'change-summary'}>
                  <strong>{change < 0 ? strings.pos.shortfall : strings.pos.change}</strong>
                  <Money value={change} signed tone={change < 0 ? 'danger' : 'success'} />
                </div>
              )}
            </>
          ) : (
            <div className="noncash-payment-form">
              <fieldset className="payment-account-picker">
                <legend>{strings.pos.paymentAccount}</legend>
                {accountChoices.length === 0 ? (
                  <p>{strings.pos.noPaymentAccounts}</p>
                ) : (
                  accountChoices.map((account) => (
                    <div
                      className={
                        paymentAccountId === account.id
                          ? 'payment-account is-selected'
                          : 'payment-account'
                      }
                      key={account.id}
                    >
                      <input
                        id={`payment-account-${account.id}`}
                        type="radio"
                        name="payment-account"
                        checked={paymentAccountId === account.id}
                        onChange={() => setPaymentAccountId(account.id)}
                      />
                      <label htmlFor={`payment-account-${account.id}`}>
                        <strong>{account.provider}</strong>
                        <span>{account.account_name}</span>
                        <span>{account.account_no}</span>
                      </label>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(account.account_no)
                            .then(() => toast.success(strings.pos.accountCopied));
                        }}
                      >
                        {strings.pos.copyAccount}
                      </button>
                    </div>
                  ))
                )}
              </fieldset>
              <label className="field">
                <span>{strings.pos.paymentReference}</span>
                <input
                  autoComplete="off"
                  minLength={4}
                  maxLength={40}
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(event.target.value.replace(/[^A-Za-z0-9]/g, ''))
                  }
                />
              </label>
              {accountsQuery.isError && (
                <p className="form-alert" role="alert">
                  {getErrorMessage(accountsQuery.error)}
                </p>
              )}
            </div>
          )}
          {!online && (
            <p className="form-alert" role="alert">
              {strings.pos.connectionError}
            </p>
          )}
          {createOrder.isError && (
            <p className="form-alert" role="alert">
              {strings.pos.checkoutError} {getErrorMessage(createOrder.error)}
            </p>
          )}
          <button
            className="button button--primary payment-submit"
            disabled={!canPay || voucherBlocksCheckout || createOrder.isPending}
            onClick={checkout}
          >
            {createOrder.isPending ? strings.pos.processingPayment : strings.pos.finishPayment}
          </button>
        </section>
      )}

      {clearConfirmation && (
        <ConfirmAction
          title={strings.pos.clearCartTitle}
          description={strings.pos.clearCartDescription}
          confirmLabel={strings.pos.clearCart}
          tone="danger"
          onConfirm={() => {
            cart.clear();
            setClearConfirmation(false);
          }}
        />
      )}

      {modifierItem && (
        <ModifierPicker
          key={modifierItem.id}
          item={modifierItem}
          onClose={() => setModifierItem(null)}
          onAdd={(ids, labels, extra, qty, note) =>
            addToCart(modifierItem, ids, labels, extra, qty, note)
          }
        />
      )}

      {createdOrder && (
        <section className="success-screen" role="status" aria-live="polite">
          <p className="eyebrow">{strings.pos.paymentSuccess}</p>
          <h2>{strings.pos.orderNumber}</h2>
          <strong className="order-number">{createdOrder.orderNo}</strong>
          <Money value={createdOrder.total} />
          <button
            className="button button--primary"
            autoFocus
            onClick={() => {
              setCreatedOrder(null);
              setPaymentOpen(false);
            }}
          >
            {strings.pos.newOrder}
          </button>
        </section>
      )}
    </main>
  );
}
