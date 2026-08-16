/**
 * 极简行 diff（审阅面板用）
 *
 * 背景：Phase 1 不引入 diff 库；只要能看出增删即可。
 * 设计意图：LCS 对短文件够用；超大则退化为「仅展示 after」。
 * 关键约束：输入已截断的 before/after；输出 unified 风格文本。
 */

const MAX_LINES = 4000
const MAX_DP_CELLS = 1_000_000
const MAX_FALLBACK_CHARS = 200_000

export function formatUnifiedDiff(
  filePath: string,
  before: string | null,
  after: string,
): string {
  if (before == null) {
    const body = after.length > MAX_FALLBACK_CHARS
      ? after.slice(0, MAX_FALLBACK_CHARS) + '\n[... 当前文件过大，已截断]'
      : after
    return `--- /dev/null\n+++ ${filePath}\n` + body.split('\n').map((l) => `+${l}`).join('\n')
  }
  const a = before.split('\n')
  const b = after.split('\n')
  if (a.length + b.length > MAX_LINES || a.length * b.length > MAX_DP_CELLS) {
    const body = after.length > MAX_FALLBACK_CHARS
      ? after.slice(0, MAX_FALLBACK_CHARS) + '\n[... 当前文件过大，已截断]'
      : after
    return `--- ${filePath} (before)\n+++ ${filePath} (after)\n@@ 文件过大，省略逐行 diff；下方为当前内容节选 @@\n` + body
  }
  const ops = diffLines(a, b)
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`, '@@']
  for (const op of ops) {
    if (op.type === 'equal') {
      for (const l of op.lines) lines.push(` ${l}`)
    } else if (op.type === 'del') {
      for (const l of op.lines) lines.push(`-${l}`)
    } else {
      for (const l of op.lines) lines.push(`+${l}`)
    }
  }
  return lines.join('\n')
}

type DiffOp =
  | { type: 'equal'; lines: string[] }
  | { type: 'del'; lines: string[] }
  | { type: 'add'; lines: string[] }

function diffLines(a: string[], b: string[]): DiffOp[] {
  // Myers 简化：DP LCS 表；规模受 MAX_LINES 约束
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: DiffOp[] = []
  let i = 0
  let j = 0
  const push = (type: DiffOp['type'], line: string) => {
    const last = ops[ops.length - 1]
    if (last && last.type === type) last.lines.push(line)
    else ops.push({ type, lines: [line] } as DiffOp)
  }
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('equal', a[i])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', a[i])
      i++
    } else {
      push('add', b[j])
      j++
    }
  }
  while (i < n) {
    push('del', a[i])
    i++
  }
  while (j < m) {
    push('add', b[j])
    j++
  }
  return ops
}
