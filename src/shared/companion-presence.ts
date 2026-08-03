/**
 * 主动在场冷启动文案（W6）+ 换角再认识（M28-G3）
 *
 * 纯函数：主进程与渲染进程共用，避免欢迎屏与 presence.ts 各写一份。
 */

export interface ColdStartCopy {
  title: string
  subtitle: string
  hint: string
}

export function buildColdStartCopy(role: {
  name: string
  description: string
}): ColdStartCopy {
  const name = role.name?.trim() || '伙伴'
  const description = role.description?.trim() || '你的数字伙伴'
  return {
    title: `嗨，我是${name}`,
    subtitle: description,
    hint: '聊天、朋友圈和衣柜都跟着当前主角；对话进行中不能换人。',
  }
}

/** 换角「再认识」微文案——新奇感来自换视角，不是教程重开 */
export interface ReacquaintCopy {
  title: string
  body: string
  /** 单行 toast */
  toast: string
}

/**
 * 构建换角后再认识文案。
 * 背景：换角易被误解为「人生重开 / 清零默契」。
 * 约束：文案明示不重置成长；与冷启动欢迎（嗨我是 X）语义分开。
 */
export function buildReacquaintCopy(input: {
  fromName: string
  toName: string
  catchupQueued?: boolean
}): ReacquaintCopy {
  const from = input.fromName?.trim() || '上一位'
  const to = input.toName?.trim() || '伙伴'
  const catchup = Boolean(input.catchupQueued)
  const title = `又见面了——我是${to}`
  const body = catchup
    ? `从${from}这边过来。生活会追赶几天近况，但我们不是重开人生：成长时钟与记忆都还在。`
    : `从${from}这边过来。换个视角继续过日子，不是教程重开——成长与记忆都还在。`
  const toast = catchup
    ? `又见面了：已切到${to}，正在追赶近况（成长未重置）`
    : `又见面了：已切到${to}（换视角，不是重开）`
  return { title, body, toast }
}
