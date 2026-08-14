/**
 * Playground「模型测试」— 对齐 Alice `模型测试` tab。
 *
 * 背景：Alice 用 `model-test-*` session 对当前已配模型做一句话烟测；
 *       我们另加 thinking.disabled 能力探测，结果写入 settings 能力缓存。
 * 意图：烟测连通；探测是否可用 `thinking: { type: "disabled" }` 供辅助调用。
 * 约束：不写真会话；失败返回可读错误；探测会打真实 LLM。
 */

import type { LLMConfig } from '../../../src/shared/types'
import { streamChat, type StreamChatResult } from '../llm/index'
import { loadMainLLMConfig } from '../llm/aux-config'
import {
  getThinkingCapability,
  prefersThinkingDisabledByHeuristic,
  setThinkingCapability,
  type ThinkingDisableSupport,
} from '../llm/thinking'
import { createLogger } from '../utils/logger'
import { startLinkedAsyncSpan } from '../utils/tracer'

const log = createLogger('PlaygroundModelTest')

const SMOKE_PROMPT = '你好！请用一句话介绍自己。'
const PROBE_PROMPT = '用两个字回答：你好'

export type ModelSmokeResult =
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

export type ThinkingProbeDisabledSide = {
  contentLen: number
  reasoningLen: number
  completionTokens: number
  ms: number
  httpOk: boolean
  error?: string
}

export type ThinkingProbeResult =
  | {
      ok: true
      model: string
      baseUrl: string
      support: ThinkingDisableSupport
      heuristic: boolean
      default: { contentLen: number; reasoningLen: number; completionTokens: number; ms: number }
      disabled: ThinkingProbeDisabledSide
      note: string
    }
  | { ok: false; error: string; model?: string; baseUrl?: string }

async function consumeOnce(
  config: LLMConfig,
  userPrompt: string,
  caller: string,
): Promise<{
  content: string
  reasoning: string
  completionTokens: number
  ms: number
}> {
  const t0 = Date.now()
  const gen = streamChat({
    config,
    messages: [
      {
        id: `mt-${Date.now()}`,
        role: 'user',
        content: userPrompt,
        timestamp: Date.now(),
      },
    ],
    caller,
    promptAssetKeys: ['playground-model-test'],
  })
  let result: StreamChatResult
  while (true) {
    const next = await gen.next()
    if (next.done) {
      result = next.value
      break
    }
  }
  return {
    content: (result.content || '').trim(),
    reasoning: (result.reasoning || '').trim(),
    completionTokens: result.usage?.completionTokens ?? 0,
    ms: Date.now() - t0,
  }
}

/**
 * 烟测：当前设置模型一句自我介绍（对照 Alice model-test chat）。
 * 默认带上 thinking.disabled（若启发式/缓存认为适用），避免 reasoning 吃光预算。
 */
export async function runModelSmokeTest(opts?: {
  disableThinking?: boolean
}): Promise<ModelSmokeResult> {
  const base = await loadMainLLMConfig()
  if (!base.apiKey?.trim()) {
    return { ok: false, error: '请先在设置中配置 API Key', model: base.model, baseUrl: base.baseUrl }
  }

  let disable = opts?.disableThinking
  if (disable === undefined) {
    const cap = await getThinkingCapability(base.baseUrl, base.model)
    if (cap.thinkingDisable === 'supported') disable = true
    else if (cap.thinkingDisable === 'unsupported') disable = false
    else disable = prefersThinkingDisabledByHeuristic(base.baseUrl, base.model)
  }

  const config: LLMConfig = {
    ...base,
    temperature: 0.3,
    maxTokens: 256,
    ...(disable ? { thinking: { type: 'disabled' as const } } : {}),
  }

  const span = startLinkedAsyncSpan('playground:model-smoke', 'system', {
    attributes: { model: config.model, playground: true },
  })
  try {
    const out = await consumeOnce(config, SMOKE_PROMPT, 'model-smoke')
    span.end('ok')
    if (!out.content) {
      return {
        ok: false,
        error: out.reasoning
          ? `模型只返回了思考、没有正文（reasoning ${out.reasoning.length} 字）。可先跑「探测 Thinking 开关」。`
          : '模型返回空正文',
        model: config.model,
        baseUrl: config.baseUrl,
      }
    }
    log.info('Model smoke ok', { model: config.model, ms: out.ms, chars: out.content.length })
    return {
      ok: true,
      text: out.content,
      ms: out.ms,
      model: config.model,
      baseUrl: config.baseUrl,
      contentLen: out.content.length,
      reasoningLen: out.reasoning.length,
      completionTokens: out.completionTokens,
      thinkingApplied: config.thinking,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    span.end('error', message)
    return { ok: false, error: message, model: config.model, baseUrl: config.baseUrl }
  }
}

/**
 * 对比默认 vs thinking.disabled，写入能力缓存。
 * supported 判定：disabled 请求成功、有 content、且 reasoning 为空（或明显短于默认）。
 */
export async function probeThinkingDisable(): Promise<ThinkingProbeResult> {
  const base = await loadMainLLMConfig()
  if (!base.apiKey?.trim()) {
    return { ok: false, error: '请先在设置中配置 API Key', model: base.model, baseUrl: base.baseUrl }
  }

  const heuristic = prefersThinkingDisabledByHeuristic(base.baseUrl, base.model)
  const span = startLinkedAsyncSpan('playground:thinking-probe', 'system', {
    attributes: { model: base.model, playground: true },
  })

  try {
    const defaultCfg: LLMConfig = {
      ...base,
      temperature: 0,
      maxTokens: 64,
    }
    const disabledCfg: LLMConfig = {
      ...base,
      temperature: 0,
      maxTokens: 64,
      thinking: { type: 'disabled' },
    }

    const def = await consumeOnce(defaultCfg, PROBE_PROMPT, 'model-probe-default')

    let disabledOut: ThinkingProbeDisabledSide
    try {
      const dis = await consumeOnce(disabledCfg, PROBE_PROMPT, 'model-probe-disabled')
      disabledOut = {
        contentLen: dis.content.length,
        reasoningLen: dis.reasoning.length,
        completionTokens: dis.completionTokens,
        ms: dis.ms,
        httpOk: true,
      }
    } catch (err) {
      disabledOut = {
        contentLen: 0,
        reasoningLen: 0,
        completionTokens: 0,
        ms: 0,
        httpOk: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }

    let support: ThinkingDisableSupport = 'unsupported'
    let note = ''
    if (!disabledOut.httpOk) {
      support = 'unsupported'
      note = `disabled 请求失败：${disabledOut.error || 'unknown'}。辅助调用将不传 thinking 参数。`
    } else if (disabledOut.contentLen > 0 && disabledOut.reasoningLen === 0) {
      support = 'supported'
      note = 'disabled 生效：有正文、无 reasoning。辅助调用（标题/画像等）将关闭 thinking。'
    } else if (
      disabledOut.contentLen > 0 &&
      def.reasoningLen > 0 &&
      disabledOut.reasoningLen < Math.max(8, Math.floor(def.reasoningLen * 0.3))
    ) {
      support = 'supported'
      note = 'disabled 部分生效（reasoning 明显缩短）。辅助调用将尝试关闭 thinking。'
    } else if (disabledOut.contentLen > 0 && def.reasoningLen === 0 && disabledOut.reasoningLen === 0) {
      support = 'unsupported'
      note = '该模型默认也不返回 reasoning；无需传 thinking.disabled（记为 unsupported）。'
    } else {
      support = 'unsupported'
      note = 'disabled 后仍有 reasoning 或正文为空，未认定为可用。'
    }

    await setThinkingCapability(base.baseUrl, base.model, { thinkingDisable: support, note })
    span.end('ok')
    log.info('Thinking probe done', { model: base.model, support })

    return {
      ok: true,
      model: base.model,
      baseUrl: base.baseUrl,
      support,
      heuristic,
      default: {
        contentLen: def.content.length,
        reasoningLen: def.reasoning.length,
        completionTokens: def.completionTokens,
        ms: def.ms,
      },
      disabled: disabledOut,
      note,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    span.end('error', message)
    return { ok: false, error: message, model: base.model, baseUrl: base.baseUrl }
  }
}

export async function getModelTestStatus(): Promise<{
  model: string
  baseUrl: string
  heuristic: boolean
  capability: Awaited<ReturnType<typeof getThinkingCapability>>
}> {
  const base = await loadMainLLMConfig()
  const capability = await getThinkingCapability(base.baseUrl, base.model)
  return {
    model: base.model,
    baseUrl: base.baseUrl,
    heuristic: prefersThinkingDisabledByHeuristic(base.baseUrl, base.model),
    capability,
  }
}
