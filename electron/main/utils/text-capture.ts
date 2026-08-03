/**
 * Span / 遥测文本捕获：PII·凭据脱敏 + 超长文本预算。
 *
 * 背景：DevPanel / 落盘 trace 若原样存 prompt、工具输出，会泄漏密钥并撑爆内存。
 * 策略：先按字段名与常见凭据模式脱敏；超长字符串改为 preview + sha256 + chars 三段式，
 *       对照灵犀 observability/text_capture.go「记指纹不记全文」。
 * 约束：不修改调用方入参；循环引用收敛为占位；敏感字段名一律 [REDACTED]（不落 hash）。
 * 调用方：tracer.startSpan / SpanHandle.setAttribute(s)；单测直接覆盖。
 * 边界：空串原样返回；非 string 的标量不截断；嵌套对象递归处理字符串叶子。
 */

import { createHash } from 'node:crypto'

/** 超过此长度的字符串改为三段式（字符数，UTF-16 code units 与 JS `.length` 一致） */
export const TEXT_PREVIEW_MAX = 200

export interface TextCapture {
  preview: string
  sha256: string
  chars: number
}

const SENSITIVE_KEY_PATTERN =
  /^(?:api[-_]?key|apikey|access[-_]?token|accesstoken|auth(?:orization)?|bearer|client[-_]?secret|clientsecret|credential|password|refresh[-_]?token|refreshtoken|secret|token)$/i
const SENSITIVE_VALUE_PATTERN =
  /(?:Bearer\s+|sk-(?:ant-)?|gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9._~+/=-]{8,}/gi
const SENSITIVE_URL_PARAM_PATTERN =
  /([?&](?:api[-_]?key|access[-_]?token|token|secret|password)=)[^&#\s"']+/gi

/**
 * 对字符串做凭据级脱敏（不截断）。
 */
export function redactSensitiveText(text: string): string {
  return text
    .replace(SENSITIVE_VALUE_PATTERN, '[REDACTED]')
    .replace(SENSITIVE_URL_PARAM_PATTERN, '$1[REDACTED]')
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * 单段文本捕获：短文本脱敏后原样；超长改为三段式。
 */
export function captureText(raw: string, maxPreview = TEXT_PREVIEW_MAX): string | TextCapture {
  const text = redactSensitiveText(raw)
  if (text.length <= maxPreview) return text
  return {
    preview: text.slice(0, maxPreview),
    sha256: sha256Hex(text),
    chars: text.length,
  }
}

/**
 * error 字段须保持 string：超长时嵌入指纹摘要，不写 TextCapture 对象。
 */
export function captureErrorMessage(raw: string, maxPreview = TEXT_PREVIEW_MAX): string {
  const captured = captureText(raw, maxPreview)
  if (typeof captured === 'string') return captured
  return `${captured.preview}…[sha256=${captured.sha256},chars=${captured.chars}]`
}

/**
 * 捕获单个 attribute 值（按 key 脱敏 + 字符串预算）。
 */
export function captureAttributeValue(
  key: string,
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]'
  if (typeof value === 'string') return captureText(value)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Circular]'
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item, i) => captureAttributeValue(String(i), item, seen))
  }

  const result: Record<string, unknown> = {}
  for (const [childKey, childValue] of Object.entries(value)) {
    result[childKey] = captureAttributeValue(childKey, childValue, seen)
  }
  return result
}

/**
 * 批量捕获 span attributes。
 */
export function captureAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    result[key] = captureAttributeValue(key, value)
  }
  return result
}
