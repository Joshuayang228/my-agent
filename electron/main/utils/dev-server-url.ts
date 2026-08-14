/**
 * 规范化 Electron 开发模式的 Vite 地址，避免 localhost 在 Windows 上优先解析到错误的 IPv6 服务。
 *
 * 背景：vite-plugin-electron 会把 127.0.0.1 / ::1 统一输出成 localhost；当旧进程占用 IPv6 端口时，
 *       Chromium 可能加载到另一个 404 服务，而不是当前 Vite 实例。
 * 设计意图：只改 loopback 主机名，保留协议、端口、路径和查询参数；外部开发地址不做改写。
 * 关键约束：无效 URL 原样返回，避免启动阶段因诊断辅助逻辑阻断主进程。
 */
export function normalizeDevServerUrl(value: string | undefined): string | undefined {
  if (!value) return value
  try {
    const url = new URL(value)
    if (url.hostname === 'localhost' || url.hostname === '::1' || url.hostname === '[::1]') url.hostname = '127.0.0.1'
    return url.toString()
  } catch {
    return value
  }
}
