import type { FetchLike } from '@modelcontextprotocol/sdk/shared/transport.js'
import { createRestrictedFetch } from '../utils/restricted-fetch'

export { withRequestAbort as withOAuthAbort, isLoopbackUrl as isOAuthLoopback, resolveRestrictedTarget as resolveOAuthTarget } from '../utils/restricted-fetch'

/** OAuth 保持原来的 1 MiB / 15 秒限制；MCP 长连接仍由 SDK 的取消信号管理。 */
export function createOAuthFetch(serverUrl: string, signal: AbortSignal, streaming = false): FetchLike {
  return createRestrictedFetch(serverUrl, signal, { streaming })
}
