import { useState } from 'react';
import { useActiveShift, useCloseShift, useOpenShift } from './hooks';
import { Money } from '../../shared/components/Money';
import { MoneyField } from '../../shared/components/MoneyField';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { strings } from '../../shared/strings/id';
import { Link } from 'react-router-dom';

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function ShiftPage() {
  const shiftQuery = useActiveShift();
  const openMutation = useOpenShift();
  const closeMutation = useCloseShift();
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [note, setNote] = useState('');
  const [closeReview, setCloseReview] = useState(false);
  const activeShift = shiftQuery.data;

  if (shiftQuery.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (shiftQuery.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.shift.loadError}</h1>
        <p>{getErrorMessage(shiftQuery.error)}</p>
        <button className="button button--secondary" onClick={() => void shiftQuery.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  return (
    <main className="shift-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.shift.title}</h1>
        </div>
        <span
          className={`status-pill ${activeShift ? 'status-pill--open' : 'status-pill--closed'}`}
        >
          {activeShift ? strings.shift.activeTitle : strings.shift.noOpenShift}
        </span>
        {activeShift && (
          <Link className="button button--primary" to="/pos">
            {strings.pos.title}
          </Link>
        )}
        <Link className="button button--secondary" to="/orders">
          {strings.orders.title}
        </Link>
        <Link className="button button--secondary" to="/inventory">
          {strings.inventory.title}
        </Link>
        <Link className="button button--secondary" to="/account/password">
          {strings.auth.passwordChangeTitle}
        </Link>
      </header>

      {!activeShift ? (
        <section className="shift-panel" aria-labelledby="open-shift-title">
          <h2 id="open-shift-title">{strings.shift.openingTitle}</h2>
          <p>{strings.shift.noOpenShift}</p>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              openMutation.mutate(Number(openingCash || 0));
            }}
          >
            <MoneyField
              id="opening-cash"
              label={strings.shift.openingCash}
              value={openingCash}
              onChange={setOpeningCash}
              autoFocus
            />
            {openMutation.isError && (
              <p className="form-alert" role="alert">
                {getErrorMessage(openMutation.error)}
              </p>
            )}
            {openMutation.isSuccess && (
              <p className="form-success" role="status">
                {strings.shift.openSuccess}
              </p>
            )}
            <button
              className="button button--primary"
              type="submit"
              disabled={openMutation.isPending}
            >
              {openMutation.isPending ? strings.shift.opening : strings.shift.open}
            </button>
          </form>
        </section>
      ) : (
        <section className="shift-panel" aria-labelledby="active-shift-title">
          <div className="shift-panel__topline">
            <div>
              <p className="eyebrow">{strings.shift.openedAt}</p>
              <h2 id="active-shift-title">
                {new Intl.DateTimeFormat('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(activeShift.opened_at))}
              </h2>
            </div>
            <div className="shift-stat">
              <span>{strings.shift.openingCash}</span>
              <Money value={activeShift.opening_cash} />
            </div>
          </div>
          <div className="shift-stat shift-stat--total">
            <span>{strings.shift.expectedCash}</span>
            <Money value={activeShift.expected_cash ?? activeShift.opening_cash} />
          </div>
          <form
            className="form-stack shift-close-form"
            onSubmit={(event) => {
              event.preventDefault();
              setCloseReview(true);
            }}
          >
            <MoneyField
              id="actual-cash"
              label={strings.shift.actualCash}
              value={actualCash}
              onChange={setActualCash}
            />
            <div className="field">
              <label htmlFor="shift-note">{strings.shift.closeNote}</label>
              <textarea
                id="shift-note"
                maxLength={200}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {closeMutation.isError && (
              <p className="form-alert" role="alert">
                {getErrorMessage(closeMutation.error)}
              </p>
            )}
            {closeMutation.isSuccess && (
              <p className="form-success" role="status">
                {strings.shift.closeSuccess}
              </p>
            )}
            <button
              className="button button--danger"
              type="submit"
              disabled={actualCash.length === 0 || closeMutation.isPending}
            >
              {strings.shift.close}
            </button>
          </form>
          {closeReview && (
            <ConfirmAction
              title={strings.shift.closeTitle}
              description={strings.shift.closeReview}
              confirmLabel={strings.shift.close}
              tone="danger"
              onConfirm={async () => {
                await closeMutation.mutateAsync({
                  actualCash: Number(actualCash),
                  note: note || null,
                });
                setCloseReview(false);
                setActualCash('');
              }}
            />
          )}
        </section>
      )}
    </main>
  );
}
