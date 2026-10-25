import { ActionButton } from '../foundation/ActionButton'
import { DiagnosticSections } from '../debug/DebugSystemContent'

export type SystemPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'missing' | 'long' | 'truncated' | 'mcp-error'
interface SystemSnapshot { runtime: Array<[string, string]>; settings: Array<[string, string]>; mcp: Array<[string, string]>; rules: Array<[string, string]>; skills: Array<[string, string]> }
interface Props { previewState: SystemPreviewState; snapshotState: SystemPreviewState; onRetry: () => void }

const SNAPSHOT: SystemSnapshot = {
  runtime: [['应用版本', '开发版 · 样张'], ['Electron / Node.js', '42.1 / 22.x · 样张'], ['平台', 'Windows · x64'], ['进程运行', '已运行 18 分钟 · 样张'], ['内存', 'RSS 428 MB · 样张']],
  settings: [['当前模型', '示例对话模型'], ['服务地址', '已配置 · 不展示凭据'], ['API Key', '已配置 · 不展示值'], ['执行模式', 'auto'], ['有效沙箱', 'workspace-read · 样张'], ['会话预算', '120000 tokens · 样张'], ['自定义 Prompt', '未配置 · 样张']],
  mcp: [['连接状态', '1 项连接失败 · 样张'], ['工具数量', '未知 · 连接未取得 schema']],
  rules: [['权限规则', '12 条 / 10 条启用 · 样张'], ['显示范围', '最多展示 40 条，完整规则由设置管理']],
  skills: [['已加载 Skills', '8 项 · 样张'], ['显示范围', '最多展示 40 项，正文按来源读取']],
}

/** 背景：系统快照聚合多条只读诊断来源，首屏同时展示会把运行状态和细节混成一块。
 * 意图：用少量状态事实做摘要，各来源进入按需展开区。
 * 约束：不返回凭据、不执行测试、不连接 MCP、不在浏览系统页时修改配置。
 */
export function DebugSystemCandidate({ previewState, snapshotState, onRetry }: Props) {
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const data: SystemSnapshot = state === 'long' ? { ...SNAPSHOT, rules: [...SNAPSHOT.rules, ['长规则样张', '规则描述保留完整来源，详情按需展开。'.repeat(10)]] } : SNAPSHOT
  return <section className="debug-system-workbench" data-testid="debug-evidence-system">
    {!available ? <div className="debug-system-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '系统状态尚未读取' : previewState === 'loading' ? '正在读取系统状态…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取系统状态。' : '系统状态读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取系统状态样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-system-state" role="alert"><p>刷新失败，保留上次系统快照；下方不代表最新配置。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'truncated' && <p className="debug-system-state" role="status">权限规则与 Skills 仅返回有界范围，不能认定完整数量。</p>}
      {state === 'mcp-error' && <p className="debug-system-state" role="status">MCP 状态读取失败；工具数量未知，不显示为零。</p>}
      {state === 'missing' && <p className="debug-system-state" role="status">系统信息未返回，未用默认配置替代。</p>}
      <DiagnosticSections summary={[[ '运行环境', '可读取' ], ['模型配置', '已脱敏'], ['权限与沙箱', '只读快照'], ['MCP', state === 'mcp-error' ? '不可用' : '1 项失败']]} sections={([{ id: 'runtime', title: '运行环境' }, { id: 'settings', title: '模型与执行' }, { id: 'mcp', title: 'MCP 与工具' }, { id: 'rules', title: '权限规则' }, { id: 'skills', title: 'Skills' }] as const).map(section => ({ ...section, items: data[section.id] }))} />
      <details className="debug-system-boundary"><summary>系统诊断边界</summary><p>来源为 debug:system-info 的只读聚合。API Key、端点凭据和 MCP 环境变量不展示；规则与 Skills 有数量上限；浏览此页不发起模型调用、不运行工具、不修改设置。</p></details>
    </>}
  </section>
}
