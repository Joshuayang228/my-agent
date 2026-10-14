export type DebugPage = 'assets' | 'schedule' | 'recent' | 'activity' | 'now' | 'location' | 'residence' | 'character' | 'footprints' | 'moments' | 'growth' | 'relations' | 'proactive' | 'wardrobe' | 'items' | 'links' | 'context' | 'profile' | 'memories' | 'runs' | 'traces' | 'events' | 'tools' | 'system' | 'quality' | 'persona'
export type DebugGroup = '内核' | '生活' | '社交' | '资产' | '用户' | '系统' | '质量'
export const DEBUG_GROUPS: readonly DebugGroup[] = ['内核', '生活', '社交', '资产', '用户', '系统', '质量']
export interface DebugView {
  id: DebugPage
  group: DebugGroup
  label: string
  description: string
  source: string
}
export const DEBUG_PERSPECTIVES: readonly DebugView[] = [
  { id: 'assets', group: '内核', label: '提示词管理器', description: '按人物与用途查找定义，查看正文、模板、变量和来源。', source: 'debug:model-context-assets' },
  { id: 'schedule', group: '内核', label: '今日日程', description: '查看当天计划；计划与事件发布状态分别追踪。', source: 'debug:companion-evidence-query · companion_day_scripts' },
  { id: 'recent', group: '内核', label: '最近事项', description: '浏览计划与已发布的生活事件，追踪关联动态和资产。', source: 'debug:companion-evidence-query · companion_events' },
  { id: 'activity', group: '内核', label: '行为日志', description: '查看已记录的行为证据，区分生活计划与模型请求。', source: 'debug:companion-evidence-query · 生活事件；运行行为见调用链' },
  { id: 'now', group: '生活', label: '此刻', description: '当前活动、情绪与生活推进状态。', source: 'debug:companion-evidence-query · companion_role_state / world-codec' },
  { id: 'character', group: '生活', label: '人物档案', description: '查看伙伴的稳定身份、人物资料与兴趣，和用户画像分开。', source: 'debug:companion-evidence-query · Role Pack profile' },
  { id: 'location', group: '生活', label: '当前位置', description: '查看当前地点和细节；出行历史在足迹，住所与物件在家居。', source: 'debug:companion-evidence-query · world.currentLocation / locationDetail' },
  { id: 'residence', group: '生活', label: '家居', description: '查看住所、空间归属、生活物件及展示依据。', source: 'debug:companion-evidence-query · companion_assets home / furniture' },
  { id: 'footprints', group: '生活', label: '足迹', description: '查看旅行状态、日期、经历与停留，区分旧地点资料和实际出发记录。', source: 'debug:companion-evidence-query · companion_assets footprint' },
  { id: 'growth', group: '生活', label: '成长与反思', description: '查看成长覆盖、版本及已记录的反思结果。', source: 'debug:companion-evidence-query · mutable / versions / reflection' },
  { id: 'moments', group: '社交', label: '朋友圈', description: '查看已发布动态、评论和生活事件来源，区别于计划。', source: 'debug:companion-evidence-query · moments / user interactions' },
  { id: 'relations', group: '社交', label: '通讯录', description: '查看人物关系、忙闲与已有经历，保留用户关系证据。', source: 'debug:companion-evidence-query · relations / published coframe events' },
  { id: 'proactive', group: '社交', label: '主动消息证据', description: '只展示可证明的问候与消息证据。', source: '独立主动消息投递索引尚未实现' },
  { id: 'wardrobe', group: '资产', label: '衣柜', description: '拥有的衣物、当前穿着与来源，默认只读。', source: 'debug:companion-evidence-query · companion_assets wardrobe' },
  { id: 'items', group: '资产', label: '文化角', description: '查看阅读、音乐、影视、摄影与所属笔记；生活物件归家居。', source: 'debug:companion-evidence-query · culture / bookshelf / readingNotes' },
  { id: 'links', group: '资产', label: '生活事件关联', description: '按显式事件标识查看动态与长期资产之间的关联。', source: 'debug:companion-evidence-query · companion_event_links' },
  { id: 'context', group: '用户', label: '上下文', description: '区分当前装配预览、本次注入与历史保存范围。', source: 'debug:llm-log-get · 已保存实发输入范围' },
  { id: 'profile', group: '用户', label: '用户画像', description: '查看已存记忆汇总的身份、协作方式与表达偏好，明确实际聚合范围。', source: 'debug:companion-evidence-query · 有界画像来源 / 既有聚合范围' },
  { id: 'memories', group: '用户', label: '用户记忆', description: '区分全局与人物分桶、存储条目与实际召回。', source: 'debug:companion-evidence-query · 人物与共享 memories' },
  { id: 'runs', group: '系统', label: 'LLM 调用', description: '定位一次调用，查看输入结构、执行过程与资产来源。', source: 'debug:llm-logs-query' },
  { id: 'traces', group: '系统', label: '调用链', description: '以明确 Span 关联查看执行阶段和失败位置。', source: 'debug:traces' },
  { id: 'events', group: '系统', label: '实时事件', description: '展示本次运行期间收到的事件，不当作完整历史台账。', source: 'DevPanel.eventLog / AgentStreamEvent' },
  { id: 'tools', group: '系统', label: '技能与工具', description: '区分注册定义、当前可用与此次实际使用。', source: 'debug:tools / skills:list / systemInfo.mcp' },
  { id: 'system', group: '系统', label: '系统状态', description: '查看实际运行环境与连接，配置编辑仍归设置。', source: 'debug:system-info' },
  { id: 'quality', group: '质量', label: 'Skill 验收', description: '从验收结论进入输入、边界检查与失败证据。', source: 'Skill Eval report' },
  { id: 'persona', group: '质量', label: '人格验收', description: '区分自动一致性判定与人工语气体验审阅。', source: 'Persona Eval report / human review' },
]
