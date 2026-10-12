# 施工合同：Debug Prompt 分层与行为资产审阅 v1

> 状态：进行中（2026-10-12）
> 生命周期：进行中
> 范围：在现有 Debug「模型上下文资产」与真实 LLM 调用证据之上，明确展示人物资产、通用行为合同和运行时上下文的分层关系；不把 Prompt 管理搬到 Playground。
> 关联合同：[debug-ui-information-architecture-v1.md](./debug-ui-information-architecture-v1.md)、[prompt-chinese-unification.md](./prompt-chinese-unification.md)、[agent-asset-catalog-v1.md](./agent-asset-catalog-v1.md)
> 统一称呼：施工合同

## 1. 需求背景（Why）

当前项目已经具备 Prompt 注册表、生产资产目录和 LLM 调用级 Prompt key 追踪，但开发者仍需要把多个来源拼起来，才能回答一次行为调用中的三个问题：

1. 哪些内容来自人物 Role Pack，回答“这个伙伴是谁”；
2. 哪些内容来自通用行为 Prompt，回答“这次任务要完成什么”；
3. 哪些内容来自运行时状态，回答“今天具体发生了什么”。

如果只按页面或 Prompt 名称展示，日剧本、朋友圈、补叙和反思等行为容易被误解为“每个人物一套完整 Prompt”，也容易把当前世界状态误写成稳定人物设定。Alice 的实现将角色 Prompt 映射与具体行为 Prompt 分开，本合同借鉴这种分层方式，但只使用本项目现有的中文 Prompt、Role Pack、伙伴世界和 Debug 资产契约。

## 2. 功能目标（What）

1. 在 Debug 中以真实生产来源展示三类输入：人物资产、通用行为合同、运行时上下文。
2. 对每个已登记的伙伴行为 Prompt，展示其触发条件、输入槽位、输出协议、代码校验和失败回退。
3. 能从一次真实 LLM 调用关联到实际使用的 Prompt key、Role Pack 来源、动态插槽和最终组装结果。
4. 明确稳定人物事实、默认世界事实、当前世界状态和用户偏好之间的边界。
5. 保持 Debug 是生产真相入口；Playground 只用于显式载入后的隔离实验副本，不维护第二份目录或 Prompt 正文。

## 3. 技术方案（How）

### 3.1 三层资产模型

```text
人物资产
├── Role Pack 身份、背景、价值观、表达基线
├── 默认世界与长期事实
└── 可变人格中已批准的长期偏好

通用行为合同
├── 行为目的与触发条件
├── 输入字段与动态插槽
├── 输出格式、长度和事实边界
└── 校验、副作用与失败回退

运行时上下文
├── 日期、时间、天气、行程和当前心情
├── 当前衣柜、书架、联系人和世界快照
├── 最近对话中与行为相关的线索
└── 已发布事件、关系状态和本次调用局部数据
```

稳定人物资产继续来自 Role Pack loader；通用行为 Prompt 继续来自生产常量或真实组装器；运行时上下文继续来自伙伴编排器、世界状态、记忆和调用现场。Debug 只聚合和关联这些来源，不在前端重新拼造事实。

### 3.2 行为资产描述

现有 `PromptAsset` / `ModelContextAsset` 继续作为统一契约；必要时补充行为级元数据，至少能表达：

- `behaviorKey`：稳定行为身份，不按页面命名；
- `trigger`：调用触发条件；
- `characterInputs`：来自 Role Pack 或可变人格的输入；
- `runtimeInputs`：来自运行时上下文的输入；
- `outputContract`：格式、长度和允许值；
- `validation`：代码校验和结构化解析；
- `fallback`：无模型、鉴权失败、解析失败时的回退；
- `sideEffects`：是否发布事件、更新状态或写入资产。

这些字段必须由真实生产组装器、校验器和副作用实现派生；禁止在 Debug 或 Playground 手写一份“看起来完整”的行为目录。

### 3.3 Debug 展示边界

- 默认展示资产分层摘要、来源、版本、指纹和动态槽位。
- 进入一次调用详情时，展示稳定模板、动态槽位值、工具环境和最终实发内容，并按现有脱敏规则处理用户隐私和敏感信息。
- 对没有共同关联标识的资产、请求和事件显示“未关联”，不在 Renderer 猜测关系。
- 生产资产目录保持只读；任何受控诊断动作沿用现有主进程校验、取消和审计边界。

### 3.4 Playground 边界

- Playground 不承担 Prompt 管理、生产目录或真实调用证据展示。
- 未来若需要试验，只能由用户显式将某个生产资产载入为隔离草稿，并保留 `derivedFrom` / `source` 关联。
- 本合同不新增 Playground 的自动选衣、真实模型调用、会话写盘或人物世界写入。

## 4. 影响范围评估

### 4.1 预计修改

- `src/shared/types.ts`：若现有资产契约不足，补充行为级元数据类型；
- `electron/main/prompts/registry.ts` 及模型上下文聚合器：从真实来源派生行为元数据；
- `electron/main/llm/` 的调用证据关联：沿用现有 Prompt key，必要时补行为 key；
- Debug 前端资产目录和调用详情展示；
- Prompt / 伙伴资产聚合、行为元数据和 Debug UI 测试；
- 本合同完成后按影响更新模块卡、质量、进度和变更记录。

### 4.2 默认不修改

- 不重写现有 Prompt 正文；
- 不新增衣柜自动决策、朋友评论、写信或深度思考能力；
- 不把生活切片重新加入人物世界正式入口；
- 不改变 Agent Loop、Provider、权限、记忆和世界状态语义；
- 不把生产 Prompt 或真实运行态复制到 Playground；
- 不新增 IPC，除非现有 Debug 聚合契约无法提供真实证据，且届时先回写本合同。

## 5. 实施步骤

1. **现状映射**：为主对话、日剧本、朋友圈润色、暂停补叙、反思和现有伙伴调用建立“人物 / 通用 / 运行时 / 校验 / 回退”来源表。
2. **契约复核**：检查现有注册表、Role Pack loader、伙伴编排器和 LLM 调用记录是否能表达上述来源；记录缺口，不先用静态文案填补。
3. **Debug 候选**：在正式 Debug 的候选视图中验证分层名称、信息密度、来源跳转和调用详情，不改变生产行为。
4. **用户验收**：确认分层表达、行为命名、来源展示、脱敏和未关联状态。
5. **正式实现**：只实现已确认且能从真实生产来源派生的字段和展示。
6. **质量验证**：补 Unit、Debug UI E2E、调用覆盖、资产唯一性、动态槽位和敏感信息门禁。
7. **文档收口**：把稳定边界吸收到模块卡、Architecture、Quality、Progress 和 Changelog；未做的行为登记到 Wishlist。

### 5.1 现状盘点证据（2026-10-12）

本轮先完成代码证据盘点，再决定是否补资产或界面：

| 层级 / 分类 | 当前真实内容 | 来源与调用证据 | 结论 |
|---|---|---|---|
| 主对话 | 四层 System、Role Pack protected / mutable / voice、用户画像、记忆召回、回复立场、语气、关系、专家度、Skill、伙伴世界上下文 | `electron/main/agent/runtime.ts` 组装 `promptAssetKeys`；主 Loop 通过 `streamChat` 发起 | 已覆盖；稳定人物与动态上下文已分开 |
| 上下文管理 | L3 Collapse、L4 AutoCompact | `electron/main/agent/context-manager.ts` → `chatComplete` | 已覆盖；压缩指令属于 context，不应归入伙伴行为 |
| 伙伴行为 | 日程剧本、朋友圈 Moment 润色、生活补叙、人格反思 | `script-generator.ts`、`moment-polish.ts`、`catchup.ts`、`reflection-service.ts` | 已有四个行为级 Prompt，均有真实调用、解析 / 校验和回退 |
| 记忆 / 会话辅助 | 用户画像提取、Embedding 输入、会话标题 | `profile-extractor.ts`、记忆向量入口、`session-store.ts` | 已覆盖；Embedding 是非聊天输入，需单独标识 |
| Playground / 诊断 | Playground 默认 / 草稿 / 模型探测、连接测试、Eval Judge、子 Agent、权限拒绝 | 对应 agent、IPC、Eval 和 subagent 调用点 | 已覆盖；不属于伙伴行为目录 |
| Role Pack | 角色 manifest、profile、world.default、scene Prompt、life 资产 | `companion/asset-registry.ts` 与 `prompts/registry.ts` 的 Role Pack 动态注册 | 按角色动态派生，不在核心 Prompt 表复制一套人物正文 |
| 生图 / 外观 | `image_generate` 接收用户或工具调用中的图片描述；外观字段来自 Role Pack profile | `tools/builtins/image-generate.ts`、`llm/image-generation.ts`、`identity/profile.ts` | 当前没有独立“生图 Prompt”资产；这是独立图片协议，不应伪造聊天 Prompt key |

核心注册表当前有 30 个稳定 Prompt key，另有按角色和文件后缀动态生成的 Role Pack 资产。已检出的聊天模型调用均声明了 `promptAssetKeys`；没有发现绕过统一 LLM 入口的聊天调用。

与 Alice 的分类对照后，当前属于“真实缺口”的只有**行为元数据表达**：注册表已有名称、来源、动态槽位和指纹，但还没有统一表达行为触发条件、角色输入、运行时输入、输出协议、校验、回退和副作用。Alice 的 `letter`、`thought`、`appearance` 等分类在本项目没有对应生产调用，不能为了分类数量对齐而新增占位 Prompt。`companion-background-tasks` 目前只有注册项，未检出对应的 LLM 调用，应标记为“已登记但未关联”，而不是当作已实现行为。

本盘点暂不修改 Prompt 正文、调用语义或生图链路；下一步应先为四个真实伙伴行为补齐可由生产代码派生的行为元数据，再在 Debug 中展示“已关联 / 未关联”状态。

## 6. 风险与权衡

- 如果把所有运行时数据都展示成人物资产，人物设定会被当前状态污染；因此必须保留来源和生命周期标签。
- 如果只展示 Prompt 模板，无法解释一次真实调用；因此必须同时保留调用级最终组装证据，但需要脱敏和预算限制。
- 行为级元数据如果由 Debug 手写，会形成第二事实源；必须从生产组装器、校验器和副作用代码派生。
- Alice 的行为划分不能自动证明我们应新增对应功能；没有真实产品行为的 Prompt 继续不注册、不占位。
- 现有调用若缺少跨层关联标识，先明确展示“未关联”，不为了视觉完整性伪造链路。

## 7. 必测点

- Debug 能区分人物资产、通用行为合同和运行时上下文；
- 日剧本、朋友圈润色、暂停补叙和反思的来源映射与实际调用一致；
- 一次真实调用能查看实际 Prompt key、行为 key（若有）、动态槽位和最终实发内容；
- 输出协议、解析校验、副作用和回退信息来自真实代码；
- 稳定人物事实不会被运行时状态或 Playground fixture 覆盖；
- 用户隐私、凭据、内部路径和不必要的原始内容按现有规则脱敏；
- 无关联数据明确显示未关联，不由 UI 猜测；
- Debug 只读边界、Playground 隔离边界和生活切片正式入口边界保持不变；
- 深浅主题、长文本、空态、错误、窄宽和键盘焦点通过 UI 验收。

## 8. 完成判定

只有在用户确认 Debug 候选的信息架构和真实来源映射后，才进入正式 UI 实施。完成时，Debug 展示必须完全来自生产 Prompt、Role Pack、运行时编排器和真实调用记录；不得存在第二份行为 Prompt 目录，也不得用静态占位项掩盖尚未实现的行为。
