/**
 * Debug IPC — 暴露 Agent 内部状态给 DevPanel
 *
 * 遵循架构分层：ipc/ → agent/, tools/, storage/, memory/, mcp/
 */
import { ipcMain } from 'electron'
import { ToolRegistry } from '../tools/registry'
import { buildSystemPrompt, BUILTIN_PERSONAS, type PromptContext } from '../agent/prompt-builder'
import { getAllSettings } from '../storage/settings-store'
import { buildUserProfile } from '../storage/memory-store'
import { mcpManager } from '../mcp/client'
import { createLogger } from '../utils/logger'
import { getRecentSpans, getCallerStats, getStartupMarks, getSpanTypeStats } from '../utils/tracer'
import { getDailyUsage } from '../agent/token-budget'
import { app } from 'electron'

const log = createLogger('DebugIPC')

export function registerDebugIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('debug:system-prompt', async () => {
    try {
      const settings = await getAllSettings()
      const persona = BUILTIN_PERSONAS.find(p => p.id === settings.personaId) || BUILTIN_PERSONAS[0]
      const toolNames = toolRegistry.getAll().map(t => t.name)

      let userProfile: PromptContext['userProfile'] | undefined
      try {
        const profile = await buildUserProfile()
        if (profile) userProfile = profile
      } catch { /* memory not available */ }

      const customPrompt = settings.systemPrompt || undefined
      const prompt = buildSystemPrompt({
        persona,
        toolNames,
        userProfile,
        sessionInfo: customPrompt,
      })

      return {
        full: prompt,
        layers: {
          l1: `[PROTECTED]\n${persona.protected}\n[/PROTECTED]\n\n[MUTABLE]\n${persona.mutable}\n[/MUTABLE]`,
          l2: `Tools: ${toolNames.join(', ')}`,
          l3: userProfile
            ? `Identity: ${userProfile.identity.slice(0, 100) || '(none)'}\nWorkflow: ${userProfile.workflow.slice(0, 100) || '(none)'}\nVoice: ${userProfile.voice.slice(0, 100) || '(none)'}${customPrompt ? `\nCustom: ${customPrompt.slice(0, 100)}` : ''}`
            : customPrompt ? `Custom: ${customPrompt.slice(0, 200)}` : '(empty)',
          l4: `Time: ${new Date().toLocaleString('zh-CN')}`,
        },
        persona: { id: persona.id, name: persona.name },
        charCount: prompt.length,
        estimatedTokens: Math.ceil(prompt.length / 3.5),
      }
    } catch (err) {
      log.error('Failed to build debug prompt', { error: String(err) })
      return { full: '(error)', layers: {}, persona: {}, charCount: 0, estimatedTokens: 0 }
    }
  })

  ipcMain.handle('debug:tools', () => {
    const tools = toolRegistry.getAll()
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      metadata: t.metadata,
    }))
  })

  ipcMain.handle('debug:system-info', async () => {
    const settings = await getAllSettings()
    const mcpStatuses = mcpManager.getStatus()

    return {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
      uptime: Math.round(process.uptime()),
      memoryUsage: process.memoryUsage(),
      settings: {
        model: settings.llmModel,
        baseUrl: settings.llmBaseUrl,
        personaId: settings.personaId,
        hasApiKey: !!settings.llmApiKey,
        hasCustomPrompt: !!settings.systemPrompt,
      },
      mcp: mcpStatuses.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        toolCount: s.toolCount,
        error: s.error,
      })),
      toolCount: toolRegistry.getAll().length,
    }
  })

  ipcMain.handle('debug:traces', () => {
    return {
      spans: getRecentSpans(100),
      callerStats: getCallerStats(),
      dailyTokenUsage: getDailyUsage(),
    }
  })

  log.info('Debug IPC registered')
}
