/**
 * 人格化错误承接（WISH-016）
 *
 * 背景：主会话发生断网、限流、超时、权限拒绝或未配置模型时，直接向聊天流渲染裸 `⚠️ message`
 * 会瞬间打破伙伴陪伴感；但若完全吞掉真实错误原因，又会让用户无法排查配置或权限问题。
 * 设计意图：按 AgentErrorCode 将冷冰冰的系统报错映射为「当前伙伴的一句自然第一人称承接 + 真实原因引用块」，
 * 既保护关系体验，又完整保留原始脱敏错误文案与可执行下一步提示。
 * 关键约束：纯前端/共享映射，绝不掩盖或篡改原始错误原因；支持 `luffy` 等角色语气覆写并内置通用伙伴兜底，
 * 不在平台层写死单一角色才能工作；Debug 事件流继续保留原始未包装的 `ev.message`。
 */

export interface CompanionErrorPresentation {
  /** 渲染到聊天助手气泡中的 Markdown 正文（伙伴承接语 + 真实错误引用） */
  displayMarkdown: string
  /** 可选的输入区轻量提醒条文案 */
  noticeText?: string
  /** 是否使用了人格化承接 */
  isPersonaVoiced: boolean
}

interface ErrorVoiceTemplate {
  lead: string
  notice?: string
  /** 为 true 时不附带技术报错引用块（如用户主动中断） */
  suppressDetail?: boolean
}

const GENERIC_VOICE: Record<string, ErrorVoiceTemplate> = {
  CONFIG_MISSING_API_KEY: {
    lead: '我这边还没连上能用的模型，先去设置里帮我配一下连接，配好我就立刻回应你。',
    notice: '尚未配置可用模型连接，可在设置 → 模型连接中完成配置。',
  },
  SESSION_BUSY: {
    lead: '别急，我上一句还在处理里呢，等这一轮走完或先点停止，我们再接着说。',
  },
  BUDGET_EXCEEDED: {
    lead: '今天的对话额度刚好用完了，我们可以先歇一会儿，或者去设置里调一下额度上限再继续。',
    notice: '已达到当前 Token 预算上限，可在设置中调整预算。',
  },
  CONTEXT_TOO_LONG: {
    lead: '咱们这一轮聊得太长、装不下了，新开一个对话吧，重要的事我都还记得。',
    notice: '当前会话上下文超限，建议新建对话继续。',
  },
  MAX_TURNS_REACHED: {
    lead: '这一步绕得有点深，我先停下来喘口气，免得一直打转——你告诉我接下来想先看哪一块。',
  },
  ABORTED: {
    lead: '好，我先停在这儿，你随时叫我继续。',
    suppressDetail: true,
  },
  LLM_RATE_LIMITED: {
    lead: '对面通道现在有点堵车，稍微等几秒再发一次试试？',
    notice: '请求触发限流，稍后重试即可。',
  },
  LLM_REQUEST_FAILED: {
    lead: '刚才信号忽然断了一下，我没能把回复发出来，你再试一次或者看看网络和模型连接？',
    notice: '请求暂时失败，可以稍后重试。',
  },
  TOOL_TIMEOUT: {
    lead: '刚才那个操作等太久没回音，我先停下来了，免得一直卡着你。',
    notice: '工具执行超时，可以稍后重试或缩小操作范围。',
  },
  TOOL_EXECUTION_FAILED: {
    lead: '刚才动手试了一下但没跑通，具体卡在哪儿我写在下面了，我们看看要不要换个法子。',
  },
  PERMISSION_DENIED: {
    lead: '这一步被权限拦住了，我没敢直接往下动——你觉得安全的话可以在下面调一下审批模式，或者我们换个更稳的办法。',
    notice: '操作被权限策略拒绝。可以在输入区切换审批模式，或让伙伴尝试更安全的替代方案。',
  },
  UNKNOWN: {
    lead: '刚才出了点小状况，没能顺利接上你的话，具体情况我放在下面了。',
  },
}

const LUFFY_VOICE: Partial<Record<string, ErrorVoiceTemplate>> = {
  CONFIG_MISSING_API_KEY: {
    lead: '喂！电话虫还没接通呢，先去设置里把模型连接配好，我马上就来找你！',
    notice: '尚未配置可用模型连接，可在设置 → 模型连接中完成配置。',
  },
  SESSION_BUSY: {
    lead: '等等等等，我上一句还没说完呢！等这下跑完或者先点停，咱们马上接着聊。',
  },
  BUDGET_EXCEEDED: {
    lead: '唔，今天的对话额度用光啦！先歇会儿，或者去设置里把额度放宽点再来找我。',
    notice: '已达到当前 Token 预算上限，可在设置中调整预算。',
  },
  CONTEXT_TOO_LONG: {
    lead: '哈哈，咱们这回聊得太长、塞不下啦！新开个对话继续吧，记住的事不会丢的。',
    notice: '当前会话上下文超限，建议新建对话继续。',
  },
  MAX_TURNS_REACHED: {
    lead: '这一步折腾了好几轮还没到头，我先刹个车，免得越绕越远——你指个方向，咱们换招试！',
  },
  ABORTED: {
    lead: '好嘞，先停在这儿！有事随时喊我。',
    suppressDetail: true,
  },
  LLM_RATE_LIMITED: {
    lead: '风浪太大信号挤住了，歇两秒再喊我一声试试！',
    notice: '请求触发限流，稍后重试即可。',
  },
  LLM_REQUEST_FAILED: {
    lead: '咦，刚才电话虫突然断线了，话没传过去——你再发一次，或者检查下网络和模型连接？',
    notice: '请求暂时失败，可以稍后重试。',
  },
  TOOL_TIMEOUT: {
    lead: '刚才那一下等太久没动静，我先收手了，别干耗着！',
    notice: '工具执行超时，可以稍后重试或缩小操作范围。',
  },
  TOOL_EXECUTION_FAILED: {
    lead: '刚才试着动手弄了一下，结果没跑通——卡在哪儿我写下面了，咱们换个法子？',
  },
  PERMISSION_DENIED: {
    lead: '这一步被权限挡在门外了，我没硬闯——你放心的话就在下面调下审批模式，或者咱们换个稳妥点的路子。',
    notice: '操作被权限策略拒绝。可以在输入区切换审批模式，或让伙伴尝试更安全的替代方案。',
  },
  UNKNOWN: {
    lead: '哎呀，刚才出了点岔子没接上你的话，具体情况我记在下面了。',
  },
}

const ROLE_VOICES: Record<string, Partial<Record<string, ErrorVoiceTemplate>>> = {
  luffy: LUFFY_VOICE,
}

/**
 * 将 Agent 错误事件格式化为伙伴承接文案 + 真实错误原因引用。
 */
export function formatCompanionErrorBubble(params: {
  code?: string
  message: string
  roleId?: string
}): CompanionErrorPresentation {
  const codeKey = (params.code || 'UNKNOWN').trim().toUpperCase()
  const roleKey = (params.roleId || '').trim().toLowerCase()
  const roleMap = ROLE_VOICES[roleKey]
  const template = roleMap?.[codeKey] ?? GENERIC_VOICE[codeKey] ?? GENERIC_VOICE.UNKNOWN
  const cleanMessage = params.message.trim()

  if (template.suppressDetail || !cleanMessage) {
    return {
      displayMarkdown: template.lead,
      noticeText: template.notice,
      isPersonaVoiced: true,
    }
  }

  return {
    displayMarkdown: `${template.lead}\n\n> ⚠️ ${cleanMessage}`,
    noticeText: template.notice,
    isPersonaVoiced: true,
  }
}
