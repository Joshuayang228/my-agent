import type { Server } from 'node:http'

/**
 * 背景：Windows 的临时端口范围可能包含 fetch 拒绝访问的端口。
 * 意图：用相同的 HTTP 客户端验证测试服务端口，避免以并发波动掩盖测试真实结果。
 * 约束：仅拒绝端口策略导致的失败才重新分配；其他异常直接报告。
 */
export async function listenOnFetchableLoopback(server: Server): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject)
        resolve()
      })
    })
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Fixture unavailable')
      const origin = `http://127.0.0.1:${address.port}`
      await fetch(`${origin}/fixture-readiness`, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
      return origin
    } catch (error) {
      await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
      const cause = error instanceof Error ? error.cause : undefined
      if (!(cause instanceof Error) || cause.message !== 'bad port' || attempt === 4) throw error
    }
  }
}
