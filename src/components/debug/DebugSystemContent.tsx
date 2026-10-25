import type { ReactNode } from 'react'

export type DebugSystemSnapshot = Awaited<ReturnType<Window['electronAPI']['debug']['systemInfo']>>
export interface DiagnosticSection { id: string; title: string; items: ReadonlyArray<readonly [string, ReactNode]> }

/** 背景：系统诊断多个来源同时铺开会淹没首屏。
 * 意图：候选与正式页共用摘要和按需展开的分区；来源数据由各自容器提供。
 * 约束：缺数据由调用方显示未知，组件不补默认配置，不执行诊断操作。
 */
export function DiagnosticSections({ summary, sections }: { summary: ReadonlyArray<readonly [string, ReactNode]>; sections: readonly DiagnosticSection[] }) {
  return <>
    <div className="debug-system-summary">{summary.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="debug-system-sections">{sections.map(section => <details key={section.id} className="debug-system-section"><summary>{section.title}<span>{section.items.length} 项</span></summary><dl>{section.items.map(([label, value], index) => <div key={`${label}:${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>)}</div>
  </>
}

export function DebugSystemContent({ info }: { info: DebugSystemSnapshot | null }) {
  if (!info) return <p className="debug-system-state" role="status">系统快照尚未读取；未使用默认配置替代。</p>
  const mcpFailures = info.mcp.filter(server => server.status === 'error').length
  const sections: DiagnosticSection[] = [
    { id: 'runtime', title: '运行环境', items: [['应用版本', info.appVersion], ['Electron / Node.js', `${info.electron} / ${info.node}`], ['Chrome', info.chrome], ['平台', `${info.platform} / ${info.arch}`], ['进程运行', `${info.uptime} 秒`], ['内存', `RSS ${(info.memoryUsage.rss / 1048576).toFixed(1)} MB · 已用堆 ${(info.memoryUsage.heapUsed / 1048576).toFixed(1)} MB / ${(info.memoryUsage.heapTotal / 1048576).toFixed(1)} MB`]] },
    { id: 'settings', title: '模型与执行', items: [['当前模型', info.settings.model || '未配置'], ['服务地址', info.settings.baseUrl || '未配置'], ['API Key', info.settings.hasApiKey ? '已配置 · 不展示值' : '未配置'], ['执行模式', info.settings.executionMode], ['有效沙箱', info.settings.sandboxMode], ['会话预算', info.settings.sessionTokenBudget], ['日预算', info.settings.dailyTokenBudget], ['当前主角', info.settings.activeRoleId || '未配置'], ['自定义 Prompt', info.settings.hasCustomPrompt ? '已配置' : '未配置']] },
    { id: 'mcp', title: 'MCP 与工具', items: [['已注册工具', info.toolCount], ['连接数量', info.mcp.length], ...info.mcp.map(server => [server.name, `${server.status} · ${server.status === 'connected' ? `${server.toolCount} 个工具` : '工具数量未知'}${server.error ? ` · ${server.error}` : ''}`] as const)] },
    { id: 'rules', title: '权限规则', items: info.permissionRules ? [['规则总数 / 启用', `${info.permissionRules.total} / ${info.permissionRules.enabled}`], ['显示范围', `${info.permissionRules.items.length} 条${info.permissionRules.truncated ? ' · 已截断' : ''}`], ...info.permissionRules.items.map(rule => [rule.id, `${rule.enabled ? '启用' : '停用'} · ${rule.action} · ${rule.type} · ${rule.pattern}${rule.description ? ` · ${rule.description}` : ''}`] as const)] : [['读取状态', '未读取，不补零']] },
    { id: 'skills', title: 'Skills', items: info.skills ? [['已加载定义', info.skills.total], ['显示范围', `${info.skills.items.length} 项${info.skills.truncated ? ' · 已截断' : ''}`], ...info.skills.items.map(skill => [skill.name, `${skill.source} · ${skill.description}`] as const)] : [['读取状态', '未读取，不补零']] },
  ]
  return <section className="debug-system-workbench" data-testid="debug-evidence-system">
    <DiagnosticSections summary={[[ '运行环境', info.appVersion ], ['模型配置', info.settings.model || '未配置'], ['权限与沙箱', info.settings.sandboxMode], ['MCP', mcpFailures ? `${mcpFailures} 项失败` : `${info.mcp.length} 项连接`]]} sections={sections} />
    <details className="debug-system-boundary"><summary>系统诊断边界</summary><p>来源为系统只读聚合；规则与 Skills 有返回上限，缺字段不补零。连接失败的 MCP 工具数量未知。浏览不发起模型请求、不运行工具、不修改设置。</p></details>
  </section>
}
