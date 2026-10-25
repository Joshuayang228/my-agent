import { ActionButton } from '../foundation/ActionButton'
import { DebugCapabilitiesContent } from '../debug/DebugCapabilitiesContent'
const TOOLS = [
  { id:'demo-tool-read', name:'读取工具', kind:'注册定义', status:'当前可用', detail:'read · 只读 · 非破坏性', usage:'demo-call-02' },
  { id:'demo-tool-skill', name:'旅行整理技能', kind:'Skill', status:'已加载', detail:'Skills loader · 此次激活未提供证据', usage:'' },
  { id:'demo-tool-mcp', name:'资料连接', kind:'MCP', status:'连接失败', detail:'工具数量未知 · Schema 尚未取得', usage:'' },
]
export type ToolsPreviewState = 'ready'|'unread'|'loading'|'unavailable'|'error'|'refresh-error'|'mcp-error'|'unknown'|'long'
export function DebugToolsCandidate({ previewState, snapshotState, onRetry }: { previewState: ToolsPreviewState; snapshotState: ToolsPreviewState; onRetry:()=>void }) {
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const tools = state === 'long' ? TOOLS.map(tool => tool.id === 'demo-tool-read' ? { ...tool, detail: tool.detail + ' · ' + '长注册说明样张 '.repeat(30) } : tool) : TOOLS
  return <section className="debug-tools-workbench" data-testid="debug-evidence-tools">{!available?<div className="debug-tools-state" role="status"><p>{previewState==='unavailable'?'需要桌面诊断连接才能读取能力。':previewState==='loading'?'正在读取技能与工具…':'技能与工具读取失败'}</p>{previewState!=='loading'&&<ActionButton onClick={onRetry}>读取能力样张</ActionButton>}</div>:<>{previewState==='refresh-error'&&<div className="debug-tools-state" role="alert"><p>刷新失败，保留原能力列表与选中详情。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}{state==='mcp-error'&&<p className="debug-tools-state" role="status">MCP 连接失败，工具数量未知，不显示为零。</p>}<DebugCapabilitiesContent records={tools.map(tool => ({ ...tool, kind: tool.kind as '注册定义' | 'Skill' | 'MCP', source: tool.kind }))} /></>}</section>
}
