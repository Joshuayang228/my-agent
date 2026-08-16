import type { McpServerConfig } from './client'

export const MCP_REDACTED_ENV_VALUE = '__MY_AGENT_REDACTED__'
export const MAX_MCP_SERVERS = 50

const MAX_MCP_ID_LENGTH = 200
const MAX_MCP_NAME_LENGTH = 200
const MAX_MCP_COMMAND_LENGTH = 4_096
const MAX_MCP_ARG_LENGTH = 8_192
const MAX_MCP_ENV_ENTRIES = 100
const MAX_MCP_ENV_KEY_LENGTH = 256
const MAX_MCP_ENV_VALUE_LENGTH = 16_384

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

/**
 * 校验 MCP 配置进入主进程执行边界前的结构与资源上限。
 *
 * 背景：MCP 配置既可能来自设置页，也可能来自被污染的 Renderer IPC。
 * 设计意图：启动恢复、手动连接和设置持久化共用同一套 fail-closed 校验。
 * 关键约束：stdio 必须有命令；SSE 只允许 http/https；env 不接受非法键名或超长值。
 */
export function isValidMcpConfig(value: unknown): value is McpServerConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  const transport = config.transport ?? 'stdio'
  if (!isBoundedString(config.id, MAX_MCP_ID_LENGTH)
    || !isBoundedString(config.name, MAX_MCP_NAME_LENGTH)
    || !Array.isArray(config.args)
    || config.args.length > 128
    || config.args.some((arg) => typeof arg !== 'string' || arg.length > MAX_MCP_ARG_LENGTH)
    || typeof config.enabled !== 'boolean'
    || (transport !== 'stdio' && transport !== 'sse')) return false
  if (transport === 'stdio' && !isBoundedString(config.command, MAX_MCP_COMMAND_LENGTH)) return false
  if (transport === 'sse') {
    if (typeof config.command !== 'string') return false
    if (!isBoundedString(config.url, 4_096)) return false
    try {
      const url = new URL(config.url)
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return false
    } catch {
      return false
    }
  }
  if (config.env !== undefined) {
    if (!config.env || typeof config.env !== 'object' || Array.isArray(config.env)) return false
    const entries = Object.entries(config.env)
    if (entries.length > MAX_MCP_ENV_ENTRIES) return false
    if (entries.some(([key, envValue]) => key.length > MAX_MCP_ENV_KEY_LENGTH
      || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
      || typeof envValue !== 'string' || envValue.length > MAX_MCP_ENV_VALUE_LENGTH)) return false
  }
  return true
}

export function parseStoredMcpConfigs(raw: string): McpServerConfig[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed) || parsed.length > MAX_MCP_SERVERS) return []
    const configs = parsed.filter(isValidMcpConfig)
    const uniqueIds = new Set(configs.map(config => config.id))
    return configs.length === parsed.length && uniqueIds.size === configs.length ? configs : []
  } catch {
    return []
  }
}

/** Renderer 只能知道 env 键是否存在，不能读取任何值。 */
export function redactMcpConfigsForRenderer(raw: string): string {
  const configs = parseStoredMcpConfigs(raw)
  return JSON.stringify(configs.map(config => ({
    ...config,
    env: config.env
      ? Object.fromEntries(Object.keys(config.env).map(key => [key, MCP_REDACTED_ENV_VALUE]))
      : undefined,
  })))
}

/**
 * 用主进程安全存储中的旧值替换 Renderer 回传的脱敏哨兵。
 * 哨兵若没有同 id、同 env key 的旧值可恢复，必须拒绝，不能把哨兵当真实 secret 启动进程。
 */
export function hydrateMcpConfigSecrets(
  incoming: unknown,
  storedConfigs: readonly McpServerConfig[],
): McpServerConfig | null {
  if (!isValidMcpConfig(incoming)) return null
  const previous = storedConfigs.find(config => config.id === incoming.id)
  const env = incoming.env ? { ...incoming.env } : undefined
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (value !== MCP_REDACTED_ENV_VALUE) continue
      const storedValue = previous?.env?.[key]
      if (storedValue === undefined || storedValue === MCP_REDACTED_ENV_VALUE) return null
      env[key] = storedValue
    }
  }
  const hydrated = { ...incoming, env }
  return isValidMcpConfig(hydrated) ? hydrated : null
}

export function mergeMcpConfigListSecrets(
  incomingRaw: string,
  storedRaw: string,
): { ok: true; configs: McpServerConfig[]; json: string } | { ok: false; error: string } {
  let incoming: unknown
  try {
    incoming = JSON.parse(incomingRaw || '[]')
  } catch {
    return { ok: false, error: 'MCP 配置不是有效 JSON' }
  }
  if (!Array.isArray(incoming) || incoming.length > MAX_MCP_SERVERS) {
    return { ok: false, error: 'MCP 配置数量无效或超出限制' }
  }
  const stored = parseStoredMcpConfigs(storedRaw)
  const configs: McpServerConfig[] = []
  const ids = new Set<string>()
  for (const item of incoming) {
    const hydrated = hydrateMcpConfigSecrets(item, stored)
    if (!hydrated || ids.has(hydrated.id)) return { ok: false, error: 'MCP 配置包含无效或重复的服务' }
    ids.add(hydrated.id)
    configs.push(hydrated)
  }
  return { ok: true, configs, json: JSON.stringify(configs) }
}

function comparableMcpConfig(config: McpServerConfig): string {
  return JSON.stringify({
    id: config.id,
    name: config.name,
    transport: config.transport ?? 'stdio',
    command: config.command,
    args: config.args,
    env: Object.entries(config.env ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    url: config.url ?? '',
    enabled: config.enabled,
  })
}

/** 仅新增、重新启用或修改一个将被自动执行的 enabled 配置时要求真人确认。 */
export function hasNewOrChangedEnabledMcpConfig(
  previous: readonly McpServerConfig[],
  next: readonly McpServerConfig[],
): boolean {
  const previousById = new Map(previous.map(config => [config.id, config]))
  return next.some(config => {
    if (!config.enabled) return false
    const old = previousById.get(config.id)
    return !old?.enabled || comparableMcpConfig(old) !== comparableMcpConfig(config)
  })
}
