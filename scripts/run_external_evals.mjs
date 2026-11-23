#!/usr/bin/env node
/**
 * 外部 Harness 评测一键编排入口。
 *
 * 背景：每次跑外部评测都需要手动启动带环境变量的 Electron 主进程、等待 /health 就绪、
 *       再运行不同评测集适配器并清理 Electron 进程。
 * 设计意图：用无窗口 headless 模式 (MY_AGENT_EVAL_HEADLESS=1) 启动隔离评测 Controller，
 *           不干扰用户桌面已打开的 My Agent 实例；跑完指定套件后自动回收进程树。
 * 关键约束：仅绑定 127.0.0.1；异常或中断时也必须清理子进程，禁止遗留孤儿 Electron。
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '..')

function parseArgs(argv) {
  const args = {
    suites: ['security', 'repobench-smoke'],
    port: process.env.MY_AGENT_EVAL_PORT || '48762',
    acbTasks: 'instruction-scope,session-resume,skill-loading,handoff,compaction',
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--suite' && argv[i + 1]) {
      args.suites = argv[++i].split(',').map((item) => item.trim()).filter(Boolean)
    } else if (argv[i] === '--port' && argv[i + 1]) {
      args.port = argv[++i].trim()
    } else if (argv[i] === '--acb-tasks' && argv[i + 1]) {
      args.acbTasks = argv[++i].trim()
    }
  }
  return args
}

function runSubprocess(command, args, cwd = repoRoot) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', (error) => resolve(127))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function waitForHealth(port, maxAttempts = 40) {
  const url = `http://127.0.0.1:${port}/health`
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch {
      // keep polling
    }
  }
  throw new Error(`External eval controller not ready on ${url}`)
}

async function killProcessTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    await runSubprocess('taskkill', ['/PID', String(pid), '/T', '/F'])
  } else {
    try { process.kill(-pid, 'SIGKILL') } catch { /* ignore */ }
  }
}

async function runRepoBenchSmoke(port) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'my-agent-repobench-smoke-'))
  try {
    const ws = path.join(tmp, 'repo')
    await mkdir(ws, { recursive: true })
    await writeFile(
      path.join(ws, 'math.mjs'),
      'export function clamp(value, min, max) {\n  if (value < min) return max;\n  if (value > max) return min;\n  return value;\n}\n',
      'utf8',
    )
    const promptFile = path.join(tmp, 'prompt.txt')
    await writeFile(
      promptFile,
      'Fix the bug in math.mjs so clamp(value, min, max) returns min when value < min, max when value > max, and value otherwise. Do not change the function signature.',
      'utf8',
    )
    const verifyJs = path.join(tmp, 'verify.mjs')
    await writeFile(
      verifyJs,
      'import { clamp } from "./repo/math.mjs";\nconst ok = clamp(-5,0,10)===0 && clamp(15,0,10)===10 && clamp(4,0,10)===4;\nconsole.log(JSON.stringify({ benchmark: "repobench-smoke", taskId: "clamp-fix", hiddenVerifierPass: ok }));\nprocess.exit(ok ? 0 : 1);\n',
      'utf8',
    )

    const targetCode = await runSubprocess('python', [
      'scripts/repobench_my_agent_target.py',
      '--workspace', ws,
      '--prompt-file', promptFile,
      '--task-id', 'smoke-clamp-fix',
      '--url', `http://127.0.0.1:${port}/run`,
    ])
    const verifyCode = await runSubprocess('node', [verifyJs], tmp)
    return targetCode === 0 && verifyCode === 0 ? 0 : 1
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const suites = options.suites.includes('all')
    ? ['acb', 'security', 'repobench-smoke']
    : options.suites

  const electronBin = process.platform === 'win32'
    ? path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(repoRoot, 'node_modules', '.bin', 'electron')

  const child = spawn(electronBin, ['.'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MY_AGENT_EVAL_CONTROLLER: '1',
      MY_AGENT_EVAL_HEADLESS: '1',
      MY_AGENT_EVAL_PORT: options.port,
    },
    stdio: 'ignore',
  })

  try {
    const health = await waitForHealth(options.port)
    console.log('Controller ready:', JSON.stringify(health))

    let exitCode = 0
    for (const suite of suites) {
      console.log(`\n--- Running suite: ${suite} ---`)
      if (suite === 'acb') {
        const code = await runSubprocess('node', [
          'scripts/acb_my_agent_runner.mjs',
          '--url', `http://127.0.0.1:${options.port}/run`,
          '--task', options.acbTasks,
          '--timeout-ms', '300000',
        ])
        if (code !== 0) exitCode = 1
      } else if (suite === 'security') {
        const code = await runSubprocess('node', [
          'scripts/harness_security_my_agent_runner.mjs',
          '--url', `http://127.0.0.1:${options.port}/run`,
        ])
        if (code !== 0) exitCode = 1
      } else if (suite === 'repobench-smoke') {
        const code = await runRepoBenchSmoke(options.port)
        if (code !== 0) exitCode = 1
      } else {
        console.error(`Unknown suite: ${suite}`)
        exitCode = 1
      }
    }
    process.exitCode = exitCode
  } finally {
    await killProcessTree(child.pid)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
