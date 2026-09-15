/**
 * 补丁预检和执行必须读取同一目标，避免省略 path 时绕过文件规则。
 * 保留已有解析器的最后一条 +++ 目标语义；本函数不解释 hunks 或新增多文件支持。
 */
export function resolvePatchTarget(patch: string): string | null {
  let target: string | null = null
  for (const line of patch.split('\n')) {
    if (!line.startsWith('+++ ')) continue
    const file = line.slice(4).trim()
    target = file.startsWith('b/') ? file.slice(2) : file
  }
  return target
}
