import { createLogger } from '../utils/logger'
import { loadAllSkills } from './loader'
import { ToolRegistry } from '../tools/registry'
import type { SkillDefinition, ToolDefinition } from '../../../src/shared/types'

const log = createLogger('SkillRegistry')

let loadedSkills: SkillDefinition[] = []
let activeSkill: SkillDefinition | null = null

export function getLoadedSkills(): SkillDefinition[] {
  return loadedSkills
}

export function getActiveSkill(): SkillDefinition | null {
  return activeSkill
}

export function clearActiveSkill(): void {
  activeSkill = null
}


export function getSkillToolName(skill: SkillDefinition): string {
  return `skill_invoke_${skill.meta.name.replace(/[^a-z0-9]/g, '_')}`
}

function buildSkillTool(skill: SkillDefinition): ToolDefinition {
  const toolName = getSkillToolName(skill)
  return {
    name: toolName,
    description: `激活 Skill: ${skill.meta.description}. 调用此工具后，Skill 的操作指南将注入上下文，指导你完成任务。`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: '简要说明为什么激活这个 Skill',
        },
      },
      required: [],
    },
    metadata: {
      isReadOnly: true,
      isDestructive: false,
      isConcurrencySafe: true,
    },
    execute: async (args) => {
      activeSkill = skill
      log.info('Skill activated', { name: skill.meta.name, reason: args.reason })

      return [
        `✅ Skill「${skill.meta.name}」已激活。`,
        '',
        '以下是该 Skill 的操作指南，请严格遵循：',
        '',
        '---',
        skill.body,
        '---',
        '',
        skill.meta.allowed_tools
          ? `⚠️ 本 Skill 限定使用以下工具：${skill.meta.allowed_tools.join(', ')}`
          : '',
      ].filter(Boolean).join('\n')
    },
  }
}

export async function initSkillSystem(toolRegistry: ToolRegistry): Promise<void> {
  loadedSkills = await loadAllSkills()

  for (const skill of loadedSkills) {
    if (skill.meta.disable_model_invocation) continue

    const tool = buildSkillTool(skill)
    toolRegistry.register(tool)
    log.info('Skill tool registered', { name: skill.meta.name, tool: tool.name })
  }

  log.info('Skill system initialized', {
    total: loadedSkills.length,
    autoInvocable: loadedSkills.filter(s => !s.meta.disable_model_invocation).length,
  })
}

export async function reloadSkills(toolRegistry: ToolRegistry): Promise<void> {
  for (const skill of loadedSkills) {
    if (!skill.meta.disable_model_invocation) {
      const toolName = getSkillToolName(skill)
      toolRegistry.unregister(toolName)
    }
  }

  await initSkillSystem(toolRegistry)
}

export function buildSkillSummaryForPrompt(): string {
  if (loadedSkills.length === 0) return ''

  const lines = ['## 可用 Skill 列表', '']
  for (const skill of loadedSkills) {
    const invocation = skill.meta.disable_model_invocation
      ? '(仅手动调用)'
      : `调用工具 ${getSkillToolName(skill)}`

    lines.push(`- **${skill.meta.name}**：${skill.meta.description}`)
    if (skill.meta.when_to_use) {
      lines.push(`  触发时机：${skill.meta.when_to_use.replace(/\n/g, ' ')}`)
    }
    lines.push(`  ${invocation}`)
    lines.push('')
  }

  lines.push('当用户的请求匹配某个 Skill 的触发条件时，请调用对应的 skill_invoke 工具来激活它，然后严格按照 Skill 指南执行。')
  return lines.join('\n')
}
