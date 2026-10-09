import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword, signIn } from './api';
import { loginSchema, type LoginInput } from './schemas';
import { useAuthSession } from './SessionProvider';
import { strings } from '../../shared/strings/id';

type Lockout = { failures: number; until: number | null };
const LOCKOUT_KEY = 'jokger.auth.lockout.v1';

function readLockout(): Lockout {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(LOCKOUT_KEY) ?? 'null');
    if (
      typeof stored === 'object' &&
      stored !== null &&
      'failures' in stored &&
      typeof stored.failures === 'number' &&
      'until' in stored &&
      (typeof stored.until === 'number' || stored.until === null)
    ) {
      return { failures: stored.failures, until: stored.until };
    }
  } catch {
    return { failures: 0, until: null };
  }
  return { failures: 0, until: null };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session } = useAuthSession();
  const [lockout, setLockout] = useState(readLockout);
  const [remaining, setRemaining] = useState(0);
  const [serverError, setServerError] = useState(() =>
    searchParams.get('reason') === 'idle' ? strings.auth.sessionIdle : '',
  );
  const [resetMessage, setResetMessage] = useState('');
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: async (input: LoginInput) => {
      const result = await signIn(input.email, input.password);
      if (!result.ok) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      localStorage.removeItem(LOCKOUT_KEY);
      setLockout({ failures: 0, until: null });
      const state = location.state as { redirect?: unknown } | null;
      const redirect = typeof state?.redirect === 'string' ? state.redirect : '/';
      navigate(redirect === '/login' ? '/' : redirect, { replace: true });
    },
    onError: (error: unknown) => {
      const nextFailures = lockout.failures + 1;
      const next = {
        failures: nextFailures,
        until: nextFailures >= 5 ? Date.now() + 30_000 : null,
      };
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
      setLockout(next);
      setServerError(
        searchParams.get('reason') === 'inactive'
          ? strings.auth.inactiveAccount
          : error instanceof TypeError
            ? strings.errors.NETWORK_OFFLINE
            : strings.auth.invalidCredentials,
      );
    },
  });
  const recovery = useMutation({
    mutationFn: async (email: string) => {
      const result = await resetPassword(email);
      if (!result.ok) {
        throw result.error;
      }
    },
    onSuccess: () => setResetMessage(strings.auth.resetPasswordSent),
  });

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [navigate, session]);

  useEffect(() => {
    if (!lockout.until) {
      setRemaining(0);
      return;
    }
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((lockout.until! - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        const next = { failures: 0, until: null };
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify(next));
        setLockout(next);
      }
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 5_000);
    return () => window.clearInterval(timer);
  }, [lockout.until]);

  const submit = form.handleSubmit((input) => {
    setServerError('');
    login.mutate(input);
  });
  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;
  const locked = remaining > 0;

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            J
          </span>
          <p className="eyebrow">{strings.app.operationTitle}</p>
        </div>
        <h1 id="login-title">{strings.auth.loginTitle}</h1>
        <form className="form-stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">{strings.auth.email}</label>
            <input
              autoComplete="username"
              autoFocus
              id="email"
              type="email"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'email-error' : undefined}
              {...form.register('email')}
            />
            {emailError && (
              <p className="field-error" id="email-error">
                {strings.auth.emailInvalid}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="password">{strings.auth.password}</label>
            <input
              autoComplete="current-password"
              id="password"
              type="password"
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'password-error' : undefined}
              {...form.register('password')}
            />
            {passwordError && (
              <p className="field-error" id="password-error">
                {strings.auth.passwordRequired}
              </p>
            )}
          </div>
          {serverError && (
            <p className="form-alert" role="alert">
              {serverError}
            </p>
          )}
          {remaining > 0 && (
            <p className="form-alert" role="status" aria-live="polite">
              {strings.auth.lockout} {remaining} {strings.auth.secondsSuffix}
            </p>
          )}
          {resetMessage && (
            <p className="form-success" role="status">
              {resetMessage}
            </p>
          )}
          {!import.meta.env.VITE_SUPABASE_URL && (
            <p className="form-alert" role="status">
              {strings.common.configurationError}
            </p>
          )}
          <button
            className="button button--primary"
            type="submit"
            disabled={locked || login.isPending}
          >
            {login.isPending ? strings.auth.loggingIn : strings.auth.login}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={!form.getValues('email') || recovery.isPending}
            onClick={() => recovery.mutate(form.getValues('email'))}
          >
            {strings.auth.forgotPassword}
          </button>
        </form>
      </section>
    </main>
  );
}
