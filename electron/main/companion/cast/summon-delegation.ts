/**
 * 召唤 × M19 委派边界（M26-G2）
 *
 * 背景：用户可能让「串门的朋友」帮忙查/改；卡司是人设包装，子 Agent 是任务编排。
 * 意图：允许召唤父会话调用 delegate_task，但子 Agent 必须是匿名任务工。
 * 约束：不改 active、不 tick/反思对方、不把子 Agent 装成另一个卡司。
 */

/** 注入召唤父会话 Prompt：可以委派，但转述归角色 */
export function summonParentDelegationHint(): string {
  return (
    '若用户请你帮忙查资料或改代码，可调用 delegate_task 把技术活交给专职子 Agent；' +
    '子 Agent 是匿名任务工，不是另一个卡司角色，完成后由你用自己的语气转述结果。'
  )
}

/**
 * 注入子 Agent system prompt（仅 sessionKind=summon）。
 * 应用场景：runSubAgent / continue 沿用父 toolContext.sessionKind。
 */
export function summonWorkerSystemAddon(sessionKind?: string): string {
  if (sessionKind !== 'summon') return ''
  return `边界（召唤 × multi-agent / M26）：
- 你是协助召唤伙伴会话的任务工。
- 你不是该伙伴角色；不要模仿其语气，也不要声称拥有其身份。
- 不要编造或推进任何角色的生活世界（动态、衣柜、日程、成长或反思）。
- 不要改变当前活跃主角。
- 只返回结构化任务结果，由父 Agent 以角色身份转述。`
}

/** 是否允许委派：main / summon / 未标记均可（召唤靠 worker addon 守边界） */
export function canDelegateInSession(sessionKind?: string): boolean {
  if (sessionKind == null || sessionKind === '') return true
  return sessionKind === 'main' || sessionKind === 'summon'
}
