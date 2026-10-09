import { create } from 'zustand';

export type RealtimeState = 'connecting' | 'connected' | 'degraded';

type ConnectionState = {
  online: boolean;
  realtime: RealtimeState;
  setOnline: (online: boolean) => void;
  setRealtime: (realtime: RealtimeState) => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  realtime: 'connecting',
  setOnline: (online) => set({ online }),
  setRealtime: (realtime) => set({ realtime }),
}));
