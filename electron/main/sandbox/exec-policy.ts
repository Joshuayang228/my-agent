/**
 * Execution Policy — 命令安全分级
 *
 * 参考 Codex 的 execpolicy，对 shell 命令进行安全分类：
 * - safe:      已知安全命令，自动放行
 * - dangerous: 已知危险命令/模式，强制拦截或需审批
 * - unknown:   未匹配，按 SandboxMode 决定行为
 */

export type CommandRisk = 'safe' | 'dangerous' | 'unknown'

export interface CommandAssessment {
  risk: CommandRisk
  reason: string
  matchedRule?: string
}

export const SAFE_COMMAND_NAMES = [
  'ls', 'dir', 'tree', 'cat', 'type', 'echo', 'pwd', 'cd',
  'head', 'tail', 'wc', 'grep', 'which', 'where', 'whoami', 'hostname', 'date',
] as const

export const SAFE_COMMAND_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /^(node|python3?|ruby|go|java)\s+--version$/, label: 'version check' },
  { pattern: /^(pwd|whoami|hostname|date)\s*$/, label: 'system information' },
  { pattern: /^(cat|type|head|tail|wc|grep|which|where)(?:\s|$)/, label: 'read-only inspection' },
  { pattern: /^(ls|dir|tree)(?:\s|$)/, label: 'directory listing' },
  { pattern: /^echo(?:\s|$)/, label: 'echo' },
  { pattern: /^cd(?:\s|$)/, label: 'navigation' },
  { pattern: /^git\s+status(?:\s+(?:--short|--branch|--show-stash|--ahead-behind|--porcelain(?:=v[12])?|--untracked-files(?:=(?:no|normal|all))?))*\s*$/, label: 'git status' },
]

export const DANGEROUS_COMMAND_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /rm\s+(-rf?|--force|--recursive)\s+(?:[/\\]|[a-z]:[/\\])/, label: 'recursive delete at root' },
  { pattern: /rm\s+(-rf?|--force)\s+~/, label: 'recursive delete at home' },
  { pattern: /(?:^|\s)format\s+[a-zA-Z]:/, label: 'disk format' },
  { pattern: /(?:^|\s)mkfs(?:\s|$)/, label: 'filesystem format' },
  { pattern: /dd\s+if=.*of=\/dev\//, label: 'disk overwrite' },
  { pattern: />\s*\/dev\/sd[a-z]/, label: 'device write' },
  { pattern: /curl\s+.*\|\s*(bash|sh|zsh|powershell|pwsh)/, label: 'pipe to shell' },
  { pattern: /wget\s+.*\|\s*(bash|sh|zsh|powershell|pwsh)/, label: 'pipe to shell' },
  { pattern: /(?:^|\s)(?:powershell|pwsh)(?:\.exe)?\s+.*-(?:e|encodedcommand)/, label: 'encoded PowerShell' },
  { pattern: /base64\s+-d\s*\|.*sh/, label: 'encoded shell execution' },
  { pattern: /:(){ :\|:& };:/, label: 'fork bomb' },
  { pattern: /(?:^|\s)(?:shutdown|reboot|halt)(?:\s|$)|(?:^|\s)init\s+[06](?:\s|$)/, label: 'system power' },
  { pattern: /chmod\s+777\s+\//, label: 'global permission change' },
  { pattern: /chown\s+-R\s+.*\s+\//, label: 'recursive ownership at root' },
  { pattern: /(?:^|\s)reg\s+(?:delete|add)\s+hklm(?:\s|$)/, label: 'registry modification' },
  { pattern: /(?:^|\s)net\s+user\s+.*\/add/, label: 'user creation' },
  { pattern: /(?:^|\s)netsh\s+firewall/, label: 'firewall modification' },
  { pattern: /(?:^|\s)iptables\s+-f(?:\s|$)/, label: 'firewall flush' },
  { pattern: /(?:^|\s)(?:eval|invoke-expression|iex)\s*[(\s]/, label: 'eval execution' },
  { pattern: /(?:^|\s)env\s+.*=.*\bsudo\b/, label: 'sudo via env' },
  { pattern: /(?:^|\s)(?:del|erase|rmdir|rd)\s+/, label: 'windows delete' },
  { pattern: /(?:^|\s)(?:remove-item|ri)\b.*(?:-recurse|-force|-literalpath)/, label: 'PowerShell delete' },
  { pattern: /(?:^|\s)diskpart\b/, label: 'disk partitioning' },
  { pattern: /(?:^|\s)git\s+(?:reset\s+--hard|clean\s+[^\n]*\bf)/, label: 'destructive git cleanup' },
]

export function assessCommand(command: string): CommandAssessment {
  const trimmed = command.trim()
  const normalized = trimmed.toLowerCase()
  const firstWord = normalized.split(/\s+/)[0] || ''

  for (const dangerPattern of DANGEROUS_COMMAND_PATTERNS) {
    if (dangerPattern.pattern.test(normalized)) {
      return { risk: 'dangerous', reason: dangerPattern.label, matchedRule: dangerPattern.pattern.source }
    }
  }

  for (const safePattern of SAFE_COMMAND_PATTERNS) {
    if (safePattern.pattern.test(normalized)) {
      return { risk: 'safe', reason: safePattern.label, matchedRule: safePattern.pattern.source }
    }
  }

  return { risk: 'unknown', reason: `unrecognized command: ${firstWord}` }
}
