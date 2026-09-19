import { listMemories, setMemoryIndexSync } from '../storage/memory-store'
import { loadMainLLMConfig } from '../llm/aux-config'
import { reconcileMemoryIndex, VECTOR_EMBEDDING_TIMEOUT_MS } from './vector-store'
import { createLogger } from '../utils/logger'

const log = createLogger('MemoryIndexSync')
export const MEMORY_INDEX_SYNC_POLICY = {
  source: 'electron/main/memory/index-sync.ts',
  sourceOfTruth: 'SQLite memories',
  retryDelayMs: 30_000,
  requestTimeoutMs: VECTOR_EMBEDDING_TIMEOUT_MS,
  triggers: ['startup', 'committed-mutation', 'retry'],
} as const

/**
 * 背景：恢复不能依赖上次进程来得及发布任务，必须从 SQLite 与磁盘镜像重算差异。
 * 意图：启动扫描 + 提交唤醒 + 失败退避，共用一个 worker；SQLite 本身就是持久恢复依据。
 * 约束：无端点配置不发请求；本地端点可以没有 API Key；失败不丢源数据；关闭中止请求；
 *       重入合并但必须重新读最新源。
 */
export function startMemoryIndexSync() {
  let stopped = false
  let revision = 0
  let dirty = false
  let running: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()

  function request(): Promise<void> {
    if (stopped) return Promise.resolve()
    revision++
    dirty = true
    clearTimeout(timer)
    if (running) return running
    running = run().finally(() => {
      running = undefined
      if (dirty && !stopped) void request()
    })
    return running
  }

  async function run(): Promise<void> {
    let complete = false
    do {
      dirty = false
      const currentRevision = revision
      try {
        const memories = await listMemories()
        const config = await loadMainLLMConfig()
        complete = await reconcileMemoryIndex(memories, config.baseUrl.trim() ? config : undefined,
          () => !stopped && currentRevision === revision,
          AbortSignal.any([controller.signal, AbortSignal.timeout(MEMORY_INDEX_SYNC_POLICY.requestTimeoutMs)]))
      } catch {
        complete = false
        if (!stopped) log.warn('Memory index reconciliation deferred; source retained')
      }
    } while (dirty && !stopped)
    if (!complete && !stopped) {
      timer = setTimeout(() => { void request() }, MEMORY_INDEX_SYNC_POLICY.retryDelayMs)
      timer.unref()
    }
  }

  const unsubscribe = setMemoryIndexSync(request)
  const ready = request()
  return {
    ready, request,
    stop() { stopped = true; unsubscribe(); clearTimeout(timer); controller.abort() },
  }
}
