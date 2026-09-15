import { useState } from 'react'
import { McpConnectionForm } from '../settings/McpConnectionForm'
import type { McpConnectionActions, McpConnectionInput, McpConnectionTestResult, McpDiscoveredTool } from '../../shared/types'

interface PreviewServer {
  name: string
  transport: string
  address: string
  status: 'connected'
  tools: Array<{ id: string; name: string; allowed: boolean }>
}
interface Props { scene: string; onCancel: () => void; onSave: (server: PreviewServer) => void }

/**
 * 背景：候选重复表单曾与正式生命周期分叉，视觉通过不能证明正式操作可用。
 * 设计意图：此处只提供隔离 actions，全部字段、状态和控件由正式共享表单渲染。
 * 关键约束：不调用 IPC 或网络；取消必须结束模拟请求，直达场景仅生成样张结果。
 */
export function McpConnectionPreview({ scene, onCancel, onSave }: Props) {
  const [fixture] = useState(() => {
    const initial: McpConnectionInput = { name: scene === 'add-local' ? '文件服务' : '文档服务',
      transport: scene === 'add-local' ? 'stdio' : 'streamable-http', command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './workspace'], url: 'https://docs.example.com/mcp' }
    const discover = (config: McpConnectionInput): McpDiscoveredTool[] => [{ name: config.transport === 'stdio' ? 'list_directory' : 'search_docs', description: config.transport === 'stdio' ? '列出目录' : '搜索文档' }]
    let tested: { id: string; config: McpConnectionInput } | null = null
    let pending: { id: string; timer: ReturnType<typeof setTimeout>; resolve: (result: McpConnectionTestResult) => void } | null = null
    let saved: PreviewServer | null = null
    const actions: McpConnectionActions = {
      testConnection: (id, config) => new Promise((resolve) => {
        pending = { id, resolve, timer: setTimeout(() => {
          pending = null; tested = { id, config }; resolve({ ok: true, tools: discover(config) })
        }, 650) }
      }),
      cancelTest: async (id) => {
        if (pending?.id === id) { clearTimeout(pending.timer); pending.resolve({ ok: false, error: '已取消连接测试。' }); pending = null }
        if (tested?.id === id) tested = null
        return { ok: true }
      },
      saveTested: async (id, allowed) => {
        const config = tested?.id === id ? tested.config : scene === 'add-ready' && id.startsWith('fixture-') ? initial : null
        if (!config) return { ok: false, error: '测试结果已失效，请重新测试连接。' }
        saved = { name: config.name, transport: config.transport === 'stdio' ? '本地 · stdio' : '远程 · Streamable HTTP',
          address: config.transport === 'stdio' ? config.command : config.url!, status: 'connected',
          tools: discover(config).map((tool) => ({ id: tool.name, name: tool.description, allowed: allowed.includes(tool.name) })) }
        tested = null
        return { ok: true, serverId: id }
      },
    }
    return { initial, actions, tools: discover(initial), readSaved: () => saved }
  })
  return <McpConnectionForm actions={fixture.actions} onCancel={onCancel} onSaved={async () => {
    const server = fixture.readSaved()
    if (server) onSave(server)
  }} initialDraft={{ kind: scene === 'add-local' ? 'local' : 'remote', name: scene === 'add-invalid' ? '' : fixture.initial.name,
    url: fixture.initial.url, command: fixture.initial.command, args: fixture.initial.args.join('\n') }}
    preview={{ phase: scene === 'add-ready' ? 'ready' : scene === 'add-connecting' ? 'testing' : 'editing',
      tools: scene === 'add-ready' ? fixture.tools : [], error: scene === 'add-invalid' ? '请输入连接名称。' : undefined }} />
}
