import { app, safeStorage } from 'electron'
import { closeSync, fstatSync, openSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const FAILURE = '系统安全存储尚未准备好，请稍后重试；原配置未更改'
const MAX_STATE_BYTES = 16 * 1024 * 1024
let pending: Promise<void> | undefined

function isPersisted(): boolean {
  if (!safeStorage.isEncryptionAvailable()) throw new Error(FAILURE)
  if (process.platform !== 'win32') return true
  let descriptor: number | undefined
  try {
    descriptor = openSync(path.join(app.getPath('userData'), 'Local State'), 'r')
    if (fstatSync(descriptor).size > MAX_STATE_BYTES) throw new Error(FAILURE)
    const state = JSON.parse(readFileSync(descriptor, 'utf8'))
    const key = state?.os_crypt?.encrypted_key
    if (typeof key !== 'string') return false
    const bytes = Buffer.from(key, 'base64')
    return bytes.length > 5 && bytes.subarray(0, 5).toString('ascii') === 'DPAPI'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw new Error(FAILURE)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

export function assertEncryptionPersisted(): void {
  if (!isPersisted()) throw new Error(FAILURE)
}

/**
 * 背景：Windows 首启的系统密钥早于 Local State 落盘，立即保存并强退会留下不可解密配置。
 * 意图：只读等待 Chromium 写出 DPAPI 密钥记录，不用固定 sleep、Session flush 或自写密钥。
 * 约束：等待必须在业务快照 / 事务之前；超时零提交，可重试，不缓存成功以免文件丢失后继续写。
 */
export async function ensureEncryptionPersisted(): Promise<void> {
  if (isPersisted()) return
  if (!pending) {
    pending = (async () => {
      const deadline = Date.now() + 15_000
      while (!isPersisted()) {
        if (Date.now() >= deadline) throw new Error(FAILURE)
        await delay(50)
      }
    })().finally(() => { pending = undefined })
  }
  await pending
}
