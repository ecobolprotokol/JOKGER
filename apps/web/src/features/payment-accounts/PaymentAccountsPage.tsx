import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  usePaymentAccounts,
  useSetPaymentAccountActive,
  useUpsertPaymentAccount,
  type PaymentAccount,
} from './index';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { PageHeader } from '../../shared/components/PageHeader';
import { strings } from '../../shared/strings/id';

type AccountFormState = {
  id: string | null;
  method: 'transfer' | 'ewallet';
  provider: string;
  accountName: string;
  accountNo: string;
  sortOrder: string;
};

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function PaymentAccountsPage() {
  const accounts = usePaymentAccounts();
  const saveAccount = useUpsertPaymentAccount();
  const setActive = useSetPaymentAccountActive();
  const [formOpen, setFormOpen] = useState(false);
  const [accountToDeactivate, setAccountToDeactivate] = useState<PaymentAccount | null>(null);
  const [form, setForm] = useState<AccountFormState>({
    id: null,
    method: 'transfer',
    provider: '',
    accountName: '',
    accountNo: '',
    sortOrder: '0',
  });

  if (accounts.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }
  if (accounts.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.paymentAccounts.title}</h1>
        <p>{errorMessage(accounts.error)}</p>
        <button className="button button--secondary" onClick={() => void accounts.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  function openForm(account: PaymentAccount | null): void {
    setForm({
      id: account?.id ?? null,
      method: account?.method ?? 'transfer',
      provider: account?.provider ?? '',
      accountName: account?.account_name ?? '',
      accountNo: account?.account_no ?? '',
      sortOrder: String(account?.sort_order ?? 0),
    });
    saveAccount.reset();
    setFormOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveAccount.mutate(
      {
        ...(form.id ? { id: form.id } : {}),
        method: form.method,
        provider: form.provider,
        account_name: form.accountName,
        account_no: form.accountNo,
        sort_order: Number(form.sortOrder),
        is_active: true,
      },
      { onSuccess: () => setFormOpen(false) },
    );
  }

  return (
    <main className="payment-accounts-page">
      <PageHeader
        title={strings.paymentAccounts.title}
        actions={
          <div className="payment-accounts-header-actions">
            <Link className="button button--secondary" to="/pos">
              {strings.pos.title}
            </Link>
            <button className="button button--primary" onClick={() => openForm(null)}>
              {strings.paymentAccounts.add}
            </button>
          </div>
        }
      />

      {accounts.data.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.paymentAccounts.empty}</h2>
          <button className="button button--primary" onClick={() => openForm(null)}>
            {strings.paymentAccounts.add}
          </button>
        </section>
      ) : (
        <div className="payment-account-grid">
          {accounts.data.map((account) => (
            <article className="payment-account-card" key={account.id}>
              <div className="payment-account-card__heading">
                <div>
                  <h2>{account.provider}</h2>
                  <p>
                    {account.method === 'transfer'
                      ? strings.paymentVerification.transfer
                      : strings.paymentVerification.ewallet}
                  </p>
                </div>
                <span
                  className={
                    account.is_active ? 'inventory-status is-safe' : 'inventory-status is-empty'
                  }
                >
                  {account.is_active
                    ? strings.paymentAccounts.active
                    : strings.paymentAccounts.inactive}
                </span>
              </div>
              <dl>
                <div>
                  <dt>{strings.paymentAccounts.accountName}</dt>
                  <dd>{account.account_name}</dd>
                </div>
                <div>
                  <dt>{strings.paymentAccounts.accountNumber}</dt>
                  <dd>
                    {strings.paymentAccounts.maskedPrefix}
                    {account.account_no.slice(-4)}
                  </dd>
                </div>
              </dl>
              <div className="payment-account-card__actions">
                <button className="button button--secondary" onClick={() => openForm(account)}>
                  {strings.paymentAccounts.edit}
                </button>
                {account.is_active ? (
                  <button
                    className="button button--danger"
                    onClick={() => setAccountToDeactivate(account)}
                  >
                    {strings.paymentAccounts.deactivate}
                  </button>
                ) : (
                  <button
                    className="button button--secondary"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ accountId: account.id, active: true })}
                  >
                    {strings.paymentAccounts.activate}
                  </button>
                )}
              </div>
              {saveAccount.isError && (
                <p className="form-alert" role="alert">
                  {strings.paymentAccounts.saveError} {errorMessage(saveAccount.error)}
                </p>
              )}
              {setActive.isError && (
                <p className="form-alert" role="alert">
                  {errorMessage(setActive.error)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <section className="inventory-dialog-backdrop">
          <form
            className="inventory-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-form-title"
            onSubmit={submit}
          >
            <h2 id="account-form-title">
              {form.id ? strings.paymentAccounts.edit : strings.paymentAccounts.add}
            </h2>
            <fieldset className="segmented-control" aria-label={strings.paymentAccounts.method}>
              <label className={form.method === 'transfer' ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name="method"
                  checked={form.method === 'transfer'}
                  onChange={() => setForm((current) => ({ ...current, method: 'transfer' }))}
                />
                {strings.paymentVerification.transfer}
              </label>
              <label className={form.method === 'ewallet' ? 'is-selected' : ''}>
                <input
                  type="radio"
                  name="method"
                  checked={form.method === 'ewallet'}
                  onChange={() => setForm((current) => ({ ...current, method: 'ewallet' }))}
                />
                {strings.paymentVerification.ewallet}
              </label>
            </fieldset>
            <label className="field">
              <span>{strings.paymentAccounts.provider}</span>
              <input
                required
                maxLength={60}
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({ ...current, provider: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.paymentAccounts.accountName}</span>
              <input
                required
                maxLength={100}
                value={form.accountName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountName: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.paymentAccounts.accountNumber}</span>
              <input
                required
                minLength={5}
                maxLength={30}
                inputMode="numeric"
                value={form.accountNo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accountNo: event.target.value.replace(/\D/g, ''),
                  }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.paymentAccounts.sortOrder}</span>
              <input
                required
                type="number"
                step="1"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
              />
            </label>
            {saveAccount.isError && (
              <p className="form-alert" role="alert">
                {strings.paymentAccounts.saveError} {errorMessage(saveAccount.error)}
              </p>
            )}
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setFormOpen(false)}
              >
                {strings.common.cancel}
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={saveAccount.isPending || form.accountNo.length < 5}
              >
                {saveAccount.isPending ? strings.common.loading : strings.paymentAccounts.save}
              </button>
            </div>
          </form>
        </section>
      )}
      {accountToDeactivate && (
        <ConfirmAction
          title={`${strings.paymentAccounts.deactivateTitle} ${accountToDeactivate.provider}?`}
          description={strings.paymentAccounts.deactivateDescription}
          confirmLabel={strings.paymentAccounts.deactivate}
          tone="danger"
          onConfirm={async () => {
            await setActive.mutateAsync({ accountId: accountToDeactivate.id, active: false });
            setAccountToDeactivate(null);
          }}
        />
      )}
    </main>
  );
}
