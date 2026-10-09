import { create } from 'zustand';

export type RealtimeState = 'connecting' | 'connected' | 'degraded';
export type PrinterState = 'none' | 'connected' | 'disconnected' | 'unsupported';

type ConnectionState = {
  online: boolean;
  realtime: RealtimeState;
  printer: PrinterState;
  setOnline: (online: boolean) => void;
  setRealtime: (realtime: RealtimeState) => void;
  setPrinter: (printer: PrinterState) => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  realtime: 'connecting',
  printer: 'none',
  setOnline: (online) => set({ online }),
  setRealtime: (realtime) => set({ realtime }),
  setPrinter: (printer) => set({ printer }),
}));
