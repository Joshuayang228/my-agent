import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { DebugEvalRunEvent } from '../../src/shared/types'
import {
  buildDebugEvalRunPlans,
  buildEvalSpawnSpec,
  DebugEvalRunner,
  parsePersonaProgressLine,
} from '../../electron/main/debug/eval-runner'

afterEach(() => {
  vi.unstubAllEnvs()
})

class FakeStream extends EventEmitter {}
class FakeChild extends EventEmitter {
  pid = 1234
  stdout = new FakeStream()
  stderr = new FakeStream()
  kill = vi.fn(() => true)
}

describe('debug eval runner', () => {
  it('只提供三个白名单计划且不暴露 API Key', () => {
    const plans = buildDebugEvalRunPlans({
      LLM_API_KEY: 'sk-secret-value',
      LLM_MODEL: 'deepseek-test',
      LLM_BASE_URL: 'https://user:password@example.test/v1?api_key=hidden-value',
      EVAL_PASS_K: '3',
    })
    expect(plans.map((plan) => plan.suite)).toEqual(['mock', 'skill', 'persona-real'])
    expect(plans[1]).toMatchObject({ available: true, command: 'npm run eval:skill' })
    expect(plans[2]).toMatchObject({
      available: true,
      model: 'deepseek-test',
      passK: 3,
      estimatedAgentCalls: 18,
      estimatedJudgeCalls: 18,
    })
    expect(JSON.stringify(plans)).not.toContain('sk-secret-value')
    expect(JSON.stringify(plans)).not.toContain('password')
    expect(JSON.stringify(plans)).not.toContain('hidden-value')
  })

  it('Skill 套件只映射到固定 eval:skill 命令', () => {
    const spec = buildEvalSpawnSpec('skill', 'linux')
    expect(spec).toEqual({ executable: 'npm', args: ['run', 'eval:skill'] })
  })

  it('解析 Persona trial 结构化进度，拒绝未知场景', () => {
    expect(parsePersonaProgressLine('x [PERSONA_EVAL_PROGRESS]{"scenarioId":"B04","trial":2,"k":3,"pass":true}')).toEqual({
      scenarioId: 'B04', trial: 2, k: 3, pass: true,
    })
    expect(parsePersonaProgressLine('[PERSONA_EVAL_PROGRESS]{"scenarioId":"X01","trial":1,"k":3,"pass":true}')).toBeNull()
  })

  it('运行固定 npm script、脱敏输出并发布真实 trial 进度', async () => {
    vi.stubEnv('LLM_API_KEY', 'test-key')
    const child = new FakeChild()
    const spawnProcess = vi.fn(() => child)
    const events: DebugEvalRunEvent[] = []
    const runner = new DebugEvalRunner('C:\\repo', spawnProcess, vi.fn())
    runner.subscribe((event) => events.push(event))

    const started = runner.start('persona-real')
    expect(started.ok).toBe(true)
    const spec = buildEvalSpawnSpec('persona-real')
    expect(spawnProcess).toHaveBeenCalledWith(
      spec.executable,
      spec.args,
      expect.objectContaining({ cwd: 'C:\\repo', windowsHide: true, detached: process.platform !== 'win32' }),
    )

    child.stdout.emit('data', 'Bearer sk-abcdefghijklmnop\n')
    child.stdout.emit('data', '[PERSONA_EVAL_PROGRESS]{"scenarioId":"B02","trial":1,"k":3,"pass":true}\n')
    const status = runner.getStatus()
    expect(status.output).toContain('[REDACTED]')
    expect(status.output).not.toContain('sk-abcdefghijklmnop')
    expect(status.completedTrials).toBe(1)
    expect(status.scenarios?.[0]).toMatchObject({ completedTrials: 1, passedTrials: 1, state: 'running' })
    expect(events.length).toBeGreaterThan(0)
  })

  it('同一时间只允许一个运行，取消时使用进程树终止器', () => {
    const child = new FakeChild()
    const killTree = vi.fn()
    const runner = new DebugEvalRunner('C:\\repo', vi.fn(() => child), killTree)
    const started = runner.start('mock')
    expect(started.ok).toBe(true)
    expect(runner.start('persona-real')).toEqual({ ok: false, error: '已有 Eval 正在运行' })
    const runId = runner.getStatus().runId!
    expect(runner.cancel(runId)).toEqual({ ok: true })
    expect(killTree).toHaveBeenCalledWith(child)
    expect(runner.getStatus().cancelRequested).toBe(true)
  })
})
