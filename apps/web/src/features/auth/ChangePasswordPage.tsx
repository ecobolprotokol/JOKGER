import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { changePassword } from './api';
import { changePasswordSchema, type ChangePasswordInput } from './schemas';
import { strings } from '../../shared/strings/id';

export function ChangePasswordPage() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onBlur',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: async (values: ChangePasswordInput) => {
      const result = await changePassword(values.currentPassword, values.newPassword);
      if (!result.ok) throw result.error;
    },
    onSuccess: () => {
      form.reset();
      toast.success(strings.auth.passwordChanged);
    },
  });
  const currentError = form.formState.errors.currentPassword?.message;
  const newError = form.formState.errors.newPassword?.message;
  const confirmError = form.formState.errors.confirmPassword?.message;

  return (
    <main className="shift-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.auth.passwordChangeTitle}</h1>
        </div>
        <Link className="button button--secondary" to="/">
          {strings.auth.backToOperations}
        </Link>
      </header>
      <section className="shift-panel" aria-labelledby="change-password-title">
        <h2 id="change-password-title">{strings.auth.passwordChangeTitle}</h2>
        <p>{strings.auth.passwordChangeDescription}</p>
        <form
          className="form-stack"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="field">
            <label htmlFor="current-password">{strings.auth.passwordCurrent}</label>
            <input
              autoComplete="current-password"
              id="current-password"
              type="password"
              aria-invalid={Boolean(currentError)}
              aria-describedby={currentError ? 'current-password-error' : undefined}
              {...form.register('currentPassword')}
            />
            {currentError && (
              <p className="field-error" id="current-password-error">
                {currentError}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="new-password">{strings.auth.passwordNew}</label>
            <input
              autoComplete="new-password"
              id="new-password"
              type="password"
              aria-invalid={Boolean(newError)}
              aria-describedby={newError ? 'new-password-error' : undefined}
              {...form.register('newPassword')}
            />
            {newError && (
              <p className="field-error" id="new-password-error">
                {newError}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="confirm-password">{strings.auth.passwordConfirm}</label>
            <input
              autoComplete="new-password"
              id="confirm-password"
              type="password"
              aria-invalid={Boolean(confirmError)}
              aria-describedby={confirmError ? 'confirm-password-error' : undefined}
              {...form.register('confirmPassword')}
            />
            {confirmError && (
              <p className="field-error" id="confirm-password-error">
                {confirmError}
              </p>
            )}
          </div>
          {mutation.isError && (
            <p className="form-alert" role="alert">
              {typeof mutation.error === 'object' &&
              mutation.error !== null &&
              'message' in mutation.error &&
              typeof mutation.error.message === 'string'
                ? mutation.error.message
                : strings.auth.passwordChangeFailed}
            </p>
          )}
          {mutation.isSuccess && (
            <p className="form-success" role="status">
              {strings.auth.passwordChanged}
            </p>
          )}
          <button className="button button--primary" disabled={mutation.isPending}>
            {mutation.isPending ? strings.auth.passwordChanging : strings.auth.passwordChangeSubmit}
          </button>
        </form>
      </section>
    </main>
  );
}
