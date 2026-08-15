/**
 * Skill Eval 固定 Grader 定义。
 *
 * 背景：Runner 与生产资产目录都需要同一组 Grader 名称和通用判据。
 * 设计意图：将纯元数据与 Agent Loop Runner 分离，避免 Debug 目录为读取定义而导入执行链。
 * 关键约束：这里只保存稳定定义；每个 Case 的 expectedActivation、allowedTools 等动态判据由 Case 资产补齐。
 */

export const SKILL_EVAL_GRADER_DEFINITIONS = {
  activation: {
    name: 'SkillActivation',
    kind: 'skill-activation',
    source: 'evals/skill/runner.ts',
    criteria: { rule: '实际激活记录必须与 expectedActivation 一致' },
  },
  injection: {
    name: 'SkillInjection',
    kind: 'skill-injection',
    source: 'evals/skill/runner.ts',
    criteria: { rule: '预期激活时必须在激活工具结果中观察到 Skill 指南正文' },
  },
  toolBoundary: {
    name: 'SkillToolBoundary',
    kind: 'skill-tool-boundary',
    source: 'evals/skill/runner.ts',
    criteria: { rule: '除激活工具外的业务工具调用必须属于 allowedTools' },
  },
  response: {
    name: 'SkillResponse',
    kind: 'skill-response',
    source: 'evals/skill/runner.ts',
    criteria: { rule: '回复必须包含 requiredResponseIncludes 且不包含 forbiddenResponseIncludes' },
  },
} as const
