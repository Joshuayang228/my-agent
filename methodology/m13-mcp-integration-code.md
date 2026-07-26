# M13 MCP 集成 — 代码走读

> 对照 [`m13-mcp-integration.md`](m13-mcp-integration.md)。
> 展示：Bridge 同构、保守元数据、连接四态、描述截断；对照 Alice/CC 概念层差异。

---

## §三 Bridge — 命名空间与同构注册

### 我们的实现

```typescript
// electron/main/mcp/bridge.ts

const MCP_TOOL_PREFIX = 'mcp'

/** ① 全名进 ToolRegistry / LLM tools 列表 */
export function mcpToolFullName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}:${serverId}:${toolName}`
  // ↑ 例：mcp:notes:search
}

export function syncMcpToolsToRegistry(registry: ToolRegistry, serverId: string): number {
  // ① 先按前缀卸旧，再注册 — 处理 listTools 变化
  removeMcpToolsFromRegistry(registry, serverId)
  for (const tool of mcpManager.getAllTools().filter(t => t.serverId === serverId)) {
    registry.register(mcpToolToDefinition(tool))
  }
  // ...
}
```

### CC / Alice 对照

| 来源 | 命名 | 说明 |
|------|------|------|
| CC | `mcp__server__tool` | 双下划线；权限解析专用 utils |
| Alice | `mcp_{serverId}_{toolName}` | 特殊字符规范化 |
| 我们 | `mcp:serverId:toolName` | 冒号；语义同构 |

**发现**：分隔符是口味，**必须有命名空间**才是纪律。迁格式代价高、收益低——保持现状。  
**方法论对照** → m13 §三。

---

## §四 保守元数据（本轮纠偏）

### 我们的实现（纠偏后）

```typescript
// electron/main/mcp/bridge.ts

/**
 * ① 比 buildTool 更严：外部未知 → auto 下也要确认
 * ② isConcurrencySafe:false — 不并行陌生副作用
 * → m13 §四
 */
export const DEFAULT_MCP_TOOL_METADATA = {
  isReadOnly: false,
  isDestructive: true,
  isConcurrencySafe: false,
} as const

export function mcpToolToDefinition(tool: McpTool): ToolDefinition {
  return {
    name: mcpToolFullName(tool.serverId, tool.name),
    description: truncateDescription(`[${tool.serverName}] ${tool.description}`),
    parameters: { /* properties / required */ },
    metadata: { ...DEFAULT_MCP_TOOL_METADATA },
    execute: async (args) => mcpManager.callTool(tool.serverId, tool.name, args),
  }
}
```

### 纠偏前 vs 后

| 字段 | 旧（危险） | 新（保守） |
|------|------------|------------|
| `isDestructive` | `false` | `true` |
| `isConcurrencySafe` | `true` | `false` |

### Alice 对照（概念）

Alice：`requiresPermission: true` / `isConcurrencySafe: false`。  
我们没有单独的 `requiresPermission` 字段——用 `isDestructive` 驱动 Loop 的 `confirmTool`（auto 模式）。

**发现**：字段名不同，**「默认要人点头」** 的语义对齐了。放行靠 permissionRules，不靠改默认。  
**方法论对照** → m13 §四。

### 单测

```typescript
// __tests__/unit/mcp-bridge.test.ts
expect(mcpToolToDefinition(tool).metadata).toEqual(DEFAULT_MCP_TOOL_METADATA)
```

---

## §五 连接四态与启动恢复

### 我们的实现

```typescript
// electron/main/mcp/client.ts

status: 'connecting' | 'connected' | 'error' | 'disconnected'
// error 相带 connection.error 字符串

// electron/main/index.ts（结构示意）
// app ready → restoreMcpConnections(enabled configs)
//   失败 → log.warn，不阻断启动  → m13 §五
// before-quit → mcpManager.disconnectAll()
```

### CC 对照（概念）

CC 另有 `needs-auth` / `disabled` / OAuth 缓存——远程企业场景。我们桌面本地 stdio 主路径不需要整套。

**发现**：四态够用；缺的是 **transport 断开监听 + 自动重连**（暂缓），不是缺状态枚举。  
**方法论对照** → m13 §五、§八。

---

## §六 描述截断

```typescript
// electron/main/mcp/bridge.ts

const MAX_TOOL_DESCRIPTION_LENGTH = 2048  // ↑ 对照 CC / learning-claude-code Ch.08

function truncateDescription(desc: string): string {
  if (desc.length <= MAX_TOOL_DESCRIPTION_LENGTH) return desc
  return desc.slice(0, MAX_TOOL_DESCRIPTION_LENGTH) + '…[description truncated]'
}
```

**发现**：与 CC 常量同量级；这是「防污染」里唯一已落地且低成本的闸门。  
**方法论对照** → m13 §六。

---

## 数据流总览

```text
SettingsPanel / restoreMcpConnections
  → ipc/mcp.ts → mcpManager.connect
  → listTools → syncMcpToolsToRegistry
  → ToolRegistry
  → runtime.chat → agentLoop
       ├─ checkToolPermission
       ├─ confirmTool（MCP 默认 isDestructive → auto 也会问）
       └─ tool.execute → mcpManager.callTool
```

---

## 与理念章检查清单的代码映射

| 清单问题 | 代码落点 |
|----------|----------|
| 命名空间？ | `mcpToolFullName` |
| 保守元数据？ | `DEFAULT_MCP_TOOL_METADATA` |
| 失败拖垮启动？ | `restoreMcpConnections` 吞错 |
| 描述截断？ | `truncateDescription` 2048 |
| Skill 全名？ | `filterTools` 精确匹配（runtime） |
