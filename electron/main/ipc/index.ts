import { ToolRegistry } from '../tools/registry'
import { registerSessionIPC } from './session'
import { registerSettingsIPC } from './settings'
import { registerMemoryIPC } from './memory'
import { registerPersonaIPC } from './persona'
import { registerChatIPC } from './chat'
import { registerMcpIPC } from './mcp'
import { registerDebugIPC } from './debug'
import { registerDataExportIPC } from './data-export'
import { registerSkillsIPC } from './skills'
import { registerSchedulerIPC } from './scheduler'
import { registerRagIPC } from './rag'
import { registerProjectIPC } from './project'

export function registerAllIPC(toolRegistry: ToolRegistry): void {
  registerSessionIPC()
  registerSettingsIPC()
  registerMemoryIPC()
  registerPersonaIPC()
  registerChatIPC(toolRegistry)
  registerMcpIPC(toolRegistry)
  registerDebugIPC(toolRegistry)
  registerDataExportIPC()
  registerSkillsIPC(toolRegistry)
  registerSchedulerIPC()
  registerRagIPC()
  registerProjectIPC()
}
