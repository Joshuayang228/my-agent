let tail: Promise<void> = Promise.resolve()

/** MCP 配置含凭据且整表存储；读改写串行化，失败必须释放，不把锁当作旧快照冲突检测。 */
export async function withMcpConfigLock<T>(action: () => Promise<T>): Promise<T> {
  const previous = tail
  let release!: () => void
  tail = new Promise<void>((resolve) => { release = resolve })
  await previous
  try { return await action() }
  finally { release() }
}
