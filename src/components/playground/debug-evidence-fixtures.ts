import type { DebugPerspective, DebugRecordFixture } from './debug-experience-fixtures'

export type DebugEvidencePageId = Exclude<DebugPerspective, 'assets' | 'runs' | 'system' | 'quality' | 'persona'>
export interface DebugEvidenceItem {
  id: string
  title: string
  subtitle: string
  role: 'lin' | 'yu' | 'shared'
  date: string
  status: string
  fields: readonly [string, string][]
  body?: string
  assets?: readonly string[]
  callId?: string
  links?: readonly { page: DebugEvidencePageId; id: string; label: string }[]
}
export interface DebugEvidencePage {
  unit: string
  dateFilter?: boolean
  boundary: string
  items: readonly DebugEvidenceItem[]
}

const TODAY = '2026-10-13'

/**
 * 背景：生活、用户与系统证据不能只用同一段伙伴摘要替代，各页必须有自己的对象和缺失边界。
 * 设计意图：样张按真实领域字段组织，记录明确来源关联；正文均为虚构的演示内容。
 * 关键约束：日期固定为样张日期，不随电脑时钟变造历史；计划 / 发布不映射为完成或跳过。
 */
const item = (id: string, title: string, subtitle: string, status: string, fields: DebugEvidenceItem['fields'], extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem =>
  ({ id: `demo-${id}`, title, subtitle, role: 'lin', date: TODAY, status, fields, ...extra })

export const DEBUG_EVIDENCE_PAGES: Record<DebugEvidencePageId, DebugEvidencePage> = {
  schedule: {
    unit: '时段', dateFilter: true, boundary: '时段属于计划；事件已发布也不证明活动已完成。生产快照最多 12 个时段，完整跳过 / 重排原因尚未记录。',
    items: [
      item('slot-morning', '09:00 · 整理旅行照片', '林 · 今日计划', '计划时段', [['时间', '09:00'], ['地点', '样张书房'], ['活动类型', '休闲'], ['情绪', '平静'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai'], ['剧本来源', 'demo-script-lin-1013 · 辅助模型样张']]),
      item('slot-afternoon', '14:00 · 阅读旅行笔记', '林 · 今日计划', '计划时段', [['时间', '14:00'], ['地点', '样张书房'], ['活动类型', '阅读'], ['关联事件', 'demo-event-reading'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai']], { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看关联生活事件' }] }),
      item('slot-evening', '19:00 · 散步', '林 · 今日计划', '计划时段', [['时间', '19:00'], ['地点', '样张河边'], ['活动类型', '户外'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai']]),
      item('slot-yesterday', '10:00 · 整理书架', '林 · 昨日样张', '计划时段', [['时间', '10:00'], ['地点', '样张书房'], ['执行结果', '未记录']], { date: '2026-10-12' }),
      item('slot-yu', '11:00 · 阅读', '予 · 今日计划', '计划时段', [['时间', '11:00'], ['地点', '未设定'], ['执行结果', '未记录']], { role: 'yu' }),
    ],
  },
  recent: {
    unit: '事件', dateFilter: true, boundary: '生产快照最多 30 条计划 / 发布事件。以下只表示查询范围；发布日期与计划日期分开，不展示虚构完成时间。',
    items: [
      item('event-reading', '阅读旅行笔记', '14:00 · 样张书房', '已发布', [['计划时间', '2026-10-13 14:00'], ['状态', 'published · 已发布'], ['动态投影', 'demo-moment-reading'], ['活动执行', '没有完成证据']], { body: '【动态样张】翻到上次旅途的笔记，准备挑几张照片做成小册子。', links: [{ page: 'links', id: 'demo-link-reading', label: '查看动态与物品关联' }] }),
      item('event-walk', '河边散步', '19:00 · 样张河边', '计划中', [['计划时间', '2026-10-13 19:00'], ['状态', 'planned · 计划中'], ['动态投影', '尚未发布'], ['活动执行', '未记录']]),
      item('event-book', '整理旧书', '昨天 · 样张书房', '已发布', [['计划时间', '2026-10-12 10:00'], ['状态', 'published · 已发布'], ['活动执行', '没有完成证据']], { date: '2026-10-12' }),
    ],
  },
  activity: {
    unit: '行为证据', dateFilter: true, boundary: '当前有反思、Trace 与事件证据，尚无完整行动 / Planner 台账。生活执行、跳过和重排原因不能从请求耗时推断。',
    items: [
      item('action-reflection', '成长反思', '13:10 · 反思日志', '未改变人格', [['日志来源', 'reflection-log'], ['是否改变', '否'], ['结论', '目前偏好已覆盖，无新增修改'], ['模型输入正文', '未保存']], { links: [{ page: 'growth', id: 'demo-growth-run', label: '查看反思结果与门闸' }] }),
      item('action-tool', '读取旅行记录', '14:31 · 工具执行证据', '已记录', [['证据来源', 'demo-span-02'], ['权限结果', '读取规则通过'], ['工具执行', '返回读取摘要'], ['生活活动完成', '不能据此推断']], { callId: 'demo-call-02', assets: ['demo.tool.read'] }),
    ],
  },
  now: {
    unit: '当前快照', boundary: '此页是当前状态，非历史请求。快照的情绪与活动不能证明某次过去请求注入了什么。',
    items: [item('now-lin', '林 · 此刻', '14:32 · 当前生活快照', '当前快照', [['活动', '整理旅行照片'], ['当前位置', '样张书房'], ['情绪', '0.65 · 样张值'], ['能量', '0.72 · 样张值'], ['社交需求', '0.40 · 样张值'], ['生活暂停', '否'], ['最后推进', '14:30'], ['快照性质', '当前状态，非历史请求']], { body: '【离线补叙样张】午后留出一段时间整理照片。补叙是生活摘要，不是独立日记。', links: [{ page: 'location', id: 'demo-location-current', label: '查看当前位置来源' }, { page: 'schedule', id: 'demo-slot-afternoon', label: '查看今日计划' }] })],
  },
  location: {
    unit: '地点记录', boundary: '当前位置、常去地点与动态中出现的地点分开。没有完整出行轨迹、搬迁状态或访问日期时显示未记录。',
    items: [
      item('location-current', '当前位置 · 样张书房', '当前世界状态', '当前', [['来源', 'world.currentLocation'], ['细节', '书桌前'], ['当前活动', '整理旅行照片'], ['更新时间', '14:32'], ['移动原因', '未记录']], { assets: ['demo.world.lin'] }),
      item('location-favorite', '常去地点 · 样张河边', 'Role Pack 默认资料', '设定', [['来源', 'worldDefaults.favoritePlaces'], ['最近访问', '未记录'], ['交通时间', '15 分钟 · 设定值']], { assets: ['demo.world.lin'] }),
      item('location-event', '事件地点 · 样张书房', 'demo-event-reading', '事件记录', [['来源', '生活事件地点'], ['计划时间', '14:00'], ['实际到达', '未记录']], { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看原始生活事件' }] }),
    ],
  },
  residence: {
    unit: '居所记录', boundary: '角色包设定、运行态居所与生活资产分开；未设定不填默认公寓。浏览不播种家具或触发搬家。',
    items: [
      item('residence-home', '居所 · 样张书房', 'Role Pack 与当前状态', '已设定', [['默认居所', '样张住所'], ['运行态居所', '样张住所'], ['布局', '一间书房与生活区'], ['时区', 'Asia/Shanghai'], ['搬迁状态', '未实现']], { assets: ['demo.world.lin'], body: '【居所样张】书桌靠窗，照片册放在右侧书架。仅为布局验收的虚构设定。' }),
      item('residence-yu', '予 · 居所未设定', '没有 world.default', '未设定', [['默认居所', '未设定'], ['运行态居所', '未设定'], ['家具', '没有已提供记录']], { role: 'yu' }),
    ],
  },
  interests: {
    unit: '兴趣资料', boundary: '稳定兴趣是人物设定，作品与笔记是生活资产。动态兴趣轮换、完成与进度尚未形成，不以阅读状态替代兴趣进度。',
    items: [
      item('interest-photo', '摄影', '稳定兴趣 · Role Profile', '人物资料', [['来源', 'profile.interests'], ['动态进度', '未实现'], ['兴趣开始时间', '未记录']], { assets: ['demo.role.lin'] }),
      item('interest-reading', '旅行笔记', '书架阅读记录', '文化记录', [['来源', 'bookshelf 资产'], ['阅读状态', '阅读中 · 样张'], ['兴趣轮换状态', '未实现']], { links: [{ page: 'items', id: 'demo-item-book', label: '查看书籍与笔记' }] }),
    ],
  },
  growth: {
    unit: '成长证据', boundary: '成长覆盖与反思日志分开；日志不等于模型隐藏思维。这里只读，不触发反思或回滚人格。',
    items: [
      item('growth-cover', '成长覆盖 · v2', 'mutable override · 林', '当前版本', [['版本', '样张 v2'], ['来源', 'override'], ['更新时间', '2026-10-12 18:20'], ['与稳定身份关系', '独立注入，不替换身份']], { assets: ['demo.prompt.growth'], body: '【成长样张】交流时先给出简短结论，再提供可展开的依据。' }),
      item('growth-run', '13:10 · 最近反思', 'reflection-status / runs', '未改变', [['是否改变', '否'], ['摘要', '已有偏好覆盖本次反馈'], ['门闸状态', '冷却中 · 样张'], ['下一次可运行', '由真实门闸判断']], { body: '【日志样张】这是一条反思服务结果，不是隐藏思维记录。' }),
    ],
  },
  relations: {
    unit: '关系记录', boundary: '关系短句、忙闲与成长证据各有来源。关系未确认时保留未知，不移植 Alice 专属 OPC 或信任分模型。',
    items: [
      item('relation-yu', '林与予', '通讯录关系资料', '已提供资料', [['关系短句', '一起交流摄影的熟人 · 样张'], ['来源', 'roster / contacts'], ['忙闲', '忙碌 · 当前样张'], ['关系状态版本', '未记录']], { assets: ['demo.role.yu'] }),
      item('relation-user', '林与用户', '成长与里程碑', '已有线索', [['来源', 'relationship-stage / milestones'], ['里程碑', '首次共同整理资料 · 样张'], ['关系名称', '未确认'], ['信任分', '无此字段']], { links: [{ page: 'memories', id: 'demo-memory-lin', label: '查看人物分桶记忆' }] }),
    ],
  },
  proactive: {
    unit: '消息证据', boundary: '问候能力已有；完整发送队列、失败重试和交付历史尚未形成。普通会话消息不能证明主动消息已送达。',
    items: [item('message-greeting', '下午问候', '会话消息样张 · 林', '会话内已记录', [['来源', 'proactive-greeting / conversation message'], ['会话', 'demo-session-01'], ['消息', 'demo-message-greeting'], ['主动来源关联', '未保存'], ['交付状态', '没有独立台账']], { body: '【消息样张】刚整理好几张照片，想听听你更喜欢哪一种排法。' })],
  },
  wardrobe: {
    unit: '衣物', boundary: '这里查看拥有、穿着版本与来源，不换装、不生图。正式接线须用纯只读查询，不能调用带初始化副作用的 get-assets。',
    items: [
      item('wardrobe-shirt', '浅色衬衫', '衣柜 · 上装', '当前穿着', [['资产', 'demo-owned-shirt'], ['槽位', 'top'], ['穿搭版本', '样张 v4'], ['来源', '用户创建 · 样张'], ['关联动态', '没有显式关联']]),
      item('wardrobe-coat', '旅行外套', '衣柜 · 外套', '已拥有', [['资产', 'demo-owned-coat'], ['槽位', 'outer'], ['穿搭版本', '未穿着'], ['来源', 'demo-event-reading · 样张']], { links: [{ page: 'links', id: 'demo-link-reading', label: '查看获得来源' }] }),
    ],
  },
  items: {
    unit: '物品', boundary: '文化、书架与家具是运行时资产；Prompt 管理器中的资产定义是另一类对象。名称相同不能代替稳定 id 关联。',
    items: [
      item('item-book', '旅行笔记', '书架 · 阅读中', '已拥有', [['资产', 'demo-owned-book'], ['类型', 'bookshelf'], ['作者', '样张作者'], ['阅读状态', '阅读中'], ['来源', '用户创建 · 样张']], { body: '【阅读笔记样张】这一章记录了河边步行的观察；正文和资产描述分别保存。' }),
      item('item-camera', '小相机', '生活物品', '已拥有', [['资产', 'demo-owned-camera'], ['类型', 'culture'], ['来源', 'demo-event-reading'], ['记录时间', '2026-10-13 14:00'], ['实际购买日期', '未记录']], { links: [{ page: 'links', id: 'demo-link-reading', label: '查看关联生活事件' }] }),
    ],
  },
  links: {
    unit: '事件关联', boundary: '只使用显式 source_event_id 与 event_links，不按名称或时间拼接；发布时刻不代表物品购买或活动完成时刻。',
    items: [item('link-reading', '阅读事件 → 动态与物品', 'demo-event-reading', '显式关联', [['事件', 'demo-event-reading'], ['动态', 'demo-moment-reading'], ['物品', 'demo-owned-camera'], ['衣物', 'demo-owned-coat'], ['图片', '样张未提供'], ['关联来源', 'source_event_id / companion_event_links']], { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看生活事件' }, { page: 'items', id: 'demo-item-camera', label: '查看关联物品' }, { page: 'wardrobe', id: 'demo-wardrobe-coat', label: '查看关联衣物' }] })],
  },
  context: {
    unit: '上下文证据', boundary: '当前装配预览不能还原历史实发正文。六个语义模块来自我们的编译架构，生活、用户数据与稳定身份独立注入。',
    items: [item('context-preview', '当前装配范围', '林 · 当前预览样张', '预览', [['平台规则', '通用规则资产'], ['人物定义', '稳定身份与 profile'], ['成长', 'mutable 覆盖'], ['行为', '主对话任务'], ['情境', '生活状态与用户资料'], ['输出契约', '协议边界'], ['历史正文', '未保存']], { assets: ['demo.prompt.main', 'demo.prompt.identity', 'demo.prompt.growth'], callId: 'demo-call-03', body: '【装配预览样张】这里只解释模块排列及来源。没有把生产 Prompt 复制进候选，也不将此预览称为某次请求的正文。' })],
  },
  profile: {
    unit: '用户画像', boundary: '这是按人物生成的用户画像，不是伙伴人物档案。提取摘要与用户明确提供事实分别标源；无材料不补故事。',
    items: [
      item('profile-lin', '用户画像 · 林视角', 'identity / workflow / voice', '已有摘要', [['身份摘要', '喜欢整理旅行资料 · 样张'], ['协作方式', '先看结论，再看依据 · 样张'], ['表达偏好', '简洁自然 · 样张'], ['提取来源', 'buildUserProfile(lin)'], ['证据条目', 'demo-memory-lin']], { links: [{ page: 'memories', id: 'demo-memory-lin', label: '查看偏好记忆' }] }),
      item('profile-yu', '用户画像 · 予视角', '尚无材料', '未形成', [['身份摘要', '未记录'], ['协作方式', '未记录'], ['表达偏好', '未记录']], { role: 'yu' }),
    ],
  },
  memories: {
    unit: '记忆', boundary: '按人物筛选包含显式共享条目。生产世界快照目前读取全局记忆，正式人物专属页须补明确分桶契约；存储不证明此次已注入。',
    items: [
      item('memory-lin', '先说结论，再展开依据', '偏好 · 林分桶', '已存储', [['记忆', 'demo-memory-lin'], ['人物归属', 'lin'], ['类别', 'preference'], ['更新时间', '2026-10-13 14:30'], ['此次注入证据', '未提供']], { body: '【记忆样张】用户明确表示希望先听短结论，再查看依据。', assets: ['demo.memory.extract'] }),
      item('memory-shared', '使用简体中文', '共享偏好', '已存储', [['记忆', 'demo-memory-shared'], ['范围', '显式共享'], ['类别', 'preference'], ['此次注入证据', '未提供']], { role: 'shared', body: '【共享记忆样张】用户希望日常交流使用简体中文。' }),
      item('memory-yu', '阅读前先看目录', '偏好 · 予分桶', '已存储', [['记忆', 'demo-memory-yu'], ['人物归属', 'yu'], ['类别', 'preference']], { role: 'yu', body: '【记忆样张】用户与予交流时希望先浏览资料目录。' }),
    ],
  },
  traces: { unit: 'Span', boundary: '仅展示请求保存的显式 Span。没有 Span 的记录不按时间关联，执行阶段不等于模型隐藏思维。', items: [] },
  events: {
    unit: '运行事件', dateFilter: true, boundary: '事件来自当前运行窗口，不是永久行动账本；事件缺少会话或 Span 时保留未关联。',
    items: [
      item('runtime-asset', '14:31:56 · 资产证据已绑定', 'demo-span-02', '已收到', [['类型', 'asset-usage'], ['会话', 'demo-session-01'], ['Span', 'demo-span-02'], ['关联依据', '事件显式标识']], { callId: 'demo-call-02', assets: ['demo.tool.read'] }),
      item('runtime-error', '14:32:08 · 模型服务失败', 'demo-span-03', '失败', [['类型', 'llm-error'], ['会话', 'demo-session-01'], ['Span', 'demo-span-03'], ['安全说明', '不展示内部错误堆栈']], { callId: 'demo-call-03' }),
      item('runtime-unlinked', '14:30:00 · 窗口恢复', '没有关联标识', '已收到', [['类型', 'window-resumed'], ['会话', '未关联'], ['Span', '未关联'], ['关联调用', '不能按时间猜测']]),
    ],
  },
  tools: {
    unit: '能力', boundary: '注册定义、当前可用与实际调用是三种事实。MCP 连接失败时工具数量未知；浏览不运行工具、激活 Skill 或修改许可。',
    items: [
      item('tool-read', '读取工具', '内置工具 · Registry', '当前可用', [['注册身份', 'read'], ['当前状态', '可用 · 样张'], ['只读', '是'], ['破坏性', '否'], ['实际使用证据', 'demo-call-02']], { assets: ['demo.tool.read'], callId: 'demo-call-02' }),
      item('tool-skill', '旅行整理技能', '用户 Skill', '已加载', [['定义来源', 'Skills loader'], ['当前加载', '已加载 · 样张'], ['此次激活', '未提供证据']], { assets: ['demo.skill.travel'], role: 'shared' }),
      item('tool-mcp', '资料连接', 'MCP · 外部能力', '连接失败', [['连接状态', '失败 · 样张'], ['工具数量', '未知'], ['Schema', '尚未取得'], ['配置入口', '设置管理']], { role: 'shared' }),
    ],
  },
}

/**
 * 背景：调用链要与正在浏览的请求快照一致，运行中 / 空态不能保留已完成阶段。
 * 设计意图：只从带显式 Span 的样张请求派生阶段，避免维护两份互相漂移的调用链。
 * 关键约束：无 Span 的请求不生成节点；记录失败不自动推断每个子阶段都失败。
 */
export function getDebugEvidencePage(id: DebugEvidencePageId, records: readonly DebugRecordFixture[]): DebugEvidencePage {
  if (id === 'events') return { ...DEBUG_EVIDENCE_PAGES.events, items: DEBUG_EVIDENCE_PAGES.events.items.map(entry => {
    const call = records.find(record => record.id === entry.callId)
    return call?.status === 'pending' ? { ...entry, title: `${call.time} · 请求进行中`, status: '运行中', fields: entry.fields.map(([label, value]) => [label, label === '类型' ? 'llm-pending' : value] as [string, string]) } : entry
  }) }
  if (id !== 'traces') return DEBUG_EVIDENCE_PAGES[id]
  return { ...DEBUG_EVIDENCE_PAGES.traces, items: records.filter(record => record.spanId).map(record => ({
    id: record.spanId!, title: record.title, subtitle: `${record.time} · ${record.spanId}`, role: 'lin', date: TODAY,
    status: record.status === 'pending' ? '运行中' : record.status === 'error' ? '失败' : '已结束',
    fields: [['Span', record.spanId!], ['会话', record.sessionId], ['明确关联请求', record.id], ['阶段数量', String(record.stages.length)]],
    body: record.stages.map((stage, index) => `${index + 1}. ${stage.title} · ${stage.duration}\n${stage.detail}`).join('\n\n'),
    assets: record.assetKeys, callId: record.id,
  })) }
}
