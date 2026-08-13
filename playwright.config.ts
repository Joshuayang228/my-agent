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
      testMatch: 'chat.test.ts',
      use: {
        baseURL: 'http://127.0.0.1:5174',
        channel: 'chrome',
        trace: 'on-first-retry',
      },
    },
  ],
  webServer: {
    command: 'npm run dev:ui-e2e',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
    timeout: 30000,
  },
})
