import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { runtime } from '../agent/runtime'

const MAX_BODY = 64 * 1024

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
 * 启动仅绑定本机的外部评测入口。
 * 背景：Python 评测器需要调用真实 Electron Runtime，直接在 Node 中导入主进程会缺少 Electron 初始化。
 * 设计意图：由 Electron 主进程持有 Runtime，评测器只提交任务正文并收到统一终态，避免复制第二套 Agent Loop。
 * 关键约束：必须显式设置环境变量才启动，只监听 127.0.0.1，只接受 POST /run，单请求体有界，禁止暴露 IPC 或凭据。
 */
export function startExternalEvalController(): Server | null {
  if (process.env.MY_AGENT_EVAL_CONTROLLER !== '1') return null
  const port = Number(process.env.MY_AGENT_EVAL_PORT || 48761)
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/run') {
      writeJson(response, 404, { ok: false, error: 'Not found' })
      return
    }
    try {
      const raw = JSON.parse(await readBody(request)) as Record<string, unknown>
      const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : ''
      const id = typeof raw.id === 'string' ? raw.id.trim() : ''
      if (!prompt || !id) {
        writeJson(response, 400, { ok: false, error: 'id and prompt are required' })
        return
      }
      const result = await runtime.runHeadless(prompt, `external-eval:${id}`)
      writeJson(response, 200, { ok: true, id, result, terminalReason: 'completed' })
    } catch (error) {
      writeJson(response, 500, { ok: false, error: error instanceof Error ? error.message : '评测运行失败' })
    }
  })
  server.listen(port, '127.0.0.1')
  return server
}
