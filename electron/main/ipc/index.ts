import { ToolRegistry } from '../tools/registry'
import { registerSessionIPC } from './session'
import { registerSettingsIPC } from './settings'
import { registerMemoryIPC } from './memory'
import { registerCompanionIPC } from './companion'
import { registerChatIPC } from './chat'
import { registerMcpIPC } from './mcp'
import { registerDebugIPC } from './debug'
import { registerDataExportIPC } from './data-export'
import { registerSkillsIPC } from './skills'
import { registerSchedulerIPC } from './scheduler'
import { registerRagIPC } from './rag'
import { registerProjectIPC } from './project'
import { registerTasksIPC } from './tasks'
import { registerSessionChangesIPC } from './session-changes'
import { registerTerminalIPC } from './terminal'

export function registerAllIPC(toolRegistry: ToolRegistry): void {
  registerSessionIPC()
  registerSettingsIPC()
  registerMemoryIPC()
  registerCompanionIPC()
  registerChatIPC(toolRegistry)
  registerMcpIPC(toolRegistry)
  registerDebugIPC(toolRegistry)
  registerDataExportIPC()
  registerSkillsIPC(toolRegistry)
  registerSchedulerIPC()
  registerRagIPC()
  registerProjectIPC()
  registerTasksIPC()
  registerSessionChangesIPC()
  registerTerminalIPC()
}
