import fs from 'node:fs'
import path from 'node:path'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { runtime } from '../agent/runtime'

// compaction 等上下文压力评测会发送 ~430KB 文本，因此单请求体上限设为 2MB 且保持有界。
const MAX_BODY = 2 * 1024 * 1024

export interface ExternalEvalMcpServer {
  id: string
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface ExternalEvalRequestPayload {
  id: string
  prompt: string
  sessionId?: string
  workspaceRoot?: string
  allowWorkspaceWrites?: boolean
  mcpServers?: ExternalEvalMcpServer[]
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
    if (body.length > MAX_BODY) throw new Error('评测请求过大')
  }
  return body
}

/**
 * 校验外部评测请求体。
 *
 * 背景：外部 Harness 评测器（Agent Context Benchmark、RepoBench 等）需要传隔离工作区和会话 ID，
 *       而仅靠默认全局工作区会导致评测写入污染主仓库。
 * 设计意图：在 HTTP 入口集中做路径绝对性、目录存在性与写权限前置校验，并保持对旧版 { id, prompt } 请求的兼容。
 * 关键约束：allowWorkspaceWrites=true 必须绑定已存在的绝对目录 workspaceRoot，禁止在无隔离目录时放行写入。
 */
export function parseExternalEvalRequest(raw: Record<string, unknown>): ExternalEvalRequestPayload {
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : ''
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!prompt || !id) {
    throw new Error('id and prompt are required')
  }

  const sessionId = typeof raw.sessionId === 'string' && raw.sessionId.trim()
    ? raw.sessionId.trim()
    : undefined

  let workspaceRoot: string | undefined
  if (raw.workspaceRoot !== undefined && raw.workspaceRoot !== null && raw.workspaceRoot !== '') {
    if (typeof raw.workspaceRoot !== 'string' || !path.isAbsolute(raw.workspaceRoot.trim())) {
      throw new Error('workspaceRoot must be an absolute directory path')
    }
    const resolved = path.resolve(raw.workspaceRoot.trim())
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error('workspaceRoot does not exist or is not a directory')
    }
    workspaceRoot = resolved
  }

  const allowWorkspaceWrites = raw.allowWorkspaceWrites === true
  if (allowWorkspaceWrites && !workspaceRoot) {
    throw new Error('allowWorkspaceWrites requires workspaceRoot')
  }

  let mcpServers: ExternalEvalMcpServer[] | undefined
  if (raw.mcpServers !== undefined && raw.mcpServers !== null) {
    if (!Array.isArray(raw.mcpServers)) {
      throw new Error('mcpServers must be an array')
    }
    if (raw.mcpServers.length > 0 && !workspaceRoot) {
      throw new Error('mcpServers requires workspaceRoot')
    }
    mcpServers = raw.mcpServers.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`mcpServers[${index}] must be an object`)
      }
      const record = item as Record<string, unknown>
      const serverId = typeof record.id === 'string' ? record.id.trim() : ''
      const command = typeof record.command === 'string' ? record.command.trim() : ''
      const args = Array.isArray(record.args) && record.args.every(a => typeof a === 'string')
        ? record.args as string[]
        : null
      if (!serverId || !command || !args) {
        throw new Error(`mcpServers[${index}] requires id, command, and string[] args`)
      }
      let cwd: string | undefined
      if (record.cwd !== undefined && record.cwd !== null && record.cwd !== '') {
        if (typeof record.cwd !== 'string' || !path.isAbsolute(record.cwd.trim())) {
          throw new Error(`mcpServers[${index}].cwd must be an absolute directory path`)
        }
        const resolvedCwd = path.resolve(record.cwd.trim())
        if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
          throw new Error(`mcpServers[${index}].cwd does not exist or is not a directory`)
        }
        cwd = resolvedCwd
      }
      let env: Record<string, string> | undefined
      if (record.env !== undefined && record.env !== null) {
        if (typeof record.env !== 'object' || Array.isArray(record.env)) {
          throw new Error(`mcpServers[${index}].env must be a string map`)
        }
        env = Object.fromEntries(
          Object.entries(record.env as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      }
      return { id: serverId, command, args, cwd, env }
    })
  }

  return {
    id,
    prompt,
    sessionId,
    workspaceRoot,
    allowWorkspaceWrites,
    mcpServers,
  }
}

/**
 * 启动仅绑定本机的外部评测入口。
 * 背景：外部评测器（Python / Node）需要调用真实 Electron Runtime，直接在 Node 中导入主进程会缺少 Electron 初始化。
 * 设计意图：由 Electron 主进程持有 Runtime，评测器提交任务正文与可选隔离工作区并收到统一终态与轨迹摘要，避免复制第二套 Agent Loop。
 * 关键约束：必须显式设置环境变量才启动，只监听 127.0.0.1，仅开放 GET /health 与 POST /run，单请求体有界，禁止暴露 IPC 或凭据。
 */
export function startExternalEvalController(): Server | null {
  if (process.env.MY_AGENT_EVAL_CONTROLLER !== '1') return null
  const port = Number(process.env.MY_AGENT_EVAL_PORT || 48761)
  const server = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      writeJson(response, 200, { ok: true, service: 'my-agent-external-eval' })
      return
    }
    if (request.method !== 'POST' || request.url !== '/run') {
      writeJson(response, 404, { ok: false, error: 'Not found' })
      return
    }
    let payload: ExternalEvalRequestPayload
    try {
      const raw = JSON.parse(await readBody(request)) as Record<string, unknown>
      payload = parseExternalEvalRequest(raw)
    } catch (error) {
      writeJson(response, 400, { ok: false, error: error instanceof Error ? error.message : '评测请求格式错误' })
      return
    }

    try {
      const turn = await runtime.runExternalEvalTurn({
        prompt: payload.prompt,
        taskName: `external-eval:${payload.id}`,
        sessionId: payload.sessionId,
        workspaceRoot: payload.workspaceRoot,
        allowWorkspaceWrites: payload.allowWorkspaceWrites,
        mcpServers: payload.mcpServers,
      })
      writeJson(response, 200, {
        ok: true,
        id: payload.id,
        sessionId: turn.sessionId,
        result: turn.result,
        terminalReason: turn.terminalReason,
        toolCalls: turn.toolCalls,
        usage: turn.usage,
        compactEvents: turn.compactEvents,
        durationMs: turn.durationMs,
      })
    } catch (error) {
      writeJson(response, 500, { ok: false, error: error instanceof Error ? error.message : '评测运行失败' })
    }
  })
  server.listen(port, '127.0.0.1')
  return server
}
