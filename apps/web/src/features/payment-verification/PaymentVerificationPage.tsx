import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePaymentProof, usePendingPayments, useVerifyPayment } from './index';
import type { PendingPayment } from './index';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { Money } from '../../shared/components/Money';
import { useRealtime } from '../../shared/hooks/useRealtime';
import { strings } from '../../shared/strings/id';

function errorText(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function PaymentVerificationPage() {
  const payments = usePendingPayments();
  const verifyMutation = useVerifyPayment();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingPayment | null>(null);
  const allPayments = payments.data ?? [];
  const selected =
    allPayments.find((payment) => payment.id === selectedId) ?? allPayments[0] ?? null;
  const proof = usePaymentProof(selected?.proof_path ?? null);
  useRealtime({
    table: 'payments',
    filter: 'status=eq.pending_verification',
    queryKey: ['payments', 'pending'],
  });

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent): void {
      if (!selected || isEditable(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() === 'a') {
        verifyMutation.mutate(
          { paymentId: selected.id, approve: true, note: null },
          { onSuccess: () => toast.success(strings.paymentVerification.approved) },
        );
      } else if (event.key.toLowerCase() === 'r') {
        setRejectTarget(selected);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selected, verifyMutation]);

  if (payments.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (payments.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.paymentVerification.loadError}</h1>
        <p>{errorText(payments.error)}</p>
        <button className="button button--secondary" onClick={() => void payments.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  async function approve(payment: PendingPayment): Promise<void> {
    await verifyMutation.mutateAsync({ paymentId: payment.id, approve: true, note: null });
    toast.success(strings.paymentVerification.approved);
  }

  return (
    <main className="verification-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.paymentVerification.title}</h1>
        </div>
      </header>
      {allPayments.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.paymentVerification.empty}</h2>
        </section>
      ) : (
        <div className="verification-layout">
          <nav className="verification-queue" aria-label={strings.paymentVerification.queue}>
            {allPayments.map((payment) => (
              <button
                className={
                  selected?.id === payment.id ? 'verification-row is-selected' : 'verification-row'
                }
                key={payment.id}
                aria-pressed={selected?.id === payment.id}
                onClick={() => setSelectedId(payment.id)}
              >
                <strong>{payment.orders?.order_no ?? payment.order_id}</strong>
                <span>
                  {payment.method === 'transfer'
                    ? strings.paymentVerification.transfer
                    : strings.paymentVerification.ewallet}
                </span>
                <Money value={payment.amount} />
                <time dateTime={payment.created_at}>
                  {new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(payment.created_at))}
                </time>
              </button>
            ))}
          </nav>
          {selected && (
            <section className="verification-detail" aria-labelledby="verification-order">
              <div className="verification-proof">
                {!selected.proof_path ? (
                  <p>{strings.paymentVerification.proofMissing}</p>
                ) : proof.isPending ? (
                  <p role="status">{strings.app.loading}</p>
                ) : proof.isError ? (
                  <p role="alert">{strings.paymentVerification.loadProofError}</p>
                ) : proof.data ? (
                  <>
                    <img
                      src={proof.data}
                      alt={`${strings.paymentVerification.reference} ${selected.reference_no ?? ''}`}
                    />
                    <a href={proof.data} target="_blank" rel="noopener noreferrer">
                      {strings.paymentVerification.openProof}
                    </a>
                  </>
                ) : null}
              </div>
              <div className="verification-information">
                <h2 id="verification-order">
                  <Link to={`/orders/${selected.order_id}`}>
                    {selected.orders?.order_no ?? selected.order_id}
                  </Link>
                </h2>
                <dl>
                  <div>
                    <dt>{strings.paymentVerification.amount}</dt>
                    <dd>
                      <Money value={selected.amount} />
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.paymentVerification.method}</dt>
                    <dd>
                      {selected.method === 'transfer'
                        ? strings.paymentVerification.transfer
                        : strings.paymentVerification.ewallet}
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.paymentVerification.account}</dt>
                    <dd>
                      {selected.payment_accounts?.provider ?? strings.paymentVerification.account}
                    </dd>
                  </div>
                  <div>
                    <dt>{strings.paymentVerification.reference}</dt>
                    <dd>{selected.reference_no ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>{strings.paymentVerification.submittedAt}</dt>
                    <dd>
                      {new Intl.DateTimeFormat('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(selected.created_at))}
                    </dd>
                  </div>
                </dl>
                {verifyMutation.isError && (
                  <p className="form-alert" role="alert">
                    {errorText(verifyMutation.error)}
                  </p>
                )}
                <div className="verification-actions">
                  <button
                    className="button button--primary"
                    disabled={verifyMutation.isPending}
                    onClick={() => void approve(selected)}
                  >
                    {strings.paymentVerification.approve}
                  </button>
                  <button
                    className="button button--danger"
                    disabled={verifyMutation.isPending}
                    onClick={() => setRejectTarget(selected)}
                  >
                    {strings.paymentVerification.reject}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      {rejectTarget && (
        <ConfirmAction
          title={`${strings.paymentVerification.rejectTitle} ${rejectTarget.orders?.order_no ?? ''}?`}
          description={strings.paymentVerification.rejectDescription}
          confirmLabel={strings.paymentVerification.reject}
          tone="danger"
          requireReason
          onConfirm={async (reason) => {
            await verifyMutation.mutateAsync({
              paymentId: rejectTarget.id,
              approve: false,
              note: reason,
            });
            setRejectTarget(null);
            toast.success(strings.paymentVerification.rejected);
          }}
        />
      )}
    </main>
  );
}
