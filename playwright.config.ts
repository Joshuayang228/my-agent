import { defineConfig } from '@playwright/test'

const localNoProxy = ['127.0.0.1', 'localhost']
for (const key of ['NO_PROXY', 'no_proxy']) {
  const existing = process.env[key]?.split(',').map((value) => value.trim()).filter(Boolean) ?? []
  process.env[key] = [...new Set([...existing, ...localNoProxy])].join(',')
}
export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  retries: 0,
  projects: [
    {
      name: 'ui',
      testMatch: ['chat.test.ts', 'markdown-theme.test.ts'],
      use: {
        baseURL: 'http://127.0.0.1:5175',
        channel: 'chrome',
        trace: 'retain-on-failure',
      },
    },
  ],
  webServer: {
    // 开发目录变动曾在操作中触发整页重载；测试使用一次性 ui-e2e 构建，保留隔离模式但不连接 HMR。
    // 独立端口且禁止复用已有服务，防止测试命中用户开发页或过期构建；5174 继续留给人工验收。
    command: 'npx vite build --mode ui-e2e --outDir var/verification/ui-dist && npx vite preview --mode ui-e2e --outDir var/verification/ui-dist --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
