import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      include: [
        'src/shared/lib/money.ts',
        'src/shared/lib/contrast.ts',
        'src/shared/lib/receipt.ts',
        'src/shared/lib/errors.ts',
        'src/shared/lib/csv.ts',
        'src/features/**/logic.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 80,
      },
    },
  },
});
