export const SETTINGS_PAGE_HEADERS = {
  appearance: { title: '外观与界面', description: '调整主题和字体大小。' },
  companion: { title: '伙伴与相处', description: '调整伙伴和你说话、提醒以及回应你的方式。' },
  model: { title: '模型', description: '先安排每种用途，再管理连接和连接下的模型清单。' },
  memory: { title: '记忆', description: '查看和管理会影响未来相处的长期信息。' },
  data: { title: '数据与隐私', description: '管理本地数据的迁移和备份，并明确哪些内容不会跟着备份文件离开设备。' },
  permissions: { title: '权限与自动化', description: '让你决定 Agent 什么时候先问你、什么时候按计划推进；越高风险的能力越应该明确。' },
  skills: { title: 'Skills', description: '管理伙伴可以按需使用的工作方法。' },
  mcp: { title: 'MCP', description: '管理伙伴可以使用的外部服务连接。' },
  about: { title: '关于 My Agent', description: '查看版本、运行环境和本机数据位置。' },
} as const
