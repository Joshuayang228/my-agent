/**
 * 同伴求助与生活共同决策（Co-Decisions & Shared Choices）
 *
 * 背景：角色在日常生活、探险与航行推进中，往往会遇到选择困难或人生/旅途分支节点。
 * 如果角色只顾自己推进或者只被动回答用户，缺乏真实伙伴在重大选择时「征求你意见、由你做主」的同伴共创感。
 *
 * 设计意图：
 * 1. 建立 companion_co_decisions 决策表，同一角色同一时刻最多存在 1 个 pending 决策；
 * 2. 用户作出选择后，角色即时生成符合人设的第一人称回响并作为 assistant 消息写入主会话；
 * 3. 决断记录为关键生活线索，通过 collectDayScriptLifeContext 注入次日剧本，真实影响明天的生活活动、足迹或朋友圈；
 * 4. 出厂为路飞播种第一件经典决策（明天的航向大抉择：大肉宴会 vs 古代遗迹 vs 海港酒馆）。
 *
 * 关键约束：
 * 1. 采用项目统一 sql.js 引擎，遵循 prepare/bind/step/free 模式与防穿越安全红线；
 * 2. 决策选择幂等化（已 resolve 的不可重复覆盖）；
 * 3. 模型不可用或解析失败时使用高质量规则预设保底。
 */

import { randomUUID } from 'crypto'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm'
import { compileCoDecisionReactionRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import { ensureMainSessionForRole } from '../../storage/session-store'
import type {
  CompanionCoDecisionRecord,
  CompanionCoDecisionEvent,
  CoDecisionOption,
  LLMConfig,
} from '../../../../src/shared/types'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { enqueueCompanionSessionMessage } from '../application/session-outbox'

const log = createLogger('CoDecision')

interface CoDecisionDbRow {
  id: string
  role_id: string
  title: string
  dilemma: string
  options_json: string
  status: 'pending' | 'resolved' | 'expired'
  selected_option_id: string | null
  selected_option_label: string | null
  companion_reaction: string | null
  created_at: number
  resolved_at: number | null
  absorbed_in_script: number
}

function parseOptions(jsonStr: string): CoDecisionOption[] {
  try {
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function rowToRecord(row: CoDecisionDbRow): CompanionCoDecisionRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    title: row.title,
    dilemma: row.dilemma,
    options: parseOptions(row.options_json),
    status: row.status,
    selectedOptionId: row.selected_option_id || undefined,
    selectedOptionLabel: row.selected_option_label || undefined,
    companionReaction: row.companion_reaction || undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || undefined,
    absorbedInScript: row.absorbed_in_script === 1,
  }
}

export const PRESET_DECISION_TEMPLATES: Array<{
  key: string
  roleId: string
  title: string
  dilemma: string
  options: CoDecisionOption[]
  fallbackReactions: Record<string, string>
}> = [
  {
    key: 'luffy-voyage-choice-1',
    roleId: 'luffy',
    title: '明天的航向大抉择！',
    dilemma: '喂！明天阳光号就要靠岸了，罗宾说东边的岛上有古代图书馆遗迹，索隆想去北边的海港城镇找酒喝，而我听说西边的大陆正在举办超级大肉宴会！我们到底先去哪边？你来做决定吧！',
    options: [
      {
        id: 'opt-meat',
        label: '西边：超级大肉宴会！',
        desc: '肉才是航海的第一要义，必须先填饱肚子！',
        impactHint: '明天将前往大肉岛举行狂欢宴会',
      },
      {
        id: 'opt-ruins',
        label: '东边：古代遗迹与神秘图书馆',
        desc: '未知的古代历史和巨大石碑在等着我们探寻。',
        impactHint: '明天将探索神秘古迹并挖掘失落文献',
      },
      {
        id: 'opt-tavern',
        label: '北边：海港酒馆与水手集市',
        desc: '听听来自世界各地的海盗传闻与冒险八卦。',
        impactHint: '明天将停靠繁华港口打听新世界悬赏',
      },
    ],
    fallbackReactions: {
      'opt-meat': '哇哈哈哈哈！果然英雄所见略同！大肉才是最重要的！我现在就去告诉娜美改舵向西！明天准备大吃一顿啦！',
      'opt-ruins': '好嘞！听你的，去东边的神秘遗迹！罗宾一定会超高兴的，说不定还能在石碑后发现什么宝藏呢，冲啊！',
      'opt-tavern': '好！那就先去北边的海港酒馆！索隆那家伙听到肯定乐坏了，正好去打听打听有没有厉害的对手！出发！',
    },
  },
  {
    key: 'luffy-bento-choice-2',
    roleId: 'luffy',
    title: '山治的特制便当对决',
    dilemma: '山治今天做了两份超绝便当，一份是堆得像小山一样的巨型烤带骨肉，一份是铺满黄金脆虾的极品海鲜炒饭！两份都超级香，山治说我只能挑一份带去甲板放风，另一份要留给大家。你觉得我今天该吃哪一个？',
    options: [
      {
        id: 'opt-bone-meat',
        label: '巨型烤带骨肉便当',
        desc: '大块大块的大口撕咬，充满力量的纯粹肉香！',
        impactHint: '午间甲板将大快朵颐烤肉',
      },
      {
        id: 'opt-seafood-rice',
        label: '黄金脆虾海鲜炒饭',
        desc: '浓郁的海鲜鲜味与金黄米粒，回味无穷的美味！',
        impactHint: '午间甲板将品尝鲜美海鲜炒饭',
      },
    ],
    fallbackReactions: {
      'opt-bone-meat': '嗷呜——！果然还是带骨肉最带劲了！一口咬下去满嘴流油，吃饱了才有力气当海贼王嘛！我开动啦！',
      'opt-seafood-rice': '好香！金黄的大虾配米饭真的绝了！山治的手艺真不是盖的，下次有机会一定要让你也尝尝看！',
    },
  },
  {
    key: 'luffy-afternoon-activity-3',
    roleId: 'luffy',
    title: '午后的冒险提案',
    dilemma: '吃完饭阳光正好！乌索普和乔巴拉着我想去钓深海巨型海王类，索隆正准备在草坪上来一场激烈的负重对决，娜美则警告我们今天最好老老实实检查船舵。你说，今天下午我们大家一起做什么最带劲？',
    options: [
      {
        id: 'opt-fishing',
        label: '跟乌索普和乔巴去钓海王类！',
        desc: '看看今天能不能钓上一只比船还大的怪兽！',
        impactHint: '下午将进行刺激的深海垂钓',
      },
      {
        id: 'opt-training',
        label: '找索隆在草坪上来场男子汉特训！',
        desc: '挥洒汗水，比比看谁的力量更大！',
        impactHint: '下午将在甲板草坪进行热血特训',
      },
      {
        id: 'opt-maintenance',
        label: '听娜美的话，乖乖巡视阳光号！',
        desc: '同伴的安全最重要，偶尔也做个称职的船长！',
        impactHint: '下午将认真检修船只零件',
      },
    ],
    fallbackReactions: {
      'opt-fishing': '哟西！钓鱼小队集合！今天我一定要钓上一条比阳光号还巨大的鱼当晚饭！走起！',
      'opt-training': '哈哈！来得正好！我这就去找索隆，看我用橡胶火箭炮把他打趴下！特训开始啦！',
      'opt-maintenance': '嘿嘿，听你的！偶尔老老实实当一回可靠的船长也不赖，娜美肯定会被我惊到的，走，巡视去！',
    },
  },
]

export async function ensureCoDecisionTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_co_decisions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL,
      title TEXT NOT NULL,
      dilemma TEXT NOT NULL,
      options_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      selected_option_id TEXT,
      selected_option_label TEXT,
      companion_reaction TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      absorbed_in_script INTEGER NOT NULL DEFAULT 0
    );
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_co_decisions_role_status ON companion_co_decisions (role_id, status, created_at);
  `)

  // 出厂为路飞播种第一件经典决策
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM companion_co_decisions WHERE role_id = ?')
  let count = 0
  try {
    countStmt.bind(['luffy'])
    if (countStmt.step()) {
      const obj = countStmt.getAsObject() as { count?: number }
      count = Number(obj.count ?? 0)
    }
  } finally {
    countStmt.free()
  }

  if (count === 0) {
    const starter = PRESET_DECISION_TEMPLATES[0]
    db.run(
      `INSERT INTO companion_co_decisions (
        id, role_id, title, dilemma, options_json, status, created_at, absorbed_in_script
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 0)`,
      [
        'luffy-starter-decision-1',
        starter.roleId,
        starter.title,
        starter.dilemma,
        JSON.stringify(starter.options),
        Date.now(),
      ],
    )
    log.info('Seeded starter co-decision for luffy')
    persist()
  }
}

/** 获取当前角色唯一的待决策事项（若无则返回 null） */
export async function getPendingCoDecision(roleId: string = 'luffy'): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ? AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `)
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([roleId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  return row ? rowToRecord(row) : null
}

/** 列出角色的所有决策历史 */
export async function listCoDecisions(roleId: string = 'luffy'): Promise<CompanionCoDecisionRecord[]> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ?
    ORDER BY created_at DESC
  `)
  const rows: CoDecisionDbRow[] = []
  try {
    stmt.bind([roleId])
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as CoDecisionDbRow)
    }
  } finally {
    stmt.free()
  }

  return rows.map(rowToRecord)
}

/**
 * 用户对某项求助困境做出决断：
 * 1. 验证选项合法性并更新为 resolved；
 * 2. 生成第一人称即时回响并存入数据库；
 * 3. 作为 assistant 消息推入角色专属主会话；
 * 4. 广播 companion:co-decision-resolved；
 * 5. 留给次日日剧本作为关键因果依据。
 */
export async function resolveCoDecision(
  decisionId: string,
  optionId: string,
): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM companion_co_decisions WHERE id = ?')
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([decisionId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  if (!row) {
    log.warn('Co-decision not found', { decisionId })
    return null
  }

  // 幂等保护：若该决策已被解决，直接返回当前记录，避免重复覆盖
  if (row.status !== 'pending') {
    return rowToRecord(row)
  }

  const options = parseOptions(row.options_json)
  const selectedOption = options.find((opt) => opt.id === optionId)
  if (!selectedOption) {
    log.warn('Option not found in decision', { decisionId, optionId })
    return null
  }

  const roleId = row.role_id
  let reactionText = ''

  // 1. 尝试使用 LLM 生成生动第一人称回响
  try {
    const auxConfig = await loadAuxLLMConfig()
    if (hasLLMAuthentication(auxConfig)) {
      const rolePack = loadRolePack(roleId)
      const protagonistName = rolePack?.name || (roleId === 'luffy' ? '路飞' : '伙伴')
      const protagonistBrief = rolePack?.description || '充满活力与冒险精神的热血海贼'

      const request = compileCoDecisionReactionRequest({
        protagonistName,
        protagonistBrief,
        decisionTitle: row.title,
        dilemma: row.dilemma,
        selectedOptionLabel: selectedOption.label,
        selectedOptionDesc: selectedOption.desc,
      })

      const rawText = await chatComplete({
        config: auxConfig as LLMConfig,
        request,
        caller: 'co-decision',
      })
      const text = rawText?.trim()
      if (text) {
        try {
          const parsed = JSON.parse(text)
          if (typeof parsed.reactionText === 'string' && parsed.reactionText.trim()) {
            reactionText = parsed.reactionText.trim()
          } else if (typeof parsed.chatMessage === 'string' && parsed.chatMessage.trim()) {
            reactionText = parsed.chatMessage.trim()
          }
        } catch {
          if (!text.startsWith('{')) {
            reactionText = text
          }
        }
      }
    }
  } catch (err) {
    log.warn('Failed to generate co-decision reaction via LLM, falling back to rule preset', { error: String(err) })
  }

  // 2. 规则保底
  if (!reactionText) {
    const template = PRESET_DECISION_TEMPLATES.find((t) => t.title === row.title)
    if (template && template.fallbackReactions[optionId]) {
      reactionText = template.fallbackReactions[optionId]
    } else {
      reactionText = `好！听你的，就选「${selectedOption.label}」！我们马上就这么办！冲啊！`
    }
  }

  const now = Date.now()
  db.run(
    `UPDATE companion_co_decisions
     SET status = 'resolved',
         selected_option_id = ?,
         selected_option_label = ?,
         companion_reaction = ?,
         resolved_at = ?
     WHERE id = ?`,
    [optionId, selectedOption.label, reactionText, now, decisionId],
  )

  persist()

  const selectStmt = db.prepare('SELECT * FROM companion_co_decisions WHERE id = ?')
  let updatedRow: CoDecisionDbRow | null = null
  try {
    selectStmt.bind([decisionId])
    if (selectStmt.step()) {
      updatedRow = selectStmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    selectStmt.free()
  }

  const record = updatedRow ? rowToRecord(updatedRow) : {
    id: decisionId,
    roleId,
    title: row.title,
    dilemma: row.dilemma,
    options,
    status: 'resolved' as const,
    selectedOptionId: optionId,
    selectedOptionLabel: selectedOption.label,
    companionReaction: reactionText,
    createdAt: row.created_at,
    resolvedAt: now,
    absorbedInScript: false,
  }

  // 3. 将角色反应写入主会话
  try {
    const mainSession = await ensureMainSessionForRole(roleId)
    await enqueueCompanionSessionMessage({
      roleId,
      sessionId: mainSession.id,
      message: { id: randomUUID(), role: 'assistant', content: reactionText, timestamp: Date.now() },
    })
    log.info('Co-decision reaction saved to main chat session', { roleId, mainSessionId: mainSession.id })
  } catch (err) {
    log.warn('Failed to save co-decision reaction to chat session', { error: String(err) })
  }

  // 4. 全局广播
  const eventPayload: CompanionCoDecisionEvent = {
    roleId,
    decision: record,
  }

  await recordCompanionEventAndNotify({
    roleId,
    type: 'co_decision_resolved',
    sourceType: 'co_decision',
    sourceId: record.id,
    idempotencyKey: `co-decision-resolved:${record.id}`,
    occurredAt: now,
    payload: eventPayload as unknown as Record<string, unknown>,
    notification: [
      { kind: 'timeline-updated', dedupeKey: `co-decision-timeline:${record.id}`, payload: { roleId, reason: 'co-decision-resolved' } },
      { kind: 'co-decision-resolved', dedupeKey: `co-decision-resolved:${record.id}`, payload: eventPayload as unknown as Record<string, unknown> },
    ],
  })

  return record
}

/** 创建一条新的共同求助事项（如果已有待决事项则直接返回它） */
export async function createCoDecision(
  roleId: string = 'luffy',
  dilemmaHintOrPayload?: string | { title?: string; dilemma?: string; options?: CoDecisionOption[] },
): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable()
  const db = await getDatabase()

  // 检查是否已有 pending
  const existingPending = await getPendingCoDecision(roleId)
  if (existingPending) {
    return existingPending
  }

  // 轮换或基于模板选取
  const stmt = db.prepare('SELECT title FROM companion_co_decisions WHERE role_id = ?')
  const existingTitles = new Set<string>()
  try {
    stmt.bind([roleId])
    while (stmt.step()) {
      const obj = stmt.getAsObject() as { title?: string }
      if (obj.title) {
        existingTitles.add(obj.title)
      }
    }
  } finally {
    stmt.free()
  }

  const availableTemplate = PRESET_DECISION_TEMPLATES.find((t) => !existingTitles.has(t.title)) || PRESET_DECISION_TEMPLATES[0]

  const customObj = typeof dilemmaHintOrPayload === 'object' && dilemmaHintOrPayload !== null ? dilemmaHintOrPayload : null
  const customString = typeof dilemmaHintOrPayload === 'string' ? dilemmaHintOrPayload : undefined

  const finalTitle = customObj?.title || availableTemplate.title
  const finalDilemma = customObj?.dilemma || customString || availableTemplate.dilemma
  const finalOptions = customObj?.options && customObj.options.length > 0 ? customObj.options : availableTemplate.options

  const newId = `decision-${Date.now()}-${randomUUID().slice(0, 8)}`
  const now = Date.now()

  db.run(
    `INSERT INTO companion_co_decisions (
      id, role_id, title, dilemma, options_json, status, created_at, absorbed_in_script
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 0)`,
    [
      newId,
      roleId,
      finalTitle,
      finalDilemma,
      JSON.stringify(finalOptions),
      now,
    ],
  )

  persist()

  const record: CompanionCoDecisionRecord = {
    id: newId,
    roleId,
    title: finalTitle,
    dilemma: finalDilemma,
    options: finalOptions,
    status: 'pending',
    createdAt: now,
    absorbedInScript: false,
  }

  const eventPayload: CompanionCoDecisionEvent = {
    roleId,
    decision: record,
  }

  await recordCompanionEventAndNotify({
    roleId,
    type: 'co_decision_created',
    sourceType: 'co_decision',
    sourceId: newId,
    idempotencyKey: `co-decision-created:${newId}`,
    occurredAt: now,
    payload: eventPayload as unknown as Record<string, unknown>,
    notification: {
      kind: 'co-decision-created',
      dedupeKey: `co-decision-created:${newId}`,
      payload: eventPayload as unknown as Record<string, unknown>,
    },
  })

  return record
}

/** 获取最近已解决、且尚未被日剧本吸收的关键决策（供日剧本规划吸收） */
export async function getRecentResolvedCoDecision(roleId: string = 'luffy'): Promise<CompanionCoDecisionRecord | null> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  const stmt = db.prepare(`
    SELECT * FROM companion_co_decisions
    WHERE role_id = ? AND status = 'resolved' AND absorbed_in_script = 0
    ORDER BY resolved_at DESC LIMIT 1
  `)
  let row: CoDecisionDbRow | null = null
  try {
    stmt.bind([roleId])
    if (stmt.step()) {
      row = stmt.getAsObject() as unknown as CoDecisionDbRow
    }
  } finally {
    stmt.free()
  }

  return row ? rowToRecord(row) : null
}

/** 标记该决策已被次日剧本吸收 */
export async function markCoDecisionAbsorbed(decisionId: string): Promise<void> {
  await ensureCoDecisionTable()
  const db = await getDatabase()
  db.run(
    `UPDATE companion_co_decisions
     SET absorbed_in_script = 1
     WHERE id = ?`,
    [decisionId],
  )
  persist()
}
