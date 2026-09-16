import { createHash } from 'node:crypto'
import { createLogger, hashForLog } from '../utils/logger'
import { loadAllSkills } from './loader'
import { loadDisabledSkills, saveDisabledSkills } from '../storage/skill-state-store'
import { ToolRegistry } from '../tools/registry'
import type { SkillActivationTrace, SkillDefinition, ToolDefinition } from '../../../src/shared/types'

const log = createLogger('SkillRegistry')

let loadedSkills: SkillDefinition[] = []
let activeSkill: SkillDefinition | null = null
let disabledSkills = new Set<string>()
let mutationQueue: Promise<unknown> = Promise.resolve()

export function isSkillEnabled(name: string): boolean {
  return !disabledSkills.has(name)
}

/** 同一主进程的启停、重载与文件变更串行，失败仅释放队列，不伪装成功。 */
export function withSkillMutation<T>(action: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(action)
  mutationQueue = result.then(() => undefined, () => undefined)
  return result
}

export function setSkillEnabled(toolRegistry: ToolRegistry, name: string, enabled: boolean): Promise<void> {
  return withSkillMutation(async () => {
    const skill = loadedSkills.find((item) => item.meta.name === name)
    if (!skill || typeof enabled !== 'boolean') throw new Error('Skill 不存在或启停参数无效。')
    if (isSkillEnabled(name) === enabled) return
    if (enabled && !skill.meta.disable_model_invocation && toolRegistry.has(getSkillToolName(skill))) throw new Error('Skill 工具名称冲突，无法启用。')
    const next = new Set(disabledSkills)
    if (enabled) next.delete(name)
    else next.add(name)
    await saveDisabledSkills(next)
    disabledSkills = next
    if (enabled && !skill.meta.disable_model_invocation) toolRegistry.register(createSkillActivationTool(skill, () => isSkillEnabled(name) && loadedSkills.includes(skill)))
    else if (!skill.meta.disable_model_invocation) toolRegistry.unregister(getSkillToolName(skill))
    if (!enabled && activeSkill?.meta.name === name) activeSkill = null
  })
}

export function getLoadedSkills(): SkillDefinition[] {
  return loadedSkills
}

export function getActiveSkill(): SkillDefinition | null {
  return activeSkill
}

export function clearActiveSkill(): void {
  activeSkill = null
}

export function getSkillActivationTrace(skill: SkillDefinition, reason?: string, activatedAt = Date.now()): SkillActivationTrace {
  return {
    name: skill.meta.name,
    toolName: getSkillToolName(skill),
    source: skill.source,
    version: skill.meta.version || 'unversioned',
    fingerprint: createHash('sha256').update(skill.body).digest('hex').slice(0, 16),
    ...(reason?.trim() ? { reason: reason.trim().slice(0, 240) } : {}),
    activatedAt,
  }
}

export function getActiveSkillTrace(): SkillActivationTrace | null {
  return activeSkill ? getSkillActivationTrace(activeSkill) : null
}

export function getSkillToolName(skill: SkillDefinition): string {
  return `skill_invoke_${skill.meta.name.replace(/[^a-z0-9]/g, '_')}`
}

export function createSkillActivationTool(skill: SkillDefinition, canActivate: () => boolean = () => true): ToolDefinition {
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
    execute: async (args, ctx) => {
      if (!canActivate()) throw new Error('此 Skill 已停用、更新或移除，请重试。')
      activeSkill = skill
      const reason = typeof args.reason === 'string' ? args.reason : undefined
      ctx?.skillActivations?.push(getSkillActivationTrace(skill, reason))
      log.info('Skill activated', { name: skill.meta.name, reasonHash: reason ? hashForLog(reason) : undefined, reasonLength: reason?.length ?? 0 })

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
  await withSkillMutation(() => reloadSkills(toolRegistry))
}

/** 调用方必须持有 withSkillMutation；先完整读取，成功后同步替换工具，失败保持原注册。 */
export async function reloadSkills(toolRegistry: ToolRegistry): Promise<void> {
  const [nextSkills, nextDisabled] = await Promise.all([loadAllSkills(), loadDisabledSkills()])
  const previousNames = new Set(loadedSkills.filter((skill) => !skill.meta.disable_model_invocation && isSkillEnabled(skill.meta.name)).map(getSkillToolName))
  const nextNames = new Set<string>()
  for (const skill of nextSkills) {
    if (skill.meta.disable_model_invocation || nextDisabled.has(skill.meta.name)) continue
    const name = getSkillToolName(skill)
    if (nextNames.has(name) || (toolRegistry.has(name) && !previousNames.has(name))) throw new Error('Skill 工具名称冲突，无法加载。')
    nextNames.add(name)
  }
  for (const name of previousNames) toolRegistry.unregister(name)
  loadedSkills = nextSkills
  disabledSkills = nextDisabled
  activeSkill = null

  for (const skill of loadedSkills) {
    if (skill.meta.disable_model_invocation || !isSkillEnabled(skill.meta.name)) continue

    const tool = createSkillActivationTool(skill, () => isSkillEnabled(skill.meta.name) && loadedSkills.includes(skill))
    toolRegistry.register(tool)
    log.info('Skill tool registered', { name: skill.meta.name, tool: tool.name })
  }

  log.info('Skill system initialized', {
    total: loadedSkills.length,
    autoInvocable: loadedSkills.filter(s => !s.meta.disable_model_invocation && isSkillEnabled(s.meta.name)).length,
  })
}

export function buildSkillSummary(skills: SkillDefinition[]): string {
  if (skills.length === 0) return ''

  const lines = ['## 可用 Skill 列表', '']
  for (const skill of skills) {
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

export function buildSkillSummaryForPrompt(): string {
  return buildSkillSummary(loadedSkills.filter((skill) => isSkillEnabled(skill.meta.name)))
}
