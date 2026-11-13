# My Agent Agent Host 总体架构施工合同 v1

> 状态：进行中
> 生命周期：进行中，指导 Agent Host 核心抽象、能力接入和现有模块迁移。

## 1. 需求背景

My Agent 已经具备 Agent Loop、Agent Runtime、Tool Registry、Skill Registry、Persona、Memory、Companion、Workspace 和 Electron 接入层。当前这些能力可以运行，但跨领域的统一组织方式还没有形成：Runtime 仍然知道部分 Companion 业务，Domain 没有统一声明自身能力的契约，固定工作流和自然语言 Tool 调用也没有共用一套应用层入口。

当前仍处于开发阶段，适合一次性确定稳定边界，避免继续把业务判断堆进 Runtime 或为每个入口复制一套 Domain 调用逻辑。

## 2. 产品目标

My Agent 定位为本地优先的 **Agent Host**：承载、创建、运行和管理多个 Agent。每个 Agent 通过 Manifest 组合 Persona、Memory、Domain、Skill、Tool、Model Policy 和 Permission Policy，共享 Runtime 与 Infrastructure，同时保持身份、记忆、状态和权限隔离。

## 3. 架构目标

```text
Entry Adapters
  Electron UI · IPC · Scheduler · Headless
                 ↓
Application Layer
  Use Case · Workflow · Lifecycle Orchestration
                 ↓
Agent Host
  Agent Manifest · Domain Registry · Capability Registry
                 ↓
Agent Runtime
  Loop · Context · Tool Runtime · Permission · Task · Session
                 ↓
Domain Layer
  Persona · Memory · Companion · Workspace · Knowledge
                 ↓
Infrastructure
  SQLite · Vector Store · LLM · MCP · Filesystem · Shell
```

依赖方向保持向下：Entry Adapter → Application / Host → Runtime / Capability → Domain → Infrastructure。Domain 不依赖 Runtime、Electron 或具体入口。Runtime 不依赖 Companion、Diary、Moments 等产品语义。

## 4. 核心概念边界

### 4.1 Agent

Agent 是一个可运行实例，由稳定身份、Domain 组合、能力授权、模型策略、权限策略和主动生命周期策略组成。Agent 的运行状态属于实例作用域，不能与另一个 Agent 共享。

### 4.2 Domain

Domain 是拥有业务事实、规则、不变量和用例的业务边界。Domain 可以提供查询、命令、事件、Context Provider、Tool Adapter、Workflow Adapter 和 Lifecycle Hook，但不感知这些能力是由 UI、LLM 还是 Scheduler 触发。

Domain 不等于 Tool，也不等于 Skill。Companion 是当前最完整的 Domain，Persona、Memory、Workspace 和 Knowledge 按相同方向逐步接入。

### 4.3 Capability

Capability 是 Domain 面向 Agent Host 暴露的一个受控能力。每个 Capability 具有稳定 key、输入输出 schema、调用方式、所需权限、上下文依赖和幂等语义。

Capability 分为：

- `query`：读取事实或生成只读 Context。
- `command`：修改 Domain 事实，必须经过 Application / Command Gateway。
- `workflow`：固定业务流程，由 Application 直接编排，也可以被 Tool Adapter 调用。
- `context`：向 Context Compiler 提供有界动态上下文。
- `lifecycle`：响应会话完成、定时器、启动和恢复等宿主事件。

Capability 可声明 `exposeToTool: false`。生命周期和仅供 Scheduler / Headless 使用的 Workflow 默认不进入 LLM Tool Catalog，固定入口仍可通过 Application Orchestrator 调用。

### 4.4 Tool

Tool 是 Capability 面向 LLM 的调用协议。Tool schema、参数校验、Permission、执行中间件和结果回传由 Tool Runtime 管理。LLM 只能调用当前 Agent 已授权并已暴露的 Tool。

### 4.5 Skill

Skill 是操作方法和行为指导，说明如何组合多个 Tool 或 Workflow。Skill 不拥有业务事实，不直接绕过 Domain 命令，也不替代 Permission。现有 Skill Registry 的按需激活机制保留，并通过 Capability Registry 读取授权能力。

### 4.6 Workflow

Workflow 是确定性的 Application 用例。用户点击写日记、Scheduler 生成朋友圈、生活引擎推进和数据导入等明确流程由 Workflow 直接编排，不要求 LLM 先判断入口。

自然语言任务由 LLM 通过 Tool Runtime 理解和拆解。两条入口最终调用同一 Domain Capability，不能维护两套业务规则。

## 5. Agent Manifest

Agent Manifest 是 Agent Host 装配 Agent 的唯一声明入口，至少包含：

```ts
interface AgentManifest {
  id: string
  version: number
  personaKey: string
  domainKeys: string[]
  capabilityPolicy: {
    allow: string[]
    deny: string[]
  }
  skillKeys: string[]
  modelPolicyKey: string
  permissionPolicyKey: string
  lifecyclePolicyKey?: string
}
```

Manifest 只声明身份、组合和授权，不复制 Prompt 正文、Memory 数据、人物运行态或工具实现。生产 Manifest 必须进入生产资产注册与 Debug 只读目录。

## 6. Registry 与 Application Orchestrator

### 6.1 Domain Registry

负责注册和发现 Domain Definition。Definition 只包含稳定身份、版本、依赖、生命周期和能力工厂，不持有用户数据。

### 6.2 Capability Registry

根据 Agent Manifest、Permission Policy 和当前执行作用域计算 `Registered → Available → Activated` 三种状态：

- `Registered`：Domain 已注册，Agent 可以拥有它。
- `Available`：当前会话可以发现和调用对应能力。
- `Activated`：本轮执行实际使用了能力。

按需激活只针对已授权 Capability，不允许 LLM 自由加载 Domain。激活 Capability 不等于把全部数据加载到上下文。Memory 激活只执行有界检索，Diary 激活只装配当前 Workflow 所需素材。

### 6.3 Application Orchestrator

负责：

- 解析当前 Agent 和会话类型。
- 装配基础 Domain 与基础 Context。
- 根据 Manifest 生成可用 Capability 目录。
- 直接运行固定 Workflow。
- 为 Agent Runtime 提供 Tool、Context、Permission 和 Lifecycle 运行环境。
- 将会话完成、定时任务、恢复和后台事件路由到对应 Workflow / Lifecycle Hook。

Application Orchestrator 不替 LLM 判断自然语言意图，也不实现 Domain 业务规则。Agent Host 只负责 Manifest 装配、Domain / Capability 发现、授权和 Execution Environment，日记、朋友圈、生活推进和 Workspace 等固定 Workflow 由 Application 负责，二者不能同时编排同一业务流程。

## 7. 基础 Domain 与按需 Capability

代码决定的基础能力：

- Persona：稳定身份和行为基线。
- Session：当前会话、取消、流式生命周期。
- Permission：当前 Agent 的安全边界。
- Companion Core：当前人物最小运行态和关系摘要。

按需暴露的能力：

- Memory Search / Recall。
- Diary Read / Generate。
- Moments Read / Publish / Comment。
- Relationship Read。
- Travel、Wardrobe、Keepsake 等 Companion Workflow。
- Workspace 文件与项目能力。

按需能力仍由代码注册、授权和校验。LLM 只选择可见的 Tool，不负责加载未授权 Domain。

## 8. Context Provider 契约

Context Provider 必须声明：

```ts
interface ContextProvider {
  key: string
  scope: 'agent' | 'session' | 'turn' | 'task'
  priority: number
  maxChars: number
  requires: string[]
  provide(input: ContextRequest): Promise<ContextBlock | null>
}
```

Context 由 Context Compiler 按固定顺序装配：Persona → Session → Permission → 当前任务 → Companion / Workspace 动态切片 → Memory 检索结果 → Tool 环境。Provider 还必须声明稳定 `source`，同一事实只能由一个 Provider 进入同一 scope，重复内容按 source 和优先级去重。Provider 只能返回有界、可追踪来源的内容，不能直接修改 Domain。

## 8.1 Host 与 Application 的边界

Host 只保存 Manifest、Domain Definition、Capability 元数据、授权结果和执行环境。Capability Registry 不能成为第二个 Service Container，不能持有业务状态、数据库连接或隐藏的服务实现。

Application 负责固定 Workflow 的输入校验、业务编排、失败恢复和事实提交。Domain Service 负责业务规则和状态转换。Workflow 与自然语言 Tool 必须调用同一个 Application / Domain 执行实现，不能分别复制朋友圈、日记或 Workspace 写入链路。

## 8.2 Scoped Tool Catalog

当前全局 ToolRegistry 加 Runtime `filterTools` 只作为迁移过渡。目标态是每个会话创建 `Scoped Tool Catalog`，只包含当前 Agent Manifest 授权、当前 Permission Policy 允许、当前 Session 可用的 Tool。Scoped Catalog 不能修改全局 ToolRegistry，也不能把另一个 Agent 的 Capability 带入模型请求。

## 8.3 Manifest 生产事实源

Manifest 必须来自版本化生产事实源，至少记录 Agent 身份、Domain 组合、Capability allow / deny、Skill、Model Policy、Permission Policy 和 Lifecycle Policy。Manifest 不复制 Persona 正文、Memory 数据、会话历史或人物运行态。代码工厂只允许作为生产 Manifest loader，不得成为隐藏的第二份配置。

## 8.4 Skill 与 Capability

Skill Registry 需要向 Capability Registry 提供 Skill 的元数据和允许能力关系。Skill 仍然只负责操作指导和能力组合，不能拥有业务状态、重新实现 Domain 规则或绕过 Permission。Skill 激活工具与 Domain Capability 不能重复注册同名 Tool，已有 Tool 必须通过稳定映射复用。

## 8.5 Debug 能力证据

Debug 必须展示真实的 `Registered`、`Available`、`Activated` 状态。Registered 来自生产 Registry，Available 来自当前 Agent Manifest、Permission Policy 和 Session 作用域，Activated 来自本次实际 Tool / Workflow 调用记录。静态清单不能伪造 Available 或 Activated。

## 9. 数据与执行不变量

- Agent 身份、Memory、Domain 状态、Session 和 Permission 按 Agent / Role 作用域隔离。
- 固定 Workflow 与 LLM Tool 最终复用同一个 Domain Capability。
- Domain 事实只能通过 Application / Command Gateway 修改。
- Tool 不直接写 Storage，不直接调用 Electron IPC。
- Skill 不拥有业务状态，不绕过 Permission。
- LLM 只能调用 Manifest 授权且 Capability Registry 暴露的能力。
- Application 和 Runtime 不把未授权 Domain 注入 Prompt 或 Tool schema。
- 外部模型、网络、窗口和文件副作用不进入本地事务。
- 每个 command、workflow 和 tool result 都具有稳定 trace、幂等和失败语义。

## 10. 实施范围

### P0 · 契约与骨架

1. 新增共享 Agent Manifest、Domain Definition、Capability Definition、Context Provider 和 Application Context 类型。
2. 新增 Domain Registry、Capability Registry 和 Application Orchestrator 的生产实现及单元测试。
3. 明确 Registry 与生产资产注册表、Permission Engine、Tool Registry 的关系，禁止重复维护能力目录。

### P1 · 主链路接入

1. 将当前主角 Chat 通过 Application Orchestrator 装配基础 Persona、Session、Permission、Companion Core 和 Memory Provider。
2. 将现有 Tool Registry / Skill Registry 接入 Capability Registry，保留既有 Tool key、Prompt 注册和权限门禁。
3. 将 Companion、Memory、Persona、Workspace 注册为第一批 Domain Definition。
4. 将固定的日记、朋友圈、生活推进、主会话完成和 Workspace Workflow 接入 Application 层。
5. 将 Manifest 生产事实源版本化，并建立会话级 Scoped Tool Catalog 的接口。

### P2 · 渐进式能力暴露

1. 为 Memory、Diary、Moments、Relationship、Workspace 建立按需 Capability。
2. 增加 Registered / Available / Activated 的 Debug 只读证据。
3. 增加自然语言 Tool 调用与固定 Workflow 共用 Capability 的 E2E 验收。
4. 将 Skill Registry 的元数据和能力关系接入 Capability Registry，禁止重复注册。
5. 增加 Context Provider 重复事实检测和来源证据。

### P3 · 迁移与收口

1. 移除 Runtime 中剩余的 Companion 业务判断。
2. 清理重复的入口级 Domain 调用和第二份能力目录。
3. 完成多 Agent 隔离、角色切换、后台任务恢复、权限拒绝和跨入口幂等验收。
4. 回流模块卡、Architecture、Quality、Decisions 和 Progress，冻结本合同。

## 11. 非目标

- 不拆微服务，不引入分布式消息队列。
- 不重新实现 Agent Loop、Tool Runtime、Permission Engine、Skill Registry 或 Companion Core。
- 不把每个 Domain 做成独立 npm 插件或动态远程代码。
- 不让 LLM 自由加载未授权 Domain。
- 不把按需激活实现为 Domain 自由加载，只允许已授权 Capability 激活。
- 不把用户运行数据、会话历史或人物状态写入静态 Manifest / Registry。
- 不为抽象而抽象。只有被两个以上入口复用、需要独立授权或需要独立生命周期的能力才进入 Registry。

## 12. 验收门禁

- `npm run test -- --maxWorkers=1`
- `npm run build`
- `npx playwright test --config=playwright.electron.config.ts __tests__/e2e/luffy-chat-tools.test.ts`
- `npm run assets:check`
- `npm run docs:validate`
- Agent Manifest、Domain Registry、Capability Registry、Application Orchestrator、Context Provider 的单元测试。
- 固定 Workflow 与 LLM Tool 共用同一 Domain Capability 的行为测试。
- 未授权能力拒绝、跨 Agent 数据隔离、角色切换竞态、后台恢复和重复调用幂等测试。
- UI、Scheduler、LLM Tool 的固定 Workflow 共享同一个 Application / Domain / Event / Outbox 事实链测试。
- Scoped Tool Catalog、Manifest 版本、Skill 重复注册、Provider 去重和 Debug Registered / Available / Activated 证据测试。

## 13. 风险与权衡

- Registry 层可能增加抽象成本，使用稳定 key、纯 Definition 和单一生产注册表控制复杂度。
- 动态能力目录可能增加可观测性要求，所有 Available / Activated 状态必须能在 Debug 追踪来源。
- 过度依赖 LLM 动态选择会增加不确定性，固定 Workflow 继续由 Application 直接编排。
- Domain 迁移期间容易出现旁路写入，Command Gateway、Permission 和生产测试作为强制门禁。
