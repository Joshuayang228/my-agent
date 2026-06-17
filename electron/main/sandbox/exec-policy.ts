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

const SAFE_COMMANDS = new Set([
  'ls', 'dir', 'cat', 'type', 'echo', 'pwd', 'cd',
  'head', 'tail', 'wc', 'sort', 'uniq', 'grep', 'rg', 'find',
  'which', 'where', 'whoami', 'hostname', 'date',
  'node', 'python', 'python3', 'git', 'npm', 'npx', 'pnpm', 'yarn',
  'tsc', 'eslint', 'prettier', 'vitest', 'jest',
  'cargo', 'rustc', 'go', 'java', 'javac',
])

const SAFE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^(node|python3?|ruby|go|java)\s+--version$/, label: 'version check' },
  { pattern: /^(npm|pnpm|yarn)\s+(list|ls|info|view|outdated|audit)/, label: 'package info' },
  { pattern: /^git\s+(status|log|diff|branch|show|tag|remote|stash list)/, label: 'git read' },
  { pattern: /^(cat|type|head|tail|less|more)\s+/, label: 'file read' },
  { pattern: /^(ls|dir|tree)\s*/, label: 'directory listing' },
  { pattern: /^echo\s+/, label: 'echo' },
  { pattern: /^(pwd|cd)\s*/, label: 'navigation' },
  { pattern: /^npx\s+(tsc|vitest|jest|eslint|prettier)\s+/, label: 'dev tool via npx' },
]

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /rm\s+(-rf?|--force|--recursive)\s+[/\\]/, label: 'recursive delete at root' },
  { pattern: /rm\s+(-rf?|--force)\s+~/, label: 'recursive delete at home' },
  { pattern: /format\s+[a-zA-Z]:/, label: 'disk format' },
  { pattern: /mkfs/, label: 'filesystem format' },
  { pattern: /dd\s+if=.*of=\/dev\//, label: 'disk overwrite' },
  { pattern: />\s*\/dev\/sd[a-z]/, label: 'device write' },
  { pattern: /curl\s+.*\|\s*(bash|sh|zsh|powershell|pwsh)/, label: 'pipe to shell' },
  { pattern: /wget\s+.*\|\s*(bash|sh|zsh|powershell|pwsh)/, label: 'pipe to shell' },
  { pattern: /powershell\s+.*-[eE]nc/, label: 'encoded PowerShell' },
  { pattern: /base64\s+-d\s*\|.*sh/, label: 'encoded shell execution' },
  { pattern: /:(){ :\|:& };:/, label: 'fork bomb' },
  { pattern: /shutdown|reboot|halt|init\s+[06]/, label: 'system power' },
  { pattern: /chmod\s+777\s+\//, label: 'global permission change' },
  { pattern: /chown\s+-R\s+.*\s+\//, label: 'recursive ownership at root' },
  { pattern: /reg\s+(delete|add)\s+HKLM/, label: 'registry modification' },
  { pattern: /net\s+user\s+.*\/add/, label: 'user creation' },
  { pattern: /netsh\s+firewall/, label: 'firewall modification' },
  { pattern: /iptables\s+-F/, label: 'firewall flush' },
  { pattern: /eval\s*\(/, label: 'eval execution' },
  { pattern: /env\s+.*=.*\bsudo\b/, label: 'sudo via env' },
]

export function assessCommand(command: string): CommandAssessment {
  const trimmed = command.trim()
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase() || ''

  for (const dp of DANGEROUS_PATTERNS) {
    if (dp.pattern.test(trimmed)) {
      return { risk: 'dangerous', reason: dp.label, matchedRule: dp.pattern.source }
    }
  }

  if (SAFE_COMMANDS.has(firstWord)) {
    return { risk: 'safe', reason: `known safe command: ${firstWord}` }
  }

  for (const sp of SAFE_PATTERNS) {
    if (sp.pattern.test(trimmed)) {
      return { risk: 'safe', reason: sp.label, matchedRule: sp.pattern.source }
    }
  }

  return { risk: 'unknown', reason: `unrecognized command: ${firstWord}` }
}
