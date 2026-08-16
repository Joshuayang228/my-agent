# M13 MCP 集成方法论

> 这份文档沉淀我们对「用标准协议扩展 Agent 能力」的设计思考。
> 前半部分是**认知框架**——MCP 在产品里站哪、怎么进工具表、为何默认不可信。
> 后半部分是**实战记录**——现状、本轮纠偏、刻意不做。
>
> 对照源：Alice Ch.08 × learning-claude-code Ch.08 × wps-cowork MCP / 元工具设计 × 我们的 `mcp/client.ts` + `bridge.ts`
> 沉淀时间：2026-07-26
>
> **纠偏先写在前面**：占位稿曾写「功能尚未实现」——**过时**。工程侧已有 Client + Bridge + 设置页 + 启动恢复；本章补认知地图，并纠偏「外部工具元数据过于乐观」。

---

# 第一部分：认知框架

## 一、第一性原理：MCP 是不可信外部能力的标准通道

M11 已定：伙伴产品的用户扩展走 Skill / MCP / 人格 / 设置，不走 lifecycle Hook。MCP 负责其中「接外部系统」这一格。

第一性原理：

**MCP 是用户侧能力扩展的标准通道；外部工具默认不可信——必须经命名空间进入统一工具表，过权限与元数据闸门，连接失败不得拖垮主对话。**

一旦接受这条，后面都是推论：怎么统一入口、怎么保守默认、连接与配置怎么分、何时才上元工具/重连/Elicitation。

```
第一性原理：MCP = 不可信外部能力的标准通道

├─ 推论组 A：定位与统一入口
│     §二 与 Skill/Hook 分工 · §三 Bridge 同构进 Registry
│
├─ 推论组 B：安全与连接契约
│     §四 元数据保守默认 · §五 配置持久 / 连接瞬态 · §六 防污染
│
└─ 推论组 C：交点与刻意不做
      §七 相邻模块 · §八 暂缓项
```

---

# 推论组 A：定位与统一入口

> 第一性原理说「标准通道」。通道若另起一套调用栈，LLM 和权限引擎都要学两遍——所以必须同构。

## 二、与 Skill / Hook 的分工

| 用户意图 | 通道 | 不是 MCP 的原因 |
|----------|------|-----------------|
| 接外部系统 / 第三方工具 | **MCP** | 标准协议、运行时发现 |
| 多会一门「自己的」手艺 | Skill | Markdown + 版本回滚，不依赖外部进程 |
| 拦生命周期改行为 | ~~Hook~~ | M11：伙伴不做用户 lifecycle Hook |
| 松/紧审批 | ExecutionMode + permissionRules | 信任配置，不是传输层 |

判据：**要「多一种能力」→ Skill 或 MCP；要「改框架语义」→ 改代码写进对应方法论章。**

## 三、Bridge：对 LLM 与本地工具同构

工作模型（受 Alice 启发，非照搬命名）：

```
MCP Server listTools
  → Bridge 转成 ToolDefinition（命名空间 + 截断 + 元数据）
  → ToolRegistry.register
  → runtime.getAll() → Loop / LLM
  → execute → mcpManager.callTool
```

对模型来说，MCP 工具和 `file_read` 一样出现在 tools 列表里——**没有第二套 function calling**。

命名空间（我们选的形态）：

```text
mcp:{serverId}:{toolName}
```

- 防止跨 Server 撞名
- 权限规则可写前缀（如 `mcp:notes:*`，视匹配器支持）
- Skill `allowed_tools` 需写全名（精确匹配，不自动放行 `mcp:`）

与 CC `mcp__server__tool` / Alice `mcp_server_tool` 语义相同，分隔符不同——桌面栈里冒号可读性更好；若某 Provider 对 function name 字符集过敏，再做规范化层（暂缓）。

---

# 推论组 B：安全与连接契约

> 「不可信」落到两件事：工具**敢不敢默默跑**，以及连接**挂了会不会拖死启动**。

## 四、外部工具元数据必须保守默认

内置工具走 `buildTool` fail-closed（`isConcurrencySafe: false`）。MCP 比内置更不可信——Server 作者不是我们。

| 字段 | MCP 默认 | 为什么 |
|------|----------|--------|
| `isReadOnly` | `false` | 不假设只读 |
| `isDestructive` | `true` | auto / plan-first 走确认（对齐 Alice `requiresPermission`） |
| `isConcurrencySafe` | `false` | 未知副作用不并行 |

放行不是改默认，而是：

1. 用户在权限规则里 allow 某个 `mcp:…`
2. 或接受确认弹窗 / 改执行模式

**反面教材（本轮已纠偏）**：曾硬编码 `isDestructive:false` + `isConcurrencySafe:true`——等于把陌生 Server 当只读并发内置工具。

## 五、配置持久，连接瞬态

| 层 | 存活 | 内容 |
|----|------|------|
| 配置 | SQLite / settings | server 列表、command、enabled |
| 连接态 | 内存 | `connecting \| connected \| error \| disconnected` |

纪律（与 M15 一致）：

- 启动：对 `enabled` 配置做恢复连接；**失败只打日志，不改配置、不阻断 app ready**
- 退出：`disconnectAll`
- `disconnected` 从 Map 删除后几乎不可观测——可接受；持久真相是配置，不是瞬态

传输：产品支持 **stdio** 与 **SSE**；设置 UI、preload、IPC 和主进程校验已同步。当前不扩展更多传输。

## 六、防污染：描述截断，规模化另议

OpenAPI 生成的工具描述可达十几～几十 KB。我们截断 **2048** 字符（对照 CC / learning-claude-code），避免单个外部工具撑爆上下文。

工具数量爆炸时，行业有两条路：

- **元工具收敛**（wps-cowork：`list` / `describe` / `call` 三件套）
- **ToolSearch**（CC）

我们当前 Server 数量级远未到——**先全量注入 + 截断**；规模痛了再开元工具专项，不在本章预建。

---

# 推论组 C：交点与刻意不做

## 七、与相邻模块的交点

| 模块 | 交点 |
|------|------|
| M04 工具 | Bridge 产出标准 `ToolDefinition`；并发批处理看 `isConcurrencySafe` |
| M10 权限 | `checkToolPermission` + `isDestructive` 确认；规则可放行 MCP |
| M11 扩展点 | 用户通道之一；不是 Hook |
| M12 IPC | `mcp:connect/disconnect/status/list-tools` |
| M15 状态机 | 连接四态是图鉴成员；配置 vs 瞬态边界 |
| M19 子 Agent | 默认只读子 Agent 拿不到 MCP（`isReadOnly:false`）；显式 allowed 需全名 |
| M20 Skill | `allowed_tools` 精确匹配 MCP 全名 |

## 八、刻意不做 / 暂缓

1. **Elicitation 完整协议**——现有 `confirmTool` 覆盖「人确认」；Server→用户表单级反问后置
2. **自动断线重连**——先手动重连 + 启动恢复；监听 transport close 另立项
3. **六种传输 / OAuth / needs-auth**——桌面伙伴以本地 stdio 为主
4. **Resources / Prompts / Sampling**——非本轮主路径
5. **元工具 / ToolSearch**——规模未到
6. **OS 沙箱包住 MCP 子进程**——属 M10 大项
7. **通用 FSM 包装连接态**——M15 已否决通用框架

---

# 第二部分：实战记录

## 学 / 审（2026-07-26）

- Alice：懒连接、命名空间、2048 截断、权限保守默认
- learning-claude-code：六传输、连接态机、Elicitation、配置原子写——完整但超出当前产品需要
- wps-cowork：元工具收敛解决工具爆炸——规模策略参考
- 我们：骨架齐全；元数据偏乐观；无重连 / Elicitation / MCP 单测；占位文案过时

## 本轮改动（A+B）

| 项 | 动作 |
|----|------|
| `bridge.ts` 元数据 | → `isDestructive:true` / `isConcurrencySafe:false` |
| 单测 | `__tests__/unit/mcp-bridge.test.ts` |
| 方法论 | 本章 + code 章 |

## 暂缓项（进 wishlist）

| 项 | 说明 |
|----|------|
| 其他远程认证传输 | stdio/SSE 已落地；OAuth/企业认证暂缓 |
| 断线检测与自动重连 | |
| Schema 保真（$defs/anyOf） | 现只映射 properties/required |
| Elicitation / Resources | |
| 工具名 Provider 字符集规范化 | |
| 配置原子写 | gap-audit 曾点名 |

## 沉淀：MCP 设计检查清单

1. 这个能力该走 MCP、Skill，还是改框架？
2. 进 Registry 的名字有没有命名空间？
3. 元数据是否按「不可信外部」保守默认？
4. 连接失败会不会拖垮启动 / 主对话？
5. 描述是否可能撑爆上下文？
6. Skill / 子 Agent 白名单有没有写到全名？
7. 是否过早上元工具或六传输？

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 本轮范围 | 文档 + 元数据纠偏 | P0 安全默认；协议深度后置 |
| 命名分隔符 | `mcp:a:b` | 与现网一致，不迁 CC 双下划线 |
| isDestructive 默认 | **true** | 比 buildTool 更严；外部未知 |
| 懒连接 | 暂不改 | 已有启动恢复；懒连接与 DevPanel mcp_ready 另议 |
