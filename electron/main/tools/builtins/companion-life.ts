import { randomUUID } from 'node:crypto'
import { buildTool } from '../builder'
import { createAsset, getAsset, listAssets, updateAsset } from '../../companion/life/assets'
import { addMomentCommentForRole, projectMomentFromEvent } from '../../companion/life/moments'
import { deleteEvent, insertEvent, listMoments } from '../../companion/life/store'
import { getSession } from '../../storage/session-store'
import { loadRelations } from '../../companion/identity/loader'

const ASSET_KINDS = ['home', 'furniture', 'footprint', 'culture', 'bookshelf', 'wardrobe'] as const
type CompanionAssetKind = (typeof ASSET_KINDS)[number]

/**
 * 背景：Chat 写入和评论需要真实目标 ID，最近动态摘要无法支持完整查找流程。
 * 设计意图：查询复用同人物存储，只返回有界摘要及稳定 ID，让后续工具使用真实引用。
 * 关键约束：不接受外部 roleId，不播种默认资产，不返回文件路径；失败交由工具中间件报告。
 */
export const companionReadWorldTool = buildTool({
  name: 'companion_read_world',
  description: '读取当前会话人物的朋友圈或生活资产，返回真实 ID 和摘要。评论动态、给已有资产配图前先查询，不猜测目标 ID。',
  parameters: {
    type: 'object',
    properties: {
      view: { type: 'string', enum: ['moments', 'assets'] },
      kind: { type: 'string', enum: [...ASSET_KINDS], description: '查询资产时可按类型筛选。' },
      offset: { type: 'integer', description: '分页起点，默认 0。' },
    },
    required: ['view'],
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args, context) => {
    const roleId = context?.roleId?.trim()
    if (!roleId) return '当前会话没有绑定人物，暂时不能读取人物世界。'
    const offset = args.offset === undefined ? 0 : args.offset
    if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > 10000) return '分页起点必须是 0–10000 的整数。'
    if (args.view === 'moments') {
      const rows = await listMoments(roleId, { offset, limit: 21 })
      return JSON.stringify({ roleId, items: rows.slice(0, 20).map(row => ({ id: row.id, text: row.text.slice(0, 2000), publishedAt: row.publishedAt })), nextOffset: rows.length > 20 ? offset + 20 : null })
    }
    if (args.view !== 'assets') return '请选择 moments 或 assets。'
    if (args.kind !== undefined && !ASSET_KINDS.includes(args.kind as CompanionAssetKind)) return '资产类型无效。'
    const rows = await listAssets(roleId, { kind: args.kind as string | undefined })
    return JSON.stringify({ roleId, items: rows.slice(offset, offset + 20).map(row => ({ id: row.id, kind: row.kind, name: row.name, description: typeof row.payload.description === 'string' ? row.payload.description.slice(0, 500) : '' })), nextOffset: rows.length > offset + 20 ? offset + 20 : null })
  },
})

function textArg(args: Record<string, unknown>, key: string, max: number): string {
  const value = typeof args[key] === 'string' ? args[key].trim() : ''
  return value.length <= max ? value : ''
}

function imageIdsFromSession(session: Awaited<ReturnType<typeof getSession>>, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return []
  if (raw.length > 9 || raw.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) return null
  const owned = new Set(session?.messages.filter(message => message.role === 'tool').flatMap(message => message.generatedImages ?? []).map(image => image.id))
  const ids = [...new Set(raw)] as string[]
  return ids.every(id => owned.has(id)) ? ids : null
}

const RELATION_PHASES = ['bonding', 'friction', 'repair', 'milestone'] as const
type RelationPhase = (typeof RELATION_PHASES)[number]

function relationParticipants(roleId: string, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return []
  if (raw.length > 4 || raw.some(id => typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id))) return null
  const known = new Set(loadRelations().edges.flatMap(edge => edge.from === roleId ? [edge.to] : edge.to === roleId ? [edge.from] : []))
  const ids = [...new Set(raw)] as string[]
  return ids.every(id => known.has(id)) ? ids : null
}

/**
 * 背景：Chat 需要把已确认的生活片段写入朋友圈，才能让人物的生活事件、互动和 Debug 共享同一事实源。
 * 设计意图：直接创建已发布事件并复用 Moment 投影器，放弃在工具内拼另一份朋友圈数据。
 * 关键约束：必须绑定当前人物；图片只能引用本会话已经生成的图片；关系参与者必须来自静态关系表；投影失败会删除整条事件。
 */
export const companionPostMomentTool = buildTool({
  name: 'companion_post_moment',
  description: '把当前人物刚刚确认发生的生活片段发布到朋友圈；可附图片、关系参与者和关系阶段。只记录明确事实，不替人物编造经历。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '朋友圈正文，最多 2000 字。' },
      activity: { type: 'string', description: '这次生活事件的短标题，最多 120 字。' },
      location: { type: 'string', description: '发生地点，例如千里阳光号甲板；可省略。' },
      imageIds: { type: 'array', description: '可选：本会话已生成图片的摘要 ID，最多 9 个。' },
      participantIds: { type: 'array', description: '可选：共同在场的关系对象 ID，必须来自当前人物关系表，最多 4 个。' },
      relationshipPhase: { type: 'string', description: '可选：这次关系事件处于建立、摩擦、修复或里程碑阶段。', enum: [...RELATION_PHASES] },
      relationshipNote: { type: 'string', description: '可选：对关系变化的事实说明，最多 300 字。' },
    },
    required: ['text'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  inputExamples: [
    { text: '甲板上的风把航线图吹得哗啦响，伙伴们已经找到下一段方向。', activity: '整理下一段航线', location: '千里阳光号甲板', participantIds: ['zoro'], relationshipPhase: 'bonding' },
  ],
  execute: async (args, context) => {
    const roleId = context?.roleId?.trim()
    if (!roleId) return '当前会话没有绑定人物，暂时不能发布朋友圈。'
    const text = textArg(args, 'text', 2000)
    if (!text) return '朋友圈正文不能为空，且不能超过 2000 字。'
    const session = context?.sessionId ? await getSession(context.sessionId) : null
    const imageIds = imageIdsFromSession(session, args.imageIds)
    if (imageIds === null) return '图片只能引用本会话已生成的图片，最多 9 张。'
    const participantIds = relationParticipants(roleId, args.participantIds)
    if (participantIds === null) return '关系参与者必须是当前人物关系表中的对象，最多 4 个。'
    const phase = typeof args.relationshipPhase === 'string' && RELATION_PHASES.includes(args.relationshipPhase as RelationPhase) ? args.relationshipPhase as RelationPhase : ''
    if (args.relationshipPhase !== undefined && !phase) return `关系阶段无效，可选：${RELATION_PHASES.join('、')}。`
    const relationshipNote = textArg(args, 'relationshipNote', 300)
    const activity = textArg(args, 'activity', 120) || text.slice(0, 80)
    const location = textArg(args, 'location', 160)
    const event = await insertEvent({
      roleId,
      scheduledAt: Date.now(),
      status: 'published',
      type: 'moment',
      dayScriptId: null,
      payload: {
        activity,
        story: text,
        ...(location ? { location } : {}),
        ...(imageIds.length ? { imageIds } : {}),
        ...(participantIds.length ? { participantIds } : {}),
        ...(phase || relationshipNote ? { relationship: { ...(phase ? { phase } : {}), ...(relationshipNote ? { note: relationshipNote } : {}) } } : {}),
      },
    })
    try {
      const moment = await projectMomentFromEvent(event, { preferLlm: false })
      if (!moment) throw new Error('朋友圈投影未创建')
      return `已发布朋友圈（动态 ID：${moment.id}）。${imageIds.length ? `已附 ${imageIds.length} 张图片。` : ''}`
    } catch (error) {
      await deleteEvent(roleId, event.id)
      return `朋友圈发布失败，已撤销未完成的记录：${error instanceof Error ? error.message : '投影失败'}`
    }
  },
})

/**
 * 背景：家居、家具、足迹和文化资料需要从 Chat 进入人物世界，不能只靠页面表单才能存在。
 * 设计意图：把自然语言请求压成现有 createAsset 契约，由资产层统一做类型、角色和字段校验。
 * 关键约束：不接受 roleId 参数，始终写当前会话人物；payload 只作为结构化资料交给白名单校验。
 */
export const companionCreateAssetTool = buildTool({
  name: 'companion_create_asset',
  description: '为当前人物添加一项生活资产，例如家居、家具、足迹、文化资料、书架条目或衣物；资料会进入人物世界。',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', description: '资产类型。', enum: [...ASSET_KINDS] },
      name: { type: 'string', description: '资产名称，1–40 字。' },
      payload: { type: 'object', description: '可选结构化资料，例如 residence、description、detail、recordType、status。' },
    },
    required: ['kind', 'name'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  inputExamples: [
    { kind: 'furniture', name: '甲板望远镜架', payload: { description: '固定在千里阳光号甲板边，方便观察远处航线。' } },
    { kind: 'home', name: '千里阳光号', payload: { recordType: 'residence', residence: '伙伴们共同生活和出发的船上空间。' } },
  ],
  execute: async (args, context) => {
    const roleId = context?.roleId?.trim()
    if (!roleId) return '当前会话没有绑定人物，暂时不能添加生活资产。'
    const kind = typeof args.kind === 'string' ? args.kind.trim() : ''
    if (!ASSET_KINDS.includes(kind as CompanionAssetKind)) return `资产类型无效，可选：${ASSET_KINDS.join('、')}。`
    const name = textArg(args, 'name', 40)
    if (!name) return '资产名称不能为空，且不能超过 40 字。'
    const payload = args.payload === undefined ? undefined : args.payload
    if (payload !== undefined && (!payload || typeof payload !== 'object' || Array.isArray(payload))) return '资产资料必须是结构化对象。'
    try {
      const result = await createAsset({ roleId, kind, name, payload: payload as Record<string, unknown> | undefined })
      return result.ok ? `已添加${name}到人物世界（资产 ID：${result.asset.id}）。` : `生活资产未保存：${result.error}`
    } catch (error) {
      return `生活资产未保存：${error instanceof Error ? error.message : '资料校验失败'}`
    }
  },
})

/**
 * 背景：阅读感想可能来自用户记录，也可能来自人物对明确材料的自主整理；两者都必须留下来源范围。
 * 设计意图：复用资产层的角色归属、字段长度和持久化校验，将多条来源笔记存入同一书架资产，不复制另一套文化存储。
 * 关键约束：只接受当前人物的 bookshelf 资产；source 和 author 必须显式提供，不能仅凭书名或无来源聊天内容伪造已读事实。
 */
export const companionAddReadingNoteTool = buildTool({
  name: 'companion_add_reading_note',
  description: '为当前人物已存在的书架条目保存一条带来源范围的阅读笔记；可以由用户记录，也可以由人物根据明确材料自主记录。先用 companion_read_world 查询真实资产 ID。',
  parameters: {
    type: 'object',
    properties: {
      assetId: { type: 'string', description: '书架条目的真实资产 ID。' },
      note: { type: 'string', description: '阅读笔记，最多 4000 字。' },
      source: { type: 'string', description: '笔记依据，例如“用户提供的摘录”或“人物读取的第 3 章材料”，最多 300 字。' },
      author: { type: 'string', enum: ['user', 'companion'], description: '记录者：user = 用户记录，companion = 人物根据明确材料记录。' },
      page: { type: 'integer', description: '可选：页码，必须是 1–100000 的整数。' },
      chapter: { type: 'string', description: '可选：章节或段落范围，最多 120 字。' },
    },
    required: ['assetId', 'note', 'source', 'author'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  execute: async (args, context) => {
    const roleId = context?.roleId?.trim()
    if (!roleId) return '当前会话没有绑定人物，暂时不能保存阅读笔记。'
    const assetId = textArg(args, 'assetId', 200)
    const note = textArg(args, 'note', 4000)
    if (!assetId || !note) return '资产 ID 和阅读笔记不能为空。'
    const source = textArg(args, 'source', 300)
    const author = args.author === 'user' || args.author === 'companion' ? args.author : ''
    if (!source || !author) return '阅读笔记必须提供来源范围和记录者（user 或 companion）。'
    const page = args.page === undefined ? undefined : args.page
    if (page !== undefined && (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1 || page > 100000)) return '页码必须是 1–100000 的整数。'
    const chapter = args.chapter === undefined ? '' : textArg(args, 'chapter', 120)
    if (args.chapter !== undefined && !chapter) return '章节或段落范围不能为空，且不能超过 120 字。'
    const asset = await getAsset(assetId)
    if (!asset || asset.roleId !== roleId || asset.kind !== 'bookshelf') return '只能为当前人物已存在的书架条目保存笔记。'
    const existingNotes = Array.isArray(asset.payload.readingNotes) ? asset.payload.readingNotes : []
    const normalizedNotes = existingNotes.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    const duplicate = normalizedNotes.some(item => item.text === note && item.source === source && item.page === page && item.chapter === chapter)
    const readingNotes = duplicate ? normalizedNotes : [...normalizedNotes, { id: randomUUID(), text: note, source, author, ...(page === undefined ? {} : { page }), ...(chapter ? { chapter } : {}), createdAt: Date.now() }].slice(-50)
    const result = await updateAsset(assetId, { payload: { readingNotes } }, { expectedRoleId: roleId })
    return result.ok ? `已保存《${asset.name}》的阅读笔记${duplicate ? '（已存在相同来源记录）' : ''}。${author === 'companion' ? '记录者：人物。' : '记录者：用户。'}来源：${source}${page === undefined ? '' : `，第 ${page} 页`}${chapter ? `，${chapter}` : ''}` : `阅读笔记未保存：${result.error}`
  },
})

/**
 * 背景：朋友圈评论原先只有 WorldHub 的 IPC 入口，Chat 无法完成“看到动态后回应”的人物旅程。
 * 设计意图：复用既有评论服务，让用户评论、主角回复、失败回退和持久化继续走同一条链，放弃在工具内复制评论表或回复 Prompt。
 * 关键约束：动态必须属于当前会话人物；评论先落库，人物回复失败不能撤销用户评论；工具不接受 roleId，避免跨人物写入。
 */
export const companionCommentMomentTool = buildTool({
  name: 'companion_comment_moment',
  description: '以当前人物身份查看并回应一条已发布朋友圈动态；评论会保留，人物回复在可用时单独生成。只能回应当前人物的动态。',
  parameters: {
    type: 'object',
    properties: {
      momentId: { type: 'string', description: '要评论的动态 ID。' },
      text: { type: 'string', description: '评论内容，最多 280 字。' },
    },
    required: ['momentId', 'text'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  inputExamples: [
    { momentId: 'moment-id', text: '这段航线看起来很有意思，下一站准备去哪？' },
  ],
  execute: async (args, context) => {
    const roleId = context?.roleId?.trim()
    if (!roleId) return '当前会话没有绑定人物，暂时不能评论朋友圈。'
    const momentId = textArg(args, 'momentId', 200)
    const text = textArg(args, 'text', 280)
    if (!momentId || !text) return '动态 ID 和评论内容不能为空，评论不能超过 280 字。'
    const result = await addMomentCommentForRole(roleId, momentId, text)
    if (!result.ok) return `朋友圈评论未保存：${result.error}`
    const reply = result.social.comments.find(item => item.source === 'protagonist' && item.parentInteractionId)
    return reply?.text ? `已评论朋友圈，${roleId} 回复：${reply.text}` : '已评论朋友圈；人物回复暂未生成。'
  },
})
