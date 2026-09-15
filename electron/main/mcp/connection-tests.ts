import { randomUUID } from 'node:crypto'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { McpServerConfig, McpConnectionTestResult, McpConnectionSaveResult } from '../../../src/shared/types'
import { createMcpClient, type McpTool, type McpResource } from './client'
import { hydrateMcpConfigSecrets } from './config-security'
import { createMcpTransport } from './transport'
import { createLogger } from '../utils/logger'

const log = createLogger('McpConnectionTests')
const MAX_TOOLS = 1000
const MAX_INVENTORY_BYTES = 2 * 1024 * 1024
const MAX_SAVED_RESULTS = 128

export interface TestedMcpConnection {
  config: McpServerConfig
  client: Client
  transport: Transport
  tools: McpTool[]
  resources: McpResource[]
}
interface Entry extends Partial<TestedMcpConnection> {
  owner: number
  requestId: string
  phase: 'confirming' | 'testing' | 'ready' | 'saving'
  controller: AbortController
  alive: boolean
  timer?: ReturnType<typeof setTimeout>
  closing?: Promise<void>
  ownerGone?: boolean
}
interface SavedResult { owner: number; allowedTools: string[]; result: McpConnectionSaveResult; expiresAt: number }
interface Dependencies {
  confirm: (config: McpServerConfig, owner: number) => Promise<boolean>
  persist: (config: McpServerConfig) => Promise<void>
  adopt: (connection: TestedMcpConnection) => void
  timeoutMs?: number
  retentionMs?: number
}

/**
 * 背景：添加向导必须先验证再保存，不能借生产 Manager 测试而提前开放工具。
 * 设计意图：独立拥有 SDK 连接，成功后移交同一连接；只把工具显示字段返回 Renderer。
 * 关键约束：请求绑定窗口、取消不写配置、保存只接受测试结果白名单；移交前后只有一个所有者。
 */
export class McpConnectionTests {
  private entries = new Map<string, Entry>()
  private savedResults = new Map<string, SavedResult>()
  constructor(private dependencies: Dependencies) {}

  private key(owner: number, requestId: string) { return `${owner}:${requestId}` }

  private async close(entry: Entry): Promise<void> {
    if (entry.closing) return entry.closing
    clearTimeout(entry.timer)
    entry.alive = false
    entry.controller.abort()
    const key = this.key(entry.owner, entry.requestId)
    if (this.entries.get(key) === entry) this.entries.delete(key)
    entry.closing = (async () => {
      try { await entry.client?.close() }
      catch { log.warn('MCP test client cleanup failed') }
      try { await entry.transport?.close() }
      catch { log.warn('MCP test transport cleanup failed') }
    })()
    return entry.closing
  }

  async cancel(owner: number, requestId: string): Promise<{ ok: boolean; error?: string }> {
    if (typeof requestId !== 'string' || requestId.length > 100) return { ok: false, error: '测试请求无效。' }
    const entry = this.entries.get(this.key(owner, requestId))
    if (!entry) return { ok: true }
    if (entry.phase === 'saving') return { ok: false, error: '连接正在保存，请等待完成。' }
    await this.close(entry)
    return { ok: true }
  }

  async cancelOwner(owner: number): Promise<void> {
    for (const [key, saved] of this.savedResults) if (saved.owner === owner) this.savedResults.delete(key)
    for (const entry of this.entries.values()) if (entry.owner === owner) entry.ownerGone = true
    await Promise.all([...this.entries.values()].filter((entry) => entry.owner === owner && entry.phase !== 'saving').map((entry) => this.close(entry)))
  }

  /** 保存响应可能丢失；仅缓存有界、无凭据的结果，不把同请求的不同工具选择当作同一保存。 */
  private rememberSaved(entry: Entry, allowedTools: string[], result: McpConnectionSaveResult): McpConnectionSaveResult {
    this.pruneSaved()
    if (!entry.ownerGone) {
      while (this.savedResults.size >= MAX_SAVED_RESULTS) this.savedResults.delete(this.savedResults.keys().next().value!)
      this.savedResults.set(this.key(entry.owner, entry.requestId), { owner: entry.owner, allowedTools: [...allowedTools], result: { ...result }, expiresAt: Date.now() + (this.dependencies.retentionMs ?? 300_000) })
    }
    return result
  }

  private pruneSaved(): void {
    for (const [key, saved] of this.savedResults) if (saved.expiresAt <= Date.now()) this.savedResults.delete(key)
  }

  /** 原生确认可能迟到；取消只结束本次等待，不让稍后的确认重新启动连接。 */
  private async confirm(entry: Entry): Promise<boolean> {
    let onAbort!: () => void
    const aborted = new Promise<never>((_resolve, reject) => { onAbort = () => reject(new Error('MCP confirmation cancelled')) })
    entry.controller.signal.addEventListener('abort', onAbort, { once: true })
    try { return await Promise.race([this.dependencies.confirm(entry.config!, entry.owner), aborted]) }
    finally { entry.controller.signal.removeEventListener('abort', onAbort) }
  }

  private assertActive(entry: Entry): void {
    if (entry.controller.signal.aborted || this.entries.get(this.key(entry.owner, entry.requestId)) !== entry) throw new Error('MCP test cancelled')
  }

  async test(owner: number, requestId: string, input: unknown): Promise<McpConnectionTestResult> {
    if (typeof requestId !== 'string' || !/^[\w-]{1,100}$/.test(requestId) || !input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: '连接参数无效。' }
    this.pruneSaved()
    if (this.savedResults.has(this.key(owner, requestId))) return { ok: false, error: '该测试请求已保存，请重新开始添加连接。' }
    if (this.entries.size >= 8 || [...this.entries.values()].some((entry) => entry.owner === owner)) return { ok: false, error: '请先取消当前连接测试。' }
    const value = input as Record<string, unknown>
    const config = hydrateMcpConfigSecrets({ id: randomUUID(), enabled: true, allowedTools: [],
      name: value.name, transport: value.transport, command: value.command, args: value.args,
      env: value.env, url: value.url, bearerToken: value.bearerToken }, [])
    if (!config) return { ok: false, error: '连接配置无效，请检查地址、命令或凭据。' }
    const entry: Entry = { owner, requestId, phase: 'confirming', controller: new AbortController(), alive: false, config }
    this.entries.set(this.key(owner, requestId), entry)
    entry.timer = setTimeout(() => { void this.close(entry) }, this.dependencies.retentionMs ?? 300_000)
    try {
      if (!await this.confirm(entry)) { await this.close(entry); return { ok: false, error: '已取消连接测试。' } }
      this.assertActive(entry)
      entry.phase = 'testing'
      clearTimeout(entry.timer)
      entry.timer = setTimeout(() => { void this.close(entry) }, this.dependencies.timeoutMs ?? 30_000)
      const client = createMcpClient()
      const transport = createMcpTransport(config)
      entry.client = client
      entry.transport = transport
      client.onclose = () => { entry.alive = false }
      await client.connect(transport, { signal: entry.controller.signal, timeout: this.dependencies.timeoutMs ?? 30_000 })
      this.assertActive(entry)
      entry.alive = true
      entry.tools = await this.discover(entry as Entry & TestedMcpConnection)
      entry.resources = await this.discoverResources(entry as Entry & TestedMcpConnection)
      this.assertActive(entry)
      if (!entry.alive) throw new Error('MCP test disconnected')
      entry.phase = 'ready'
      clearTimeout(entry.timer)
      entry.timer = setTimeout(() => { void this.close(entry) }, this.dependencies.retentionMs ?? 300_000)
      return { ok: true, tools: entry.tools.map(({ name, description }) => ({ name, description })) }
    } catch (error) {
      const cancelled = entry.controller.signal.aborted
      await this.close(entry)
      log.warn('MCP connection test failed', { errorType: error instanceof Error ? error.name : 'unknown' })
      return { ok: false, error: cancelled ? '连接测试已取消或超时，请重试。' : '连接测试失败，请检查服务、命令或认证信息。' }
    }
  }

  private async discover(entry: Entry & TestedMcpConnection): Promise<McpTool[]> {
    if (!entry.client.getServerCapabilities()?.tools) return []
    const tools: McpTool[] = []
    const names = new Set<string>()
    const cursors = new Set<string>()
    let cursor: string | undefined
    let bytes = 0
    do {
      this.assertActive(entry)
      const result = await entry.client.listTools(cursor ? { cursor } : undefined, { signal: entry.controller.signal, timeout: this.dependencies.timeoutMs ?? 30_000 })
      bytes += Buffer.byteLength(JSON.stringify(result), 'utf8')
      if (bytes > MAX_INVENTORY_BYTES || tools.length + result.tools.length > MAX_TOOLS) throw new Error('MCP inventory limit')
      for (const tool of result.tools) {
        if (!tool.name || tool.name.length > 200 || names.has(tool.name)) throw new Error('MCP tool identity invalid')
        names.add(tool.name)
        tools.push({ serverId: entry.config.id, serverName: entry.config.name, name: tool.name,
          description: (tool.description ?? '').slice(0, 2048), inputSchema: tool.inputSchema as Record<string, unknown> })
      }
      cursor = result.nextCursor
      if (cursor && (cursors.has(cursor) || cursors.size >= 100)) throw new Error('MCP inventory pagination limit')
      if (cursor) cursors.add(cursor)
    } while (cursor)
    return tools
  }

  private async discoverResources(entry: Entry & TestedMcpConnection): Promise<McpResource[]> {
    if (!entry.client.getServerCapabilities()?.resources) return []
    const resources: McpResource[] = []
    const uris = new Set<string>()
    const cursors = new Set<string>()
    let cursor: string | undefined
    let bytes = 0
    do {
      this.assertActive(entry)
      const result = await entry.client.listResources(cursor ? { cursor } : undefined, { signal: entry.controller.signal, timeout: this.dependencies.timeoutMs ?? 30_000 })
      bytes += Buffer.byteLength(JSON.stringify(result), 'utf8')
      if (bytes > MAX_INVENTORY_BYTES || resources.length + result.resources.length > MAX_TOOLS) throw new Error('MCP resource inventory limit')
      for (const resource of result.resources) {
        if (!resource.uri || resource.uri.length > 16_384 || uris.has(resource.uri)) throw new Error('MCP resource identity invalid')
        uris.add(resource.uri)
        resources.push({ serverId: entry.config.id, serverName: entry.config.name, uri: resource.uri,
          name: resource.name.slice(0, 500), description: resource.description?.slice(0, 2048), mimeType: resource.mimeType?.slice(0, 200) })
      }
      cursor = result.nextCursor
      if (cursor && (cursors.has(cursor) || cursors.size >= 100)) throw new Error('MCP resource pagination limit')
      if (cursor) cursors.add(cursor)
    } while (cursor)
    return resources
  }

  async save(owner: number, requestId: string, allowedTools: unknown): Promise<McpConnectionSaveResult> {
    if (typeof requestId !== 'string' || requestId.length > 100) return { ok: false, error: '测试请求无效。' }
    this.pruneSaved()
    const saved = this.savedResults.get(this.key(owner, requestId))
    if (saved) {
      if (!Array.isArray(allowedTools) || allowedTools.length !== saved.allowedTools.length || new Set(allowedTools).size !== allowedTools.length
        || allowedTools.some((name) => typeof name !== 'string' || !saved.allowedTools.includes(name))) return { ok: false, error: '连接已保存，不能在原请求中更改工具选择。' }
      return { ...saved.result }
    }
    const entry = this.entries.get(this.key(owner, requestId))
    if (!entry || entry.phase !== 'ready' || !entry.alive || !entry.config || !entry.client || !entry.transport || !entry.tools || !entry.resources) return { ok: false, error: '测试结果已失效，请重新测试连接。' }
    if (!Array.isArray(allowedTools) || allowedTools.length > MAX_TOOLS || new Set(allowedTools).size !== allowedTools.length
      || allowedTools.some((name) => typeof name !== 'string' || !entry.tools!.some((tool) => tool.name === name))) return { ok: false, error: '工具选择无效，请重新选择。' }
    entry.phase = 'saving'
    clearTimeout(entry.timer)
    const config = { ...entry.config, allowedTools: [...allowedTools] as string[] }
    try { await this.dependencies.persist(config) }
    catch {
      if (entry.ownerGone) {
        await this.close(entry)
        return { ok: false, error: '连接未保存，页面已关闭，测试连接已清理。' }
      }
      entry.phase = 'ready'
      entry.timer = setTimeout(() => { void this.close(entry) }, this.dependencies.retentionMs ?? 300_000)
      return { ok: false, error: '连接未保存，请重试；当前测试结果仍保留。' }
    }
    try {
      if (!entry.alive) throw new Error('MCP connection closed before activation')
      this.dependencies.adopt({ config, client: entry.client, transport: entry.transport, tools: entry.tools, resources: entry.resources })
      this.entries.delete(this.key(owner, requestId))
      return this.rememberSaved(entry, config.allowedTools, { ok: true, serverId: config.id })
    } catch {
      await this.close(entry)
      return this.rememberSaved(entry, config.allowedTools, { ok: false, savedServerId: config.id, error: '连接已保存，但未能启用，请在服务列表中重试。' })
    }
  }
}
