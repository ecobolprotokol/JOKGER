import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DeviceState = {
  printer: { id: string; name: string } | null;
  paperWidthOverride: 58 | 80 | null;
  shortcutsEnabled: boolean;
  soundOnNewOrder: boolean;
  setPrinter: (printer: { id: string; name: string } | null) => void;
  setPaperWidthOverride: (width: 58 | 80 | null) => void;
  setShortcutsEnabled: (enabled: boolean) => void;
  setSoundOnNewOrder: (enabled: boolean) => void;
};

const initialDevice = {
  printer: null,
  paperWidthOverride: null,
  shortcutsEnabled: true,
  soundOnNewOrder: false,
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      ...initialDevice,
      setPrinter: (printer) => set({ printer }),
      setPaperWidthOverride: (paperWidthOverride) => set({ paperWidthOverride }),
      setShortcutsEnabled: (shortcutsEnabled) => set({ shortcutsEnabled }),
      setSoundOnNewOrder: (soundOnNewOrder) => set({ soundOnNewOrder }),
    }),
    {
      name: 'jokger.device.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
