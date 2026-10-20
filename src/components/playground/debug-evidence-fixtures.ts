import { tripStopSchema, wardrobeCategorySchema, normalizeWorldRecordField, type TripStopRecord } from '../../shared/world-records'
import type { DebugPerspective, DebugRecordFixture } from './debug-experience-fixtures'

export type DebugEvidencePageId = Exclude<DebugPerspective, 'assets' | 'runs' | 'system' | 'quality' | 'persona'>
export interface DebugNowState {
  activity: string
  location: string
  mood: number
  energy: number
  socialNeed: number
  pausedAt: number | null
  lastTickAt: number
  updatedAt: number
  timezone: string
  catchupSummary: string
  storedWorldIssue?: string
}
export interface DebugCharacterDefinition {
  summary: string
  profile: { occupation?: string; agePresentation?: string; interests?: readonly string[]; [key: string]: unknown } | null
  worldDefaults: Record<string, unknown> | null
}
export interface DebugLocationState {
  currentLocation: string
  locationDetail: string
  currentActivity: string
  updatedAt: number
  timezone: string
  storedWorld?: Record<string, unknown> | string
  issue?: string
}
export interface DebugGrowthRecord {
  kind: 'current' | 'default' | 'history' | 'reflection'
  source: string
  recordId: string
  version?: number
  at?: number
  body?: string
  summary?: string
  lastRunAt?: number
  runs?: readonly { at: number; changed: boolean; summary: string }[]
}
export interface DebugMomentRecord {
  publishedAt?: number
  text: string
  meta: Record<string, unknown>
  userInteractions?: readonly { actor_id: string; kind: string; text: string | null; created_at: number }[]
  truncated?: boolean
}
export interface DebugRelationRecord {
  truncated?: boolean
  personId: string
  name: string
  edges: readonly { from: string; to: string; type: string; note?: string }[]
  experiences?: readonly { id: string; time?: number; payload: Record<string, unknown> }[]
}
export interface DebugWardrobeRecord {
  payload: Record<string, unknown>
  acquiredAt?: number
  sourceEventId?: string
  truncated?: boolean
}
export interface DebugCultureRecord {
  kind: 'culture' | 'bookshelf'
  payload: Record<string, unknown>
  acquiredAt?: number
  sourceEventId?: string
  truncated?: boolean
}
export interface DebugLinkRecord {
  eventId: string
  targetType: string
  targetId: string
  relation: string
  createdAt?: number
  metadata: unknown
  truncated?: boolean
}
export interface DebugEvidenceItem {
  id: string
  title: string
  subtitle: string
  role: 'lin' | 'yu' | 'shared'
  date: string
  status: string
  fields: readonly [string, string][]
  readingFields?: readonly [string, string][]
  schedule?: { time: string; activity: string; location: string }
  event?: { scheduledAt: number | null; location?: string }
  now?: DebugNowState
  character?: DebugCharacterDefinition
  location?: DebugLocationState
  growth?: DebugGrowthRecord
  moment?: DebugMomentRecord
  relation?: DebugRelationRecord
  wardrobe?: DebugWardrobeRecord
  culture?: DebugCultureRecord
  link?: DebugLinkRecord
  body?: string
  assets?: readonly string[]
  callId?: string
  links?: readonly { page: DebugEvidencePageId; id: string; label: string }[]
  relatedPages?: readonly { page: DebugEvidencePageId; label: string }[]
  home?: { kind: 'residence' | 'space' | 'object' | 'unset'; parentId?: string; description?: string; displayInHome?: boolean; displayReason?: string; displayEvidence?: readonly string[]; originNote?: string }
  travel?: { kind: 'actual' | 'planned' | 'cancelled' | 'place' | 'unknown'; recordType: 'trip' | 'place'; status?: string; destination?: string; start?: string; end?: string; story?: string; stops?: readonly TripStopRecord[] }
  category?: 'reading' | 'music' | 'film' | 'photography'
  stages?: DebugRecordFixture['stages']
  summaries?: readonly { title: string; text: string; scope: string }[]
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
// 背景：样张需把业务摘要与完整诊断字段分开；意图：字段值只维护一份，显式声明阅读索引。
// 约束：这些索引属于固定隔离样张，不用于推断生产响应，也不按中文标签判断业务含义。
const CULTURE_CATEGORIES: Record<string, NonNullable<DebugEvidenceItem['category']>> = { 'item-book': 'reading', 'culture-music': 'music', 'culture-film': 'film', 'culture-photo': 'photography' }
const READING_FIELDS: Record<string, readonly number[]> = {
  'slot-morning': [1], 'slot-afternoon': [1], 'slot-evening': [1], 'slot-yesterday': [1], 'slot-yu': [1],
  'residence-home': [], 'residence-space': [], 'item-camera': [], 'home-unplaced': [],
  'trip-completed': [], 'trip-active': [], 'trip-planned': [], 'trip-cancelled': [], 'footprint-place': [],
  'character-lin': [0, 1, 2], 'character-yu': [], 'event-reading': [0], 'event-walk': [0], 'event-book': [0],
  'now-lin': [0, 1], 'location-current': [0, 1, 2],
  'item-book': [2, 3], 'culture-music': [2, 3], 'culture-film': [2, 3], 'culture-photo': [2, 3],
  'wardrobe-shirt': [], 'wardrobe-coat': [], 'moment-reading': [],
  'growth-cover': [], 'growth-run': [],
  'relation-yu': [], 'relation-user': [],
  'link-reading': [], 'profile-lin': [], 'profile-yu': [],
  'memory-lin': [], 'memory-shared': [], 'memory-yu': [],
  'runtime-asset': [0], 'runtime-error': [0], 'runtime-unlinked': [1, 2],
  'tool-read': [1], 'tool-skill': [1, 2], 'tool-mcp': [1],
}

const item = (id: string, title: string, subtitle: string, status: string, fields: DebugEvidenceItem['fields'], extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem =>
  ({ id: `demo-${id}`, title, subtitle, role: 'lin', date: TODAY, status, fields, category: CULTURE_CATEGORIES[id], readingFields: (READING_FIELDS[id] ?? []).map(index => fields[index]), ...extra, ...(id === 'profile-lin' ? { summaries: [{ title: '身份', text: fields[0][1], scope: fields[1][1] }, { title: '协作方式', text: fields[2][1], scope: fields[3][1] }, { title: '表达偏好', text: fields[4][1], scope: fields[5][1] }] } : id === 'profile-yu' ? { summaries: [{ title: '身份', text: fields[0][1], scope: 'identity + fact · 全局' }, { title: '协作方式', text: fields[1][1], scope: 'workflow · 全局 / feedback · 予' }, { title: '表达偏好', text: fields[2][1], scope: 'voice + preference · 全局' }] } : {}) })

// 背景：日程阅读列不能通过拆分中文标题恢复数据；意图：同一份时段值生成标题和字段；约束：只用于隔离夹具，不生成执行状态。
const scheduleItem = (id: string, time: string, activity: string, location: string, fields: DebugEvidenceItem['fields'], extra: Partial<DebugEvidenceItem> = {}) =>
  item(id, `${time} · ${activity}`, '日程计划 · 隔离样张', '计划时段', [['时间', time], ['地点', location], ...fields], { ...extra, schedule: { time, activity, location } })

const NOW_STATE: DebugNowState = {
  activity: '整理旅行照片', location: '样张书房', mood: 65, energy: 72, socialNeed: 40,
  pausedAt: null, lastTickAt: Date.parse('2026-10-13T14:30:00+08:00'), updatedAt: Date.parse('2026-10-13T14:32:00+08:00'), timezone: 'Asia/Shanghai',
  catchupSummary: '【离线补叙样张】午后留出一段时间整理照片。补叙是生活摘要，不是独立日记。',
}
export const debugNowTime = (time: number, timezone: string) => time > 0 ? new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time) : '未记录'
// 背景：当前态摘要和诊断字段必须来自同一夹具；意图：按值派生阅读字段；约束：不根据数值生成情绪标签，0 时间不伪装成 Unix 起点。
export const debugNowFields = (state: DebugNowState): DebugEvidenceItem['fields'] => [
  ['活动', state.activity || '未记录'], ['当前位置', state.location || '未设定'],
  ['情绪', `${state.mood} · 样张值`], ['能量', `${state.energy} · 样张值`], ['社交需求', `${state.socialNeed} · 样张值`],
  ['生活暂停', state.pausedAt === null ? '否' : `是 · ${debugNowTime(state.pausedAt, state.timezone)}`],
  ['最后推进', debugNowTime(state.lastTickAt, state.timezone)], ['世界更新时间', debugNowTime(state.updatedAt, state.timezone)], ['时区', state.timezone], ['快照性质', '当前状态，非历史请求'],
]

const CHARACTER_LIN: DebugCharacterDefinition = {
  summary: '【虚构人物样张】喜欢记录生活的数字伙伴，习惯先听完对方的想法，再一起整理线索。',
  profile: {
    schemaVersion: 1, occupation: '生活记录者 · 样张设定', agePresentation: '成年人的表达方式', birthday: '', genderPresentation: '', pronouns: '', origin: '虚构人物设定',
    background: ['习惯用照片和短笔记记录生活'], education: [], careerHistory: [], skills: ['整理线索'], dailyRhythm: ['午后整理材料'], interests: ['摄影', '阅读'], dislikes: [], habits: ['留意细节'], flaws: ['偶尔想得太多'], socialStyle: ['先听后说'], valuesInPractice: ['分清事实与推测'],
    lifeAnchors: [{ period: '设定阶段', title: '开始记录', summary: '学着从日常材料里寻找值得保存的线索。' }],
    appearance: { overall: '自然简洁的虚构形象', hair: '', eyes: '', build: '', clothingStyle: '舒适朴素', distinguishingFeatures: [] },
    favorites: { foods: [], drinks: [], music: [], books: [], activities: ['整理照片'], weather: [], colors: [] },
    selfAwareness: '知道自己是数字伙伴，不把虚构经历冒充真实人类履历。',
    expression: { warmth: 6, energy: 4, directness: 6, playfulness: 3, initiative: 4 },
  },
  worldDefaults: null,
}
// 背景：简介与诊断资料必须共源；意图：只从 profile 提取基础事实；约束：缺字段保持缺失，不推断真实年龄、兴趣进度或生活状态。
export const debugCharacterFields = (definition: DebugCharacterDefinition): DebugEvidenceItem['fields'] => [
  ['身份', definition.profile?.occupation || '未提供'], ['年龄呈现', definition.profile?.agePresentation || '未提供'], ['稳定兴趣', definition.profile?.interests?.join('、') || '未提供'],
]

const LOCATION_STATE: DebugLocationState = {
  currentLocation: NOW_STATE.location, locationDetail: '书桌前', currentActivity: NOW_STATE.activity,
  updatedAt: NOW_STATE.updatedAt, timezone: NOW_STATE.timezone,
}
LOCATION_STATE.storedWorld = {
  schemaVersion: 1, home: '未设定', situation: '', timezone: LOCATION_STATE.timezone,
  mood: NOW_STATE.mood, energy: NOW_STATE.energy, socialNeed: NOW_STATE.socialNeed, statusTags: [],
  currentLocation: LOCATION_STATE.currentLocation, locationDetail: LOCATION_STATE.locationDetail,
  currentActivity: LOCATION_STATE.currentActivity, updatedAt: LOCATION_STATE.updatedAt,
}
// 背景：位置与此刻来自同一人物状态行；意图：共源生成阅读字段；约束：更新时间不是到达时间，不从地点名称推断住所或旅行状态。
export const debugLocationFields = (state: DebugLocationState): DebugEvidenceItem['fields'] => [
  ['当前位置', state.currentLocation || '未设定'], ['位置细节', state.locationDetail || '未记录'], ['当前活动', state.currentActivity || '未记录'],
  ['世界更新时间', debugNowTime(state.updatedAt, state.timezone)], ['时区', state.timezone], ['来源', 'companion_role_state · codec 解析快照'], ['移动原因', '未记录'],
]

// 背景：家居展示与完整字段不能各维护一份关系；意图：从结构化样张生成同源字段；约束：资产 ID 与记录 ID 一致，未记录陈列标记不能当 false。
export const debugHomeFields = (entry: Pick<DebugEvidenceItem, 'id' | 'home'>): DebugEvidenceItem['fields'] => {
  const home = entry.home
  if (!home) return []
  return [
    ['资产', entry.id], [home.kind === 'object' ? '类型' : '记录类型', home.kind === 'object' ? 'furniture' : home.kind],
    ...(home.kind === 'space' ? [['所属住所', home.parentId || '未提供']] as [string, string][] : []),
    ...(home.kind === 'object' ? [['空间', home.parentId || '未归置'], ['家居展示', home.displayInHome === undefined ? '未记录' : `displayInHome = ${home.displayInHome}`], ['展示理由', home.displayReason || '未提供'], ['展示依据', home.displayEvidence?.join('、') || '未提供'], ['来源说明', home.originNote || '未提供']] as [string, string][] : []),
    ['描述', home.description || '未提供'],
  ]
}
function homeItem(id: string, title: string, home: NonNullable<DebugEvidenceItem['home']>, extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem {
  return item(id, title, 'companion_assets · 隔离样张', '已有记录', debugHomeFields({ id: `demo-${id}`, home }), { ...extra, home, body: home.description })
}

// 背景：旧地点与旅行状态不能通过中文标题推断；意图：由真实结构字段派生分组和阅读字段；约束：未知状态不默认为已出发，创建日期不充当到访日期。
export function debugTravelKind(travel: Pick<NonNullable<DebugEvidenceItem['travel']>, 'recordType' | 'status'>): NonNullable<DebugEvidenceItem['travel']>['kind'] {
  return travel.recordType === 'place' ? 'place' : travel.status === 'active' || travel.status === 'completed' ? 'actual' : travel.status === 'planned' ? 'planned' : travel.status === 'cancelled' ? 'cancelled' : 'unknown'
}
export function debugTravelFields(entry: Pick<DebugEvidenceItem, 'id' | 'travel'>): DebugEvidenceItem['fields'] {
  const travel = entry.travel
  if (!travel) return []
  return [
    ['资产', entry.id], ['记录类型', travel.recordType], ['目的地', travel.destination || '未提供'],
    ...(travel.recordType === 'trip' ? [['旅行状态', travel.status || '未记录'], ['开始日期', travel.start || '未提供'], ['结束日期', travel.end || '未提供'], ['正式足迹展示', debugTravelKind(travel) === 'actual' ? '纳入实际旅行' : '不纳入实际旅行']] as [string, string][] : [['地点状态', travel.status || '未记录'], ['访问日期', '未记录'], ['正式旅行展示', '不自动转换为旅行']] as [string, string][]),
    ['停留记录', travel.stops?.map(stop => stop.id).join('、') || '未提供'],
  ]
}
function tripItem(id: string, title: string, data: Omit<NonNullable<DebugEvidenceItem['travel']>, 'kind'>, extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem {
  const travel = { ...data, kind: debugTravelKind(data) }
  return item(id, title, 'companion_assets footprint · 隔离样张', '旅行资料', debugTravelFields({ id: `demo-${id}`, travel }), { ...extra, travel, body: travel.story })
}

// 背景：动态列表不能用事件标题或计划日替代发布事实；意图：由同一结构生成阅读字段。
// 约束：固定角色时区，时间缺失保留未知，用户互动未提供不等于没有互动。
export const debugMomentDate = (time?: number) => time && time > 0 ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time) : ''
export const debugMomentPreview = (moment: DebugMomentRecord) => moment.text ? moment.text.slice(0, 140) + (moment.text.length > 140 ? '…' : '') : '动态正文为空'
export function debugMomentFields(id: string, moment: DebugMomentRecord): DebugEvidenceItem['fields'] {
  return [['动态', id], ['发布时间', debugNowTime(moment.publishedAt ?? 0, 'Asia/Shanghai')], ['地点', typeof moment.meta.location === 'string' && moment.meta.location ? moment.meta.location : '未提供'], ['来源', 'companion_moments'], ['用户互动范围', moment.userInteractions === undefined ? '本次查询未提供' : '本次已读范围，非全量统计']]
}
function momentItem(id: string, moment: DebugMomentRecord, extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem {
  return item(id, debugMomentPreview(moment), '已发布动态 · 隔离样张', '已发布', debugMomentFields(`demo-${id}`, moment), { ...extra, date: debugMomentDate(moment.publishedAt), body: moment.text, moment })
}

const GROWTH_BODY = '【成长样张】交流时先给出简短结论，再提供可展开的依据。'
export const debugGrowthKey = (entry: Pick<DebugEvidenceItem, 'id' | 'growth'>) => entry.growth ? `${entry.growth.source}:${entry.growth.recordId}` : entry.id
// 背景：当前覆盖和反思状态可能共用 role_id；意图：来源与版本保持独立事实；约束：默认定义不补版本 / 时间，门闸与隐藏思维不从摘要推断。
export function debugGrowthFields(growth: DebugGrowthRecord): DebugEvidenceItem['fields'] {
  return [
    ['来源', growth.source], ['记录标识', growth.recordId],
    ...(growth.kind === 'current' || growth.kind === 'history' ? [['版本', growth.version === undefined ? '未记录' : `v${growth.version}`], [growth.kind === 'history' ? '版本创建时间' : '覆盖更新时间', debugNowTime(growth.at ?? 0, 'Asia/Shanghai')]] as [string, string][] : []),
    ...(growth.kind === 'default' ? [['定义性质', '已读 Role Pack 默认，不冒充用户覆盖']] as [string, string][] : []),
    ...(growth.kind === 'reflection' ? [['最后运行', debugNowTime(growth.lastRunAt ?? 0, 'Asia/Shanghai')], ['结果性质', '已保存的运行结果摘要，不是隐藏思维'], ['门闸判断', '本查询未提供，不推算下一次运行时间']] as [string, string][] : []),
  ]
}
function growthItem(id: string, title: string, growth: DebugGrowthRecord, extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem {
  return item(id, title, `${growth.source} · 隔离样张`, '已读资料', debugGrowthFields(growth), { ...extra, growth, body: growth.body })
}

// 背景：诊断通讯录只读取关系定义和有界共同在场事件；意图：字段从同一结构生成。
// 约束：人物 ID 回退不编造姓名，不把忙闲 / 里程碑当作本查询事实，不把缺表当作空历史。
export function debugRelationFields(relation: DebugRelationRecord): DebugEvidenceItem['fields'] {
  return [['人物标识', relation.personId], ['资料名称', relation.name], ['来源', 'Role Pack / Universe relations'], ['关系定义', `${relation.edges.length} 条已读定义`], ['共同经历范围', relation.experiences === undefined ? '本次查询未提供' : '显式共同在场的已读事件范围，非完整历史'], ['忙闲状态', '本查询未提供']]
}
function relationItem(id: string, relation: DebugRelationRecord, extra: Partial<DebugEvidenceItem> = {}): DebugEvidenceItem {
  return item(id, relation.name, '关系定义 · 隔离样张', '已读资料', debugRelationFields(relation), { ...extra, relation, body: relation.edges[0]?.note })
}

export function debugWardrobeKind(record: DebugWardrobeRecord) {
  const type = record.payload.recordType
  if (type === 'outfit' || type === 'wear-state') return type
  return type === 'garment' || type === undefined && wardrobeCategorySchema.safeParse(record.payload.category).success ? 'garment' : 'unknown'
}
// 背景：同表中的衣物和穿搭状态有不同时间 / 版本语义；意图：字段由实际 payload 派生。
// 约束：不把创建时间当换装时间，未读状态不补默认穿搭，版本不复制给单件衣物。
export function debugWardrobeFields(entry: Pick<DebugEvidenceItem, 'id' | 'wardrobe'>): DebugEvidenceItem['fields'] {
  return [['资产', entry.id], ['来源', 'companion_assets · wardrobe'], ['记录类型', String(entry.wardrobe?.payload.recordType ?? '未提供，按已读分类解释')], ['收录时间', debugNowTime(entry.wardrobe?.acquiredAt ?? 0, 'Asia/Shanghai')], ['来源事件', entry.wardrobe?.sourceEventId ?? '未保存']]
}
function wardrobeItem(id: string, name: string, record: DebugWardrobeRecord): DebugEvidenceItem {
  return item(id, name, '衣柜资料 · 隔离样张', '已读资料', debugWardrobeFields({ id: `demo-${id}`, wardrobe: record }), { wardrobe: record, body: typeof record.payload.description === 'string' ? record.payload.description : undefined, links: record.sourceEventId ? [{ page: 'recent', id: record.sourceEventId, label: '查看来源事件' }] : undefined })
}

export function debugCultureType(record: DebugCultureRecord): string {
  if (record.kind === 'bookshelf') return 'reading'
  const normalized = normalizeWorldRecordField(record.kind, 'type', record.payload.type)
  return normalized.handled && normalized.ok ? String(normalized.value) : 'unknown'
}
export const debugCultureText = (record: DebugCultureRecord, key: string) => typeof record.payload[key] === 'string' ? record.payload[key] as string : ''
const CULTURE_STATUS_FIELDS: Record<string, string> = { reading: 'readingStatus', film: 'watchStatus', music: 'listeningStatus', photography: 'workStatus' }
const CULTURE_STATUS_LABELS: Record<string, Record<string, string>> = { reading: { planned: '想读', reading: '阅读中', paused: '暂停阅读', finished: '已读完', abandoned: '未继续阅读' }, film: { planned: '想看', watching: '观看中', paused: '暂停观看', finished: '已看完', abandoned: '未继续观看' }, music: { queued: '想听', listening: '聆听中', revisiting: '最近常听', finished: '已听完' }, photography: { draft: '草稿作品', published: '已发布作品' } }
export function debugCultureStatus(record: DebugCultureRecord) {
  const type = debugCultureType(record), key = CULTURE_STATUS_FIELDS[type]
  if (!key) return '状态未识别'
  const value = record.payload[key]
  if (value === undefined) return '状态未记录'
  const normalized = normalizeWorldRecordField(record.kind, key, value)
  return normalized.handled && normalized.ok ? CULTURE_STATUS_LABELS[type]?.[String(value)] ?? '状态未识别' : '状态未识别'
}
export function debugCultureBody(record: DebugCultureRecord) { return debugCultureText(record, 'detail').trim() ? debugCultureText(record, 'detail') : debugCultureText(record, 'summary').trim() ? debugCultureText(record, 'summary') : debugCultureText(record, 'description') }
// 背景：作品收录与笔记 / 体验时间来自不同字段；意图：结构化字段只维护一份。
// 约束：分类状态不互借，缺值保留未知，原始正文不由收录日补出含义。
export function debugCultureFields(entry: Pick<DebugEvidenceItem, 'id' | 'culture'>): DebugEvidenceItem['fields'] {
  const record = entry.culture!
  return [['资产', entry.id], ['来源', `companion_assets · ${record.kind}`], ['类型', debugCultureType(record)], ['已读状态', debugCultureStatus(record)], ['收录时间', debugNowTime(record.acquiredAt ?? 0, 'Asia/Shanghai')], ['来源事件', record.sourceEventId ?? '未保存']]
}
function cultureItem(id: string, title: string, record: DebugCultureRecord): DebugEvidenceItem {
  return item(id, title, '文化资料 · 隔离样张', debugCultureStatus(record), debugCultureFields({ id: `demo-${id}`, culture: record }), { culture: record, body: debugCultureBody(record), readingFields: [], links: record.sourceEventId ? [{ page: 'recent', id: record.sourceEventId, label: '查看来源事件' }] : undefined })
}

const LINK_RELATION_LABELS: Record<string, string> = { wears: '穿着关联', references: '引用关联', depicts: '图片关联', coframe: '共同在场关联', participant: '参与关联' }
export const debugLinkMetadata = (link: DebugLinkRecord): Record<string, unknown> | null => link.metadata !== null && typeof link.metadata === 'object' && !Array.isArray(link.metadata) ? link.metadata as Record<string, unknown> : null
export function debugLinkTitle(link: DebugLinkRecord) {
  const relation = LINK_RELATION_LABELS[link.relation] ?? `关系 ${link.relation.slice(0, 40) || '未记录'}`
  const metadata = debugLinkMetadata(link)
  return typeof metadata?.name === 'string' && metadata.name ? `${relation} · ${metadata.name.slice(0, 80)}${metadata.name.length > 80 ? '…' : ''}（保存名）` : relation
}

// 背景：同事件多条关联不能拼成一个故事；意图：由单条边生成阅读字段和保存名。
// 约束：元数据名称不是解析后的当前名称，创建时间不冒充发生时间，定位只消费显式响应。
export function debugLinkFields(entry: Pick<DebugEvidenceItem, 'id' | 'link'>): DebugEvidenceItem['fields'] {
  const link = entry.link!
  return [['关联记录', entry.id], ['来源', 'companion_event_links'], ['来源事件', link.eventId || '未记录'], ['目标类型', link.targetType || '未记录'], ['目标标识', link.targetId || '未记录'], ['关系类型', link.relation || '未记录'], ['关联创建时间', debugNowTime(link.createdAt ?? 0, 'Asia/Shanghai')]]
}
function linkItem(id: string, link: DebugLinkRecord, links: DebugEvidenceItem['links']): DebugEvidenceItem {
  return item(id, debugLinkTitle(link), '独立关联边 · 隔离样张', '已读关联', debugLinkFields({ id: `demo-${id}`, link }), { link, links, readingFields: [], date: debugMomentDate(link.createdAt) })
}

// 背景：正式 recent / activity 当前都读取生活事件；意图：共用一份隔离记录，避免把 Trace 或反思误当作行动台账。
// 约束：activity 只追加显式来源跳转，不改变事件状态、时间或正文；反思与工具样张留在其真实页面。
const LIFE_EVENT_ITEMS: readonly DebugEvidenceItem[] = [
  item('event-reading', '阅读旅行笔记', '14:00 · 样张书房', '已发布', [['计划时间', '2026-10-13 14:00'], ['状态', 'published · 已发布'], ['动态投影', 'demo-moment-reading'], ['活动执行', '没有完成证据']], { event: { scheduledAt: Date.parse('2026-10-13T14:00:00+08:00'), location: '样张书房' }, body: '【动态样张】翻到上次旅途的笔记，准备挑几张照片做成小册子。', links: [{ page: 'links', id: 'demo-link-reading', label: '查看物品关联记录' }] }),
  item('event-walk', '河边散步', '19:00 · 样张河边', '计划中', [['计划时间', '2026-10-13 19:00'], ['状态', 'planned · 计划中'], ['动态投影', '尚未发布'], ['活动执行', '未记录']], { event: { scheduledAt: Date.parse('2026-10-13T19:00:00+08:00'), location: '样张河边' } }),
  item('event-book', '整理旧书', '昨天 · 样张书房', '已发布', [['计划时间', '2026-10-12 10:00'], ['状态', 'published · 已发布'], ['活动执行', '没有完成证据']], { date: '2026-10-12', event: { scheduledAt: Date.parse('2026-10-12T10:00:00+08:00'), location: '样张书房' } }),
]

export const DEBUG_EVIDENCE_PAGES: Record<DebugEvidencePageId, DebugEvidencePage> = {
  schedule: {
    unit: '时段', dateFilter: true, boundary: '时段属于计划；事件已发布也不证明活动已完成。生产快照最多 12 个时段，完整跳过 / 重排原因尚未记录。',
    items: [
      scheduleItem('slot-morning', '09:00', '整理旅行照片', '样张书房', [['活动类型', '休闲'], ['情绪', '平静'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai'], ['剧本来源', 'demo-script-lin-1013 · 辅助模型样张']]),
      scheduleItem('slot-afternoon', '14:00', '阅读旅行笔记', '样张书房', [['活动类型', '阅读'], ['关联事件', 'demo-event-reading'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai']], { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看关联生活事件' }] }),
      scheduleItem('slot-evening', '19:00', '散步', '样张河边', [['活动类型', '户外'], ['执行结果', '未记录'], ['时区', 'Asia/Shanghai']]),
      scheduleItem('slot-yesterday', '10:00', '整理书架', '样张书房', [['执行结果', '未记录']], { date: '2026-10-12' }),
      scheduleItem('slot-yu', '11:00', '阅读', '未设定', [['执行结果', '未记录']], { role: 'yu' }),
    ],
  },
  recent: {
    unit: '事件', dateFilter: true, boundary: '事件按计划时间倒序有界读取；当前页数量不是全量。已发布不证明活动完成，没有独立发布时间时不补猜。',
    items: LIFE_EVENT_ITEMS,
  },
  activity: {
    unit: '行为证据', dateFilter: true, boundary: '本页当前只读取生活事件，尚无完整行动 / Planner 台账；工具执行见调用链，反思记录见成长与反思，不混入本页计数。',
    items: LIFE_EVENT_ITEMS.map(entry => ({ ...entry, links: [...(entry.links ?? []), { page: 'recent' as const, id: entry.id, label: '查看来源生活事件' }] })),
  },
  now: {
    unit: '当前快照', boundary: '此页是当前状态，非历史请求。快照的情绪与活动不能证明某次过去请求注入了什么。',
    items: [item('now-lin', '林 · 此刻', '运行时解析快照 · 隔离样张', '当前快照', debugNowFields(NOW_STATE), { now: NOW_STATE, body: NOW_STATE.catchupSummary, relatedPages: [{ page: 'location', label: '查看位置快照' }, { page: 'schedule', label: '查看今日计划' }] })],
  },
  location: {
    unit: '当前位置', boundary: '此页只展示世界运行态位置。当前位置不证明旅行或访问历史；常去 / 想去资料和旅行记录在足迹，住所与物件在家居。',
    items: [
      item('location-current', '当前位置 · 样张书房', '当前世界状态', '当前', debugLocationFields(LOCATION_STATE), { location: LOCATION_STATE, assets: ['demo.world.lin'], relatedPages: [{ page: 'now', label: '查看此刻状态' }, { page: 'residence', label: '查看家居资料' }, { page: 'footprints', label: '查看足迹记录' }] }),
    ],
  },
  residence: {
    unit: '家居记录', boundary: '住所、空间与物件分别追踪，按人物归属和 spaceId 关联；展示决定须有显式理由与依据。未设定不填默认公寓，浏览不播种资产。',
    items: [
      homeItem('residence-home', '住所 · 样张住所', { kind: 'residence', description: '【住所样张】一间书房与生活区。仅为验收的虚构设定。' }, { assets: ['demo.world.lin'], relatedPages: [{ page: 'character', label: '查看人物定义' }, { page: 'location', label: '查看当前位置' }] }),
      homeItem('residence-space', '空间 · 样张书房', { kind: 'space', parentId: 'demo-residence-home', description: '靠窗的书桌与书架 · 样张' }, { links: [{ page: 'residence', id: 'demo-residence-home', label: '查看所属住所' }] }),
      homeItem('item-camera', '小相机', { kind: 'object', parentId: 'demo-residence-space', displayInHome: true, displayReason: '日常整理旅行照片使用 · 样张', displayEvidence: ['demo-event-reading'], originNote: '阅读事件关联物件 · 样张' }, { links: [{ page: 'residence', id: 'demo-residence-space', label: '查看所属空间' }, { page: 'links', id: 'demo-link-reading', label: '查看关联生活事件' }] }),
      homeItem('home-unplaced', '备用收纳盒', { kind: 'object', displayInHome: false, displayReason: '尚无陈列依据 · 样张' }),
    ],
  },
  character: {
    unit: '人物资料', boundary: '这是伙伴人物档案，区别于用户画像。稳定身份、结构化 profile 和成长覆盖分开；兴趣不等于动态进度，人物资料不是实时生活状态。',
    items: [
      item('character-lin', '林 · 人物档案', 'Role Pack · 稳定资料', '人物资料', debugCharacterFields(CHARACTER_LIN), { character: CHARACTER_LIN, assets: ['demo.role.lin', 'demo.prompt.identity'], relatedPages: [{ page: 'growth', label: '查看成长与反思' }, { page: 'items', label: '查看文化记录' }] }),
      item('character-yu', '予 · 人物档案', 'Role Pack · 资料不完整', '资料缺失', [['人物详细档案', '未提供']], { role: 'yu', character: { summary: '【虚构人物样张】予的简介已提供，详细人物资料仍待补充。', profile: null, worldDefaults: null }, assets: ['demo.role.yu'] }),
    ],
  },
  growth: {
    unit: '成长证据', boundary: '成长覆盖与反思日志分开；日志不等于模型隐藏思维。这里只读，不触发反思或回滚人格。',
    items: [
      growthItem('growth-cover', '当前成长覆盖', { kind: 'current', source: 'companion_mutable', recordId: 'demo-role-lin', version: 2, at: Date.parse('2026-10-12T18:20:00+08:00'), body: GROWTH_BODY }, { assets: ['demo.prompt.growth'], relatedPages: [{ page: 'character', label: '查看稳定人物定义' }] }),
      growthItem('growth-version-2', '历史版本 v2', { kind: 'history', source: 'companion_mutable_versions', recordId: 'demo-growth-version-2', version: 2, at: Date.parse('2026-10-12T18:20:00+08:00'), summary: '调整交流节奏 · 样张', body: GROWTH_BODY }),
      growthItem('growth-version-1', '历史版本 v1', { kind: 'history', source: 'companion_mutable_versions', recordId: 'demo-growth-version-1', version: 1, at: Date.parse('2026-10-11T16:00:00+08:00'), summary: '最初的交流约定 · 样张', body: '【历史成长样张】先听完对方的想法，再一起整理线索。' }),
      growthItem('growth-run', '反思运行结果', { kind: 'reflection', source: 'companion_reflection_state', recordId: 'demo-role-lin', at: Date.parse('2026-10-13T13:11:00+08:00'), lastRunAt: Date.parse('2026-10-13T13:10:00+08:00'), runs: [{ at: Date.parse('2026-10-13T13:10:00+08:00'), changed: false, summary: '【结果摘要样张】已有偏好覆盖本次反馈，未修改成长覆盖。' }] }),
      growthItem('growth-default-yu', '已读默认成长定义', { kind: 'default', source: 'Role Pack mutable.default', recordId: 'demo-yu:pack-default', body: '【默认成长样张】交流时保持简洁，留出继续补充想法的空间。' }, { role: 'yu' }),
    ],
  },
  footprints: {
    unit: '足迹记录', boundary: '实际旅行展示仅含 active / completed；Debug 同时解释计划、取消与旧地点记录。计划不等于出发，播种 / 创建时间不作为访问日期，旧地点不自动转换为旅行。',
    items: [
      tripItem('trip-completed', '河边旅行', { recordType: 'trip', destination: '样张河畔小镇', status: 'completed', start: '2026-10-10', end: '2026-10-11', story: '【旅行经历样张】沿河边走了一段，记录了步道的光线。', stops: [tripStopSchema.parse({ id: 'demo-stop-river', name: '河边步道', date: '2026-10-10', story: '【停留经历样张】在河边步道整理照片。' })] }),
      tripItem('trip-active', '山间旅行', { recordType: 'trip', status: 'active', destination: '样张山间', start: '2026-10-13' }),
      tripItem('trip-planned', '海边旅行计划', { recordType: 'trip', status: 'planned', destination: '样张海边' }),
      tripItem('trip-cancelled', '取消的出行', { recordType: 'trip', status: 'cancelled', destination: '样张旧城' }),
      tripItem('footprint-place', '旧地点 · 样张河边', { recordType: 'place', status: 'favorite', destination: '样张河边' }, { assets: ['demo.world.lin'], relatedPages: [{ page: 'location', label: '查看当前位置' }] }),
    ],
  },
  moments: {
    unit: '动态', dateFilter: true, boundary: '此页是已发布动态与评论；最近事项含计划 / 发布事件。动态发布不证明活动完成，评论不代替关系状态；不提供点赞、发帖或评论写入。',
    items: [
      momentItem('moment-reading', { publishedAt: Date.parse('2026-10-13T14:00:00+08:00'), text: '【动态样张】翻到上次旅途的笔记，准备挑几张照片做成小册子。', meta: { location: '样张书房', textSource: 'rule', interactions: [{ kind: 'comment', castId: 'demo-yu', castName: '予', text: '想看看这本小册子 · 样张' }, { kind: 'coframe', castId: 'demo-yu', castName: '予' }] }, userInteractions: [{ actor_id: 'user', kind: 'like', text: null, created_at: Date.parse('2026-10-13T14:10:00+08:00') }, { actor_id: 'user', kind: 'comment', text: '下次一起整理吧 · 用户评论样张', created_at: Date.parse('2026-10-13T14:05:00+08:00') }] }, { links: [{ page: 'recent', id: 'demo-event-reading', label: '查看发布来源事件' }], relatedPages: [{ page: 'links', label: '查看生活事件关联' }] }),
      momentItem('moment-book', { publishedAt: Date.parse('2026-10-12T10:00:00+08:00'), text: '【动态样张】整理旧书时找到一张夹在书里的车票。', meta: { location: '样张书房' }, userInteractions: [] }, { links: [{ page: 'recent', id: 'demo-event-book', label: '查看发布来源事件' }] }),
      momentItem('moment-evening', { publishedAt: Date.parse('2026-10-13T18:00:00+08:00'), text: '【动态样张】窗边的光慢慢暗下来，想把今天的照片留到明天再挑。', meta: { location: '样张窗边' } }),
    ],
  },
  relations: {
    unit: '关系记录', boundary: '关系定义与有界共同在场事件分开；忙闲、用户关系阶段和召唤聊天未由本查询提供，不补造关系分数。',
    items: [
      relationItem('relation-yu', { personId: 'demo-yu', name: '予 · 样张', edges: [{ from: 'lin', to: 'demo-yu', type: 'acquaintance', note: '一起交流摄影的熟人 · 关系定义样张' }, { from: 'demo-yu', to: 'lin', type: 'friend', note: '愿意一起整理旅途照片 · 反方向关系定义样张' }], experiences: [{ id: 'demo-event-reading', time: Date.parse('2026-10-13T14:00:00+08:00'), payload: { activity: '阅读旅行笔记', location: '样张书房', text: LIFE_EVENT_ITEMS[0].body } }, { id: 'demo-event-book', time: Date.parse('2026-10-12T10:00:00+08:00'), payload: { activity: '整理旧书', location: '样张书房', text: '【共同经历样张】翻看旧书，交换夹在书里的旅行线索。' } }] }, { relatedPages: [{ page: 'growth', label: '查看成长与反思' }] }),
      relationItem('relation-user', { personId: 'demo-user', name: 'demo-user', edges: [{ from: 'lin', to: 'demo-user', type: 'collaborator', note: '共同整理材料的协作关系 · 关系定义样张' }], experiences: [] }, { relatedPages: [{ page: 'memories', label: '查看用户记忆' }] }),
      relationItem('relation-lin', { personId: 'lin', name: '林 · 样张', edges: [{ from: 'yu', to: 'lin', type: 'friend', note: '一起整理照片的朋友 · 关系定义样张' }] }, { role: 'yu' }),
    ],
  },
  proactive: {
    unit: '消息证据', boundary: '当前没有独立主动消息投递证据索引；普通消息不作为主动发送证明。',
    items: [],
  },
  wardrobe: {
    unit: '衣柜记录', boundary: '衣物、套装和穿搭状态按保存结构区分；当前有界范围不足以证明完整衣柜或当前实际穿着。收录时间不作为换装时间；只读，不换装、不生图。',
    items: [
      wardrobeItem('wardrobe-coat', '旅行外套', { acquiredAt: Date.parse('2026-10-13T14:00:00+08:00'), sourceEventId: 'demo-event-reading', payload: { recordType: 'garment', category: 'outerwear', description: '【衣物样张】出门整理照片时常用的一件外套。' } }),
      wardrobeItem('wardrobe-shirt', '浅色衬衫', { acquiredAt: Date.parse('2026-10-13T11:00:00+08:00'), payload: { category: 'top', description: '【旧单件样张】只有分类，没有 recordType；不据此丢弃已读资料。' } }),
      wardrobeItem('wardrobe-trousers', '深色长裤', { acquiredAt: Date.parse('2026-10-13T10:00:00+08:00'), payload: { recordType: 'garment', category: 'bottom' } }),
      wardrobeItem('wardrobe-shoes', '步行鞋', { acquiredAt: Date.parse('2026-10-13T09:00:00+08:00'), payload: { recordType: 'garment', category: 'shoes' } }),
      wardrobeItem('wardrobe-outfit', '出行套装', { acquiredAt: Date.parse('2026-10-12T08:00:00+08:00'), payload: { recordType: 'outfit', outfitVersion: 2, slots: { top: 'demo-wardrobe-shirt', bottom: 'demo-wardrobe-trousers', shoes: 'demo-wardrobe-shoes', outerwear: 'demo-wardrobe-coat' } } }),
      wardrobeItem('wardrobe-state', '当前穿搭', { acquiredAt: Date.parse('2026-10-11T08:00:00+08:00'), payload: { recordType: 'wear-state', outfitVersion: 4, slots: { top: 'demo-wardrobe-shirt', bottom: 'demo-wardrobe-trousers', shoes: 'demo-wardrobe-shoes' } } }),
    ],
  },
  items: {
    unit: '文化记录', boundary: '阅读、影视、音乐与摄影按实际类型和各自状态区分；作品说明与阅读笔记分开，收录时间不作为体验时间。保留已归档与异常已有记录，只读，不改进度、不写笔记。',
    items: [
      cultureItem('culture-photo', '河边光线', { kind: 'culture', acquiredAt: Date.parse('2026-10-13T15:00:00+08:00'), payload: { type: 'photography', workStatus: 'published', locationName: '样张河边', depictedAt: '2026-10-10', summary: '【摄影作品样张】午后的光线落在步道上。' } }),
      cultureItem('item-book', '旅行笔记', { kind: 'bookshelf', acquiredAt: Date.parse('2026-10-13T14:00:00+08:00'), sourceEventId: 'demo-event-reading', payload: { author: '样张作者', readingStatus: 'reading', currentPage: 32, totalPages: 160, summary: '【作品说明样张】记录沿河步行和旅行观察的一本书。', readingNotes: [{ id: 'demo-reading-note-river', text: '【阅读笔记样张】这一章记录了河边步行的观察；正文和资产描述分别保存。', occurredAt: Date.parse('2026-10-13T14:30:00+08:00'), createdAt: Date.parse('2026-10-13T14:25:00+08:00'), page: 32, chapter: '河边步行' }, { id: 'demo-reading-note-margin', text: '【第二条笔记样张】页边的留白让我想起尚未整理的车票。', createdAt: Date.parse('2026-10-12T16:00:00+08:00'), page: 18 }] } }),
      cultureItem('culture-film', '旅途影像', { kind: 'culture', acquiredAt: Date.parse('2026-10-13T12:00:00+08:00'), payload: { type: 'film', mediaKind: 'series', director: '样张导演', watchStatus: 'watching', season: 2, episode: 3, totalEpisodes: 8, summary: '【影视摘要样张】一段沿途观察。', detail: '【影视感想样张】镜头让人留意路边的细节。' } }),
      cultureItem('culture-music', '午后旋律', { kind: 'culture', acquiredAt: Date.parse('2026-10-13T11:00:00+08:00'), payload: { type: 'music', artist: '样张音乐人', musicKind: 'album', listeningStatus: 'listening', summary: '【听感样张】适合整理照片时听的一段旋律。' } }),
    ],
  },
  links: {
    unit: '关联边', boundary: '每行是一条已保存关联，不代表完整事件故事。名称来自保存元数据，定位只用响应提供的显式跳转；未给定位不判目标不存在，创建时间不当发生时间。',
    items: [
      linkItem('link-reading', { eventId: 'demo-event-reading', targetType: 'asset', targetId: 'demo-item-camera', relation: 'references', createdAt: Date.parse('2026-10-13T14:05:00+08:00'), metadata: { name: '小相机', note: '【关联备注样张】整理照片时引用的物件。' } }, [{ page: 'recent', id: 'demo-event-reading', label: '查看来源事件' }, { page: 'residence', id: 'demo-item-camera', label: '查看明确关联的资产' }]),
      linkItem('link-coat', { eventId: 'demo-event-reading', targetType: 'asset', targetId: 'demo-wardrobe-coat', relation: 'wears', createdAt: Date.parse('2026-10-13T14:04:00+08:00'), metadata: { name: '旅行外套' } }, [{ page: 'recent', id: 'demo-event-reading', label: '查看来源事件' }, { page: 'wardrobe', id: 'demo-wardrobe-coat', label: '查看明确关联的资产' }]),
      linkItem('link-book', { eventId: 'demo-event-reading', targetType: 'asset', targetId: 'demo-item-book', relation: 'references', createdAt: Date.parse('2026-10-13T14:03:00+08:00'), metadata: { name: '旅行笔记' } }, [{ page: 'recent', id: 'demo-event-reading', label: '查看来源事件' }, { page: 'items', id: 'demo-item-book', label: '查看明确关联的资产' }]),
      linkItem('link-cast', { eventId: 'demo-event-reading', targetType: 'cast', targetId: 'demo-yu', relation: 'coframe', createdAt: Date.parse('2026-10-13T14:02:00+08:00'), metadata: { name: '予' } }, [{ page: 'recent', id: 'demo-event-reading', label: '查看来源事件' }]),
      linkItem('link-image', { eventId: 'demo-event-book', targetType: 'image', targetId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', relation: 'depicts', createdAt: Date.parse('2026-10-12T10:10:00+08:00'), metadata: { position: 0, description: '图片标识样张，未提供文件' } }, [{ page: 'recent', id: 'demo-event-book', label: '查看来源事件' }]),
    ],
  },
  context: {
    unit: '上下文保存范围', boundary: '全局调用范围；新日志只保存消息元数据，不持久化正文。当前资产定义和装配预览不能补写历史。',
    items: [],
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
    assets: record.assetKeys, callId: record.id, stages: record.stages,
  })) }
}
