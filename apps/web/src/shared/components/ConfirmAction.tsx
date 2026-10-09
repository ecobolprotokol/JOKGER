import { useEffect, useRef, useState } from 'react';
import { strings } from '../strings/id';

type ConfirmActionProps = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  requireReason?: boolean;
  requireTypedText?: string;
  onConfirm: (reason: string | null) => void | Promise<void>;
};

export function ConfirmAction({
  title,
  description,
  confirmLabel,
  tone = 'default',
  requireReason = false,
  requireTypedText,
  onConfirm,
}: ConfirmActionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [typedText, setTypedText] = useState('');
  const [pending, setPending] = useState(false);
  const reasonIsValid =
    !requireReason || (reason.trim().length >= 3 && reason.trim().length <= 200);
  const typedTextIsValid = !requireTypedText || typedText === requireTypedText;
  const canConfirm = reasonIsValid && typedTextIsValid && !pending;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  async function confirm(): Promise<void> {
    if (!canConfirm) {
      return;
    }
    setPending(true);
    try {
      await onConfirm(requireReason ? reason.trim() : null);
      dialogRef.current?.close();
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      className="confirm-dialog"
      ref={dialogRef}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      onClose={() => {
        setReason('');
        setTypedText('');
      }}
    >
      <form method="dialog" className="confirm-dialog__content">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        {requireReason && (
          <label className="field">
            <span>{strings.common.reason}</span>
            <textarea
              autoFocus
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={!reasonIsValid}
            />
          </label>
        )}
        {requireTypedText && (
          <label className="field">
            <span>{strings.common.typeToConfirm}</span>
            <input value={typedText} onChange={(event) => setTypedText(event.target.value)} />
          </label>
        )}
        <div className="confirm-dialog__actions">
          <button className="button button--secondary" value="cancel" autoFocus={!requireReason}>
            {strings.common.cancel}
          </button>
          <button
            className={`button ${tone === 'danger' ? 'button--danger' : 'button--primary'}`}
            type="button"
            disabled={!canConfirm}
            onClick={() => void confirm()}
          >
            {pending ? strings.common.loading : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
