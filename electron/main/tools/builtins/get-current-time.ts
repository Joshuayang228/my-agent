import { buildTool } from '../builder'

export const getCurrentTimeTool = buildTool({
  name: 'get_current_time',
  description: "获取当前日期和时间。用户询问当前时间、日期，或任务需要准确当前时间时使用。",
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: "IANA 时区名称，例如 Asia/Shanghai 或 America/New_York；省略时使用系统时区。",
      },
    },
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args) => {
    const timezone = (args.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone
    try {
      const now = new Date()
      const formatted = now.toLocaleString('zh-CN', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        weekday: 'long', hour12: false,
      })
      return `当前时间（${timezone}）： ${formatted}`
    } catch {
      return `错误：无效时区 "${timezone}"`
    }
  },
})
