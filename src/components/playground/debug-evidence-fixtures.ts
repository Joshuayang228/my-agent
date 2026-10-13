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
    unit: '当前位置', boundary: '此页只展示世界运行态位置。当前位置不证明旅行或访问历史；常去 / 想去资料和旅行记录在足迹，住所与物件在家居。',
    items: [
      item('location-current', '当前位置 · 样张书房', '当前世界状态', '当前', [['来源', 'world.currentLocation'], ['细节', '书桌前'], ['当前活动', '整理旅行照片'], ['更新时间', '14:32'], ['移动原因', '未记录']], { assets: ['demo.world.lin'] }),
    ],
  },
  residence: {
    unit: '家居记录', boundary: '住所、空间与物件分别追踪，按人物归属和 spaceId 关联；展示决定须有显式理由与依据。未设定不填默认公寓，浏览不播种资产。',
    items: [
      item('residence-home', '住所 · 样张住所', 'home · residence', '已设定', [['资产', 'demo-home-lin'], ['记录类型', 'residence'], ['默认居所', '样张住所'], ['运行态居所', '样张住所'], ['搬迁状态', '未实现']], { assets: ['demo.world.lin'], body: '【住所样张】一间书房与生活区。仅为验收的虚构设定。' }),
      item('residence-space', '空间 · 样张书房', 'home · space', '已有记录', [['资产', 'demo-space-study'], ['记录类型', 'space'], ['所属住所', 'demo-home-lin'], ['描述', '靠窗的书桌与书架 · 样张']], { links: [{ page: 'residence', id: 'demo-residence-home', label: '查看所属住所' }] }),
      item('item-camera', '小相机', '生活物件 · 家居', '明确展示', [['资产', 'demo-owned-camera'], ['类型', 'furniture'], ['空间', 'demo-space-study'], ['家居展示', 'displayInHome = true'], ['展示理由', '日常整理旅行照片使用 · 样张'], ['展示依据', 'demo-event-reading'], ['来源说明', '阅读事件关联物件 · 样张'], ['实际购买日期', '未记录']], { links: [{ page: 'residence', id: 'demo-residence-space', label: '查看所属空间' }, { page: 'links', id: 'demo-link-reading', label: '查看关联生活事件' }] }),
      item('home-unplaced', '备用收纳盒', '生活物件 · 未归置', '未展示', [['资产', 'demo-owned-box'], ['类型', 'furniture'], ['空间', '未归置'], ['家居展示', 'displayInHome = false'], ['展示理由', '尚无陈列依据 · 样张'], ['展示依据', '未提供']]),
      item('residence-yu', '予 · 居所未设定', '没有 world.default', '未设定', [['默认居所', '未设定'], ['运行态居所', '未设定'], ['家具', '没有已提供记录']], { role: 'yu' }),
    ],
  },
  character: {
    unit: '人物资料', boundary: '这是伙伴人物档案，区别于用户画像。稳定身份、结构化 profile 和成长覆盖分开；兴趣不等于动态进度，人物资料不是实时生活状态。',
    items: [
      item('character-lin', '林 · 人物档案', 'Role Pack · 稳定资料', '人物资料', [['来源', 'manifest / profile / characterProfile'], ['身份', '喜欢记录生活的数字伙伴 · 样张'], ['稳定兴趣', '摄影、阅读 · 样张'], ['人物资料版本', '样张 v2'], ['动态兴趣进度', '未实现']], { assets: ['demo.role.lin', 'demo.prompt.identity'], links: [{ page: 'growth', id: 'demo-growth-cover', label: '查看独立成长覆盖' }, { page: 'items', id: 'demo-item-book', label: '查看实际阅读记录' }] }),
      item('character-yu', '予 · 人物档案', 'Role Pack · 资料不完整', '资料缺失', [['来源', 'manifest'], ['人物详细档案', '未提供'], ['稳定兴趣', '未提供']], { role: 'yu', assets: ['demo.role.yu'] }),
    ],
  },
  growth: {
    unit: '成长证据', boundary: '成长覆盖与反思日志分开；日志不等于模型隐藏思维。这里只读，不触发反思或回滚人格。',
    items: [
      item('growth-cover', '成长覆盖 · v2', 'mutable override · 林', '当前版本', [['版本', '样张 v2'], ['来源', 'override'], ['更新时间', '2026-10-12 18:20'], ['与稳定身份关系', '独立注入，不替换身份']], { assets: ['demo.prompt.growth'], body: '【成长样张】交流时先给出简短结论，再提供可展开的依据。' }),
      item('growth-run', '13:10 · 最近反思', 'reflection-status / runs', '未改变', [['是否改变', '否'], ['摘要', '已有偏好覆盖本次反馈'], ['门闸状态', '冷却中 · 样张'], ['下一次可运行', '由真实门闸判断']], { body: '【日志样张】这是一条反思服务结果，不是隐藏思维记录。' }),
    ],
  },
  footprints: {
    unit: '足迹记录', boundary: '实际旅行展示仅含 active / completed；Debug 同时解释计划、取消与旧地点记录。计划不等于出发，播种 / 创建时间不作为访问日期，旧地点不自动转换为旅行。',
    items: [
      item('trip-completed', '河边旅行', 'footprint · trip', '已结束旅行', [['资产', 'demo-trip-river'], ['记录类型', 'trip'], ['目的地', '样张河畔小镇'], ['旅行状态', 'completed'], ['开始日期', '2026-10-10'], ['结束日期', '2026-10-11'], ['正式足迹展示', '纳入实际旅行'], ['停留记录', 'demo-stop-river · 河边步道 · 2026-10-10']], { body: '【旅行经历样张】沿河边走了一段，记录了步道的光线。\n【停留经历样张】在河边步道整理照片。' }),
      item('trip-active', '山间旅行', 'footprint · trip', '旅行中', [['资产', 'demo-trip-mountain'], ['记录类型', 'trip'], ['目的地', '样张山间'], ['旅行状态', 'active'], ['开始日期', '2026-10-13'], ['结束日期', '未提供'], ['正式足迹展示', '纳入实际旅行'], ['停留记录', '未提供']]),
      item('trip-planned', '海边旅行计划', 'footprint · trip', '未出发', [['资产', 'demo-trip-coast'], ['记录类型', 'trip'], ['旅行状态', 'planned'], ['开始日期', '未提供'], ['正式足迹展示', '不纳入实际旅行']]),
      item('trip-cancelled', '取消的出行', 'footprint · trip', '已取消', [['资产', 'demo-trip-cancelled'], ['记录类型', 'trip'], ['旅行状态', 'cancelled'], ['正式足迹展示', '不纳入实际旅行']]),
      item('footprint-place', '旧地点 · 样张河边', 'footprint · place', '常去资料', [['资产', 'demo-place-river'], ['记录类型', 'place'], ['地点状态', 'favorite'], ['访问日期', '未记录'], ['正式旅行展示', '不自动转换为旅行']], { assets: ['demo.world.lin'] }),
    ],
  },
  moments: {
    unit: '动态', dateFilter: true, boundary: '此页是已发布动态与评论；最近事项含计划 / 发布事件。动态发布不证明活动完成，评论不代替关系状态；不提供点赞、发帖或评论写入。',
    items: [item('moment-reading', '林 · 阅读旅行笔记', '14:00 · 已发布动态', '已发布', [['动态', 'demo-moment-reading'], ['发布时间', '2026-10-13 14:00'], ['地点', '样张书房'], ['来源事件', 'demo-event-reading'], ['评论', 'demo-comment-yu · 予 · 想看看这本小册子 · 样张'], ['图片', '未提供']], { body: '【动态样张】翻到上次旅途的笔记，准备挑几张照片做成小册子。', links: [{ page: 'recent', id: 'demo-event-reading', label: '查看发布来源事件' }, { page: 'links', id: 'demo-link-reading', label: '查看动态与物品关联' }] })],
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
    unit: '文化记录', boundary: '阅读、音乐、影视、摄影是文化资产，笔记保留所属作品和独立正文；实物属于家居。阅读 / 观看 / 聆听状态不等于动态兴趣进度。',
    items: [
      item('item-book', '旅行笔记', '书架 · 阅读中', '已拥有', [['资产', 'demo-owned-book'], ['类型', 'bookshelf'], ['作者', '样张作者'], ['阅读状态', '阅读中'], ['来源', '用户创建 · 样张']], { body: '【阅读笔记样张】这一章记录了河边步行的观察；正文和资产描述分别保存。' }),
      item('culture-music', '午后旋律', 'culture · music', '聆听中', [['资产', 'demo-culture-music'], ['类型', 'music'], ['状态', 'listening'], ['作者', '样张音乐人']], { body: '【听感样张】适合整理照片时听的一段旋律。' }),
      item('culture-film', '旅途影像', 'culture · film', '观看中', [['资产', 'demo-culture-film'], ['类型', 'film'], ['状态', 'watching'], ['导演', '样张导演']], { body: '【影视感想样张】镜头让人留意路边的细节。' }),
      item('culture-photo', '河边光线', 'culture · photography', '已发布作品', [['资产', 'demo-culture-photo'], ['类型', 'photography'], ['作品状态', 'published'], ['拍摄地点', '样张河边']], { body: '【摄影作品样张】午后的光线落在步道上。' }),
    ],
  },
  links: {
    unit: '事件关联', boundary: '只使用显式 source_event_id 与 event_links，不按名称或时间拼接；发布时刻不代表物品购买或活动完成时刻。',
    items: [item('link-reading', '阅读事件 → 动态与物品', 'demo-event-reading', '显式关联', [['事件', 'demo-event-reading'], ['动态', 'demo-moment-reading'], ['物品', 'demo-owned-camera'], ['衣物', 'demo-owned-coat'], ['图片', '样张未提供'], ['关联来源', 'source_event_id / companion_event_links']], { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看生活事件' }, { page: 'moments', id: 'demo-moment-reading', label: '查看已发布动态' }, { page: 'residence', id: 'demo-item-camera', label: '查看关联物品' }, { page: 'wardrobe', id: 'demo-wardrobe-coat', label: '查看关联衣物' }] })],
  },
  context: {
    unit: '上下文证据', boundary: '当前装配预览不能还原历史实发正文。六个语义模块来自我们的编译架构，生活、用户数据与稳定身份独立注入。',
    items: [item('context-preview', '当前装配范围', '林 · 当前预览样张', '预览', [['平台规则', '通用规则资产'], ['人物定义', '稳定身份与 profile'], ['成长', 'mutable 覆盖'], ['行为', '主对话任务'], ['情境', '生活状态与用户资料'], ['输出契约', '协议边界'], ['历史正文', '未保存']], { assets: ['demo.prompt.main', 'demo.prompt.identity', 'demo.prompt.growth'], callId: 'demo-call-03', body: '【装配预览样张】这里只解释模块排列及来源。没有把生产 Prompt 复制进候选，也不将此预览称为某次请求的正文。' })],
  },
  profile: {
    unit: '记忆摘要', boundary: '用户画像是已有记忆的聚合摘要，不是伙伴人物档案。当前仅 feedback 按人物过滤，其他类别仍全局聚合；跳过凭据。主对话使用此摘要，工作区会话不注入，无材料返回空。',
    items: [
      item('profile-lin', '用户画像 · 林调用范围', 'identity / workflow / voice', '记忆聚合', [['身份摘要', '喜欢整理旅行资料 · 样张'], ['身份来源类别', 'identity + fact · 全局'], ['协作方式', '先看结论，再看依据 · 样张'], ['协作来源类别', 'workflow · 全局 / feedback · 林'], ['表达偏好', '使用简体中文 · 样张'], ['表达来源类别', 'voice + preference · 全局'], ['聚合来源', 'buildUserProfile(lin)'], ['历史注入证明', '当前聚合不能证明历史实发']], { links: [{ page: 'memories', id: 'demo-memory-lin', label: '查看协作反馈记忆' }, { page: 'memories', id: 'demo-memory-shared', label: '查看共享偏好记忆' }] }),
      item('profile-yu', '用户画像 · 予调用范围', '全局资料 + 予反馈', '记忆聚合', [['身份摘要', '喜欢整理旅行资料 · 全局样张'], ['协作反馈', '未提供予专属 feedback'], ['表达偏好', '使用简体中文 · 全局样张'], ['范围说明', '不能称为完全独立的予专属画像']], { role: 'yu' }),
    ],
  },
  memories: {
    unit: '记忆', boundary: '按人物筛选包含显式共享条目。生产世界快照目前读取全局记忆，正式人物专属页须补明确分桶契约；存储不证明此次已注入。',
    items: [
      item('memory-lin', '先说结论，再展开依据', '协作反馈 · 林分桶', '已存储', [['记忆', 'demo-memory-lin'], ['人物归属', 'lin'], ['类别', 'feedback'], ['更新时间', '2026-10-13 14:30'], ['此次注入证据', '未提供']], { body: '【记忆样张】用户明确表示希望先听短结论，再查看依据。', assets: ['demo.memory.extract'] }),
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
