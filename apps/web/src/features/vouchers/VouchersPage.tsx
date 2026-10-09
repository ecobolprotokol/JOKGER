import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { Money } from '../../shared/components/Money';
import { formatDate, formatPercent } from '../../shared/lib/format';
import { calculateVoucherDiscount } from '../../shared/lib/money';
import { strings } from '../../shared/strings/id';
import { useSetVoucherActive, useUpsertVoucher, useVouchers, type Voucher } from './index';

const voucherFormSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,32}$/),
    name: z.string().trim().min(1).max(100),
    type: z.enum(['percent', 'nominal']),
    value: z.coerce.number().int().positive().max(999_999_999),
    minSubtotal: z.coerce.number().int().nonnegative().max(999_999_999),
    maxDiscount: z.string().refine((value) => value === '' || /^\d+$/.test(value)),
    validFrom: z.string().min(1),
    validUntil: z.string().min(1),
    totalQuota: z.string().refine((value) => value === '' || /^\d+$/.test(value)),
    isActive: z.boolean(),
  })
  .superRefine((voucher, context) => {
    if (voucher.type === 'percent' && voucher.value > 100) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: strings.vouchers.percentInvalid,
      });
    }
    const maxDiscount = voucher.maxDiscount === '' ? null : Number(voucher.maxDiscount);
    const totalQuota = voucher.totalQuota === '' ? null : Number(voucher.totalQuota);
    if (voucher.type === 'nominal' && maxDiscount !== null) {
      context.addIssue({
        code: 'custom',
        path: ['maxDiscount'],
        message: strings.vouchers.maxDiscountPercentOnly,
      });
    }
    if (maxDiscount !== null && (!Number.isSafeInteger(maxDiscount) || maxDiscount <= 0)) {
      context.addIssue({
        code: 'custom',
        path: ['maxDiscount'],
        message: strings.vouchers.invalidMaxDiscount,
      });
    }
    if (totalQuota !== null && (!Number.isSafeInteger(totalQuota) || totalQuota <= 0)) {
      context.addIssue({
        code: 'custom',
        path: ['totalQuota'],
        message: strings.vouchers.invalidQuota,
      });
    }
    if (Date.parse(voucher.validUntil) <= Date.parse(voucher.validFrom)) {
      context.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: strings.vouchers.invalidPeriod,
      });
    }
  });

type VoucherFormValues = z.infer<typeof voucherFormSchema>;

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toJakartaInput(value: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(value))
    .replace(' ', 'T');
}

function toJakartaIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

function voucherStatus(voucher: Voucher): string {
  const now = Date.now();
  if (!voucher.is_active) return strings.vouchers.inactive;
  if (now < Date.parse(voucher.valid_from)) return strings.vouchers.notStarted;
  if (now > Date.parse(voucher.valid_until)) return strings.vouchers.expired;
  if (voucher.total_quota !== null && voucher.used_count >= voucher.total_quota) {
    return strings.vouchers.quotaUsed;
  }
  return strings.vouchers.active;
}

export function VouchersPage() {
  const vouchers = useVouchers();
  const saveVoucher = useUpsertVoucher();
  const setActive = useSetVoucherActive();
  const [formOpen, setFormOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{ voucher: Voucher; active: boolean } | null>(
    null,
  );
  const [previewSubtotal, setPreviewSubtotal] = useState('100000');
  const form = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: defaultVoucherValues(),
  });

  if (vouchers.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (vouchers.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.vouchers.loadError}</h1>
        <p>{getErrorMessage(vouchers.error)}</p>
        <button className="button button--secondary" onClick={() => void vouchers.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const preview = calculatePreview(
    form.watch('type'),
    Number(form.watch('value')),
    form.watch('maxDiscount'),
    Number(previewSubtotal),
  );

  function beginCreate(): void {
    setEditingVoucher(null);
    saveVoucher.reset();
    form.reset(defaultVoucherValues());
    setFormOpen(true);
  }

  function beginEdit(voucher: Voucher): void {
    setEditingVoucher(voucher);
    saveVoucher.reset();
    form.reset({
      id: voucher.id,
      code: voucher.code,
      name: voucher.name,
      type: voucher.type,
      value: voucher.value,
      minSubtotal: voucher.min_subtotal,
      maxDiscount: voucher.max_discount === null ? '' : String(voucher.max_discount),
      validFrom: toJakartaInput(voucher.valid_from),
      validUntil: toJakartaInput(voucher.valid_until),
      totalQuota: voucher.total_quota === null ? '' : String(voucher.total_quota),
      isActive: voucher.is_active,
    });
    setFormOpen(true);
  }

  function submitVoucher(values: VoucherFormValues): void {
    saveVoucher.mutate(
      {
        ...(values.id ? { id: values.id } : {}),
        code: values.code,
        name: values.name,
        type: values.type,
        value: values.value,
        minSubtotal: values.minSubtotal,
        maxDiscount: values.maxDiscount === '' ? null : Number(values.maxDiscount),
        validFrom: toJakartaIso(values.validFrom),
        validUntil: toJakartaIso(values.validUntil),
        totalQuota: values.totalQuota === '' ? null : Number(values.totalQuota),
        isActive: values.isActive,
      },
      {
        onSuccess: () => {
          setFormOpen(false);
          toast.success(strings.vouchers.saved);
        },
      },
    );
  }

  function generateCode(): void {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    form.setValue(
      'code',
      Array.from(bytes, (byte) => CODE_CHARACTERS[byte % CODE_CHARACTERS.length] ?? 'A').join(''),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <main className="inventory-page voucher-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.vouchers.title}</h1>
        </div>
        <button className="button button--primary" onClick={beginCreate}>
          {strings.vouchers.add}
        </button>
      </header>

      {formOpen && (
        <section className="menu-edit-panel" aria-labelledby="voucher-form-title">
          <h2 id="voucher-form-title">
            {editingVoucher ? strings.vouchers.edit : strings.vouchers.add}
          </h2>
          <form className="voucher-form-grid" onSubmit={form.handleSubmit(submitVoucher)}>
            <label>
              <span>{strings.vouchers.code}</span>
              <div className="voucher-code-field">
                <input
                  maxLength={32}
                  {...form.register('code', {
                    onChange: (event) =>
                      form.setValue('code', event.currentTarget.value.toUpperCase(), {
                        shouldDirty: true,
                        shouldValidate: true,
                      }),
                  })}
                />
                <button className="button button--secondary" type="button" onClick={generateCode}>
                  {strings.vouchers.generate}
                </button>
              </div>
              {form.formState.errors.code && (
                <small role="alert">{strings.vouchers.invalidCode}</small>
              )}
            </label>
            <label>
              <span>{strings.vouchers.name}</span>
              <input maxLength={100} {...form.register('name')} />
              {form.formState.errors.name && (
                <small role="alert">{strings.vouchers.invalidName}</small>
              )}
            </label>
            <label>
              <span>{strings.vouchers.type}</span>
              <select
                {...form.register('type', {
                  onChange: (event) => {
                    if (event.currentTarget.value === 'nominal') {
                      form.setValue('maxDiscount', '', { shouldDirty: true });
                    }
                  },
                })}
              >
                <option value="percent">{strings.vouchers.percent}</option>
                <option value="nominal">{strings.vouchers.nominal}</option>
              </select>
            </label>
            <label>
              <span>{strings.vouchers.value}</span>
              <input type="number" min="1" step="1" {...form.register('value')} />
              {form.formState.errors.value && (
                <small role="alert">
                  {form.watch('type') === 'percent'
                    ? strings.vouchers.percentInvalid
                    : strings.vouchers.invalidValue}
                </small>
              )}
            </label>
            <label>
              <span>{strings.vouchers.minSubtotal}</span>
              <input type="number" min="0" step="1" {...form.register('minSubtotal')} />
              {form.formState.errors.minSubtotal && (
                <small role="alert">{strings.vouchers.invalidMinSubtotal}</small>
              )}
            </label>
            {form.watch('type') === 'percent' && (
              <label>
                <span>{strings.vouchers.maxDiscount}</span>
                <input type="number" min="1" step="1" {...form.register('maxDiscount')} />
                {form.formState.errors.maxDiscount && (
                  <small role="alert">{strings.vouchers.invalidMaxDiscount}</small>
                )}
              </label>
            )}
            <label>
              <span>{strings.vouchers.validFrom}</span>
              <input type="datetime-local" {...form.register('validFrom')} />
            </label>
            <label>
              <span>{strings.vouchers.validUntil}</span>
              <input type="datetime-local" {...form.register('validUntil')} />
              {form.formState.errors.validUntil && <small>{strings.vouchers.invalidPeriod}</small>}
            </label>
            <label>
              <span>{strings.vouchers.quota}</span>
              <input type="number" min="1" step="1" {...form.register('totalQuota')} />
              {form.formState.errors.totalQuota && (
                <small role="alert">{strings.vouchers.invalidQuota}</small>
              )}
            </label>
            <label className="menu-toggle-field">
              <input type="checkbox" {...form.register('isActive')} />
              <span>{strings.vouchers.active}</span>
            </label>
            <div className="voucher-preview">
              <label>
                <span>{strings.vouchers.previewSubtotal}</span>
                <input
                  inputMode="numeric"
                  type="number"
                  min="0"
                  step="1"
                  value={previewSubtotal}
                  onChange={(event) => setPreviewSubtotal(event.target.value)}
                />
              </label>
              <p>
                {strings.vouchers.previewDiscount}: <Money value={preview.discount} />
              </p>
              <p>
                {strings.vouchers.previewTotal}: <Money value={preview.total} />
              </p>
            </div>
            <div className="inventory-actions menu-form-actions">
              <button className="button button--primary" disabled={saveVoucher.isPending}>
                {strings.common.save}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                {strings.common.cancel}
              </button>
            </div>
          </form>
          {saveVoucher.isError && <p role="alert">{getErrorMessage(saveVoucher.error)}</p>}
        </section>
      )}

      {vouchers.data.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.vouchers.empty}</h2>
        </section>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.vouchers.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.vouchers.code}</th>
                <th scope="col">{strings.vouchers.name}</th>
                <th scope="col">{strings.vouchers.type}</th>
                <th scope="col">{strings.vouchers.period}</th>
                <th scope="col">{strings.vouchers.quota}</th>
                <th scope="col">{strings.vouchers.status}</th>
                <th scope="col">{strings.vouchers.actions}</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.data.map((voucher) => (
                <tr key={voucher.id}>
                  <th scope="row" className="voucher-code">
                    {voucher.code}
                  </th>
                  <td>{voucher.name}</td>
                  <td>
                    {voucher.type === 'percent' ? (
                      <>
                        {formatPercent(voucher.value)}
                        {` · `}
                        <Money value={voucher.max_discount ?? 0} />
                      </>
                    ) : (
                      <Money value={voucher.value} />
                    )}
                  </td>
                  <td>
                    {formatDate(voucher.valid_from)} – {formatDate(voucher.valid_until)}
                  </td>
                  <td>
                    {voucher.used_count} / {voucher.total_quota ?? strings.vouchers.unlimited}
                  </td>
                  <td>{voucherStatus(voucher)}</td>
                  <td>
                    <div className="inventory-actions">
                      <button className="button button--ghost" onClick={() => beginEdit(voucher)}>
                        {strings.vouchers.edit}
                      </button>
                      <button
                        className="button button--secondary"
                        onClick={() => setToggleTarget({ voucher, active: !voucher.is_active })}
                      >
                        {voucher.is_active
                          ? strings.vouchers.deactivate
                          : strings.vouchers.activate}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toggleTarget && (
        <ConfirmAction
          title={
            toggleTarget.active ? strings.vouchers.activateTitle : strings.vouchers.deactivateTitle
          }
          description={strings.vouchers.toggleDescription}
          confirmLabel={
            toggleTarget.active ? strings.vouchers.activate : strings.vouchers.deactivate
          }
          tone={toggleTarget.active ? 'default' : 'danger'}
          onConfirm={async () => {
            await setActive.mutateAsync({
              voucherId: toggleTarget.voucher.id,
              active: toggleTarget.active,
            });
            setToggleTarget(null);
          }}
        />
      )}
    </main>
  );
}

function defaultVoucherValues(): VoucherFormValues {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: '',
    name: '',
    type: 'percent',
    value: 10,
    minSubtotal: 0,
    maxDiscount: '',
    validFrom: toJakartaInput(start.toISOString()),
    validUntil: toJakartaInput(end.toISOString()),
    totalQuota: '',
    isActive: true,
  };
}

function calculatePreview(
  type: 'percent' | 'nominal',
  value: number,
  maxDiscountInput: string,
  subtotal: number,
): { discount: number; total: number } {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) return { discount: 0, total: 0 };
  try {
    const discount = calculateVoucherDiscount({
      subtotal,
      type,
      value: Number.isSafeInteger(value) && value >= 0 ? value : 0,
      maxDiscount: maxDiscountInput ? Number(maxDiscountInput) : null,
    });
    return { discount, total: subtotal - discount };
  } catch {
    return { discount: 0, total: subtotal };
  }
}
