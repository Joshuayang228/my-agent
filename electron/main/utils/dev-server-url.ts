/**
 * 规范化 Electron 开发模式的 Vite 地址，避免 localhost 在 Windows 上优先解析到错误的 IPv6 服务。
 *
 * 背景：vite-plugin-electron 会把 127.0.0.1 / ::1 统一输出成 localhost；当旧进程占用 IPv6 端口时，
 *       Chromium 可能加载到另一个 404 服务，而不是当前 Vite 实例。
 * 设计意图：只允许 loopback 开发地址并统一到 IPv4，保留协议、端口、路径和查询参数。
 * 关键约束：外部域名、凭据 URL、非 HTTP(S) 和无效 URL 一律返回 undefined；不能让远程网页获得 preload IPC。
 */
export function normalizeDevServerUrl(value: string | undefined): string | undefined {
  if (!value) return value
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (url.username || url.password) return undefined
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') return undefined
    url.hostname = '127.0.0.1'
    return url.toString()
  } catch {
    return undefined
  }
}
