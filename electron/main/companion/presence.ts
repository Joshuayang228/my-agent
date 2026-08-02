/**
 * 主动在场文案（W6 Surfaces）
 *
 * 背景：空会话欢迎屏与冷启动需要跟活跃主角绑定，而不是通用「构建什么」。
 * 意图：纯函数生成欢迎标题/副文案/快捷入口文案。
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
