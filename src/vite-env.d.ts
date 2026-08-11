/// <reference types="vite/client" />

import type {
  ChatMessage,
  ChatSession,
  AgentStreamEvent,
  LLMCallDetail,
  LLMCallEvent,
  LLMCallQuery,
  LLMCallQueryResult,
  LLMSubagentSession,
} from './shared/types'

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      session: {
        list: () => Promise<SessionSummary[]>
        create: () => Promise<ChatSession>
        get: (id: string) => Promise<ChatSession | null>
        delete: (id: string) => Promise<void>
        rename: (id: string, title: string) => Promise<void>
        deleteMessage: (messageId: string) => Promise<void>
        fork: (sessionId: string, upToMessageId: string) => Promise<ChatSession>
        tokenUsage: (sessionId: string) => Promise<{ promptTokens: number; completionTokens: number }>
        regenerateTitle: (sessionId: string) => Promise<{ success: boolean; error?: string }>
        listFileChanges: (sessionId: string) => Promise<Array<{
          path: string
          toolName: string
          updatedAt: number
          hasBefore: boolean
          beforeTruncated?: boolean
        }>>
        clearFileChanges: (sessionId: string) => Promise<{ ok: boolean }>
        getFileChangeDiff: (sessionId: string, filePath: string) => Promise<{
          path?: string
          toolName?: string
          updatedAt?: number
          beforeTruncated?: boolean
          diff?: string
          after?: string
          hasBefore?: boolean
          error?: string
        }>
        onFileChange: (callback: (payload: {
          sessionId: string
          change: { path: string; toolName: string; updatedAt: number; hasBefore: boolean; beforeTruncated?: boolean }
        }) => void) => () => void
      }
      rag: {
        list: () => Promise<Array<{ id: string; name: string; filePath: string; chunkCount: number; createdAt: number }>>
        ingest: () => Promise<Array<{ id: string; name: string; filePath: string; chunkCount: number; createdAt: number }>>
        delete: (docId: string) => Promise<void>
      }
      scheduler: {
        list: () => Promise<Array<{ id: string; name: string; prompt: string; cron?: string; intervalMs?: number; enabled: boolean; lastRunAt?: number; nextRunAt?: number; createdAt: number }>>
        create: (opts: { name: string; prompt: string; cron?: string; intervalMs?: number }) => Promise<unknown>
        update: (id: string, updates: Record<string, unknown>) => Promise<void>
        delete: (id: string) => Promise<void>
        onTriggered: (cb: (info: { taskId: string; name: string; prompt: string }) => void) => () => void
      }
      updater: {
        check: () => Promise<{ available: boolean; version?: string }>
        download: () => Promise<void>
        install: () => void
        onAvailable: (cb: (info: { version: string }) => void) => () => void
        onProgress: (cb: (info: { percent: number }) => void) => () => void
        onDownloaded: (cb: (info: { version: string }) => void) => () => void
      }
      settings: {
        get: () => Promise<Record<string, string>>
        set: (key: string, value: string) => Promise<void>
      }
      memory: {
        list: (category?: string) => Promise<Array<{ id: string; category: string; content: string; createdAt: number; updatedAt: number }>>
        add: (category: string, content: string, roleId?: string) => Promise<{ id: string; category: string; content: string; createdAt: number; updatedAt: number; roleId?: string }>
        delete: (id: string) => Promise<void>
        update: (id: string, content: string) => Promise<void>
        correctCitation: (
          id: string,
          replacement?: string,
        ) => Promise<
          | { ok: true; action: 'deleted' | 'updated' | 'replaced'; id: string; newId?: string }
          | { ok: false; error: string }
        >
      }
      companion: {
        listProtagonists: () => Promise<Array<{ id: string; name: string; description: string }>>
        getActive: () => Promise<{ id: string; name: string; description: string; universeId: string }>
        requestSwitch: (roleId: string) => Promise<
          | {
              ok: true
              catchupQueued: boolean
              reacquaint: { title: string; body: string; toast: string }
            }
          | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE' }
        >
        getMutable: (roleId?: string) => Promise<{ roleId: string; body: string }>
        setMutable: (
          roleId: string,
          body: string,
          summary?: string,
        ) => Promise<
          | { ok: true; version: number }
          | { ok: false; error: string; code?: string }
        >
        listMutableVersions: (roleId: string) => Promise<Array<{
          id: string
          roleId: string
          version: number
          body: string
          createdAt: number
          summary: string
        }>>
        rollbackMutable: (
          roleId: string,
          toVersion: number,
        ) => Promise<{ ok: true; version: number } | { ok: false; error: string }>
        getMoments: (opts?: { limit?: number; offset?: number }) => Promise<{
          roleId: string
          items: Array<{
            id: string
            roleId: string
            eventId: string
            publishedAt: number
            text: string
            meta: Record<string, unknown>
          }>
        }>
        catchupStatus: () => Promise<{
          roleId: string
          pausedAt: number | null
          catchupSummary: string
          lastTickAt: number
          presence: string
        }>
        getAssets: (opts?: { kind?: string }) => Promise<{
          roleId: string
          items: Array<{
            id: string
            roleId: string
            kind: string
            name: string
            payload: Record<string, unknown>
            acquiredAt: number
            sourceEventId: string | null
          }>
        }>
        updateAsset: (
          assetId: string,
          patch: { name?: string; payload?: Record<string, unknown> },
        ) => Promise<
          | {
              ok: true
              asset: {
                id: string
                roleId: string
                kind: string
                name: string
                payload: Record<string, unknown>
                acquiredAt: number
                sourceEventId: string | null
              }
            }
          | { ok: false; error: string; code?: string }
        >
        deleteAsset: (
          assetId: string,
        ) => Promise<{ ok: true } | { ok: false; error: string; code?: string }>
        getRoster: () => Promise<{
          roleId: string
          lines: Array<{
            otherId: string
            otherName: string
            relationType: string
            text: string
          }>
          cast: Array<{
            id: string
            name: string
            description: string
            summary: string
            canBeProtagonist: boolean
            summonHint: string
          }>
        }>
        summonBrief: (roleId: string) => Promise<
          | {
              ok: true
              brief: {
                id: string
                name: string
                description: string
                summary: string
                canBeProtagonist: boolean
                summonHint: string
              }
            }
          | { ok: false; error: string }
        >
        checkCastAvailability: (roleId: string) => Promise<
          | {
              available: boolean
              roleId: string
              name: string
              reason?: string
              alternative?: string
              presence?: string
            }
          | { ok: false; error: string }
        >
        startSummon: (
          roleId: string,
          force?: boolean,
        ) => Promise<
          | {
              ok: true
              sessionId: string
              roleId: string
              name: string
              sessionKind: 'main' | 'summon'
              activeRoleId: string
              presence?: string
            }
          | {
              ok: false
              error: string
              reason?: string
              alternative?: string
              presence?: string
            }
        >
        reflectionStatus: (roleId?: string) => Promise<{
          gate: {
            allowed: boolean
            reason: string
            detail?: string
            growthStartedAt: number
            lastRunAt: number
            recentUserMessages: number
          }
          state: {
            roleId: string
            lastRunAt: number
            runs: Array<{ at: number; changed: boolean; summary: string }>
          }
        }>
        runReflection: (
          roleId?: string,
          force?: boolean,
        ) => Promise<{
          skipped: boolean
          reason?: string
          changed: boolean
          summary: string
          version?: number
        }>
        listMilestones: (roleId?: string) => Promise<{
          roleId: string
          kinds: Array<'first_role_switch' | 'first_reflection' | 'first_rapport'>
        }>
        onMilestone: (
          callback: (payload: {
            roleId: string
            kind: 'first_role_switch' | 'first_reflection' | 'first_rapport'
            toast: string
          }) => void,
        ) => () => void
        onMomentTip: (
          callback: (payload: { roleId: string; toast: string; published: number }) => void,
        ) => () => void
        onProactiveGreeting: (
          callback: (payload: { roleId: string; toast: string; momentId: string }) => void,
        ) => () => void
        onRoleChanged: (
          callback: (payload: {
            roleId: string
            catchupQueued: boolean
            previousRoleId: string
            reacquaint?: { title: string; body: string; toast: string }
          }) => void,
        ) => () => void
      }
      mcp: {
        connect: (config: {
          id: string
          name: string
          transport?: 'stdio' | 'sse'
          command: string
          args: string[]
          env?: Record<string, string>
          url?: string
          enabled: boolean
        }) => Promise<{ success: boolean; toolCount?: number; error?: string }>
        disconnect: (serverId: string) => Promise<{ success: boolean }>
        status: () => Promise<Array<{ id: string; name: string; status: string; toolCount: number; resourceCount?: number; error?: string }>>
        listTools: (serverId?: string) => Promise<Array<{ serverId: string; serverName: string; name: string; description: string }>>
        listResources: (serverId?: string) => Promise<Array<{
          serverId: string
          serverName: string
          uri: string
          name: string
          description?: string
          mimeType?: string
        }>>
        readResource: (serverId: string, uri: string) => Promise<{ success: boolean; content?: string; error?: string }>
        onElicitRequest: (callback: (data: {
          requestId: string
          serverId: string
          message: string
          schema: Record<string, unknown>
        }) => void) => () => void
        elicitResponse: (requestId: string, values: Record<string, unknown> | null) => void
      }
      skills: {
        list: () => Promise<Array<{
          name: string
          description: string
          when_to_use: string
          allowed_tools: string[]
          disable_model_invocation: boolean
          version: string
          source: 'builtin' | 'user'
          filePath: string
        }>>
        get: (name: string) => Promise<string | null>
        save: (name: string, content: string) => Promise<{ success: boolean; filePath: string }>
        delete: (name: string) => Promise<{ success: boolean }>
        reload: () => Promise<{ success: boolean; count: number }>
        versions: (name: string) => Promise<number[]>
        rollback: (name: string, version: number) => Promise<{ success: boolean }>
      }
      data: {
        export: () => Promise<{ success: boolean; path?: string; error?: string; stats?: { sessions: number; memories: number } }>
        import: () => Promise<{ success: boolean; error?: string; stats?: { sessions: number; memories: number; settings: number } }>
      }
      terminal: {
        run: (input: { command: string; cwd?: string }) => Promise<
          { ok: true; runId: string } | { ok: false; error: string }
        >
        kill: (runId: string) => Promise<{ ok: boolean }>
        onStdout: (callback: (ev: { runId: string; chunk: string }) => void) => () => void
        onStderr: (callback: (ev: { runId: string; chunk: string }) => void) => () => void
        onExit: (callback: (ev: { runId: string; code: number }) => void) => () => void
      }
      project: {
        browse: () => Promise<{ path: string; name: string } | null>
        list: () => Promise<{ path: string; name: string }[]>
        set: (dirPath: string | null) => Promise<{ success: boolean; error?: string }>
        get: () => Promise<{ path: string; name: string } | null>
        listFiles: (dirPath: string, depth?: number) => Promise<Array<{ name: string; path: string; isDir: boolean; children?: Array<{ name: string; path: string; isDir: boolean; children?: unknown[] }> }>>
        readFile: (filePath: string) => Promise<{
          kind?: 'text' | 'image' | 'unsupported'
          content?: string
          dataUrl?: string
          mimeType?: string
          languageHint?: string
          reason?: string
          size?: number
          error?: string
        }>
        openExternal: (filePath: string) => Promise<{ ok: boolean; error?: string }>
      }
      debug: {
        systemPrompt: () => Promise<{
          full: string
          layers: { l1: string; l2: string; l3: string; l4: string }
          persona: { id: string; name: string }
          charCount: number
          estimatedTokens: number
        }>
        promptAssets: () => Promise<Array<{
          id: string
          name: string
          category: 'system' | 'context' | 'companion' | 'subagent' | 'ui'
          desc: string
          sourcePath: string
          preview?: string
          content?: string
          dynamic?: boolean
        }>>
        tools: () => Promise<Array<{
          name: string
          description: string
          parameters: Record<string, unknown>
          metadata: {
            isReadOnly: boolean
            isDestructive: boolean
            isConcurrencySafe: boolean
            longRunning?: boolean
          }
        }>>
        systemInfo: () => Promise<{
          electron: string
          node: string
          chrome: string
          platform: string
          arch: string
          appVersion: string
          uptime: number
          memoryUsage: { rss: number; heapUsed: number; heapTotal: number }
          settings: {
            model: string
            baseUrl: string
            activeRoleId: string
            hasApiKey: boolean
            hasCustomPrompt: boolean
            sandboxMode: string
            executionMode: string
            conversationDebugMode: boolean
            sessionTokenBudget: number
            dailyTokenBudget: number
          }
          mcp: Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>
          toolCount: number
          permissionRules: {
            total: number
            enabled: number
            items: Array<{
              id: string
              type: string
              pattern: string
              action: string
              enabled: boolean
              description?: string
            }>
            truncated: boolean
          }
          skills: {
            total: number
            items: Array<{ name: string; source: string; description: string }>
            truncated: boolean
          }
        }>
        traces: () => Promise<{
          spans: Array<{
            id: string
            name: string
            type: string
            caller: string
            parentId?: string
            startTime: number
            endTime?: number
            duration?: number
            status: string
            attributes: Record<string, unknown>
            error?: string
          }>
          callerStats: Record<string, {
            count: number
            totalMs: number
            avgMs: number
            totalInputTokens: number
            totalOutputTokens: number
          }>
          tokenLanes?: {
            foreground: { inputTokens: number; outputTokens: number }
            background: { inputTokens: number; outputTokens: number }
          }
          dailyTokenUsage: number
        }>
        llmLogsQuery: (input?: LLMCallQuery) => Promise<LLMCallQueryResult>
        llmLogGet: (id: string) => Promise<LLMCallDetail | null>
        llmLogExport: (id: string) => Promise<{
          ok: boolean
          canceled?: boolean
          filePath?: string
          error?: string
        }>
        llmSubagents: (mainSessionId: string) => Promise<LLMSubagentSession[]>
        llmLogsClear: (sessionId?: string) => Promise<{ ok: boolean }>
        llmLogsExport: (input?: LLMCallQuery) => Promise<{
          ok: boolean
          canceled?: boolean
          filePath?: string
          count?: number
          error?: string
        }>
        onLLMCallEvent: (callback: (event: LLMCallEvent) => void) => () => void
        playgroundRun: (input: {
          systemPrompt?: string
          userPrompt: string
          history?: Array<{ role: 'user' | 'assistant'; content: string }>
        }) => Promise<
          | { ok: true; text: string; ms: number; model: string }
          | { ok: false; error: string }
        >
        toolRun: (input: {
          name: string
          args?: Record<string, unknown>
          confirmRisk?: boolean
        }) => Promise<
          | {
              ok: true
              content: string
              isError?: boolean
              ms: number
              permission: {
                allowed: boolean | 'needs_approval'
                reason: string
                decisionType: string
                matchedRule?: string
                chain: string
              }
            }
          | {
              ok: false
              error: string
              needsConfirmation?: boolean
              permission?: {
                allowed: boolean | 'needs_approval'
                reason: string
                decisionType: string
                matchedRule?: string
                chain: string
              }
            }
        >
        worldSnapshot: () => Promise<{
          role: { id: string; name: string; description: string; universeId: string }
          characterProfile: {
            schemaVersion: 1
            agePresentation: string
            birthday: string
            genderPresentation: string
            pronouns: string
            origin: string
            occupation: string
            background: string[]
            education: string[]
            careerHistory: string[]
            skills: string[]
            dailyRhythm: string[]
            interests: string[]
            dislikes: string[]
            habits: string[]
            flaws: string[]
            socialStyle: string[]
            valuesInPractice: string[]
            lifeAnchors: Array<{ period: string; title: string; summary: string }>
            appearance: {
              overall: string
              hair: string
              eyes: string
              build: string
              clothingStyle: string
              distinguishingFeatures: string[]
            }
            favorites: {
              foods: string[]
              drinks: string[]
              music: string[]
              books: string[]
              activities: string[]
              weather: string[]
              colors: string[]
            }
            selfAwareness: string
            expression: {
              warmth: number
              energy: number
              directness: number
              playfulness: number
              initiative: number
            }
          } | null
          worldDefaults: {
            schemaVersion: 1
            city: { id: string; name: string; fictional: boolean; description: string; climate: string }
            timezone: string
            district: string
            districtDescription: string
            home: {
              shortName: string
              residence: string
              surroundings: string
              interior: string
              layout: string
              view: string
              sensoryDetails: string[]
            }
            initialLocation: string
            mobility: { primary: string; alternatives: string[] }
            favoritePlaces: Array<{
              id: string
              name: string
              kind: string
              description: string
              travelMinutes: number
            }>
            possessions: Array<{
              id: string
              kind: string
              name: string
              description: string
              condition: string
            }>
            routines: { weekday: string[]; weekend: string[] }
            standingFacts: string[]
            initialState: {
              mood: number
              energy: number
              socialNeed: number
              currentLocation: string
              locationDetail: string
              currentActivity: string
              statusTags: string[]
            }
            rooms: Array<{ id: string; name: string; day: string; night: string }>
          } | null
          mutable: {
            body: string
            truncated: boolean
            version: number | null
            updatedAt: number | null
            source: 'override' | 'pack-default'
          }
          world: {
            schemaVersion: 1
            home: string
            timezone: string
            situation: string
            mood: number
            energy: number
            socialNeed: number
            currentLocation: string
            locationDetail: string
            currentActivity: string
            statusTags: string[]
            updatedAt: number
          } | null
          life: {
            pausedAt: number | null
            lastTickAt: number
            catchupSummary: string
            catchupTruncated: boolean
          } | null
          dayScript: {
            date: string
            id: string
            theme: string
            slots: Array<{
              hour: number
              minute: number
              type: string
              activity: string
              mood: string
              location: string
            }>
            slotsTruncated: boolean
          } | null
          events: Array<{
            id: string
            scheduledAt: number
            status: 'planned' | 'published'
            type: string
            activity: string
            mood: string
            location: string
          }>
          eventsTruncated: boolean
          moments: Array<{ id: string; publishedAt: number; text: string }>
          momentsTruncated: boolean
          profile: { identity: string; workflow: string; voice: string } | null
          memories: Array<{ id: string; category: string; content: string; updatedAt: number }>
          memoriesTruncated: boolean
          generatedAt: number
        }>
        modelSmoke: () => Promise<
          | {
              ok: true
              text: string
              ms: number
              model: string
              baseUrl: string
              contentLen: number
              reasoningLen: number
              completionTokens: number
              thinkingApplied?: { type: 'enabled' | 'disabled' }
            }
          | { ok: false; error: string; model?: string; baseUrl?: string }
        >
        modelProbeThinking: () => Promise<
          | {
              ok: true
              model: string
              baseUrl: string
              support: 'supported' | 'unsupported' | 'unknown'
              heuristic: boolean
              default: { contentLen: number; reasoningLen: number; completionTokens: number; ms: number }
              disabled: {
                contentLen: number
                reasoningLen: number
                completionTokens: number
                ms: number
                httpOk: boolean
                error?: string
              }
              note: string
            }
          | { ok: false; error: string; model?: string; baseUrl?: string }
        >
        modelTestStatus: () => Promise<{
          model: string
          baseUrl: string
          heuristic: boolean
          capability: {
            thinkingDisable: 'supported' | 'unsupported' | 'unknown'
            probedAt?: number
            note?: string
          }
        }>
      }
      chat: {
        send: (sessionId: string, userMessage: ChatMessage) => Promise<void>
        abort: (sessionId?: string) => Promise<void>
        onEvent: (callback: (event: AgentStreamEvent) => void) => () => void
        onConfirmRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => () => void
        confirmResponse: (requestId: string, approved: boolean) => void
      }
      tasks: {
        list: (sessionId?: string) => Promise<import('./shared/types').BackgroundTaskInfo[]>
        sync: (sessionId?: string) => Promise<{
          active: import('./shared/types').BackgroundTaskInfo[]
          pendingNotify: import('./shared/types').BackgroundTaskInfo[]
        }>
        cancel: (taskId: string) => Promise<boolean>
        onEvent: (callback: (event: import('./shared/types').TaskLifecycleEvent) => void) => () => void
      }
    }
  }
}
