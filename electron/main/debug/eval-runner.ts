/**
 * Debug Eval 受控运行器。
 *
 * 背景：Debug 已能读取真实报告，但开发者仍需切到终端运行固定 Eval script。
 * 设计意图：主进程仅暴露三个白名单 suite，通过 npm script 子进程复用 CLI 真相；结构化进度由
 *           Persona Eval 自身输出，避免 UI 猜测日志。
 * 关键约束：不接受任意命令/参数；真实运行由 UI 二次确认；单次只允许一个进程；输出脱敏且有界；
 *           取消时终止进程树，避免 npm/vitest 孤儿进程继续消耗 API。
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  DebugEvalRunEvent,
  DebugEvalRunPlan,
  DebugEvalRunStatus,
  DebugEvalScenarioProgress,
  DebugEvalSuite,
} from '../../../src/shared/types'
import { redactSensitiveText } from '../utils/text-capture'
import { buildSafeChildProcessEnv } from '../utils/safe-process-env'
import { listPersonaEvalReports } from './persona-eval-reports'
import { listSkillEvalReports } from './skill-eval-reports'

const OUTPUT_LIMIT = 80_000
const PERSONA_IDS = ['B02', 'B03', 'B04', 'B05', 'B06', 'B07'] as const
const PROGRESS_PREFIX = '[PERSONA_EVAL_PROGRESS]'

interface EvalChildProcess {
  pid?: number
  stdout: NodeJS.ReadableStream
  stderr: NodeJS.ReadableStream
  on(event: 'close', listener: (code: number | null) => void): this
  on(event: 'error', listener: (error: Error) => void): this
  kill(signal?: NodeJS.Signals): boolean
}

type SpawnEvalProcess = (
  executable: string,
  args: string[],
  options: Parameters<typeof spawn>[2],
) => EvalChildProcess

type KillProcessTree = (child: EvalChildProcess) => void

function sanitizeDisplayUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.username) url.username = '[REDACTED]'
    if (url.password) url.password = '[REDACTED]'
    return redactSensitiveText(url.toString())
  } catch {
    return redactSensitiveText(raw)
  }
}

function parsePassK(env: NodeJS.ProcessEnv): number {
  const raw = env.EVAL_PASS_K?.trim()
  if (!raw) return 3
  const value = Number(raw)
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : 3
}

export function buildDebugEvalRunPlans(env: NodeJS.ProcessEnv = process.env): DebugEvalRunPlan[] {
  const passK = parsePassK(env)
  const hasApiKey = Boolean((env.TEST_LLM_API_KEY || env.LLM_API_KEY || '').trim())
  return [
    {
      suite: 'mock',
      label: 'Mock Eval',
      command: 'npm run eval:run',
      requiresConfirmation: false,
      available: true,
    },
    {
      suite: 'skill',
      label: 'Skill Eval',
      command: 'npm run eval:skill',
      requiresConfirmation: false,
      available: true,
    },

    {
      suite: 'persona-real',
      label: '真实 Persona Eval',
      command: 'npm run eval:persona',
      requiresConfirmation: true,
      available: hasApiKey,
      unavailableReason: hasApiKey ? undefined : '项目 .env 未配置 LLM_API_KEY / TEST_LLM_API_KEY',
      model: env.LLM_MODEL || 'gpt-4o',
      baseUrl: sanitizeDisplayUrl(env.LLM_BASE_URL || 'https://api.openai.com/v1'),
      hasApiKey,
      passK,
      scenarioCount: PERSONA_IDS.length,
      estimatedAgentCalls: PERSONA_IDS.length * passK,
      estimatedJudgeCalls: PERSONA_IDS.length * passK,
    },
  ]
}

export function parsePersonaProgressLine(line: string): {
  scenarioId: string
  trial: number
  k: number
  pass: boolean
} | null {
  const markerIndex = line.indexOf(PROGRESS_PREFIX)
  if (markerIndex < 0) return null
  try {
    const parsed = JSON.parse(line.slice(markerIndex + PROGRESS_PREFIX.length)) as Record<string, unknown>
    if (typeof parsed.scenarioId !== 'string'
      || typeof parsed.trial !== 'number'
      || typeof parsed.k !== 'number'
      || typeof parsed.pass !== 'boolean') return null
    if (!PERSONA_IDS.includes(parsed.scenarioId as typeof PERSONA_IDS[number])) return null
    return {
      scenarioId: parsed.scenarioId,
      trial: parsed.trial,
      k: parsed.k,
      pass: parsed.pass,
    }
  } catch {
    return null
  }
}

function makePersonaProgress(k: number): DebugEvalScenarioProgress[] {
  return PERSONA_IDS.map((id) => ({
    id,
    completedTrials: 0,
    passedTrials: 0,
    totalTrials: k,
    state: 'pending',
  }))
}

export function buildEvalSpawnSpec(
  suite: DebugEvalSuite,
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): { executable: string; args: string[] } {
  const scripts: Record<DebugEvalSuite, string> = {
    mock: 'eval:run',
    skill: 'eval:skill',
    'persona-real': 'eval:persona',
  }
  const script = scripts[suite]
  if (platform === 'win32') {
    return {
      executable: env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `npm.cmd run ${script}`],
    }
  }
  return { executable: 'npm', args: ['run', script] }
}

function defaultSpawn(
  executable: string,
  args: string[],
  options: Parameters<typeof spawn>[2],
): ChildProcessWithoutNullStreams {
  return spawn(executable, args, options) as ChildProcessWithoutNullStreams
}

function defaultKillProcessTree(child: EvalChildProcess): void {
  const pid = child.pid
  if (!pid) {
    child.kill('SIGTERM')
    return
  }
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    killer.on('error', () => { child.kill('SIGTERM') })
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

export class DebugEvalRunner {
  private status: DebugEvalRunStatus = { state: 'idle', output: '' }
  private child: EvalChildProcess | null = null
  private subscribers = new Set<(event: DebugEvalRunEvent) => void>()
  private lineBuffer = ''

  constructor(
    private readonly appRoot: string,
    private readonly spawnProcess: SpawnEvalProcess = defaultSpawn,
    private readonly killProcessTree: KillProcessTree = defaultKillProcessTree,
  ) {}

  getPlans(): DebugEvalRunPlan[] {
    return buildDebugEvalRunPlans(process.env)
  }

  getStatus(): DebugEvalRunStatus {
    return structuredClone(this.status)
  }

  subscribe(listener: (event: DebugEvalRunEvent) => void): () => void {
    this.subscribers.add(listener)
    return () => this.subscribers.delete(listener)
  }

  start(suite: DebugEvalSuite): { ok: true; status: DebugEvalRunStatus } | { ok: false; error: string } {
    if (this.status.state === 'running') return { ok: false, error: '已有 Eval 正在运行' }
    const plan = this.getPlans().find((item) => item.suite === suite)
    if (!plan) return { ok: false, error: '不支持的 Eval 套件' }
    if (!plan.available) return { ok: false, error: plan.unavailableReason || '当前 Eval 不可运行' }

    const spawnSpec = buildEvalSpawnSpec(suite)
    const startedAt = Date.now()
    const runId = randomUUID()
    const passK = plan.passK || 1
    this.lineBuffer = ''
    this.status = {
      runId,
      suite,
      state: 'running',
      startedAt,
      output: '',
      cancelRequested: false,
      completedTrials: 0,
      totalTrials: suite === 'persona-real' ? PERSONA_IDS.length * passK : undefined,
      scenarios: suite === 'persona-real' ? makePersonaProgress(passK) : undefined,
    }

    try {
      this.child = this.spawnProcess(spawnSpec.executable, spawnSpec.args, {
        cwd: this.appRoot,
        // Eval 子进程不继承主进程的全部环境变量；真实 Persona Eval 的配置由其
        // 自己的 eval-config/.env 读取，避免 mock/skill 运行器意外暴露主进程凭据。
        env: buildSafeChildProcessEnv(),
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      this.status = {
        ...this.status,
        state: 'failed',
        endedAt: Date.now(),
        error: 'Eval 启动失败，请检查 Node/npm 环境。',
      }
      this.emit()
      return { ok: false, error: this.status.error || 'Eval 启动失败，请检查 Node/npm 环境。' }
    }

    this.child.stdout.on('data', (chunk: Buffer | string) => this.consumeOutput(String(chunk)))
    this.child.stderr.on('data', (chunk: Buffer | string) => this.consumeOutput(String(chunk)))
    this.child.on('error', () => this.finish(-1, 'Eval 子进程运行失败。'))
    this.child.on('close', (code) => { void this.finish(code ?? -1) })
    this.emit()
    return { ok: true, status: this.getStatus() }
  }

  cancel(runId: string): { ok: boolean; error?: string } {
    if (this.status.state !== 'running' || !this.child || this.status.runId !== runId) {
      return { ok: false, error: '没有可停止的 Eval 运行' }
    }
    this.status = { ...this.status, cancelRequested: true }
    this.appendOutput('\n[已请求停止 Eval]\n')
    this.emit()
    this.killProcessTree(this.child)
    return { ok: true }
  }

  private consumeOutput(chunk: string): void {
    const clean = redactSensitiveText(chunk).replace(/\u001b\[[0-9;]*m/g, '')
    this.appendOutput(clean)
    this.lineBuffer += clean
    const lines = this.lineBuffer.split(/\r?\n/)
    this.lineBuffer = lines.pop() || ''
    for (const line of lines) this.applyProgress(line)
    this.emit()
  }

  private applyProgress(line: string): void {
    const event = parsePersonaProgressLine(line)
    if (!event || !this.status.scenarios) return
    const scenarios = this.status.scenarios.map((scenario) => {
      if (scenario.id !== event.scenarioId) return scenario
      const completedTrials = Math.max(scenario.completedTrials, event.trial)
      const passedTrials = scenario.passedTrials + (event.trial > scenario.completedTrials && event.pass ? 1 : 0)
      return {
        ...scenario,
        completedTrials,
        passedTrials,
        totalTrials: event.k,
        state: completedTrials >= event.k
          ? (passedTrials === event.k ? 'passed' : 'failed')
          : 'running',
      } satisfies DebugEvalScenarioProgress
    })
    const firstPending = scenarios.findIndex((scenario) => scenario.state === 'pending')
    if (firstPending >= 0 && scenarios.some((scenario) => scenario.state === 'running')) {
      // 前一个场景完成后，下一个场景尚未产生 trial 事件；保持 pending，避免制造假进度。
    }
    this.status = {
      ...this.status,
      scenarios,
      completedTrials: scenarios.reduce((sum, scenario) => sum + scenario.completedTrials, 0),
    }
  }

  private appendOutput(chunk: string): void {
    const combined = `${this.status.output}${chunk}`
    this.status = {
      ...this.status,
      output: combined.length > OUTPUT_LIMIT
        ? `[前部日志已截断]\n${combined.slice(-OUTPUT_LIMIT)}`
        : combined,
    }
  }

  private async finish(exitCode: number, processError?: string): Promise<void> {
    if (this.status.state !== 'running') return
    const cancelled = this.status.cancelRequested === true
    const nextState = cancelled ? 'cancelled' : exitCode === 0 ? 'succeeded' : 'failed'
    const reportDir = path.join(this.appRoot, 'eval-reports')
    const latest = this.status.suite === 'persona-real'
      ? (await listPersonaEvalReports(reportDir)).latest?.fileName
      : undefined
    this.child = null
    this.status = {
      ...this.status,
      state: nextState,
      endedAt: Date.now(),
      exitCode,
      error: processError ? 'Eval 子进程运行失败。' : (nextState === 'failed' ? `Eval 退出码 ${exitCode}` : undefined),
      latestReportFile: latest,
    }
    this.emit()
  }

  private emit(): void {
    const event: DebugEvalRunEvent = { type: 'status', status: this.getStatus() }
    for (const listener of this.subscribers) listener(event)
  }
}
