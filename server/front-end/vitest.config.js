import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});

