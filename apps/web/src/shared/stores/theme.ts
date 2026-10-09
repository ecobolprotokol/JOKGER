import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const initialTheme = {
  mode: 'system' as ThemeMode,
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      ...initialTheme,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'jokger.theme.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
