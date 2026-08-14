import { createHash } from 'node:crypto'

/** 对模型可见正文或结构描述生成稳定短指纹；不记录原文，也不包含运行时凭据。 */
export function modelContextFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
