import { ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import type { AppSettings } from '../storage/settings-store'
import { loadRules } from '../sandbox/permission-engine'
import { chatComplete, LLMError } from '../llm/index'
import { loadMainLLMConfig } from '../llm/aux-config'
import { CONNECTION_TEST_MESSAGES, validateLLMConnectionTestInput } from '../../../src/shared/llm-connection-test'
import type { LLMConnectionTestInput, LLMConnectionTestResult } from '../../../src/shared/types'

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:get', async () => settings.getAllSettings())

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    await settings.setSetting(key as keyof AppSettings, value)
    // 自定义权限规则热更新 → 立即刷入责任链第一层
    if (key === 'permissionRules') {
      loadRules(value || '[]')
    }
  })

  ipcMain.handle('settings:test-connection', async (_event, input: LLMConnectionTestInput): Promise<LLMConnectionTestResult> => {
    const validated = validateLLMConnectionTestInput(input)
    if (!validated.ok) return validated

    const startedAt = Date.now()
    try {
      const config = await loadMainLLMConfig(validated.value)
      await chatComplete({
        config: {
          ...config,
          temperature: 0,
          maxTokens: 32,
        },
        messages: CONNECTION_TEST_MESSAGES,
        caller: 'connection-test',
        promptAssetKeys: ['connection-test'],
        timeoutMs: 15_000,
      })
      return { ok: true, model: config.model, ms: Date.now() - startedAt }
    } catch (error) {
      return { ok: false, error: connectionTestError(error) }
    }
  })
}

export function connectionTestError(error: unknown): string {
  if (error instanceof LLMError) {
    if (error.status === 401 || error.status === 403) return 'API Key 无效或没有权限'
    if (error.status === 404) return 'Base URL 或模型名不存在'
    if (error.status === 429) return '请求过于频繁，请稍后再试'
  }
  return '连接失败，请检查网络、Base URL、模型名和 API Key'
}
