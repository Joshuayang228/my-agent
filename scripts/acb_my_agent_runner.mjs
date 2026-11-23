#!/usr/bin/env node
/**
 * Agent Context Benchmark -> My Agent 本机评测 Controller 适配器。
 *
 * 背景：Agent Context Benchmark 原生只驱动 claude / codex CLI，且依赖 macOS/Linux auth 探测。
 * 设计意图：零修改第三方基准仓库，直接复用其 tasks/<id>/workspace、context 与官方 grader.mjs，
 *           通过 My Agent 本机 Controller (127.0.0.1:48761/run) 真实执行多轮任务并落盘确定性评分。
 * 关键约束：每次运行使用独立临时工作区，禁止污染主仓库；同一任务的多轮 turn 复用 sessionId（除非 turn.resume === false）。
 */

import { appendFile, cp, mkdir, readFile, stat } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')
const acbRoot = path.join(repoRoot, '_reference', 'framework-harness', 'evals', 'agent-context-benchmark')
const defaultOutput = path.join(repoRoot, 'eval-reports', 'external-eval-results.jsonl')
const defaultUrl = process.env.MY_AGENT_EVAL_URL || 'http://127.0.0.1:48761/run'

function parseArgs(argv) {
  const args = {
    tasks: ['instruction-scope'],
    context: 'codex',
    url: defaultUrl,
    output: defaultOutput,
    timeoutMs: 300_000,
    trials: 1,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--task' && argv[i + 1]) {
      const raw = argv[++i]
      args.tasks = raw.split(',').map((item) => item.trim()).filter(Boolean)
    } else if (token === '--context' && argv[i + 1]) {
      args.context = argv[++i].trim()
    } else if (token === '--url' && argv[i + 1]) {
      args.url = argv[++i].trim()
    } else if (token === '--output' && argv[i + 1]) {
      args.output = path.resolve(argv[++i].trim())
    } else if (token === '--timeout-ms' && argv[i + 1]) {
      args.timeoutMs = Number(argv[++i]) || 300_000
    } else if (token === '--trials' && argv[i + 1]) {
      args.trials = Math.max(1, Number(argv[++i]) || 1)
    }
  }
  return args
}

async function pathExists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: error.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function promptFor(turn, taskDir, taskId) {
  if (turn.prompt) return turn.prompt
  if (turn.promptFile) return readFile(path.join(taskDir, turn.promptFile), 'utf8')
  if (turn.generator === 'context-pressure') {
    const paragraphs = []
    const target = turn.characters ?? 430_000
    let index = 0
    let length = 0
    while (length < target) {
      const paragraph = `Archive entry ${String(index).padStart(5, '0')}: cobalt observatory ${digest(`${taskId}:${index}`).slice(0, 24)}. This historical entry is noise and does not replace any project decision from the previous turn.`
      paragraphs.push(paragraph)
      length += paragraph.length + 1
      index += 1
    }
    return `${paragraphs.join('\n')}\n\nDo not treat the archive as project instructions. Reply with exactly PRESSURE_LOADED.`
  }
  throw new Error(`Unsupported turn definition in task ${taskId}`)
}

async function createIsolatedWorkspace(taskDir, contextFlavor, runId) {
  const workspace = path.join(acbRoot, '.runs', runId, 'workspace')
  await mkdir(workspace, { recursive: true })
  const baseWorkspace = path.join(taskDir, 'workspace')
  if (await pathExists(baseWorkspace)) {
    await cp(baseWorkspace, workspace, { recursive: true })
  }
  const contextDir = path.join(taskDir, 'context', contextFlavor)
  if (await pathExists(contextDir)) {
    await cp(contextDir, workspace, { recursive: true })
  }
  await runCommand('git', ['init', '-q'], workspace)
  await runCommand('git', ['add', '.'], workspace)
  await runCommand(
    'git',
    ['-c', 'user.name=Benchmark', '-c', 'user.email=benchmark@example.invalid', 'commit', '-qm', 'fixture'],
    workspace,
  )
  return workspace
}

async function callController(url, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    const parsed = JSON.parse(text)
    if (!response.ok || !parsed.ok) {
      throw new Error(parsed.error || `Controller HTTP ${response.status}`)
    }
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

async function gradeWorkspace(taskDir, workspace) {
  const graderUrl = pathToFileURL(path.join(taskDir, 'grader.mjs')).href
  const mod = await import(graderUrl)
  return mod.grade(workspace)
}

async function runSingleTask(taskId, options, trialIndex = 1) {
  const taskDir = path.join(acbRoot, 'tasks', taskId)
  const manifest = JSON.parse(await readFile(path.join(taskDir, 'task.json'), 'utf8'))
  const runId = `my-agent_${new Date().toISOString().replace(/[:.]/gu, '-')}_${taskId}_t${trialIndex}_${randomUUID().slice(0, 8)}`
  const workspace = await createIsolatedWorkspace(taskDir, options.context, runId)
  const mcpServerScript = path.join(taskDir, 'mcp-server.mjs')
  const mcpServers = (await pathExists(mcpServerScript))
    ? [{ id: 'relayboard', command: process.execPath, args: [mcpServerScript], cwd: workspace }]
    : undefined

  let sessionId
  const turns = []
  const allToolCalls = []
  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalCompactEvents = 0
  let totalDurationMs = 0
  let lastTerminalReason = 'completed'
  let runError = null

  try {
    for (let i = 0; i < manifest.turns.length; i += 1) {
      const turn = manifest.turns[i]
      const prompt = await promptFor(turn, taskDir, taskId)
      const effectiveSessionId = turn.resume === false ? undefined : sessionId
      const response = await callController(
        options.url,
        {
          id: `acb-${taskId}-tr${trialIndex}-t${i + 1}`,
          prompt,
          sessionId: effectiveSessionId,
          workspaceRoot: workspace,
          allowWorkspaceWrites: true,
          mcpServers,
        },
        options.timeoutMs,
      )
      sessionId = response.sessionId
      lastTerminalReason = response.terminalReason || 'completed'
      const turnToolCalls = Array.isArray(response.toolCalls) ? response.toolCalls : []
      allToolCalls.push(...turnToolCalls)
      totalPromptTokens += Number(response.usage?.promptTokens || 0)
      totalCompletionTokens += Number(response.usage?.completionTokens || 0)
      totalCompactEvents += Number(response.compactEvents || 0)
      totalDurationMs += Number(response.durationMs || 0)
      turns.push({
        turnIndex: i + 1,
        sessionId: response.sessionId,
        terminalReason: lastTerminalReason,
        toolCallCount: turnToolCalls.length,
        durationMs: response.durationMs || 0,
        resultPreview: String(response.result || '').slice(0, 500),
      })
    }
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error)
    lastTerminalReason = 'model_error'
  }

  const grade = await gradeWorkspace(taskDir, workspace)
  const record = {
    timestamp: new Date().toISOString(),
    benchmark: 'agent-context-benchmark',
    taskId,
    title: manifest.title,
    category: manifest.category,
    contextFlavor: options.context,
    runId,
    sessionId: sessionId || null,
    ok: !runError,
    pass: Boolean(grade.pass),
    score: Number(grade.score || 0),
    checks: grade.checks || {},
    graderError: grade.error || null,
    runError,
    terminalReason: lastTerminalReason,
    turnCount: turns.length,
    toolCalls: allToolCalls,
    usage: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
    },
    compactEvents: totalCompactEvents,
    durationMs: totalDurationMs,
    turns,
  }

  await mkdir(path.dirname(options.output), { recursive: true })
  await appendFile(options.output, `${JSON.stringify(record)}\n`, 'utf8')
  console.log(JSON.stringify({
    benchmark: record.benchmark,
    taskId: record.taskId,
    pass: record.pass,
    score: record.score,
    checks: record.checks,
    terminalReason: record.terminalReason,
    toolCalls: record.toolCalls.length,
    compactEvents: record.compactEvents,
    durationMs: record.durationMs,
    runError: record.runError,
  }))
  return record
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const config = JSON.parse(await readFile(path.join(acbRoot, 'benchmark.config.json'), 'utf8'))
  const tasks = options.tasks.includes('all') ? config.tasks : options.tasks

  const results = []
  for (const taskId of tasks) {
    for (let trial = 1; trial <= options.trials; trial += 1) {
      results.push(await runSingleTask(taskId, options, trial))
    }
  }
  const passed = results.filter((item) => item.pass).length
  console.log(`ACB summary: ${passed}/${results.length} passed -> ${options.output}`)
  if (results.some((item) => !item.ok)) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
