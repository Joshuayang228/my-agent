import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import type { AppSettings } from '../storage/settings-store'
import { loadRules } from '../sandbox/permission-engine'
import { chatComplete, LLMError } from '../llm/index'
import { loadMainLLMConfig } from '../llm/aux-config'
import { PROMPT_KEYS } from '../prompts/keys'
import { CONNECTION_TEST_MESSAGES, validateLLMConnectionTestInput } from '../../../src/shared/llm-connection-test'
import type { LLMConnectionTestInput, LLMConnectionTestResult, RendererSettings } from '../../../src/shared/types'
import { redactMcpConfigsForRenderer, hasNewOrChangedEnabledMcpConfig, mergeMcpConfigListSecrets, parseStoredMcpConfigs } from '../mcp/config-security'

const RENDERER_BLOCKED_SETTING_KEYS = new Set<keyof AppSettings>(['currentProject', 'recentProjects'])

export function isRendererWritableSettingKey(value: unknown): value is keyof AppSettings {
  return typeof value === 'string' && settings.isAppSettingKey(value)
    && !RENDERER_BLOCKED_SETTING_KEYS.has(value as keyof AppSettings)
}

/**
 * 主进程向 Renderer 暴露的设置安全视图。
 *
 * 背景：设置存储层必须能解密 API Key/MCP env 供生产调用，但 Renderer 可能被 XSS、
 * 恶意插件或不受信任的 Markdown 影响，不能因此获得长期凭据原文。
 * 设计意图：保留 UI 所需的普通设置和“是否已配置”状态；敏感值只返回空串/脱敏哨兵。
 * 关键约束：任何新增敏感设置都必须在这里显式脱敏，而不是直接返回 getAllSettings()。
 */
export async function getRendererSettings(): Promise<RendererSettings> {
  const stored = await settings.getAllSettings()
  return {
    ...stored,
    llmApiKey: '',
    llmApiKeyConfigured: stored.llmApiKey.trim() ? 'true' : 'false',
    mcpServers: redactMcpConfigsForRenderer(stored.mcpServers),
  }
}

async function confirmHighRiskSettingChange(title: string, detail: string): Promise<boolean> {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) return false
  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    title,
    message: '这项设置会改变应用的高风险执行边界。',
    detail,
    buttons: ['取消', '确认'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  return result.response === 1
}

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:get', async () => getRendererSettings())

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    if (!isRendererWritableSettingKey(key)) {
      throw new Error('无效的设置项')
    }
    if (typeof value !== 'string' || value.length > settings.MAX_SETTING_VALUE_LENGTH) {
      throw new Error('设置值无效或超出长度限制')
    }

    if (key === 'executionMode' && value === 'full-access') {
      const previous = await settings.getSetting('executionMode')
      if (previous !== 'full-access' && !await confirmHighRiskSettingChange(
        '确认启用完全访问',
        '完全访问会允许工具在不逐次确认的情况下执行高风险操作。请确认你了解并接受这个风险。',
      )) {
        throw new Error('用户取消高风险设置变更')
      }
    }

    if (key === 'mcpServers') {
      const previousRaw = await settings.getSetting('mcpServers')
      const merged = mergeMcpConfigListSecrets(value, previousRaw)
      if (!merged.ok) throw new Error(merged.error)
      const previousList = parseStoredMcpConfigs(previousRaw)
      if (hasNewOrChangedEnabledMcpConfig(previousList, merged.configs)
        && !await confirmHighRiskSettingChange(
          '确认保存并启用 MCP 服务',
          '启用的 MCP 服务可能启动本地进程、访问文件或连接远程网络。只保存并启用你信任的配置。',
        )) {
        throw new Error('用户取消高风险设置变更')
      }
      value = merged.json
    }

    // API Key/MCP secret 只在主进程处理；Renderer 永远只能收到安全视图或脱敏哨兵。
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
      const config = await loadMainLLMConfig({
        ...(validated.value.apiKey ? { apiKey: validated.value.apiKey } : {}),
        baseUrl: validated.value.baseUrl,
        model: validated.value.model,
      })
      if (!config.apiKey) return { ok: false, error: '请先配置 API Key' }
      await chatComplete({
        config: {
          ...config,
          temperature: 0,
          maxTokens: 32,
        },
        messages: CONNECTION_TEST_MESSAGES,
        caller: 'connection-test',
        promptAssetKeys: [PROMPT_KEYS.connectionTest],
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
