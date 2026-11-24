/**
 * 主动在场冷启动文案（W6）+ 换角再认识（M28-G3）
 *
 * 纯函数：主进程与渲染进程共用，避免欢迎屏与 presence.ts 各写一份。
 */

export interface ColdStartCopy {
  title: string
  subtitle: string
}

export function buildTimeOfDayGreeting(hour = new Date().getHours()): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 5 && h < 9) return '早上好啊'
  if (h >= 9 && h < 12) return '上午好啊'
  if (h >= 12 && h < 14) return '中午好啊'
  if (h >= 14 && h < 18) return '下午好啊'
  if (h >= 18 && h < 23) return '晚上好啊'
  return '夜深了'
}

export function buildTimeOfDaySubtitle(hour = new Date().getHours()): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  if (h >= 5 && h < 9) return '新的一天，想先从哪件事开始？'
  if (h >= 9 && h < 12) return '今天想一起做点什么？'
  if (h >= 12 && h < 14) return '吃过饭了吗？下午打算忙点啥？'
  if (h >= 14 && h < 18) return '歇口气，有什么想聊的随时说。'
  if (h >= 18 && h < 23) return '忙了一天，今晚想聊点啥？'
  return '还没歇着呀，陪你待一会儿。'
}

export function buildColdStartCopy(role: {
  name: string
  description: string
  /** 首次冷启宣言仍保留人物口号；日常回头开聊改走温暖时段双行问候 */
  quote?: string
  firstContact?: { openingLine: string; quote?: string }
  hour?: number
}): ColdStartCopy {
  const name = role.name?.trim() || '伙伴'
  const description = role.description?.trim() || '你的数字伙伴'
  const openingLine = role.firstContact?.openingLine?.trim()
  if (openingLine) {
    return {
      title: openingLine,
      subtitle: `${name} · ${description}`,
    }
  }
  return {
    title: buildTimeOfDayGreeting(role.hour),
    subtitle: buildTimeOfDaySubtitle(role.hour),
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
