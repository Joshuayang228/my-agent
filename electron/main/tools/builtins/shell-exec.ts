import { buildTool } from '../builder'
import { exec } from 'node:child_process'
import path from 'node:path'
import { createLogger, hashForLog } from '../../utils/logger'
import { buildSafeChildProcessEnv } from '../../utils/safe-process-env'
import { checkCommandPermission } from '../../sandbox/permission-engine'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import { PERMISSION_SANDBOX_ASSET_KEYS } from '../../sandbox/asset-keys'
import type { ToolContext } from '../../../../src/shared/types'

const log = createLogger('ShellExec')

const TIMEOUT_MS = 30_000
const MAX_OUTPUT_CHARS = 30_000
const MAX_COMMAND_LENGTH = 100_000
const MAX_CWD_LENGTH = 4_096

export const shellExecTool = buildTool({
  name: 'shell_exec',
  description: "执行 shell 命令并返回输出。\n\n适用场景：\n- 运行构建脚本、测试或编译命令\n- 安装或管理 npm、pip、cargo 等包\n- 检查磁盘空间、进程、环境变量等系统信息\n- 运行 Git status、diff、log 等命令\n- 执行使用 shell 更方便的文件操作，例如 find 或复杂 grep\n- 执行项目专用脚本和工具\n\n不适用场景：\n- 简单文件读写，优先使用更安全、更快的专用文件工具\n- 搜索代码，优先使用会返回结构化结果的 code_search\n- 需要交互输入的命令；shell 是非交互式的\n- 长时间运行的进程；命令在 30 秒后超时\n\n行为：\n- 命令 30 秒超时，并返回已有输出和超时标记\n- 沙箱模式控制允许的命令：\n  - read-only：阻止所有写操作\n  - workspace-write：阻止 rm -rf、dd、format 等危险命令，以及工作区外写入\n  - full-access：允许所有命令，必须谨慎使用\n- 返回 stdout、stderr 和退出码\n- 输出超过 30,000 个字符时截断；大型输出可重定向到文件\n\n安全：所有命令都经过权限引擎，包括自定义规则、审批记录与沙箱。危险操作可能被阻止；此前被拒绝的命令会自动阻止。",
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: "要执行的 shell 命令。",
      },
      cwd: {
        type: 'string',
        description: "命令的工作目录，默认为当前目录。",
      },
    },
    required: ['command'],
  },
  inputExamples: [
    { command: 'npm test' },
    { command: 'git status', cwd: 'packages/core' },
  ],
  metadata: {
    isDestructive: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    const command = args.command
    const requestedCwd = args.cwd
    if (typeof command !== 'string' || !command.trim()) return '错误：必须提供命令'
    if (command.length > MAX_COMMAND_LENGTH) return '错误：命令过长'
    if (requestedCwd !== undefined && (typeof requestedCwd !== 'string' || requestedCwd.length > MAX_CWD_LENGTH)) {
      return '错误：工作目录参数无效或过长'
    }

    const mode = await loadEffectiveSandbox()
    const workspaceRoot = ctx?.workdir?.trim() || getWorkspaceRoot()
    const cwd = typeof requestedCwd === 'string' && requestedCwd.trim()
      ? (path.isAbsolute(requestedCwd) ? path.resolve(requestedCwd) : path.resolve(workspaceRoot || process.cwd(), requestedCwd))
      : undefined
    // 统一走五层责任链（自定义规则 / 审批记录 / 沙箱），禁止工具内自管权限
    const decision = checkCommandPermission(command, cwd, mode, workspaceRoot)
    const decisionValue = decision.allowed === true ? 'allow' : decision.allowed === 'needs_approval' ? 'needs_approval' : 'deny'
    const decisionStatus = decision.allowed === true ? 'success' : 'blocked'
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.commandSafetyGrading,
      relation: 'used', usageKind: 'permission-decision', status: decisionStatus,
      metadata: { decision: decisionValue, decisionType: decision.decisionType, chain: decision.chain },
    })
    ctx?.assetUsageReporter?.({
      assetKey: PERMISSION_SANDBOX_ASSET_KEYS.sandboxModes,
      relation: 'used', usageKind: 'permission-decision', status: decisionStatus,
      metadata: { sandboxMode: mode, decision: decisionValue },
    })

    if (decision.allowed === false) {
      log.warn('Command blocked by permission engine', {
        commandHash: hashForLog(command),
        commandLength: command.length,
        reason: decision.reason,
        decisionType: decision.decisionType,
        chain: decision.chain,
      })
      return `[沙箱已阻止] ${decision.reason}\n\n当前沙箱模式为“${mode}”。出于安全原因，此命令已被阻止。`
    }

    if (decision.allowed === 'needs_approval') {
      // 责任链已查过审批库仍为 needs_approval → 尚无允许记录。
      // Loop 在 confirmTool 通过后会 recordApproval(session)；若仍到这里说明未确认或 confirm 被跳过。
      log.warn('Command needs approval but none recorded', {
        commandHash: hashForLog(command),
        commandLength: command.length,
        reason: decision.reason,
      })
      return `[沙箱已阻止] ${decision.reason}\n\n此命令执行前需要批准。请请求用户确认，或改用权限更低的替代方案。`
    }

    log.info('Executing command', {
      commandHash: hashForLog(command),
      commandLength: command.length,
      cwdHash: cwd ? hashForLog(cwd) : undefined,
      effectiveSandbox: mode,
      decisionType: decision.decisionType,
    })

    const sanitizedEnv = buildSafeChildProcessEnv()
    if (mode !== 'full-access') {
      delete sanitizedEnv.LD_PRELOAD
      delete sanitizedEnv.DYLD_INSERT_LIBRARIES
    }

    const isWin = process.platform === 'win32'
    const actualCommand = isWin ? `chcp 65001 >nul && ${command}` : command

    return new Promise<string>((resolve) => {
      exec(actualCommand, { timeout: TIMEOUT_MS, cwd, maxBuffer: 2 * 1024 * 1024, env: sanitizedEnv, encoding: 'utf-8' }, (error, stdout, stderr) => {
        const parts: string[] = []

        if (stdout) {
          let out = stdout.toString()
          if (out.length > MAX_OUTPUT_CHARS) {
            out = out.slice(0, MAX_OUTPUT_CHARS) + `\n[... 已在 ${MAX_OUTPUT_CHARS} 个字符处截断]`
          }
          parts.push(out)
        }

        if (stderr) {
          let err = stderr.toString()
          if (err.length > MAX_OUTPUT_CHARS) {
            err = err.slice(0, MAX_OUTPUT_CHARS) + `\n[... 已截断]`
          }
          parts.push(`[标准错误]\n${err}`)
        }

        if (error) {
          const exitCode = error.code ?? 'unknown'
          parts.push(`[退出码：${exitCode}]`)
          if (error.killed) parts.push('[进程因超时被终止]')
          log.warn('Command failed', { commandHash: hashForLog(command), commandLength: command.length, exitCode })
        } else {
          log.info('Command completed', { commandHash: hashForLog(command), commandLength: command.length })
        }

        resolve(parts.join('\n') || '（无输出）')
      })
    })
  },
})
