import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: ['electron.test.ts', 'onboarding.test.ts', 'local-model.test.ts', 'mcp-oauth.test.ts', 'image-generation.test.ts', 'backup-recovery.test.ts', 'moment-backup.test.ts', 'model-diagnostic-lifecycle.test.ts'],
  timeout: 60000,
  retries: 0,
  workers: 1,
})
