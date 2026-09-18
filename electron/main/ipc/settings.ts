import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import type { AppSettings } from '../storage/settings-store'
import { loadRules, validatePermissionRules } from '../sandbox/permission-engine'
import { chatComplete, LLMError } from '../llm/index'
import { loadMainLLMConfig } from '../llm/aux-config'
import { PROMPT_KEYS } from '../prompts/keys'
import { CONNECTION_TEST_MESSAGES, sameConnectionEndpoint, validateLLMConnectionTestInput } from '../../../src/shared/llm-connection-test'
import { MODEL_FETCH_MESSAGES, normalizeConnectionModels, validateLLMModelFetchInput } from '../../../src/shared/llm-model-fetch'
import { fetchRemoteModels } from '../llm/model-discovery'
import type { LLMConnectionTestInput, LLMConnectionTestResult, LLMModelFetchInput, LLMModelFetchResult, RendererSettings } from '../../../src/shared/types'
import { MAX_COMPANION_RESPONSE_NOTE_LENGTH } from '../../../src/shared/types'
import { redactMcpConfigsForRenderer, hasNewOrChangedEnabledMcpConfig, mergeMcpConfigListSecrets, parseStoredMcpConfigs } from '../mcp/config-security'
import { withMcpConfigLock } from '../mcp/config-lock'
import { z } from 'zod'
import { hasLLMAuthentication } from '../../../src/shared/llm-connection-test'

const modelConfigurationSchema = z.object({
  connections: z.string().max(settings.MAX_SETTING_VALUE_LENGTH),
  routes: z.string().max(settings.MAX_SETTING_VALUE_LENGTH),
})
const connectionListSchema = z.array(z.object({
  id: z.string().min(1).max(256), name: z.string().max(1024), baseUrl: z.string().max(8192),
  model: z.string().max(1024), enabled: z.boolean(), apiKey: z.string().max(65536).optional(),
  models: z.array(z.object({ id: z.string().min(1).max(1024), enabled: z.boolean() })).max(2000).optional(),
  provider: z.enum(['auto', 'openai', 'anthropic', 'gemini']).optional(),
  source: z.enum(['official', 'coding', 'relay', 'local', 'custom']).optional(), presetId: z.string().max(256).optional(),
})).max(1000)
const routeListSchema = z.array(z.object({
  purpose: z.enum(['primary', 'auxiliary', 'image']), connectionId: z.string().min(1).max(256),
  model: z.string().max(1024), enabled: z.boolean(),
})).max(3000)
let modelConfigurationWrites: Promise<void> = Promise.resolve()

/** 同组配置包含凭据读改写；按请求顺序串行且失败释放，错误仍通过原 Promise 返回调用方。 */
function withModelConfigurationWrite(action: () => Promise<void>): Promise<void> {
  const next = modelConfigurationWrites.then(action)
  modelConfigurationWrites = next.then(() => undefined, () => undefined)
  return next
}

const RENDERER_BLOCKED_SETTING_KEYS = new Set<keyof AppSettings>(['currentProject', 'recentProjects'])

function mergeModelConnectionSecrets(nextRaw: string, previousRaw: string): string {
  let next: unknown
  let previous: unknown
  try { next = JSON.parse(nextRaw); previous = JSON.parse(previousRaw) } catch { throw new Error('模型连接配置无效') }
  if (!Array.isArray(next) || !Array.isArray(previous)) throw new Error('模型连接配置无效')
  const oldById = new Map(previous.filter((item) => item && typeof item === 'object').map((item) => [String((item as Record<string, unknown>).id), item as Record<string, unknown>]))
  return JSON.stringify(next.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const connection = item as Record<string, unknown>
    const old = oldById.get(String(connection.id))
    const apiKey = typeof connection.apiKey === 'string' && connection.apiKey.trim()
      ? connection.apiKey
      : old && sameConnectionEndpoint(old, connection) && typeof old.apiKey === 'string' ? old.apiKey : ''
    const { hasApiKey: _hasApiKey, ...rest } = connection
    const models = normalizeConnectionModels({ model: typeof rest.model === 'string' ? rest.model : '', models: Array.isArray(rest.models) ? rest.models as Array<{ id?: string; enabled?: boolean }> : [] })
    return { ...rest, apiKey, models, model: models[0]?.id ?? (typeof rest.model === 'string' ? rest.model : '') }
  }))
}

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
  const mainConfig = await loadMainLLMConfig()
  let modelConnections = '[]'
  try {
    const parsed = JSON.parse(stored.modelConnections)
    if (Array.isArray(parsed)) {
      modelConnections = JSON.stringify(parsed.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item
        const connection = item as Record<string, unknown>
        const hasApiKey = typeof connection.apiKey === 'string' && Boolean(connection.apiKey.trim())
        return { ...connection, apiKey: '', hasApiKey }
      }))
    }
  } catch {
    modelConnections = '[]'
  }
  return {
    ...stored,
    llmApiKey: '',
    llmApiKeyConfigured: stored.llmApiKey.trim() ? 'true' : 'false',
    llmConnectionReady: hasLLMAuthentication(mainConfig) && Boolean(mainConfig.model?.trim()) ? 'true' : 'false',
    llmEffectiveModel: mainConfig.model,
    llmEffectiveBaseUrl: mainConfig.baseUrl,
    mcpServers: redactMcpConfigsForRenderer(stored.mcpServers),
    modelConnections,
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

  ipcMain.handle('settings:save-model-configuration', async (_event, input: unknown) => {
    const parsed = modelConfigurationSchema.safeParse(input)
    if (!parsed.success) throw new Error('模型配置无效或超出长度限制')
    let connections: unknown, routes: unknown
    try { connections = JSON.parse(parsed.data.connections); routes = JSON.parse(parsed.data.routes) }
    catch { throw new Error('模型配置格式无效') }
    const checkedConnections = connectionListSchema.safeParse(connections)
    const checkedRoutes = routeListSchema.safeParse(routes)
    if (!checkedConnections.success || !checkedRoutes.success
      || new Set(checkedConnections.data.map((item) => item.id)).size !== checkedConnections.data.length) {
      throw new Error('模型连接或用途路由无效')
    }
    return withModelConfigurationWrite(async () => {
      const merged = mergeModelConnectionSecrets(JSON.stringify(checkedConnections.data), await settings.getSetting('modelConnections'))
      await settings.saveModelConfiguration({ connections: merged, routes: JSON.stringify(checkedRoutes.data) })
    })
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    if (!isRendererWritableSettingKey(key)) {
      throw new Error('无效的设置项')
    }
    if (typeof value !== 'string' || value.length > settings.MAX_SETTING_VALUE_LENGTH) {
      throw new Error('设置值无效或超出长度限制')
    }
    if (key === 'companionResponseNote' && value.length > MAX_COMPANION_RESPONSE_NOTE_LENGTH) {
      throw new Error('相处补充说明超出长度限制')
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
      // 整表保存与向导新增、工具许可共用锁；解密合并到写盘必须在同一临界区，旧快照冲突另行处理。
      return withMcpConfigLock(async () => {
        const previousRaw = await settings.getSetting('mcpServers')
        const merged = mergeMcpConfigListSecrets(value, previousRaw)
        if (!merged.ok) throw new Error(merged.error)
        const previousList = parseStoredMcpConfigs(previousRaw)
        if (hasNewOrChangedEnabledMcpConfig(previousList, merged.configs)
          && !await confirmHighRiskSettingChange(
            '确认保存并启用 MCP 服务',
            '启用的 MCP 服务可能启动本地进程、访问文件或连接远程网络。只保存并启用你信任的配置。',
          )) throw new Error('用户取消高风险设置变更')
        await settings.setSetting('mcpServers', merged.json)
      })
    }
    if (key === 'modelConnections' || key === 'modelRoutes') {
      return withModelConfigurationWrite(async () => {
        if (key === 'modelConnections') value = mergeModelConnectionSecrets(value, await settings.getSetting('modelConnections'))
        await settings.setSetting(key, value)
      })
    }

    if (key === 'permissionRules') validatePermissionRules(value || '[]')

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
      const storedKey = validated.value.useStoredApiKey
        ? await resolveStoredConnectionApiKey(validated.value)
        : ''
      const config = await loadMainLLMConfig({
        apiKey: validated.value.apiKey || storedKey,
        baseUrl: validated.value.baseUrl,
        model: validated.value.model,
        ...(validated.value.provider ? { provider: validated.value.provider } : {}),
      })
      if (!hasLLMAuthentication(config)) return { ok: false, error: '请先配置 API Key' }
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

  ipcMain.handle('settings:fetch-models', async (_event, input: LLMModelFetchInput): Promise<LLMModelFetchResult> => {
    const validated = validateLLMModelFetchInput(input)
    if (!validated.ok) return { ok: false, error: validated.error, reason: validated.reason, retryable: validated.reason !== 'missing-key' }
    const storedKey = validated.value.useStoredApiKey
      ? await resolveStoredConnectionApiKey(validated.value)
      : ''
    const config = await loadMainLLMConfig({
      apiKey: validated.value.apiKey || storedKey,
      ...(validated.value.provider ? { provider: validated.value.provider } : {}),
      baseUrl: validated.value.baseUrl,
    })
    if (!hasLLMAuthentication(config)) return { ok: false, error: MODEL_FETCH_MESSAGES.missingKey, reason: 'missing-key', retryable: false }
    return fetchRemoteModels(config)
  })
}

/**
 * 按连接读取已存密钥，供测试连接和模型发现使用。
 *
 * 背景：Renderer 只能看到 hasApiKey，不能拿回密钥原文；正式页又必须能测未保存草稿和已保存连接。
 * 设计意图：草稿 Key 优先由调用方传入；已存 Key 同时核对 connectionId、端点与协议，不用全局 llmApiKey 冒充该连接。
 * 关键约束：缺少身份、找不到连接或端点 / 协议变化均返回空串，阻止编辑表单将旧凭据发往新供应商。
 */
async function resolveStoredConnectionApiKey(input: Pick<LLMModelFetchInput, 'connectionId' | 'baseUrl' | 'provider'>): Promise<string> {
  const { connectionId } = input
  if (!connectionId) return ''
  const stored = await settings.getAllSettings()
  try {
    const parsed = JSON.parse(stored.modelConnections)
    if (!Array.isArray(parsed)) return ''
    const match = parsed.find((item) => item && typeof item === 'object' && String((item as Record<string, unknown>).id) === connectionId && sameConnectionEndpoint(item as Record<string, unknown>, input))
    return typeof match?.apiKey === 'string' ? match.apiKey.trim() : ''
  } catch {
    return ''
  }
}

export function connectionTestError(error: unknown): string {
  if (error instanceof LLMError) {
    if (error.status === 401 || error.status === 403) return 'API Key 无效或没有权限'
    if (error.status === 404) return 'Base URL 或模型名不存在'
    if (error.status === 429) return '请求过于频繁，请稍后再试'
  }
  return '连接失败，请检查网络、Base URL、模型名和 API Key'
}
