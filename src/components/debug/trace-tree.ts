import type { DebugTraceSpan } from '../../shared/debug-traces'

/** 背景：有界快照可能缺父级，损坏环和重复 ID 不能让整段链路消失或无限递归。
 * 意图：只沿显式父级遍历，剩余节点独立保留并报告异常，原始结构留给来源核对。
 * 约束：links 不参与树或耗时计算；每个稳定 ID 只渲染一次，不修改原快照。
 */
export function traceTree(spans: readonly DebugTraceSpan[]) {
  const byId = new Map<string, DebugTraceSpan>(), children = new Map<string, DebugTraceSpan[]>()
  for (const span of spans) if (!byId.has(span.id)) byId.set(span.id, span)
  for (const span of byId.values()) if (span.parentId) children.set(span.parentId, [...children.get(span.parentId) ?? [], span])
  const seen = new Set<string>(), nodes: Array<{ span: DebugTraceSpan; depth: number }> = []
  let cyclic = false
  const visit = (root: DebugTraceSpan) => {
    const stack = [{ span: root, depth: 0 }]
    while (stack.length) {
      const node = stack.pop()!
      if (seen.has(node.span.id)) { cyclic = true; continue }
      seen.add(node.span.id); nodes.push(node)
      for (const child of [...children.get(node.span.id) ?? []].reverse()) stack.push({ span: child, depth: node.depth + 1 })
    }
  }
  for (const span of byId.values()) if (!span.parentId || !byId.has(span.parentId)) visit(span)
  for (const span of byId.values()) if (!seen.has(span.id)) { cyclic = true; visit(span) }
  return { nodes, cyclic, duplicates: spans.length - byId.size, orphans: spans.filter(span => span.parentId && !byId.has(span.parentId)).length }
}
