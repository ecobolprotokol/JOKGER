import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { ErrorState } from '../../shared/components/ErrorState';
import { PageHeader } from '../../shared/components/PageHeader';
import { formatDate } from '../../shared/lib/format';
import { toAppError, type AppError } from '../../shared/lib/errors';
import { strings } from '../../shared/strings/id';
import { useProfile } from '../auth';
import { signOut } from '../auth/api';
import { useCreateStaff, useSetStaffActive, useSetStaffRole, useStaff } from './hooks';
import type { StaffCreationInput, StaffProfile } from './api';

type StaffAction =
  | { kind: 'role'; staff: StaffProfile; role: StaffProfile['role'] }
  | { kind: 'deactivate'; staff: StaffProfile };

function errorStatus(error: AppError): number | null {
  if (
    typeof error.raw === 'object' &&
    error.raw !== null &&
    'status' in error.raw &&
    typeof error.raw.status === 'number'
  )
    return error.raw.status;
  return null;
}

function generatedPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function StaffPage(): JSX.Element {
  const query = useStaff();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const create = useCreateStaff();
  const setRole = useSetStaffRole();
  const setActive = useSetStaffActive();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<StaffAction | null>(null);
  const [input, setInput] = useState<StaffCreationInput>({
    email: '',
    full_name: '',
    role: 'admin',
    password: '',
  });
  const [formError, setFormError] = useState<AppError | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setEmailError(null);
    try {
      await create.mutateAsync(input);
      setDialogOpen(false);
      toast.success(`${strings.staff.createdToast} ${input.full_name.trim()}`);
      setInput({ email: '', full_name: '', role: 'admin', password: '' });
    } catch (error) {
      const parsed = toAppError(error);
      const status = errorStatus(parsed);
      if (parsed.code === 'STAFF_EMAIL_EXISTS') setEmailError(parsed.message);
      else if (parsed.code === 'INPUT_INVALID') setFormError(parsed);
      else if (status === 401) {
        await signOut();
        queryClient.clear();
        setFormError(parsed);
      } else setFormError(parsed);
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
        <h1>{strings.staff.loadError}</h1>
        <ErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />
      </main>
    );

  const rows = query.data ?? [];
  const ownId = profile.data?.id;

  return (
    <main className="settings-page">
      <PageHeader
        title={strings.staff.title}
        actions={
          <button className="button button--primary" onClick={() => setDialogOpen(true)}>
            {strings.staff.add}
          </button>
        }
      />
      {rows.length === 0 ? (
        <section className="orders-empty" role="status">
          <h2>{strings.staff.empty}</h2>
        </section>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.staff.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.staff.name}</th>
                <th scope="col">{strings.staff.email}</th>
                <th scope="col">{strings.staff.role}</th>
                <th scope="col">{strings.staff.status}</th>
                <th scope="col">{strings.staff.created}</th>
                <th scope="col">{strings.staff.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((staff) => {
                const isSelf = staff.id === ownId;
                return (
                  <tr key={staff.id}>
                    <th scope="row">
                      {staff.full_name}
                      {isSelf && <small className="staff-self-label">{strings.staff.you}</small>}
                    </th>
                    <td>{staff.email ?? strings.orderDetail.notApplicable}</td>
                    <td>
                      {staff.role === 'super_admin'
                        ? strings.staff.superAdmin
                        : strings.staff.admin}
                    </td>
                    <td>{staff.is_active ? strings.staff.active : strings.staff.inactive}</td>
                    <td>{formatDate(staff.created_at)}</td>
                    <td>
                      <div className="staff-actions">
                        {!isSelf && (
                          <>
                            <button
                              className="button button--secondary"
                              onClick={() =>
                                setAction({
                                  kind: 'role',
                                  staff,
                                  role: staff.role === 'admin' ? 'super_admin' : 'admin',
                                })
                              }
                            >
                              {strings.staff.editRole}
                            </button>
                            {staff.is_active ? (
                              <button
                                className="button button--danger"
                                onClick={() => setAction({ kind: 'deactivate', staff })}
                              >
                                {strings.staff.deactivate}
                              </button>
                            ) : (
                              <button
                                className="button button--secondary"
                                disabled={setActive.isPending}
                                onClick={() =>
                                  setActive.mutate(
                                    { userId: staff.id, active: true },
                                    {
                                      onSuccess: () => toast.success(strings.staff.saved),
                                      onError: (error) => toast.error(toAppError(error).message),
                                    },
                                  )
                                }
                              >
                                {strings.staff.activate}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {dialogOpen && (
        <section className="inventory-dialog-backdrop">
          <form
            className="inventory-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-create-title"
            onSubmit={(event) => void submit(event)}
          >
            <h2 id="staff-create-title">{strings.staff.add}</h2>
            <label className="field">
              <span>{strings.staff.name}</span>
              <input
                autoFocus
                maxLength={100}
                required
                value={input.full_name}
                onChange={(event) => setInput({ ...input, full_name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{strings.staff.email}</span>
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                aria-invalid={Boolean(emailError)}
                value={input.email}
                onChange={(event) => {
                  setInput({ ...input, email: event.target.value });
                  setEmailError(null);
                }}
              />
              {emailError && <small className="form-alert">{emailError}</small>}
            </label>
            <label className="field">
              <span>{strings.staff.role}</span>
              <select
                value={input.role}
                onChange={(event) =>
                  setInput({ ...input, role: event.target.value as StaffProfile['role'] })
                }
              >
                <option value="admin">{strings.staff.admin}</option>
                <option value="super_admin">{strings.staff.superAdmin}</option>
              </select>
            </label>
            <label className="field">
              <span>{strings.staff.password}</span>
              <div className="staff-password-field">
                <input
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  value={input.password}
                  onChange={(event) => setInput({ ...input, password: event.target.value })}
                />
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setInput({ ...input, password: generatedPassword() })}
                >
                  {strings.staff.generatePassword}
                </button>
              </div>
            </label>
            <p className="settings-hint">{strings.staff.passwordHint}</p>
            {formError && (
              <p className="form-alert" role="alert">
                {formError.message}
              </p>
            )}
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setDialogOpen(false)}
              >
                {strings.common.cancel}
              </button>
              <button className="button button--primary" disabled={create.isPending}>
                {create.isPending ? strings.common.loading : strings.staff.create}
              </button>
            </div>
          </form>
        </section>
      )}
      {action?.kind === 'role' && (
        <ConfirmAction
          title={strings.staff.roleTitle}
          description={strings.staff.roleDescription}
          confirmLabel={strings.staff.editRole}
          onConfirm={async () => {
            await setRole.mutateAsync({ userId: action.staff.id, role: action.role });
            toast.success(strings.staff.saved);
            setAction(null);
          }}
        />
      )}
      {action?.kind === 'deactivate' && (
        <ConfirmAction
          title={strings.staff.deactivateTitle}
          description={strings.staff.deactivateDescription}
          confirmLabel={strings.staff.deactivate}
          tone="danger"
          onConfirm={async () => {
            await setActive.mutateAsync({ userId: action.staff.id, active: false });
            toast.success(strings.staff.saved);
            setAction(null);
          }}
        />
      )}
    </main>
  );
}
