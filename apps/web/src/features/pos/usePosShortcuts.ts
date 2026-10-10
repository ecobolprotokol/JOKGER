import { useEffect } from 'react';

export type PosShortcutActions = {
  enabled: boolean;
  cartFocused: () => boolean;
  focusSearch: () => void;
  focusVoucher: () => void;
  selectVisibleItem: (index: number) => void;
  openPayment: () => void;
  openBill: () => void;
  moveCartSelection: (direction: -1 | 1) => void;
  adjustSelectedLine: (amount: -1 | 1) => void;
  removeSelectedLine: () => void;
  closeTopOverlay: () => boolean;
  clearSearch: () => void;
  toggleHelp: () => void;
};

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

export function usePosShortcuts(actions: PosShortcutActions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!actions.enabled || event.metaKey || event.ctrlKey || event.altKey) return;
      const inputFocused = isTextInput(document.activeElement);
      const allowWhileTyping = ['F2', 'F3', 'F4', 'Escape'].includes(event.key);
      if (inputFocused && !allowWhileTyping) return;

      if (event.key === '/') {
        event.preventDefault();
        actions.focusSearch();
      } else if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        actions.selectVisibleItem(Number(event.key) - 1);
      } else if (event.key === 'F2') {
        event.preventDefault();
        actions.openPayment();
      } else if (event.key === 'F3') {
        event.preventDefault();
        actions.openBill();
      } else if (event.key === 'F4') {
        event.preventDefault();
        actions.focusVoucher();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (!actions.closeTopOverlay()) actions.clearSearch();
      } else if (event.key === '?' && !inputFocused) {
        event.preventDefault();
        actions.toggleHelp();
      } else if (actions.cartFocused()) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          actions.moveCartSelection(event.key === 'ArrowUp' ? -1 : 1);
        } else if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          actions.adjustSelectedLine(1);
        } else if (event.key === '-') {
          event.preventDefault();
          actions.adjustSelectedLine(-1);
        } else if (event.key === 'Delete') {
          event.preventDefault();
          actions.removeSelectedLine();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
