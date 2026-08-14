import type { SkillDefinition, ToolDefinition } from '../../src/shared/types'
import type { MockTurn } from '../types'

export interface SkillEvalCase {
  id: string
  description: string
  skill: SkillDefinition
  userPrompt: string
  expectedActivation: boolean
  allowedTools: string[]
  supportTools?: ToolDefinition[]
  requiredResponseIncludes?: string[]
  forbiddenResponseIncludes?: string[]
  mockResponses: MockTurn[]
}
