import { ToolRegistry } from '../tools/registry'
import { registerSessionIPC } from './session'
import { registerSettingsIPC } from './settings'
import { registerMemoryIPC } from './memory'
import { registerPersonaIPC } from './persona'
import { registerChatIPC } from './chat'
import { registerMcpIPC } from './mcp'

export function registerAllIPC(toolRegistry: ToolRegistry): void {
  registerSessionIPC()
  registerSettingsIPC()
  registerMemoryIPC()
  registerPersonaIPC()
  registerChatIPC(toolRegistry)
  registerMcpIPC(toolRegistry)
}
