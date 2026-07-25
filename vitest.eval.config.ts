import { defineConfig } from 'vitest/config'

/**
 * Eval 专属 vitest 配置 — 与主测试套件完全隔离。
 *
 * 运行方式：npm run eval:run
 * 不会被 npm run test（unit test）触发。
 */
export default defineConfig({
  test: {
    include: ['evals/eval.test.ts'],
    globals: true,
    testTimeout: 30000,  // 单场景最多 30s
    hookTimeout: 10000,
  },
})
