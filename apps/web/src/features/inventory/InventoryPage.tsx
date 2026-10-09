import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useInventoryItems,
  useRecordStockMovement,
  useUpsertInventoryItem,
  type InventoryItem,
  type StockMovementInput,
} from './index';
import { useProfile } from '../auth';
import { Money } from '../../shared/components/Money';
import { ConfirmAction } from '../../shared/components/ConfirmAction';
import { calculateStockValue } from '../../shared/lib/money';
import { strings } from '../../shared/strings/id';

type MovementType = StockMovementInput['type'];

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return typeof error.message === 'string' ? error.message : strings.common.unknownError;
  }
  return strings.common.unknownError;
}

export function InventoryPage() {
  const inventory = useInventoryItems();
  const movement = useRecordStockMovement();
  const saveItem = useUpsertInventoryItem();
  const profile = useProfile();
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('purchase');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [allowNegative, setAllowNegative] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    id: null as string | null,
    name: '',
    unit: '',
    minQty: '0',
    unitCost: '',
  });
  const isSuperAdmin = profile.data?.role === 'super_admin';

  if (inventory.isPending) {
    return (
      <main className="page-state" role="status">
        {strings.app.loading}
      </main>
    );
  }

  if (inventory.isError) {
    return (
      <main className="page-state" role="alert">
        <h1>{strings.inventory.loadError}</h1>
        <p>{getErrorMessage(inventory.error)}</p>
        <button className="button button--secondary" onClick={() => void inventory.refetch()}>
          {strings.common.retry}
        </button>
      </main>
    );
  }

  const items = inventory.data ?? [];

  function openMovement(item: InventoryItem, type: MovementType): void {
    setSelectedItem(item);
    setMovementType(type);
    setQuantity('');
    setNote('');
    setAllowNegative(false);
    setConfirmationOpen(false);
    movement.reset();
  }

  function openItemForm(item: InventoryItem | null): void {
    setItemForm({
      id: item?.id ?? null,
      name: item?.name ?? '',
      unit: item?.unit ?? '',
      minQty: item ? String(item.min_qty) : '0',
      unitCost: item ? String(item.unit_cost) : '',
    });
    saveItem.reset();
    setItemFormOpen(true);
  }

  function submitItemForm(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const input = {
      ...(itemForm.id ? { id: itemForm.id } : {}),
      name: itemForm.name,
      unit: itemForm.unit,
      min_qty: Number(itemForm.minQty),
      unit_cost: Number(itemForm.unitCost),
      is_active: true,
    };
    saveItem.mutate(input, {
      onSuccess: () => {
        setItemFormOpen(false);
        toast.success(strings.inventory.itemSaved);
      },
    });
  }

  async function saveMovement(reason: string | null): Promise<void> {
    if (!selectedItem) return;
    const parsedQuantity = Number(quantity);
    const finalNote = reason ?? (note.trim() || null);
    const input: StockMovementInput = {
      itemId: selectedItem.id,
      type: movementType,
      quantity: movementType === 'adjustment' ? parsedQuantity : Math.abs(parsedQuantity),
      note: finalNote,
      allowNegative,
    };
    await movement.mutateAsync(input);
    setConfirmationOpen(false);
    setSelectedItem(null);
  }

  return (
    <main className="inventory-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{strings.app.operationTitle}</p>
          <h1>{strings.inventory.title}</h1>
        </div>
        <Link className="button button--secondary" to="/payment-verification">
          {strings.paymentVerification.title}
        </Link>
        <Link className="button button--secondary" to="/payment-accounts">
          {strings.paymentAccounts.title}
        </Link>
        <button className="button button--primary" onClick={() => openItemForm(null)}>
          {strings.inventory.addItem}
        </button>
      </header>
      {items.length === 0 ? (
        <section className="orders-empty" aria-live="polite">
          <h2>{strings.inventory.noItems}</h2>
          <button className="button button--primary" onClick={() => openItemForm(null)}>
            {strings.inventory.addItem}
          </button>
        </section>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <caption className="visually-hidden">{strings.inventory.title}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.inventory.name}</th>
                <th scope="col">{strings.inventory.currentStock}</th>
                <th scope="col">{strings.inventory.minimumStock}</th>
                <th scope="col">{strings.inventory.stockValue}</th>
                <th scope="col">{strings.inventory.status}</th>
                <th scope="col">{strings.common.save}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isEmpty = item.current_qty <= 0;
                const isLow = !isEmpty && item.current_qty <= item.min_qty;
                const status = isEmpty
                  ? strings.inventory.empty
                  : isLow
                    ? strings.inventory.low
                    : strings.inventory.safe;
                return (
                  <tr key={item.id}>
                    <th scope="row">{item.name}</th>
                    <td className="numeric-cell">
                      {item.current_qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                      {item.unit}
                    </td>
                    <td className="numeric-cell">
                      {item.min_qty.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                      {item.unit}
                    </td>
                    <td>
                      <Money value={calculateStockValue(item.current_qty, item.unit_cost)} />
                    </td>
                    <td>
                      <span
                        className={`inventory-status ${isEmpty ? 'is-empty' : isLow ? 'is-low' : 'is-safe'}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td>
                      <div className="inventory-actions">
                        <button
                          className="button button--secondary"
                          onClick={() => openItemForm(item)}
                        >
                          {strings.inventory.editItem}
                        </button>
                        <button
                          className="button button--secondary"
                          onClick={() => openMovement(item, 'purchase')}
                        >
                          {strings.inventory.purchase}
                        </button>
                        <button
                          className="button button--secondary"
                          onClick={() => openMovement(item, 'waste')}
                        >
                          {strings.inventory.waste}
                        </button>
                        <button
                          className="button button--secondary"
                          onClick={() => openMovement(item, 'adjustment')}
                        >
                          {strings.inventory.adjustment}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedItem && (
        <section className="inventory-dialog-backdrop">
          <div
            className="inventory-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movement-title"
          >
            <h2 id="movement-title">
              {strings.inventory.movementTitle}: {selectedItem.name}
            </h2>
            <p>
              {movementType === 'purchase'
                ? strings.inventory.purchase
                : movementType === 'waste'
                  ? strings.inventory.waste
                  : strings.inventory.adjustment}
            </p>
            <label className="field">
              <span>{strings.inventory.quantity}</span>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                min={movementType === 'adjustment' ? undefined : 0.001}
                max={999_999_999.999}
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            {movementType === 'purchase' && (
              <label className="field">
                <span>{strings.inventory.note}</span>
                <input
                  maxLength={200}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            )}
            {isSuperAdmin && movementType === 'adjustment' && (
              <label className="inventory-negative-toggle">
                <input
                  type="checkbox"
                  checked={allowNegative}
                  onChange={(event) => setAllowNegative(event.target.checked)}
                />
                <span>{strings.inventory.allowNegative}</span>
              </label>
            )}
            {movement.isError && (
              <p className="form-alert" role="alert">
                {strings.inventory.movementError} {getErrorMessage(movement.error)}
              </p>
            )}
            {movement.isSuccess && (
              <p className="form-success" role="status">
                {strings.inventory.movementSaved}
              </p>
            )}
            <div className="confirm-dialog__actions">
              <button className="button button--secondary" onClick={() => setSelectedItem(null)}>
                {strings.common.cancel}
              </button>
              <button
                className="button button--primary"
                disabled={!quantity || Number(quantity) === 0 || movement.isPending}
                onClick={() => setConfirmationOpen(true)}
              >
                {strings.inventory.submitMovement}
              </button>
            </div>
          </div>
        </section>
      )}
      {itemFormOpen && (
        <section className="inventory-dialog-backdrop">
          <form
            className="inventory-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-item-title"
            onSubmit={submitItemForm}
          >
            <h2 id="inventory-item-title">
              {itemForm.id ? strings.inventory.editItem : strings.inventory.addItem}
            </h2>
            <label className="field">
              <span>{strings.inventory.itemName}</span>
              <input
                autoFocus
                maxLength={80}
                required
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.inventory.unit}</span>
              <input
                maxLength={20}
                required
                value={itemForm.unit}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, unit: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.inventory.minimumStock}</span>
              <input
                type="number"
                min="0"
                step="0.001"
                required
                value={itemForm.minQty}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, minQty: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>{strings.inventory.unitCost}</span>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={itemForm.unitCost}
                onChange={(event) =>
                  setItemForm((current) => ({ ...current, unitCost: event.target.value }))
                }
              />
            </label>
            {saveItem.isError && (
              <p className="form-alert" role="alert">
                {strings.inventory.saveItemError} {getErrorMessage(saveItem.error)}
              </p>
            )}
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setItemFormOpen(false)}
              >
                {strings.common.cancel}
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={
                  saveItem.isPending ||
                  !itemForm.name.trim() ||
                  !itemForm.unit.trim() ||
                  itemForm.unitCost === ''
                }
              >
                {saveItem.isPending ? strings.common.loading : strings.inventory.saveItem}
              </button>
            </div>
          </form>
        </section>
      )}
      {confirmationOpen && selectedItem && (
        <ConfirmAction
          title={`${strings.inventory.confirmMovement} ${selectedItem.name}?`}
          description={
            allowNegative ? strings.inventory.negativeHint : strings.inventory.movementTitle
          }
          confirmLabel={strings.inventory.submitMovement}
          tone={movementType === 'purchase' ? 'default' : 'danger'}
          requireReason={movementType !== 'purchase'}
          requireTypedText={allowNegative ? selectedItem.name : ''}
          onConfirm={saveMovement}
        />
      )}
    </main>
  );
}
