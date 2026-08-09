import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/shared/**/*.ts',
        'src/background/**/*.ts',
        'src/blocked/**/*.ts',
        'src/content/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/types.ts'],
    },
  },
});
