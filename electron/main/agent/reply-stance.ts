/**
 * 本轮回复立场轻量分类（M27-G1）
 *
 * 背景：问/做/安慰/推回已是产品默认表，但未进 Prompt，模型易无脑顺从或无脑热情。
 * 意图：对用户最后一条消息做启发式分类，产出短策略提示注入 Assemble。
 * 约束：不调用 LLM；不硬拦 Agent Loop；误分时 hint 偏保守（危险→先问）。
 */

export type ReplyStance = 'ask' | 'act' | 'comfort' | 'pushback' | 'balanced'

export interface ReplyStanceResult {
  primary: ReplyStance
  /** 命中的信号标签（可观测 / 单测） */
  signals: string[]
  /** 注入 Prompt 的短指导（中文） */
  guidance: string
}

const RE_PUSHBACK =
  /绕过(权限|安全|沙箱)|忽略(安全|权限)|帮我黑|盗号|泄露.*(密钥|token|密码)|越权|伪造身份|假装成(?!.*测试)|破解别人/i

const RE_DANGER =
  /\brm\s+-rf\b|force\s*push|删除(全部|所有|生产)|drop\s+table|格式化|清空(仓库|数据库)|生产环境.*(删|清)|不可逆/i

const RE_EMOTION =
  /好累|崩溃|难受|焦虑|沮丧|想哭|撑不住|绝望|孤独|没意思|心情不好|压力好大|受不了|心好乱/i

const RE_CLEAR_ACT =
  /直接(改|做|执行)|马上(改|做|执行)|别问了|赶紧|执行吧|帮我改好|就这么办|just\s+do|go\s+ahead|不用确认/i

const RE_UNCLEAR =
  /怎么办|咋整|你看着办|随便吧|不知道怎么|帮我想想|somehow|not\s+sure|看一下呢/i

const GUIDANCE: Record<ReplyStance, string> = {
  ask:
    '目标或风险不清：先用主角语气问清关键参数/范围，或给出 plan；高风险操作不要猜完就执行。',
  act:
    '目标相对清楚且催办信号强：直接推进可执行步骤；少客套确认；aside 可省略。',
  comfort:
    '情绪信号明显：先短接住感受，再问要不要继续办事；主答仍给一个轻量下一步，别只灌鸡汤。',
  pushback:
    '请求可能违规/越权/崩人设：用主角语气拒绝并说明边界，给安全替代路径；边界写在主答，aside 可不服气但不可泄密。',
  balanced:
    '无明显偏向：按人设自然回应；需要工具时先判断风险；aside 仍可选且勿每轮都有。',
}

/**
 * 轻量分类用户文本 → 本轮立场。
 * 优先级：推回 > 危险偏问 > 情绪安慰 > 催办即做 > 不清则问 > 均衡。
 */
export function detectReplyStance(
  userText: string,
  opts?: { executionMode?: string },
): ReplyStanceResult {
  const text = (userText || '').trim()
  const signals: string[] = []
  if (!text) {
    return { primary: 'balanced', signals: ['empty'], guidance: GUIDANCE.balanced }
  }

  if (RE_PUSHBACK.test(text)) {
    signals.push('policy-risk')
    return pack('pushback', signals)
  }

  const dangerous = RE_DANGER.test(text)
  const emotion = RE_EMOTION.test(text)
  const clearAct = RE_CLEAR_ACT.test(text)
  const unclear = RE_UNCLEAR.test(text)

  if (dangerous) signals.push('dangerous-op')
  if (emotion) signals.push('emotion')
  if (clearAct) signals.push('clear-act')
  if (unclear) signals.push('unclear')
  if (opts?.executionMode === 'plan-first') signals.push('plan-first')
  if (opts?.executionMode === 'confirm-all') signals.push('confirm-all')

  // plan-first / 危险：偏向先问（即使用户催办）
  if (dangerous && !clearAct) {
    return pack('ask', signals)
  }
  if (dangerous && clearAct) {
    // 又急又危险：短接 + 挡操作 → 以 ask 承载「先确认」
    signals.push('urgent-danger')
    return pack('ask', [...signals, 'comfort-soft'])
  }

  if (emotion && !clearAct) {
    return pack('comfort', signals)
  }
  if (emotion && clearAct) {
    // 又急又崩：安慰优先，但仍提示可办事
    return pack('comfort', [...signals, 'then-act'])
  }

  if (opts?.executionMode === 'plan-first' && !clearAct) {
    return pack('ask', signals)
  }

  if (clearAct && !unclear) {
    return pack('act', signals)
  }
  if (unclear) {
    return pack('ask', signals)
  }

  return pack('balanced', signals.length ? signals : ['default'])
}

function pack(primary: ReplyStance, signals: string[]): ReplyStanceResult {
  return { primary, signals, guidance: GUIDANCE[primary] }
}

/** 拼进 System Prompt 的短块；空文本不注入 */
export function formatReplyStanceForPrompt(result: ReplyStanceResult): string {
  if (result.signals.includes('empty')) return ''
  const signalLine = result.signals.length
    ? `Signals: ${result.signals.join(', ')}`
    : ''
  return [
    `Suggested stance: ${result.primary}`,
    signalLine,
    `Guidance: ${result.guidance}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export const __test = {
  RE_PUSHBACK,
  RE_DANGER,
  RE_EMOTION,
  RE_CLEAR_ACT,
  RE_UNCLEAR,
  GUIDANCE,
}
