import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CartLine = {
  lineId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  modifierExtra: number;
  modifierOptionIds: string[];
  modifierLabels: string[];
  qty: number;
  note: string | null;
};

export type NewCartLine = Omit<CartLine, 'lineId' | 'qty' | 'modifierExtra'> & {
  qty?: number;
  modifierExtra?: number;
};

type CartState = {
  orderType: 'dine_in' | 'takeaway';
  tableLabel: string | null;
  customerName: string | null;
  lines: CartLine[];
  voucherCode: string | null;
  clientRef: string | null;
  addLine: (line: NewCartLine) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeLine: (lineId: string) => void;
  setOrderType: (orderType: CartState['orderType']) => void;
  setTableLabel: (tableLabel: string | null) => void;
  setCustomerName: (customerName: string | null) => void;
  setVoucher: (code: string | null) => void;
  ensureClientRef: () => string;
  clear: () => void;
};

const initialCart = {
  orderType: 'dine_in' as const,
  tableLabel: null,
  customerName: null,
  lines: [],
  voucherCode: null,
  clientRef: null,
};

function sameLine(first: CartLine, next: NewCartLine): boolean {
  return (
    first.menuItemId === next.menuItemId &&
    first.note === next.note &&
    first.modifierOptionIds.length === next.modifierOptionIds.length &&
    first.modifierOptionIds.every((id, index) => id === next.modifierOptionIds[index])
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...initialCart,
      addLine: (line) =>
        set((state) => {
          const existing = state.lines.find((current) => sameLine(current, line));
          if (existing) {
            return {
              lines: state.lines.map((current) =>
                current.lineId === existing.lineId
                  ? { ...current, qty: Math.min(100, current.qty + (line.qty ?? 1)) }
                  : current,
              ),
            };
          }
          const qty = Math.min(100, Math.max(1, line.qty ?? 1));
          return {
            lines: [
              ...state.lines,
              { ...line, modifierExtra: line.modifierExtra ?? 0, qty, lineId: crypto.randomUUID() },
            ],
          };
        }),
      updateQty: (lineId, qty) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.lineId === lineId ? { ...line, qty: Math.min(100, Math.max(1, qty)) } : line,
          ),
        })),
      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.lineId !== lineId) })),
      setOrderType: (orderType) => set({ orderType }),
      setTableLabel: (tableLabel) => set({ tableLabel }),
      setCustomerName: (customerName) => set({ customerName }),
      setVoucher: (voucherCode) => set({ voucherCode }),
      ensureClientRef: () => {
        const current = get().clientRef;
        if (current) {
          return current;
        }
        const clientRef = crypto.randomUUID();
        set({ clientRef });
        return clientRef;
      },
      clear: () => set(initialCart),
    }),
    {
      name: 'jokger.cart.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orderType: state.orderType,
        tableLabel: state.tableLabel,
        customerName: state.customerName,
        lines: state.lines,
        voucherCode: state.voucherCode,
        clientRef: state.clientRef,
      }),
    },
  ),
);
