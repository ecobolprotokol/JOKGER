import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { ErrorState } from '../../shared/components/ErrorState';
import { toAppError } from '../../shared/lib/errors';
import { strings } from '../../shared/strings/id';
import { useSaveStoreSettings, useStoreSettings } from './hooks';
import type { StoreSettings, StoreSettingsPatch } from './api';

export function SettingsPage(): JSX.Element {
  const query = useStoreSettings();
  const save = useSaveStoreSettings();
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [confirmDisableVerification, setConfirmDisableVerification] = useState(false);

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  async function saveSection(
    event: FormEvent<HTMLFormElement>,
    values: StoreSettingsPatch,
  ): Promise<void> {
    event.preventDefault();
    try {
      const updated = await save.mutateAsync(values);
      setForm((current) => (current ? { ...current, ...updated } : updated));
      toast.success(strings.settings.saved);
    } catch {
      toast.error(strings.settings.saveError);
    }
  }

  if (query.isPending)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  if (query.isError)
    return (
      <main className="page-state">
        <h1>{strings.settings.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );
  if (!form)
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );

  return (
    <main className="settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.settings.title}</h1>
        </div>
      </header>

      <form
        className="settings-section"
        onSubmit={(event) =>
          void saveSection(event, {
            store_name: form.store_name,
            address: form.address,
            phone: form.phone,
            logo_url: form.logo_url,
          })
        }
      >
        <h2>{strings.settings.identity}</h2>
        <label className="field">
          <span>{strings.settings.storeName}</span>
          <input
            required
            maxLength={100}
            value={form.store_name}
            onChange={(event) => setForm({ ...form, store_name: event.target.value })}
          />
        </label>
        <label className="field">
          <span>{strings.settings.address}</span>
          <textarea
            maxLength={300}
            value={form.address ?? ''}
            onChange={(event) => setForm({ ...form, address: event.target.value || null })}
          />
        </label>
        <label className="field">
          <span>{strings.settings.phone}</span>
          <input
            maxLength={30}
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value || null })}
          />
        </label>
        <label className="field">
          <span>{strings.settings.logoUrl}</span>
          <input
            type="url"
            value={form.logo_url ?? ''}
            onChange={(event) => setForm({ ...form, logo_url: event.target.value || null })}
          />
        </label>
        <button className="button button--primary" disabled={save.isPending}>
          {strings.common.save}
        </button>
      </form>

      <form
        className="settings-section"
        onSubmit={(event) =>
          void saveSection(event, {
            tax_percent: form.tax_percent,
            service_percent: form.service_percent,
            rounding_rule: form.rounding_rule,
          })
        }
      >
        <h2>{strings.settings.taxAndService}</h2>
        <div className="settings-grid">
          <label className="field">
            <span>{strings.settings.taxPercent}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.tax_percent}
              onChange={(event) => setForm({ ...form, tax_percent: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>{strings.settings.servicePercent}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.service_percent}
              onChange={(event) =>
                setForm({ ...form, service_percent: Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>{strings.settings.roundingRule}</span>
            <select
              value={form.rounding_rule}
              onChange={(event) =>
                setForm({
                  ...form,
                  rounding_rule: event.target.value as StoreSettings['rounding_rule'],
                })
              }
            >
              <option value="none">{strings.settings.noRounding}</option>
              <option value="up_100">{strings.settings.roundUp100}</option>
              <option value="nearest_100">{strings.settings.nearest100}</option>
            </select>
          </label>
        </div>
        <button className="button button--primary" disabled={save.isPending}>
          {strings.common.save}
        </button>
      </form>

      <form
        className="settings-section"
        onSubmit={(event) =>
          void saveSection(event, { require_verified_payment: form.require_verified_payment })
        }
      >
        <h2>{strings.settings.payment}</h2>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={form.require_verified_payment}
            onChange={(event) => {
              if (!event.target.checked) setConfirmDisableVerification(true);
              else setForm({ ...form, require_verified_payment: true });
            }}
          />
          <span>
            <strong>{strings.settings.requireVerifiedPayment}</strong>
            <small>{strings.settings.requireVerifiedHint}</small>
          </span>
        </label>
        <button className="button button--primary" disabled={save.isPending}>
          {strings.common.save}
        </button>
      </form>

      <form
        className="settings-section"
        onSubmit={(event) =>
          void saveSection(event, {
            receipt_header: form.receipt_header,
            receipt_footer: form.receipt_footer,
            paper_width_mm: form.paper_width_mm,
          })
        }
      >
        <h2>{strings.settings.receipt}</h2>
        <label className="field">
          <span>{strings.settings.receiptHeader}</span>
          <textarea
            maxLength={300}
            value={form.receipt_header ?? ''}
            onChange={(event) => setForm({ ...form, receipt_header: event.target.value || null })}
          />
        </label>
        <label className="field">
          <span>{strings.settings.receiptFooter}</span>
          <textarea
            maxLength={300}
            value={form.receipt_footer ?? ''}
            onChange={(event) => setForm({ ...form, receipt_footer: event.target.value || null })}
          />
        </label>
        <label className="field">
          <span>{strings.settings.paperWidth}</span>
          <select
            value={form.paper_width_mm}
            onChange={(event) =>
              setForm({ ...form, paper_width_mm: Number(event.target.value) as 58 | 80 })
            }
          >
            <option value={58}>58 mm</option>
            <option value={80}>80 mm</option>
          </select>
        </label>
        <button className="button button--primary" disabled={save.isPending}>
          {strings.common.save}
        </button>
      </form>

      {confirmDisableVerification && (
        <ConfirmAction
          title={strings.settings.disableVerifiedTitle}
          description={strings.settings.disableVerifiedDescription}
          confirmLabel={strings.common.confirm}
          onConfirm={() => {
            setForm({ ...form, require_verified_payment: false });
            setConfirmDisableVerification(false);
          }}
        />
      )}
    </main>
  );
}
