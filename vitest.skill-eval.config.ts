import { defineConfig } from 'vitest/config'

/** Skill Eval 专属配置；默认无网络、无费用，避免混入常规单元测试。 */
export default defineConfig({
  test: {
    env: {
      EVAL_MODE: process.env.EVAL_MODE === 'real' ? 'real' : 'mock',
    },
    include: ['evals/skill.test.ts'],
    globals: true,
    testTimeout: 120_000,
    hookTimeout: 10_000,
    pool: 'forks',
    maxWorkers: 1,
  },
})
