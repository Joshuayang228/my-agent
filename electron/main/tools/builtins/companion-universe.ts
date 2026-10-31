import { buildTool } from '../builder'
import { listAvailableUniverseIds, requestUniverseSwitch } from '../../companion/orchestrator'

export const companionUniverseTool = buildTool({
  name: 'companion_switch_universe',
  description: '查看或切换当前人物世界观套装。切换会绑定目标世界的默认主角、暂停当前人物生活并刷新后续上下文；切换前需要用户确认。',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'switch'] },
      universeId: { type: 'string', description: '要切换到的世界观 ID。' },
    },
    required: ['action'],
  },
  metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: false },
  resolveMetadata: (args) => ({ isReadOnly: args.action === 'list', isDestructive: args.action === 'switch' }),
  execute: async (args) => {
    if (args.action === 'list') return `可用世界观：${listAvailableUniverseIds().join('、') || '暂无'}。`
    if (args.action !== 'switch' || typeof args.universeId !== 'string') return '请提供 switch 操作和 universeId。'
    const result = await requestUniverseSwitch(args.universeId)
    if (!result.ok) {
      const messages = { UNKNOWN_UNIVERSE: '世界观不存在或默认主角无效。', SESSION_ACTIVE: '当前会话正在生成，暂时不能切换世界观。', ALREADY_ACTIVE: '当前已经在这个世界观中。', INVALID_UNIVERSE: '世界观标识格式无效。' } as const
      return messages[result.code]
    }
    return `已切换到世界观「${result.universeId}」，当前主角是${result.name}。`
  },
})
