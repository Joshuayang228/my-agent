/**
 * 背景：Debug 重设计需要复核信息密度与证据缺失状态，不能读取用户会话来制作样张。
 * 设计意图：仅维护虚构的请求元数据和关联标识，不复制生产 Prompt 或权限定义。
 * 关键约束：所有数据仅供 P0；关联只能使用显式 id，历史正文缺失不得用当前模板代替。
 */
export type DebugScenario = 'normal' | 'running' | 'empty' | 'unread' | 'truncated' | 'refresh-error'
export type { DebugPage as DebugPerspective } from '../../shared/debug-navigation'
export interface DebugRecordFixture {
  id: string
  title: string
  caller: string
  status: 'success' | 'error' | 'pending'
  time: string
  model: string
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  sessionId: string
  spanId?: string
  assetKeys: readonly string[]
  error?: string
  stages: readonly { title: string; duration: string; detail: string }[]
}

export const DEBUG_RECORD_FIXTURES: readonly DebugRecordFixture[] = [
  { id: 'demo-call-03', title: '整理旅行计划', caller: '主对话', status: 'error', time: '14:32:08', model: '示例对话模型', durationMs: 2410, inputTokens: 4286, sessionId: 'demo-session-01', spanId: 'demo-span-03', assetKeys: ['demo.prompt.main', 'demo.role.lin'], error: '模型服务暂时不可用，本次请求未获得回复。', stages: [
    { title: '请求编译', duration: '18 ms', detail: '已绑定资产来源；12 条消息、6 个语义模块、8 个可用工具。' },
    { title: '模型请求', duration: '2.39 s', detail: '服务返回失败；没有响应 Token 计量。' },
  ] },
  { id: 'demo-call-02', title: '读取旅行记录', caller: '主对话', status: 'success', time: '14:31:56', model: '示例对话模型', durationMs: 3680, inputTokens: 3612, outputTokens: 426, sessionId: 'demo-session-01', spanId: 'demo-span-02', assetKeys: ['demo.prompt.main', 'demo.role.lin', 'demo.tool.read'], stages: [
    { title: '模型请求', duration: '2.18 s', detail: '模型返回读取工具调用。' },
    { title: '权限检查', duration: '6 ms', detail: '命中只读规则；该工具不需要用户确认。' },
    { title: '读取工具', duration: '184 ms', detail: '工具完成。仅展示脱敏结果摘要，原始参数不在此样张中。' },
    { title: '回复生成', duration: '1.31 s', detail: '工具结果加入下一轮上下文，回复完成。' },
  ] },
  { id: 'demo-call-01', title: '提取旅行偏好', caller: '记忆提取', status: 'success', time: '14:30:12', model: '示例辅助模型', durationMs: 840, inputTokens: 720, outputTokens: 86, sessionId: 'demo-session-02', assetKeys: ['demo.memory.extract'], stages: [] },
]

export { DEBUG_GROUPS, DEBUG_PERSPECTIVES } from '../../shared/debug-navigation'
export type { DebugGroup, DebugView } from '../../shared/debug-navigation'
export const DEBUG_ROLES = [{ id: 'lin', label: '林 · 样张' }, { id: 'yu', label: '予 · 样张' }] as const

export const DEBUG_CAPABILITY_GAPS = [
  ['日记与情绪日记', '目前只有动态与补叙，未形成独立日记模型。'],
  ['动态兴趣', '稳定兴趣已有；兴趣轮换、进度与结束状态未形成完整链路。'],
  ['独立思绪池', '反思结果可追踪，不展示模型隐藏思维。'],
  ['信件与消息台账', '问候已有；独立信件与完整交付历史尚未形成。'],
  ['生活账簿', '物品来源已有，不具备钱包余额和交易台账。'],
  ['头像与封面历史', '媒体引用已有，未形成独立版本、激活和切换历史。'],
  ['用户待办', '定时任务和 Agent 任务不等于用户待办状态机。'],
  ['完整生活执行日志', '计划 / 发布不能证明完成、跳过或重排原因。'],
] as const
