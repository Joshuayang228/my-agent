import { buildTool } from '../builder'

export const getCurrentTimeTool = buildTool({
  name: 'get_current_time',
  description: 'Get the current date and time. Use this when the user asks about current time, date, or when you need to know the current time for any task.',
  parameters: {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'IANA timezone name (e.g. "Asia/Shanghai", "America/New_York"). Defaults to system timezone if not specified.',
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
      return `Current time (${timezone}): ${formatted}`
    } catch {
      return `Error: Invalid timezone "${timezone}"`
    }
  },
})
