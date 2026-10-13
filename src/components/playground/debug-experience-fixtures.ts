/**
 * 背景：Debug 重设计需要复核信息密度与证据缺失状态，不能读取用户会话来制作样张。
 * 设计意图：仅维护虚构的请求元数据和关联标识，不复制生产 Prompt 或权限定义。
 * 关键约束：所有数据仅供 P0；关联只能使用显式 id，历史正文缺失不得用当前模板代替。
 */
export type DebugScenario = 'normal' | 'running' | 'empty' | 'refresh-error'
export type DebugPerspective = 'runs' | 'assets' | 'companion' | 'quality' | 'system'
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

export interface DebugAssetFixture {
  key: string
  label: string
  type: string
  version: string
  fingerprint: string
  source: string
  ownership: string
  summary: string
}
export const DEBUG_ASSET_FIXTURES: readonly DebugAssetFixture[] = [
  { key: 'demo.prompt.main', label: '主对话语义编译', type: '提示词', version: '样张 v3', fingerprint: 'demo:71c83a', source: 'electron/main/prompts/compiler.ts', ownership: '平台', summary: '动态组装平台规则、人物、成长、行为、情境与输出契约。目录描述当前定义，具体调用的输入以请求证据为准。' },
  { key: 'demo.role.lin', label: '人物定义 · 林', type: '人物', version: '样张 v2', fingerprint: 'demo:a59e12', source: 'Role Pack loader', ownership: '角色包', summary: '人物身份与角色资产的来源示例。生活状态独立注入，不覆盖稳定身份。' },
  { key: 'demo.tool.read', label: '读取工具', type: '工具', version: '样张 v1', fingerprint: 'demo:8e6f02', source: 'ToolRegistry', ownership: '平台', summary: '工具身份及只读能力摘要。生产目录须读取 Registry，不能从展示文案生成权限规则。' },
  { key: 'demo.memory.extract', label: '记忆提取策略', type: '记忆', version: '样张 v1', fingerprint: 'demo:462ca9', source: 'memory production definitions', ownership: '平台', summary: '后台提取行为的资产关联示例，不包含用户记忆正文。' },
]
export const DEBUG_PERSPECTIVES: readonly { id: DebugPerspective; label: string; description: string; source: string }[] = [
  { id: 'runs', label: '运行记录', description: '定位一次调用，查看输入结构、执行过程与资产来源。', source: 'LLM 调用记录 · Trace · 实时事件' },
  { id: 'assets', label: '生产资产', description: '查看当前生产定义，以及哪些调用使用过它。', source: 'debug:model-context-assets' },
  { id: 'companion', label: '伙伴状态', description: '区分当前人物、生活快照与长期关系资料。', source: 'debug:world-snapshot' },
  { id: 'quality', label: '质量报告', description: '从结论进入检查证据，区分自动判定与人工审阅。', source: 'Skill / Persona Eval 报告' },
  { id: 'system', label: '系统状态', description: '查看实际运行环境与连接，配置编辑仍归设置。', source: 'debug:system-info' },
]
