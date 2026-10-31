import { buildTool } from '../builder'
import { listCharacterDrafts, publishCharacterDraft, readCharacterDraft, saveCharacterDraft, type CharacterDraftSection } from '../../companion/authoring/draft-store'

const SECTIONS = [
  'identity', 'world', 'relationships', 'appearance', 'behaviors', 'materials',
  'dramaturgy', 'decisionRules', 'continuity', 'firstContact', 'evidence', 'canon', 'externalEvidence',
] as const

export const companionCharacterDraftTool = buildTool({
  name: 'companion_character_draft',
  description: '创建和整理人物体系草稿。草稿只保存到用户数据目录，不能直接发布 Role Pack、切换世界观或修改生产资产。',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'submit_for_review', 'publish', 'read', 'list'] },
      draftId: { type: 'string', description: '已有草稿标识。' },
      universeId: { type: 'string', description: '世界观套装标识。' },
      title: { type: 'string', description: '人物体系草稿标题。' },
      roleId: { type: 'string', description: '人物标识。' },
      roleName: { type: 'string', description: '人物名称。' },
      section: { type: 'string', enum: [...SECTIONS] },
      content: { type: 'string', description: '当前分区材料或已确认设定。' },
    },
    required: ['action'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  resolveMetadata: (args) => ({ isDestructive: args.action === 'publish' }),
  execute: async (args) => {
    const action = typeof args.action === 'string' ? args.action : ''
    if (action === 'list') return JSON.stringify(await listCharacterDrafts())
    if (action === 'read') {
      if (typeof args.draftId !== 'string') return '读取人物草稿需要 draftId。'
      const draft = await readCharacterDraft(args.draftId)
      return draft ? JSON.stringify(draft) : '找不到人物草稿。'
    }
    if (action === 'publish') {
      if (typeof args.draftId !== 'string') return '发布人物草稿需要 draftId。'
      try {
        const result = await publishCharacterDraft(args.draftId)
        return `人物草稿已发布为用户世界观「${result.title}」，世界观 ID：${result.universeId}，主角 ID：${result.roleId}。尚未自动切换当前世界观。`
      } catch (error) {
        return `人物草稿未发布：${error instanceof Error ? error.message : '发布校验失败'}。`
      }
    }
    if (!['create', 'update', 'submit_for_review'].includes(action)) return '人物草稿操作无效。'
    try {
      const draft = await saveCharacterDraft({
        action: action as 'create' | 'update' | 'submit_for_review',
        draftId: typeof args.draftId === 'string' ? args.draftId : undefined,
        universeId: typeof args.universeId === 'string' ? args.universeId : undefined,
        title: typeof args.title === 'string' ? args.title : undefined,
        roleId: typeof args.roleId === 'string' ? args.roleId : undefined,
        roleName: typeof args.roleName === 'string' ? args.roleName : undefined,
        section: typeof args.section === 'string' ? args.section as CharacterDraftSection : undefined,
        content: typeof args.content === 'string' ? args.content : undefined,
      })
      return `人物草稿已保存：${draft.id}，状态：${draft.status}。`
    } catch (error) {
      return `人物草稿未保存：${error instanceof Error ? error.message : '参数无效'}。`
    }
  },
})
