import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  TEXT_PREVIEW_MAX,
  captureAttributeValue,
  captureAttributes,
  captureErrorMessage,
  captureText,
  redactSensitiveText,
} from '../../electron/main/utils/text-capture'

describe('text-capture', () => {
  it('短文本只脱敏不截断', () => {
    expect(captureText('hello')).toBe('hello')
    expect(redactSensitiveText('Bearer sk-ant-abcdefghijklmnop')).toContain('[REDACTED]')
    expect(captureText('token=Bearer sk-ant-abcdefghijklmnop')).toBe(
      redactSensitiveText('token=Bearer sk-ant-abcdefghijklmnop'),
    )
  })

  it('超长文本变为 preview + sha256 + chars', () => {
    const raw = 'a'.repeat(TEXT_PREVIEW_MAX + 50)
    const captured = captureText(raw)
    expect(typeof captured).toBe('object')
    if (typeof captured === 'string') throw new Error('expected TextCapture')
    expect(captured.preview).toBe('a'.repeat(TEXT_PREVIEW_MAX))
    expect(captured.chars).toBe(raw.length)
    expect(captured.sha256).toBe(createHash('sha256').update(raw, 'utf8').digest('hex'))
  })

  it('敏感字段名整值 REDACTED，不落 hash', () => {
    expect(captureAttributeValue('apiKey', 'sk-ant-secretvalue123')).toBe('[REDACTED]')
    expect(captureAttributeValue('password', 'x'.repeat(300))).toBe('[REDACTED]')
  })

  it('嵌套对象递归捕获字符串叶子', () => {
    const long = 'b'.repeat(TEXT_PREVIEW_MAX + 10)
    const attrs = captureAttributes({
      model: 'gpt-4',
      prompt: long,
      nested: { token: 'should-hide', note: 'ok' },
    })
    expect(attrs.model).toBe('gpt-4')
    expect(attrs.prompt).toMatchObject({ chars: long.length })
    expect((attrs.nested as Record<string, unknown>).token).toBe('[REDACTED]')
    expect((attrs.nested as Record<string, unknown>).note).toBe('ok')
  })

  it('error 消息保持 string 并嵌入指纹', () => {
    const raw = 'err-'.repeat(80)
    const msg = captureErrorMessage(raw)
    expect(typeof msg).toBe('string')
    expect(msg).toContain('sha256=')
    expect(msg).toContain(`chars=${raw.length}`)
  })
})
