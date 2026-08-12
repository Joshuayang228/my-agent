import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      EVAL_MODE: 'real',
    },
    include: ['evals/persona-real.test.ts'],
    globals: true,
    testTimeout: 15 * 60 * 1000,
    hookTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
  },
})
