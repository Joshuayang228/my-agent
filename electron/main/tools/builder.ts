/**
 * buildTool() — 工具定义工厂函数。
 *
 * 背景：20 个内置工具直接实现 ToolDefinition 接口时，metadata 字段需要全部显式声明，
 *       新增字段时要改 20 个文件，且容易遗漏导致默认值不一致。
 *
 * 意图：提供一个工厂函数，用户只需声明偏离默认值的字段，其余由工厂 fail-closed 填充。
 *
 * 默认值（fail-closed 安全策略）：
 * - isReadOnly: false — 假设工具会修改状态，比默认只读更安全
 * - isDestructive: false — 大多数工具不是不可逆的
 * - isConcurrencySafe: false — 假设不能并发，比默认并发更安全
 * - maxResultSizeChars: 50_000 — 限制上下文爆炸
 *
 * 调用方：所有内置工具文件，通过 buildTool(def) 替代直接实现 ToolDefinition
 *
 * 约束：工厂不验证 name/description/execute 的内容，调用方负责这些字段的正确性
 */

import type { ToolDefinition, ToolDef } from '../../../src/shared/types'

const METADATA_DEFAULTS = {
  isReadOnly: false,
  isDestructive: false,
  isConcurrencySafe: false,
} as const

export function buildTool(def: ToolDef): ToolDefinition {
  return {
    ...def,
    metadata: {
      ...METADATA_DEFAULTS,
      ...def.metadata,
    },
    maxResultSizeChars: def.maxResultSizeChars ?? 50_000,
  }
}
