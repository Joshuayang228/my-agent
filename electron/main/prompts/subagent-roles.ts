/** 子任务生产角色定义；执行器与提示词编译共享纯事实源。 */
export interface AgentRole {
  labelZh: string
  descriptionZh: string
  systemPromptAddon: string
  defaultAllowedTools: string[]
  defaultReadOnly: boolean
}

export const AGENT_ROLES: Record<string, AgentRole> = {
  researcher: {
    labelZh: '研究专家',
    descriptionZh: '收集、核对并综合信息，只读返回证据。',
    systemPromptAddon: '你是研究专家。请全面收集并综合信息，使用文件路径、行号、来源等具体证据报告发现。不要修改任何内容。',
    defaultAllowedTools: ['file_read', 'code_search', 'web_search', 'url_fetch', 'rag_search'],
    defaultReadOnly: true,
  },
  coder: {
    labelZh: '编码专家',
    descriptionZh: '执行精准代码修改，验证编译与测试结果。',
    systemPromptAddon: '你是编码专家。请做精准、正确的修改，修复根因而不是表面症状。报告完成前，验证修改能够通过编译和测试。',
    defaultAllowedTools: ['file_read', 'file_edit', 'file_write', 'apply_patch', 'code_search', 'shell_exec'],
    defaultReadOnly: false,
  },
  analyst: {
    labelZh: '分析专家',
    descriptionZh: '分析结构、模式和证据，只读返回结论。',
    systemPromptAddon: '你是数据与代码分析专家。请分析结构与模式，基于证据得出结论。不要修改任何内容。',
    defaultAllowedTools: ['file_read', 'code_search', 'rag_search'],
    defaultReadOnly: true,
  },
}
