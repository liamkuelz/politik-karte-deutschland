import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Unterpfad fuer GitHub Pages (z. B. /politik-karte/); lokal '/'.
  base: process.env.VITE_BASE || '/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
