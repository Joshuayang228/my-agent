/**
 * 主动在场冷启动文案（W6）
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
