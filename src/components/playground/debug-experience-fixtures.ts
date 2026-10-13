/**
 * 背景：Debug 重设计需要复核信息密度与证据缺失状态，不能读取用户会话来制作样张。
 * 设计意图：仅维护虚构的请求元数据和关联标识，不复制生产 Prompt 或权限定义。
 * 关键约束：所有数据仅供 P0；关联只能使用显式 id，历史正文缺失不得用当前模板代替。
 */
export type DebugScenario = 'normal' | 'running' | 'empty' | 'refresh-error'
export type DebugPerspective = 'assets' | 'schedule' | 'recent' | 'activity' | 'now' | 'location' | 'residence' | 'interests' | 'growth' | 'relations' | 'proactive' | 'wardrobe' | 'items' | 'links' | 'context' | 'profile' | 'memories' | 'runs' | 'traces' | 'events' | 'tools' | 'system' | 'quality' | 'persona'
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

export type DebugGroup = '内核' | '生活' | '社交' | '资产' | '用户' | '系统' | '质量'
export const DEBUG_GROUPS: readonly DebugGroup[] = ['内核', '生活', '社交', '资产', '用户', '系统', '质量']
export interface DebugView {
  id: DebugPerspective
  group: DebugGroup
  label: string
  description: string
  source: string
}
export const DEBUG_PERSPECTIVES: readonly DebugView[] = [
  { id: 'assets', group: '内核', label: '提示词管理器', description: '按人物与用途查找定义，查看正文、模板、变量和来源。', source: 'debug:model-context-assets' },
  { id: 'schedule', group: '内核', label: '今日日程', description: '查看当天计划；计划与事件发布状态分别追踪。', source: 'debug:world-snapshot · dayScript' },
  { id: 'recent', group: '内核', label: '最近事项', description: '浏览计划与已发布的生活事件，追踪关联动态和资产。', source: 'debug:world-snapshot · events / life/slices.ts' },
  { id: 'activity', group: '内核', label: '行为日志', description: '查看已记录的行为证据，区分生活计划与模型请求。', source: 'Trace / eventLog / growth/reflection-log.ts' },
  { id: 'now', group: '生活', label: '此刻', description: '当前活动、情绪与生活推进状态。', source: 'debug:world-snapshot · world / life' },
  { id: 'location', group: '生活', label: '位置', description: '分开查看当前位置、常去地点和动态中的地点。', source: 'world.currentLocation / footprint / moments' },
  { id: 'residence', group: '生活', label: '居住空间', description: '区分居所设定、当前居所和拥有的生活物件。', source: 'worldDefaults.home / world.home / home assets' },
  { id: 'interests', group: '生活', label: '兴趣资料', description: '人物稳定兴趣与文化记录；不推断动态兴趣进度。', source: 'Role Profile.interests / culture / bookshelf' },
  { id: 'growth', group: '生活', label: '成长与反思', description: '查看成长覆盖、版本及已记录的反思结果。', source: 'mutable-store / companion:reflection-status' },
  { id: 'relations', group: '社交', label: '人物关系', description: '查看人物关系资料与已有成长线索。', source: 'companion:get-contacts / roster / milestones' },
  { id: 'proactive', group: '社交', label: '主动消息证据', description: '只展示可证明的问候与消息证据。', source: 'life/proactive-greeting.ts / conversation messages' },
  { id: 'wardrobe', group: '资产', label: '衣柜', description: '拥有的衣物、当前穿着与来源，默认只读。', source: 'life/assets.ts · wardrobe / Moment.outfit' },
  { id: 'items', group: '资产', label: '文化与物品', description: '查看作品、书籍与生活物件的分类和来源。', source: 'companion_assets · culture / bookshelf / furniture' },
  { id: 'links', group: '资产', label: '生活事件关联', description: '按显式事件标识查看动态与长期资产之间的关联。', source: 'companion:get-life-slice / companion_event_links' },
  { id: 'context', group: '用户', label: '上下文', description: '区分当前装配预览、本次注入与历史保存范围。', source: 'ContextInspectorPanel / debug:system-prompt' },
  { id: 'profile', group: '用户', label: '用户画像', description: '查看用户身份、协作方式与表达偏好的提取结果。', source: 'buildUserProfile(role.id)' },
  { id: 'memories', group: '用户', label: '用户记忆', description: '区分全局与人物分桶、存储条目与实际召回。', source: 'memory:list / memory-store / injection evidence' },
  { id: 'runs', group: '系统', label: 'LLM 调用', description: '定位一次调用，查看输入结构、执行过程与资产来源。', source: 'debug:llm-logs-query' },
  { id: 'traces', group: '系统', label: '调用链', description: '以明确 Span 关联查看执行阶段和失败位置。', source: 'debug:traces' },
  { id: 'events', group: '系统', label: '实时事件', description: '展示本次运行期间收到的事件，不当作完整历史台账。', source: 'DevPanel.eventLog / AgentStreamEvent' },
  { id: 'tools', group: '系统', label: '技能与工具', description: '区分注册定义、当前可用与此次实际使用。', source: 'debug:tools / skills:list / systemInfo.mcp' },
  { id: 'system', group: '系统', label: '系统状态', description: '查看实际运行环境与连接，配置编辑仍归设置。', source: 'debug:system-info' },
  { id: 'quality', group: '质量', label: 'Skill 验收', description: '从验收结论进入输入、边界检查与失败证据。', source: 'Skill Eval report' },
  { id: 'persona', group: '质量', label: '人格验收', description: '区分自动一致性判定与人工语气体验审阅。', source: 'Persona Eval report / human review' },
]
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
