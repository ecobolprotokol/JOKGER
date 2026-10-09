import { useEffect, useRef, useState } from 'react';
import type { MenuItem } from '../../menu';
import { sumRupiah } from '../../../shared/lib/money';
import { Money } from '../../../shared/components/Money';
import { strings } from '../../../shared/strings/id';

type ModifierPickerProps = {
  item: MenuItem;
  onAdd: (
    optionIds: string[],
    labels: string[],
    extraPrice: number,
    qty: number,
    note: string,
  ) => void;
  onClose: () => void;
};

export function ModifierPicker({ item, onAdd, onClose }: ModifierPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const selectedOptions = item.modifierGroups.flatMap((group) =>
    group.options.filter((option) => selectedIds.includes(option.id)),
  );
  const canAdd = item.modifierGroups.every((group) => {
    const selectedCount = group.options.filter((option) => selectedIds.includes(option.id)).length;
    return selectedCount >= group.min_select && selectedCount <= group.max_select;
  });

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function toggle(optionId: string, maxSelect: number): void {
    setSelectedIds((current) => {
      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }
      if (maxSelect === 1) {
        const group = item.modifierGroups.find((entry) =>
          entry.options.some((option) => option.id === optionId),
        );
        const groupIds = group?.options.map((option) => option.id) ?? [];
        return [...current.filter((id) => !groupIds.includes(id)), optionId];
      }
      const group = item.modifierGroups.find((entry) =>
        entry.options.some((option) => option.id === optionId),
      );
      const groupIds = group?.options.map((option) => option.id) ?? [];
      const selectedInGroup = current.filter((id) => groupIds.includes(id)).length;
      return selectedInGroup < maxSelect ? [...current, optionId] : current;
    });
  }

  const extraPrice = sumRupiah(selectedOptions.map((option) => option.extra_price));

  return (
    <dialog
      className="confirm-dialog modifier-dialog"
      ref={dialogRef}
      aria-labelledby="modifier-title"
      onClose={onClose}
    >
      <form method="dialog" className="confirm-dialog__content">
        <h2 id="modifier-title">{item.name}</h2>
        {item.modifierGroups.map((group) => (
          <fieldset className="modifier-group" key={group.id}>
            <legend>
              {group.name} ·{' '}
              {group.min_select === group.max_select
                ? `${strings.pos.modifierRulesSingle} ${group.min_select}`
                : `${strings.pos.modifierRulesMultiple} ${group.max_select}`}
            </legend>
            {group.options.map((option) => (
              <label className="modifier-option" key={option.id}>
                <input
                  type={group.max_select === 1 ? 'radio' : 'checkbox'}
                  name={group.id}
                  checked={selectedIds.includes(option.id)}
                  onChange={() => toggle(option.id, group.max_select)}
                />
                <span>{option.name}</span>
                <Money value={option.extra_price} />
              </label>
            ))}
          </fieldset>
        ))}
        <div className="field">
          <label htmlFor="modifier-note">{strings.pos.note}</label>
          <input
            id="modifier-note"
            maxLength={140}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="quantity-control" aria-label={strings.pos.cart}>
          <button
            type="button"
            aria-label={strings.pos.decreaseQty}
            disabled={qty <= 1}
            onClick={() => setQty((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <span>{qty}</span>
          <button
            type="button"
            aria-label={strings.pos.increaseQty}
            disabled={qty >= 100}
            onClick={() => setQty((value) => Math.min(100, value + 1))}
          >
            +
          </button>
        </div>
        <div className="confirm-dialog__actions">
          <button className="button button--secondary" value="cancel">
            {strings.common.cancel}
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!canAdd}
            onClick={() => {
              onAdd(
                selectedIds,
                selectedOptions.map((option) => option.name),
                extraPrice,
                qty,
                note,
              );
              dialogRef.current?.close();
            }}
          >
            {strings.pos.addToCart}
          </button>
        </div>
      </form>
    </dialog>
  );
}
