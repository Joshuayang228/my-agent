import type { ToolDefinition } from '../../../../src/shared/types'
import { getCurrentTimeTool } from './get-current-time'
import { webSearchTool } from './web-search'
import { fileReadTool } from './file-read'
import { fileWriteTool } from './file-write'
import { fileEditTool } from './file-edit'
import { fileDeleteTool } from './file-delete'
import { applyPatchTool } from './apply-patch'
import { shellExecTool } from './shell-exec'
import { rememberTool, recallTool, forgetTool } from './memory-manage'
import { taskPlanTool } from './task-plan'
import { codeSearchTool } from './code-search'
import { urlFetchTool } from './url-fetch'
import { delegateTaskTool } from './delegate-task'
import { continueTaskTool } from './continue-task'
import { ragSearchTool } from './rag-search'
import { gitStatusTool, gitDiffTool, gitLogTool, gitCommitTool, gitBranchTool } from './git-tools'
import { thinkTool } from './think'

const BUILTIN_TOOL_ENTRIES: Array<{ tool: ToolDefinition; source: string }> = [
  { tool: getCurrentTimeTool, source: 'electron/main/tools/builtins/get-current-time.ts' },
  { tool: webSearchTool, source: 'electron/main/tools/builtins/web-search.ts' },
  { tool: urlFetchTool, source: 'electron/main/tools/builtins/url-fetch.ts' },
  { tool: fileReadTool, source: 'electron/main/tools/builtins/file-read.ts' },
  { tool: fileWriteTool, source: 'electron/main/tools/builtins/file-write.ts' },
  { tool: fileEditTool, source: 'electron/main/tools/builtins/file-edit.ts' },
  { tool: fileDeleteTool, source: 'electron/main/tools/builtins/file-delete.ts' },
  { tool: applyPatchTool, source: 'electron/main/tools/builtins/apply-patch.ts' },
  { tool: shellExecTool, source: 'electron/main/tools/builtins/shell-exec.ts' },
  { tool: codeSearchTool, source: 'electron/main/tools/builtins/code-search.ts' },
  { tool: gitStatusTool, source: 'electron/main/tools/builtins/git-tools.ts' },
  { tool: gitDiffTool, source: 'electron/main/tools/builtins/git-tools.ts' },
  { tool: gitLogTool, source: 'electron/main/tools/builtins/git-tools.ts' },
  { tool: gitCommitTool, source: 'electron/main/tools/builtins/git-tools.ts' },
  { tool: gitBranchTool, source: 'electron/main/tools/builtins/git-tools.ts' },
  { tool: rememberTool, source: 'electron/main/tools/builtins/memory-manage.ts' },
  { tool: recallTool, source: 'electron/main/tools/builtins/memory-manage.ts' },
  { tool: forgetTool, source: 'electron/main/tools/builtins/memory-manage.ts' },
  { tool: taskPlanTool, source: 'electron/main/tools/builtins/task-plan.ts' },
  { tool: delegateTaskTool, source: 'electron/main/tools/builtins/delegate-task.ts' },
  { tool: continueTaskTool, source: 'electron/main/tools/builtins/continue-task.ts' },
  { tool: ragSearchTool, source: 'electron/main/tools/builtins/rag-search.ts' },
  { tool: thinkTool, source: 'electron/main/tools/builtins/think.ts' },
]

export const builtinTools: ToolDefinition[] = BUILTIN_TOOL_ENTRIES.map((entry) => entry.tool)

/**
 * 返回内置工具模型可见 schema 的生产来源。
 *
 * 背景：统一模型上下文目录需要显示 Tool description / parameters 来自哪个实现文件。
 * 设计意图：来源映射与 builtinTools 在同一清单维护，避免 Debug 按工具名猜路径。
 * 关键约束：动态 Skill/MCP 工具不在此表中，由各自运行时来源解析。
 */
export function getBuiltinToolSource(name: string): string | undefined {
  return BUILTIN_TOOL_ENTRIES.find((entry) => entry.tool.name === name)?.source
}
