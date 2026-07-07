import type { ToolDefinition } from '../../../../src/shared/types'
import { getCurrentTimeTool } from './get-current-time'
import { webSearchTool } from './web-search'
import { fileReadTool } from './file-read'
import { fileWriteTool } from './file-write'
import { fileEditTool } from './file-edit'
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

export const builtinTools: ToolDefinition[] = [
  getCurrentTimeTool,
  webSearchTool,
  urlFetchTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  applyPatchTool,
  shellExecTool,
  codeSearchTool,
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitCommitTool,
  gitBranchTool,
  rememberTool,
  recallTool,
  forgetTool,
  taskPlanTool,
  delegateTaskTool,
  continueTaskTool,
  ragSearchTool,
]
