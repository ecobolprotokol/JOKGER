import { useRef } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { usePosShortcuts } from './usePosShortcuts';

type PosShortcutActionMocks = {
  focusSearch: Mock<() => void>;
  focusVoucher: Mock<() => void>;
  selectVisibleItem: Mock<(index: number) => void>;
  openPayment: Mock<() => void>;
  openBill: Mock<() => void>;
  moveCartSelection: Mock<(direction: -1 | 1) => void>;
  adjustSelectedLine: Mock<(amount: -1 | 1) => void>;
  removeSelectedLine: Mock<() => void>;
  closeTopOverlay: Mock<() => boolean>;
  clearSearch: Mock<() => void>;
  toggleHelp: Mock<() => void>;
};

function Harness({ enabled, actions }: { enabled: boolean; actions: PosShortcutActionMocks }) {
  const cart = useRef<HTMLDivElement>(null);
  usePosShortcuts({
    enabled,
    cartFocused: () => Boolean(cart.current?.contains(document.activeElement)),
    focusSearch: actions.focusSearch,
    focusVoucher: actions.focusVoucher,
    selectVisibleItem: actions.selectVisibleItem,
    openPayment: actions.openPayment,
    openBill: actions.openBill,
    moveCartSelection: actions.moveCartSelection,
    adjustSelectedLine: actions.adjustSelectedLine,
    removeSelectedLine: actions.removeSelectedLine,
    closeTopOverlay: actions.closeTopOverlay,
    clearSearch: actions.clearSearch,
    toggleHelp: actions.toggleHelp,
  });
  return (
    <>
      <input aria-label="Pencarian" />
      <div ref={cart} tabIndex={-1}>
        <button>Baris keranjang</button>
      </div>
    </>
  );
}

function createActions(): PosShortcutActionMocks {
  return {
    focusSearch: vi.fn<() => void>(),
    focusVoucher: vi.fn<() => void>(),
    selectVisibleItem: vi.fn<(index: number) => void>(),
    openPayment: vi.fn<() => void>(),
    openBill: vi.fn<() => void>(),
    moveCartSelection: vi.fn<(direction: -1 | 1) => void>(),
    adjustSelectedLine: vi.fn<(amount: -1 | 1) => void>(),
    removeSelectedLine: vi.fn<() => void>(),
    closeTopOverlay: vi.fn<() => boolean>(() => false),
    clearSearch: vi.fn<() => void>(),
    toggleHelp: vi.fn<() => void>(),
  };
}

describe('POS shortcuts', () => {
  afterEach(() => cleanup());

  it('handles search, digit selection, payments, bill, voucher, escape, and help', () => {
    const actions = createActions();
    render(<Harness enabled actions={actions} />);
    for (const key of [
      '/',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'F2',
      'F3',
      'F4',
      'Escape',
      '?',
    ]) {
      fireEvent.keyDown(window, { key });
    }
    expect(actions.focusSearch).toHaveBeenCalledOnce();
    expect(actions.selectVisibleItem.mock.calls.map(([index]) => index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(actions.openPayment).toHaveBeenCalledOnce();
    expect(actions.openBill).toHaveBeenCalledOnce();
    expect(actions.focusVoucher).toHaveBeenCalledOnce();
    expect(actions.toggleHelp).toHaveBeenCalledOnce();
  });

  it('allows payment function keys while typing and supports cart quantity/delete keys', () => {
    const actions = createActions();
    const view = render(<Harness enabled actions={actions} />);
    view.getByRole('textbox', { name: 'Pencarian' }).focus();
    fireEvent.keyDown(window, { key: 'F2' });
    fireEvent.keyDown(window, { key: '4' });
    expect(actions.openPayment).toHaveBeenCalledOnce();
    expect(actions.selectVisibleItem).not.toHaveBeenCalled();
    view.getByRole('button', { name: 'Baris keranjang' }).focus();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '-' });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(actions.moveCartSelection.mock.calls.map(([direction]) => direction)).toEqual([-1, 1]);
    expect(actions.adjustSelectedLine.mock.calls.map(([amount]) => amount)).toEqual([1, -1]);
    expect(actions.removeSelectedLine).toHaveBeenCalledOnce();
  });

  it('does nothing when shortcuts are disabled', () => {
    const actions = createActions();
    render(<Harness enabled={false} actions={actions} />);
    fireEvent.keyDown(window, { key: 'F2' });
    expect(actions.openPayment).not.toHaveBeenCalled();
  });
});
