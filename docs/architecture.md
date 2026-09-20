# 系统架构

敏感设置持久化经 `storage/encryption-persistence.ts` 前置保护：Windows 在保存快照之前只读检查 userData/Local State 的 os_crypt.encrypted_key（DPAPI 包络）；缺失时合并异步等待，15 秒上限失败且不提交。`settings-store` 双键 / 单键入口等待后同步复核，备份在业务快照与 beginCommit 前准备，并复核请求归属。只读系统状态，不改写 Chromium 文件、不另存密钥、不明文降级；当前格式绑定 Electron 42 Windows，升级须跑首次保存强退回归。保护针对进程异常退出，不承诺磁盘损坏、系统账户变化或断电恢复。

模型配置提交事件由 storage/settings-store 发布无载荷通知，memory/index-sync 订阅后重读统一配置工厂。双键 / 单键保存及备份实际写入模型键均须完整持久化成功后发布；失败补偿且不通知。恢复 worker 合并请求、取消过期尝试并以修订号阻止旧结果发布，停止时解除订阅。存储层不反向依赖 memory 或 llm。

模型诊断 IPC 使用 `model-diagnostic-operation.ts` 持有单次主框架请求的 AbortController 与事件监听；它不持有设置写入锁，也不下沉到 LLM 层。settings handler 在每个准备阶段 await 后复核归属，向 `chatComplete` / `fetchRemoteModels` 传信号并在 finally 释放监听。模型发现组合 owner 与超时信号；配置仍由 aux-config 唯一工厂装配，未改变 IPC 载荷或凭据存储。

`storage/moment-backup.ts` 从既有生活表收集已发布事件、动态快照和独立用户赞评，校验角色 / 事件 / 动态关联及规模；`ipc/data-export.ts` 在整份导入的同一 SQLite 事务和失败补偿中恢复。历史事件不关联日剧本，不创建 planned 事件，不调用世界推进、奖励或 LLM。稳定身份冲突拒绝整份导入，相同归属的现有内容不覆盖。

`CheckboxField` 是 Foundation 的原生复选框封装，只集中主题强调色、焦点及固定尺寸，不持有业务许可状态。MCP 服务卡、添加向导和基础故事共同消费；工具选择与存储仍分别归受控调用方和主进程，不通过基础组件访问 IPC。

类型检查按进程独立运行：Renderer 根配置不再引用主进程 composite 工程，避免共享源码被当成尚未生成的声明产物而报 TS6305；主进程配置和独立诊断检查保留。这不改变运行时依赖方向，也不解决主进程存量类型债。

`ModelAdvancedSettings` 组合 Foundation ActionButton / TextField，只管理展开和测试展示生命周期，参数值、保存重试及测试实现均由调用方注入。正式通过既有 settings:set 保存，通过既有 settings:test-connection 测试已保存主用途首选；Playground 只改内存与返回隔离结果。`src/shared/model-routing.ts` 是用途顺序 / 启用 / 模型清单筛选的纯函数事实源，Renderer 传脱敏快照，主进程传解密快照，不把凭据处理下沉前端。`src/shared/model-parameters.ts` 统一界面、IPC 与 Temperature 装配的数字边界；同端点换 Key 后的测试失效由成功保存版本号保证，不比较密钥原文。新增共享文件显式列入主进程 composite 清单。

ModelConnectionCard 是正式模型页与候选共用的纯受控 Experience，组合 Foundation ActionButton / IconButton / TextField。调用方持有请求令牌、草稿与保存状态，只传脱敏展示属性和动作回调；组件不读取 IPC、密钥或存储。正式注入删除与真实请求，候选注入隔离适配器；共享展示不改变后端保存或请求生命周期。

连接认证与协议自动检测共用 `src/shared/llm-connection-test.ts`，主进程 Provider Router 引用并重导出规则，不复制第二份。只有 HTTP(S) 回环 OpenAI 兼容端点可无 Key；Runtime、测试 / 发现和已有辅助调用按同一规则预检。主进程 `settings:get` 经唯一配置工厂派生就绪状态和实际主模型 / 地址，Renderer 不再用全局 Key 推断主用途配置；原密钥配置标志仍只表达密钥存在，不被改写为连接可用性。

正式模型设置通过专用 `settings:save-model-configuration` 一次提交连接与用途路由。主进程限制 JSON 长度、数组数量及字段枚举，串行合并同身份密钥后调用 settings-store 双键保存；密文准备完成后在无 await 的同步段更新并一次落盘，失败恢复已写键的原始值。通用 settings:set 的模型键与专用入口共用写队列，但仍是单键接口，不对外承诺整组语义。未实现多窗口旧快照版本冲突检测。

SQLite 快照通过同目录临时文件写入后 rename 替换；替换失败禁止退回 copy 覆盖旧库，失败保留原文件并向调用方抛出友好错误。这只是单进程文件替换保障，不代表多字段业务事务或断电耐久性；sql.js 的 export 不得发生在尚未提交的业务事务内。

MCP 启动恢复在主进程阶段读取已启用配置并建立真实连接，恢复失败记录受控错误且不阻塞主窗口；OAuth 配置重启后进入需登录状态，不自动打开浏览器。工具许可仍由配置、活动连接、Registry 注册和执行前调用共同约束。

MCP 首次 OAuth 链路由共享设置表单经 preload / 主框架 IPC 发起，`mcp/oauth.ts` 在主进程持有窗口绑定的临时授权、回环监听与内存凭据，SDK 处理发现、注册、PKCE 和授权码交换；`oauth-network.ts` 校验端点并固定 DNS 解析地址，拒绝越界私网与重定向。成功后聚焦发起窗口，测试连接沿既有保存 / 接管 / 工具许可链路进入 Manager 与 Registry。取消、窗口失效及超时撤销归属；令牌不进入 Renderer、settings 或备份，不自动刷新。已保存服务重新登录前确认并复核配置，登录失效撤销工具注册；后续登录保持见 DEC-043 与 WISH-045。

MCP 运行状态由 Manager 生成不含凭据的共享快照，经 IPC 同步 Registry 后广播 `mcp:status-changed`；preload 提供可取消订阅，Settings 对状态与工具读取做代际隔离。意外断开保留 error / reconnecting 行，手动停止撤销连接归属；旧 close / connect 回调不得覆盖新连接。生产与 Playground 共用服务卡片，后者仍只注入隔离状态，不订阅生产。
> 只维护稳定分层、依赖方向和主数据流。工具数、IPC 数、测试数、预设数等动态清单以代码注册表或命令输出为准。

## 项目愿景

**构建一个人格化桌面 AI Agent。**

正式设置的 UI 只承载已验收的 Playground 体验；生产数据、IPC 与安全边界仍由正式调用链负责，Playground 不成为第二事实源。

模型连接配置由设置存储加密保存，配置工厂在主进程按用途路由解析为 LLMConfig；Renderer 只读取脱敏结构，数据备份只保留连接元数据，不携带密钥。正式模型发现只走主进程 `settings:fetch-models`，不允许 Renderer 直连供应商。

ModelConnectionForm 为纯受控业务 UI，由正式设置和候选共用；来源分类与预设默认值从共享 Provider 注册表派生。source / presetId 是连接元数据，不授予权限；provider 是实际协议选择，测试与生产装配共用 LLMProvider。主进程保存 / 读取旧密钥时除连接 id 外还核对端点与协议，身份变化必须使用新输入的 Key；候选只模拟凭据状态，不能读取真实存储。

ModelUsageArrangements 同样属于纯受控 Experience，组合 Foundation SelectField / ActionButton / IconButton。正式 ModelRoutingSettings 注入真实路由及整组保存回调，候选只操作内存；共享组件没有 IPC。image 用途统一为生图，由独立配置工厂装配；用户附图理解使用主对话模型，不再切换到 image 路由。

主对话与辅助用途由唯一配置工厂按同用途顺序装配首选及 fallbackModels，过滤停用项和缺失引用、去重相同连接模型；每项端点、密钥、模型和 provider 整体绑定，空 Key 不借用其他连接凭据。独立辅助用途不继承主用途备用池，无有效辅助用途时整体沿用主配置。生图必须显式配置，只取首个有效目标，不回退主模型、不自动重试或跨供应商重发。主用途不存在时身份为空，不读取旧全局字段或 LLM_* 环境变量。一次性身份覆盖不继承已保存备用链。统一调用入口逐目标认证，远程缺 Key 不发请求；Debug 从主配置工厂读取脱敏身份。

用户主动生图沿 image_generate → loadImageGenerationConfig → Images / Gemini 适配器 → sharp 完整解码并归一化 PNG → 项目 images 目录独占提交执行。主进程注入 workspaceRoot，收费请求前及提交前复核权限与真实路径；restricted-fetch 同时服务生成下载及 OAuth 网络封装，限制目标、DNS、重定向和响应规模。结构化图片引用经 Registry / Loop 写入 schema 17 工具消息后才发布 tool_end；模型仅接收文字摘要，主聊天、侧边聊天和基础故事共用 GeneratedImageResult。读取与文件定位 IPC 仅接受会话和图片身份，主进程校验工具归属、文件摘要及路径，不接受 Renderer 任意路径。

媒体备份保存工具调用配对、图片摘要和受限 PNG 字节，不保存恢复用绝对路径。导入经完整校验后写 userData 带管理标记的独立目录。会话、生活资产、记忆和设置在同一同步事务中写入，记忆去重和设置加密复用存储原语；COMMIT 后一次 persist，替换失败同步补偿本批写入并清理媒体，不更换数据库实例。成功落盘后才通知 `memory/index-sync` 核对派生索引并移除媒体标记。启动先读取持久数据库并核对待恢复目录，未引用才清理，已引用则保留；解析失败 / 链接目录不清理。SQLite 是结构化记忆事实源，Vectra 镜像由启动、成功提交和失败退避 worker 按稳定 id 重建 / 清理；不承诺断电耐久性、外部 Embedding 可用性或未保存凭据的强退恢复。

不只是一个工具，而是一个有性格、有记忆、能成长的数字伙伴：
- **人格化交互** — 有一致的性格特征和交流风格，不是冰冷的 Q&A 机器
- **持久记忆** — 记住用户的偏好、项目上下文、历史对话，越用越懂你
- **主动协作** — 不仅被动回答，还能主动提醒、建议、推进任务
- **本地优先** — 数据存储在用户本地，隐私可控
- **可扩展** — 通过 MCP 协议连接外部能力，用户可自由添加工具

## 技术栈

| 层级 | 技术选择 |
|------|---------|
| 外壳 | Electron（主进程 Node.js + 渲染进程 Chromium） |
| 语言 | TypeScript 全栈，主进程与渲染进程共享类型定义 |
| 前端 | React + TailwindCSS + Lucide Icons |
| 存储 | SQLite（结构化，sql.js WASM）+ Vectra（向量检索）|
| LLM | 多 Provider（OpenAI 兼容 / Anthropic / Gemini，自动检测路由） |
| 扩展 | MCP 协议（Model Context Protocol） |
| 测试 | vitest（单元）+ Playwright（E2E） |
| 打包 | electron-builder（NSIS / DMG） |

## 整体架构

- MCP 配置类型统一在 shared，主进程 `mcp/transport.ts` 复用 SDK 创建 stdio / SSE / Streamable HTTP。Bearer 沿既有 settings 加密与脱敏管线装配，不在 Renderer 或 Playground 创建传输；HTTP 凭据绑定原端点，禁止自动重定向。连接确认、工具注册和权限决策不属于传输工厂，仍由既有 IPC / Manager / Bridge 分层负责。
- MCP 添加向导的测试连接由 `mcp/connection-tests.ts` 独立持有，按 Renderer 窗口与 requestId 绑定；只有保存成功后才由 `McpClientManager.adoptTestedConnection` 接入生产 Registry。取消、超时和窗口销毁不会写配置或开放未保存工具。

- MCP 工具许可数据流：正式 Settings 读取脱敏后的服务配置与真实 `mcp:list-tools`，通过 `mcp:set-tool-allowed` 写回服务配置；主进程更新活动连接、重建 MCP Bridge 的 ToolRegistry 注册，并在 `callTool` 前再次校验。未配置 `allowedTools` 的历史配置保持全部允许，MCP 许可不替代权限引擎的审批决策。


- 伙伴回应偏好沿 `SettingsPanel → settings:get/set → settings-store → Runtime → prompt-builder` 单一路径装配；共享 `CompanionSettingsContent` 只接 props，Playground 使用隔离状态。`companionResponseNote` 与旧 `systemPrompt` 分离，无隐式数据迁移，Debug 从同一组装器查看结果；该字段不是记忆库或身份资产。

- chat:send 建立会话到发起 Renderer 的短生命周期归属，chat:abort 只能控制该归属；IPC 缺省会话 ID 直接返回，避免把 Renderer 输入映射为 Runtime 全局中断。

```
┌──────────────────────────────────────────────────────────┐
│                      Electron App                        │
│                                                          │
│  ┌──────────────┐        IPC         ┌────────────────┐  │
│  │   渲染进程    │◄─────────────────►│    主进程       │  │
│  │   (React)     │   AgentStreamEvent │   (Node.js)    │  │
│  │               │                    │                │  │
│  │ - App.tsx     │                    │ ┌────────────┐ │  │
│  │ - Settings    │                    │ │ IPC 路由层  │ │  │
│  │ - Markdown    │                    │ │ (12 模块)  │ │  │
│  │ - FileBrowser │                    │ └──────┬─────┘ │  │
│  └──────────────┘                    │        │       │  │
│                                      │ ┌──────▼─────┐ │  │
│                                      │ │ Agent Loop  │ │  │
│                                      │ │ (核心循环)  │ │  │
│                                      │ └──────┬─────┘ │  │
│                                      │        │       │  │
│                     ┌────────────────┼────────┼───────┤  │
│                     │                │        │       │  │
│              ┌──────▼──────┐  ┌──────▼─────┐  │       │  │
│              │ Tool System │  │ LLM Adapter│  │       │  │
│              │ (Registry)  │  │ (流式API)  │  │       │  │
│              └──────┬──────┘  └────────────┘  │       │  │
│                     │                         │       │  │
│              ┌──────▼──────┐           ┌──────▼─────┐ │  │
│              │ MCP Bridge  │           │ Memory     │ │  │
│              │ (动态工具)  │           │ System     │ │  │
│              └──────┬──────┘           │ - SQLite   │ │  │
│                     │                  │ - Vectra   │ │  │
│              ┌──────▼──────┐           │ - Profile  │ │  │
│              │ MCP Client  │           └────────────┘ │  │
│              │ (stdio)     │                          │  │
│              └─────────────┘                          │  │
└──────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. Agent Loop（核心循环）

```
think → act → observe → think → ...
```

- 事件流使用 AsyncGenerator 模式
- 输出纯数据事件（AgentStreamEvent），不含 UI 逻辑
- 支持 AbortSignal 取消（用户停止按钮）
- 最大迭代次数保护（默认 25 轮）
- 每轮迭代前自动检查上下文压缩（四层分级）
- **消息管道**：sanitizeToolCallPairs 修复孤儿消息，防止 LLM API 400
- **Runtime 编排**：AgentRuntime 单例管理生命周期，后台任务队列串行执行
- **LLM 调用重试**：网络错误/429/5xx 自动重试，最多 2 次，指数退避
- **工具并发执行**：按 LLM 原始顺序分批 — concurrencySafe 连续工具并行，遇到非安全工具刷新批次串行，保持 LLM 指定的执行语义
- **ToolContext 依赖注入**：工具通过 `ctx: ToolContext` 获取 workdir / sessionId / AbortSignal，不再依赖全局 import
- **运行证据会话归属**：Agent Loop 的权限决策与工具执行资产记录统一从 `ToolContext.sessionId` 取会话 ID，与 workspace/runtime 的工具上下文保持同源；不新增 IPC 字段，也不改变权限或工具执行契约。

### 2. IPC 模块化

主进程 IPC 按产品领域拆分在 `electron/main/ipc/`，实际 handler 清单以该目录和 `ipc/index.ts` 注册结果为准，不在本文维护数量。

IPC 契约必须四处同步：

1. `src/shared/types.ts`：共享载荷类型；
2. `electron/preload/index.ts`：Renderer 白名单桥接；
3. `electron/main/ipc/*.ts`：主进程 handler；
4. `src/vite-env.d.ts`：`window.electronAPI` 类型。

Renderer 只能通过 preload 白名单访问主进程。敏感配置、文件边界、外部进程和高风险确认必须由主进程重新校验，不能信任 Renderer 传入的“已批准”状态。

备份 IPC 的交互生命周期由 `ipc/backup-operation.ts` 管理：`data:export` 与 `data:import` 共用进程内互斥租约，绑定请求主框架及其 BrowserWindow，不依赖当前聚焦窗口。准备阶段监听窗口销毁、Renderer 退出与主文档导航，失效后迟到结果不得开始写入；进入 commit 后保持锁直至 handler finally 收尾。该锁只互斥备份请求；核心会话 / 生活资产 / 记忆 / 设置由同步 SQLite 事务和一次快照替换提交，派生向量不属于同一事务。

备份正文的业务约束不在 IPC 复制：`isValidExportData` 在整份预检阶段调用 `memoryStore.assertMemoryContentAllowed`，与实际记忆写入共用长度与凭据拒绝规则。任何一条不合法都在首次业务写入前拒绝；预检不能替代后续合法数据写入的事务与失败恢复。

### 3. 工具系统

- 声明式注册（ToolDefinition + ToolMetadata）
- **buildTool() 工厂**：统一 fail-closed 默认值（isReadOnly/isDestructive/isConcurrencySafe 默认 false，maxResultSizeChars 默认 50,000），工具只声明偏离默认的字段
- 并发安全分流：`isConcurrencySafe` → Promise.all，否则串行
- 动态注册/注销：支持 MCP 工具运行时加入和移除
- 破坏性操作前用户确认（IPC 双向通信弹窗）
- 终端运行实例由发起 webContents 归属；终止合并并发请求，必须等到 child `close` 才成功，失败或超时保留记录供重试，`error` 不代替退出。Windows 使用隐藏的 taskkill 回收进程树；Unix 使用独立进程组并在 SIGTERM 后必要时升级 SIGKILL（本机未作 Unix 实机验证）。未握手 stdout/stderr 有界缓存，Renderer 通过 `terminal:ready` 冲刷；10 秒未握手、窗口销毁/崩溃或命令超时触发清理。输出按 8000 字符分包而不是截断，累计上限仍为 2MB 字符；Renderer 拼接未完成行，不以包边界换行。
- **超时保护**：每个工具 30s 超时，超时自动返回错误
- **子 Agent 系统**：delegate_task 工具，独立上下文 + 受限工具集 + 权限只降不升 + 工具黑名单（禁止 delegate_task 递归 / remember / forget / task_plan）
- **中间件管道**：ToolMiddlewarePipeline 洋葱模型（error-formatting → logging → verify → result-persistence）
- **大结果落盘**：工具结果超过 maxResultSizeChars（默认 50,000）时写临时文件返回路径，防止上下文爆炸；file_read 设 Infinity 避免循环
- **Token 预算**：会话级 + 日级限额，超限自动终止
- **沙箱系统**：参考 Codex 四层纵深防御，三级沙箱模式（read-only / workspace-write / full-access）
- **命令安全分级**：ExecPolicy 白名单/黑名单 + CommandGuard 路径边界检查 + ApprovalStore 审批记录
- **权限规则引擎**：不可绕过硬边界（危险命令、Shell 控制符、越界路径 / cwd）先执行，再进入五层业务责任链（自定义规则 → 审批记录 → ask 规则 → 命令分级 / 沙箱 → 默认）；已接入 Agent Loop 主流程
- **文件自定义规则**：Loop / Debug 与 Registry 共用 file-tool-permission，先验证真实路径沙箱，再按 deny > ask > allow 匹配逻辑路径、真实路径和删除目录子项。ask 的内部对象凭据绑定 callId、参数、会话、规则快照和目标，一次性消费；Registry 在实际执行前复核，不能从 IPC/JSON 伪造。此链覆盖原生文件读写、编辑、删除和补丁，不扩展到 Shell 或 MCP。
- **工作区管理**：workspaceRoot 维护；文件工具与子 Agent 优先使用 `ToolContext.workdir`，写入前解析 realpath 防 symlink 越界；`file_delete` 的永久删除白名单只匹配工作区内部相对路径段，系统 `/tmp` 等祖先目录不能扩大永久删除范围
- **工具 vs 服务边界**：工具（ToolDefinition）仅暴露给 LLM 的薄壳，内部逻辑下沉为独立服务（如 task-plan-service.ts），运行时/中间件/其他工具可直接调用服务而不经 LLM

### 4. 记忆系统

两层记忆架构：

| 层级 | 存储 | 用途 |
|------|------|------|
| 结构化记忆 | SQLite memory 表 | 用户画像（identity/workflow/voice）、偏好、事实 |
| 向量记忆 | Vectra LocalIndex | 历史对话语义检索，按相关性召回 |

- 自动提取用户画像（异步 LLM 分析，每 5 分钟 + 3 条消息触发）
- 对话后只索引用户消息；assistant 原文不写入向量库，避免自我强化循环
- 语义检索注入 System Prompt L3 层（top-5，score > 0.6）

### 5. Prompt 分层系统

4 层 System Prompt 注入，稳定内容在前（利于 KV Cache）：

| 层级 | 内容 | 稳定性 |
|------|------|--------|
| L1 人格定义 | [PROTECTED] 核心身份 + [MUTABLE] 行为规范 | 最稳定 |
| L2 能力边界 | 工具列表、行为规范、aside 格式 | 稳定 |
| L3 上下文 | 用户画像、记忆、向量检索结果、自定义指令 | 每次重建 |
| L4 动态 | 当前时间 | 每次变化 |

Prompt 资产由 `electron/main/prompts/registry.ts` 统一登记；核心 key 由 `prompts/keys.ts` 类型化，Role Pack key 只能通过工厂生成。每项记录用途、角色、真实来源、人工版本、自动内容/结构指纹、当前 locale、静态 / 动态模式和动态插槽。每次 `streamChat` / `chatComplete` 必须声明非空资产 key，或显式给出 `promptlessReason`；统一入口把解析结果写入 `requestExtra.promptAssets`，未知 key 进入 `unknownPromptAssetKeys`。静态正文集中在 `prompts/texts.ts`，Eval Judge 模板集中在 `prompts/eval-judge.ts`，生产调用与目录共同引用。Debug 通过 `debug:model-context-assets` 在 IPC 高层聚合 Prompt、伙伴与人格资产、记忆策略、权限与沙箱策略、Tool schema、Skill、Eval Case / Grader、Eval Judge 和当前 MCP 工具；含用户状态的最终动态内容仍只认真实调用的 System / Messages / Tools。Playground 只接收显式实验副本，不维护第二份生产目录。

未来扩展英文时，在同一资产 key 下维护独立语言版本，由运行时按 locale 单选；当前不实现英文或韩文版本。

Skill 资产由 `electron/main/skills/loader.ts` 读取和保存；Frontmatter 只允许标准 YAML，使用 `js-yaml` `JSON_SCHEMA`，禁止 JavaScript / 可执行语言引擎。内置目录由主入口 `APP_ROOT/electron/skills-builtin` 定位并纳入打包清单，不依赖 ESM 中不存在的 `__dirname`。`registry.ts` 负责激活工具、当前激活状态和不含正文的指纹。正式 `SkillsPanel` 与 Playground 共用 `settings/SkillViews.tsx`，只管理列表、详情、启停及用户正文编辑 / 删除；创建、版本和试跑不作为正式页入口。保存前由主进程校验 Frontmatter、正文和工具引用，底层版本备份仍保存在用户目录 `.versions/`。

Skill 启停是用户运行态，不修改内置文件或资产指纹。`skills:set-enabled` 通过 registry 串行队列，调用 `storage/skill-state-store.ts` 在 settings 表独立键 `skillDisabledNames` 保存停用名称；普通 settings 写入不开放此键。写盘成功后才替换注册状态，失败恢复数据库旧值；重载、保存和删除使用同一队列。新 Prompt 摘要过滤停用项，已捕获的生产工具执行前检查当前启用状态和定义身份，避免重载 / 删除后的旧闭包继续激活。`disable_model_invocation` 与启停独立；已写入历史消息的正文不追溯撤回。Debug 目录展示定义，真实 LLM 调用继续通过 `requestExtra.skillActivations` 记录来源和指纹；Eval 的显式隔离 Skill 不读取用户启停状态。

### 5.1 伙伴与生活世界（Companion）

人格化伙伴的**产品终局**（多主角同团、单活跃、生活世界、朋友圈/衣柜）挂在现有 Loop / Memory / IPC 之上，**不另起进程模型**。

| 要点 | 说明 |
|------|------|
| 运行时 | 唯一 `activeRoleId`；会话中禁止换角；完整切换 + 非活跃暂停 |
| Catch-up | 切换时细补最近 ≤7 日生活剧本/事件 |
| 契约索引 | [`requirements/README.md`](./requirements/README.md) |
| 产品模块 | [`modules/companion.md`](./modules/companion.md) |
| 能力表 | [`modules/companion.md`](./modules/companion.md)「已落地能力」；运行时见 [`modules/agent-runtime.md`](./modules/agent-runtime.md) |

目录落点：`electron/main/companion/`（identity / growth / life / cast / orchestrator）；`prompt-builder` 为组装器。  
已落地：**W0–W6** + 三槽 + 召唤子会话/忙闲 + 自动反思 MUTABLE。后续：Pack 内容打磨、methodology M21–M31 深啃。

生活面数据沿 `Role Pack world.default → life/assets → companion_assets → companion IPC → WorldDetailsPanel / AssetsPanel → WorldLivingContent / WorldAssetEditor` 流转。正式通讯录沿 `get-roster` + 既有 `check-cast-availability` 进入 `CastPanel` 列表预检，开聊仍走 `start-summon` 二次判定；Playground 通讯录保持静态夹具。住所和常去地点分别为 `home` / `footprint`，不另建第二份世界内容库；运行后以角色隔离的资产为准。没有 `world.default.json` 时，`world_json` 的 home / currentLocation 与 Catch-up 居所回退为「未设定」，不得按角色写入公寓、合租或日常住处。用户新增走 `companion:create-asset`，由 `createAsset` 校验白名单 kind 后写入活跃主角；更新 / 删除沿既有 IPC。`companion_asset_seeds(role_id, kind)` 与新资产同事务写入，事务内无异步等待或落盘；默认世界未设定不生成，已有记录优先，删空后不重新初始化。动态足迹继续来自 Moments，不把资产创建日期当成访问日期。正式朋友圈沿 `companion:get-moments` 读取动态；用户赞 / 评论写入独立表 `companion_moment_user_interactions`，不改 `moment.text` 或卡司 `meta.interactions`。Playground 朋友圈仍用本地夹具。

`WorldLivingContent` 是正式家居 / 足迹与 Playground 共用的纯展示层，只接收 props；真实 IPC 和加载 / 错误处理属于正式面板，隔离样张属于 Playground。用户导入导出覆盖 `companion_assets` 与 `companion_asset_seeds`，按 id / 播种键合并，失败与会话同一事务回滚；旧备份缺字段仍可导入。不导出朋友圈互动、MCP、权限、API Key 和本机项目路径。

### 6. MCP 协议

- MCP Client Manager：管理多个 MCP Server 的生命周期
- **双传输层**：StdioClientTransport（本地子进程）+ SSEClientTransport（远程 HTTP/SSE）
- Bridge 层：自动将 MCP 工具转换为 ToolDefinition 并注册
- 命名空间隔离：`mcp:{serverId}:{toolName}` 避免冲突
- 配置持久化：MCP 服务器列表存入 settings
- 启动时自动恢复已启用的连接

### 7. LLM 路由

- **多 Provider 路由**：显式 Provider 优先；否则按共享 Base URL 规则检测 OpenAI / Anthropic / Gemini，未知端点回退 OpenAI Compatible
- OpenAI Compatible 请求由 `request-builders.ts` 纯构造器生成，真实调用与 Provider 资产目录共用同一请求事实（覆盖 DeepSeek / Groq / OpenRouter / Together 等）
- Anthropic Messages API 适配（SSE 流解析 + content_block_delta + tool_use 映射）
- Gemini API 请求构建器（systemInstruction + functionDeclarations）
- 流式 SSE 解析（text / reasoning / tool_calls delta）
- **Streaming Tool Calls**：工具参数边流式边 yield `tool_call_delta` 事件
- **Model Failover**：未输出时按 `fallbackModels` 顺序尝试；备用配置继承采样参数、可显式覆盖或清空 thinking / 运行资产证据，并清除递归 fallback。取消或向消费者交付模型事件后停止切换，所有目标失败仍返回失败。切换提示不算模型事件；`chatComplete` 丢弃流式事件，只消费最终返回值。
- **Vision 降级**：OpenAI Compatible 图片先乐观尝试，识别能力错误后进程内记忆拒绝并去图重试一次
- **Prompt Cache**：Anthropic `cache_control` 标记 System Prompt + Tools
- **Structured Output**：OpenAI Compatible `ResponseFormat` 支持 json_object / json_schema
- 内置 Provider 入口统一来自 `src/shared/provider-presets.ts`：按海外直连、国内服务商、编程套餐、聚合与代理、本地 / 自定义分组；当前 Settings 展示 24 个入口，Chat 快切展示其中 2 个 Provider。模型 ID 不进入 Provider 预设，来自用户账户实际可用列表。ListenHub / CLIProxy 不作为普通聊天入口。
- RAG 文档查询通过 rag_search → searchDocuments → Vectra queryItems(vector, query, topK)，配置仍由 loadMainLLMConfig 装配；入口校验端点和模型，不将 Key 非空作为本地连接必要条件。不改变分层、索引格式或 IPC。
- Embedding 当前仍复用主用途端点与默认嵌入模型。index-sync 与 RAG IPC 从唯一配置工厂装配，入口不以 Key 非空替代配置就绪；适配器仅在 Key 非空时发送认证头，不持有进程级永久失败缓存。结构化索引恢复的退避 / 取消仍归既有 worker，不新增调度层。embeddings 统一生成请求空间指纹、返回模型和维度元数据，记忆 / RAG 在计算相似度前过滤；结构化源在核对时按请求空间重建。独立嵌入配置、配置保存后的唤醒及文档 / 对话重建仍是 S2 缺口。

### 8. 上下文压缩

四层分级压缩策略（Alice 方法论 Ch.5）：

| 层级 | 触发阈值 | 策略 | 成本 |
|------|----------|------|------|
| L1 Snip | 60% | 删除最早的工具调用轮次 | 零 |
| L2 MicroCompact | 75% | 去重相同工具调用 | 零 |
| L3 Collapse | 90% | LLM 生成摘要（降级：规则占位符） | LLM 调用 |
| L4 AutoCompact | 95% | 全量重写（仅主循环触发） | LLM 调用 |

- querySource 互斥守卫：compact/memory/title 来源自动跳过 LLM 摘要，防递归

### 9. Eval 与 Debug 证据链

- Eval CLI 是判定与报告的事实源；Debug 只通过受控 IPC 读取报告、启动固定白名单脚本，不在渲染层重新评分。
- Debug 只有一个产品入口：`activeView === 'debug'` 渲染 `DevPanel` 全页工作区；Chat 不再维护 `conversationDebugMode`，也不在 `ChatRightDock` 中叠加调试半屏。LLM 调用、Trace 和事件统一在 Debug「请求与运行」域查看。
- 产品 Primary Sidebar 只保留人物世界与设置两个产品目的地；MemoryPanel 与 SkillsPanel 仍是独立页面能力，但入口统一由 Settings 的「记忆」与「工具」分区承载，SecondaryNav 不再挂载。
- Chat 壳层的 PrimarySidebar 与 ResizeHandle 由 `sidebar-transition` 轨道常驻承载：收起时通过宽度 / 透明度 / 位移和延迟隐藏完成滑动，搜索在顶部工具行内展开，不再增加独立搜索行。
- Skill Eval 为每个 Case 创建独立临时目录和 ToolRegistry，复用生产 Skill 激活工具、Skill 摘要与 Agent Loop；Mock / Real 共用触发、指南注入、工具边界和回复约束 Grader。
- 报告写入 `eval-reports/` 的 JSON / Markdown，只保存输入快照、Skill 元数据与指纹、激活 Trace、工具调用和 Agent 可见回复，不保存 API Key、隐藏 reasoning 或 Skill 正文。
- `debug:skill-eval-reports` / `debug:skill-eval-report-get` 对文件名与最小结构做校验，拒绝目录穿越和损坏报告；`DebugEvalRunner` 仅映射 `eval:run`、`eval:skill`、`eval:persona`。

### 10. Agent 生产资产目录

- Prompt 注册表仍负责模型可见 Prompt 的稳定 key、locale、模板和运行时追踪；伙伴注册表不复制 Prompt 正文。
- `companion/asset-registry.ts` 读取真实 Role Pack loader、场景 loader 和生活 starter 工厂，生成 manifest、人物档案、默认世界、伙伴场景与生活内容资产。
- Debug 高层聚合 Prompt、伙伴资产、记忆策略、权限与沙箱策略、Tool schema、Skill、Eval Case / Grader、Eval Judge、模型 Provider 与 MCP，统一展示来源、所有权、版本、指纹、状态、派生关系和依赖。
- 用户记忆、当前世界状态和运行后 `companion_assets` 属于运行时数据，不进入静态生产资产目录；分别由记忆 / 世界态 / 请求记录查看。
- `memory/strategy-registry.ts` 只登记记忆提取、去重、反馈分桶、向量召回、向量生命周期和引用纠错策略；策略参数由原生产模块导出，注册表不反向驱动算法。
- `sandbox/asset-registry.ts` 从沙箱档位、命令分级、权限责任链、路径守卫、审批生命周期和有效沙箱映射生成只读资产；不读取用户规则、审批记录或当前执行模式。
- 正式设置权限页与 Playground 候选共用 `PermissionSettingsContent` / `PermissionRulesEditor`；Renderer 只提交规则草稿，主进程在 `settings:set` 写盘前严格校验并再热加载，执行引擎仍是权限事实源。
- `evals/scenario-registry.ts` 是普通 Eval Scenario 唯一列表，CLI、Vitest 与 `evals/asset-registry.ts` 共同消费；Case / Grader 资产来自真实场景和结构化判据，不读取运行报告、环境凭据或 Judge 隐藏推理。
- `llm/provider-asset-registry.ts` 从真实请求构造器、路由规则、Thinking / Context / Vision / Failover 生产事实和共享预设生成协议能力、跨 Provider 策略与内置预设资产；只保存脱敏结构，不读取用户配置或能力缓存。
- `agent/subagent-asset-registry.ts` 登记 `researcher`、`coder`、`analyst` 三个 SubAgent 角色的 Prompt addon、默认工具集与只读边界；执行器和 Debug 聚合消费同一角色定义，自由字符串角色不伪造为内置资产。
- Renderer 设计资产由 `src/shared/design-asset-registry.ts` 单一登记主题与字体比例；Settings、Playground、MarkdownRenderer 不再各自维护主题集合，设计资产不进入 ModelContext 或运行证据。
- Playground 不直接写生产资产；只有文本类资产可显式载入为实验副本，伙伴、记忆、权限与沙箱、Eval Case / Grader、Provider 等结构化资产保持只读。
- 已确认的候选回流正式 UI 时采用选择性同步：生产只接收视觉 token、真实产品交互和真实组件组合，不接收来源路径、采用标记、目录、调试控制或隔离 fixture。正式 Right Dock 的文件工具由 `WorkspaceFilesPanel` 管理左树右多预览及每路径读取状态；审阅 / 终端仍沿真实 `session` / `terminal` IPC 路径。
- 正式 Right Dock 的浏览器入口走 `browser:load` 主进程边界：Renderer 不直接 `fetch` 或 `loadURL`，主进程复用 URL/DNS 校验、手动拒绝重定向、超时和响应上限后返回文档；Renderer 仅用无脚本 `sandbox` 与 CSP 展示，不继承 Electron bridge。该能力是受限只读查看器，不等同于完整浏览器。每次加载由 Renderer 生成 requestId，主进程按 senderId + requestId 维护 AbortController；标签关闭或组件卸载通过 `browser:cancel` 终止未完成抓取，避免无主网络请求继续等待超时。
- 正式 Right Dock 的侧边聊天不复用主会话：`session:createWorkspace` 创建 `session_kind=workspace` 的临时 Runtime 会话，`listSessions` 排除它；卸载调用既有 `session:delete`，由主进程阻止新发送、取消运行与工具确认，等待 chat:send 完整消费生成器并退出后才删记录。`done` 事件和 abort 回执均不是收尾完成凭证。Runtime 在首次配置 await 前登记控制器，只在生成器 finally 释放；重复发送不能覆盖运行锁，删除失败释放删除门禁以便重试。`chat:event` 按 sessionId 过滤，停止只控制当前会话；异窗不能中断或删除活跃会话，确认响应也校验发起 webContents，窗口销毁取消确认。
- 工作区按项目归属：App 的产品子树在设置／Playground 全屏导航时仅隐藏；其它非 Chat 页面也隐藏右坞和拖拽柄，不挤压全页。ChatRightDock 以项目路径为 key，切换项目重建，取消项目或关闭最后标签卸载。后台标签保留面板与订阅，ReviewPanel 额外以 sessionId 重建。TerminalPanel 的运行记录独立于选中态，pending 取消／卸载保留取消意图，迟到成功响应补发 kill；仅当前未卸载的运行可更新 UI。终止失败可重试，关闭后的清理失败仅记录固定告警，主进程已实现进程树回收与就绪握手；仍不将 IPC 应答视为进程树退出证明。
- `session:getFileChangeDiff` 的真实返回同时包含受长度上限保护的 `before` 与 `after`；Renderer 的 ReviewPanel 只在两者都存在时开放并排视图，并以请求序号隔离快速切换产生的过期响应。
- `scripts/asset-governance.mjs` 声明资产家族的来源、注册表、发现方式、key 规则、展示面和证据边界；`npm run assets:check` 生成机器审计快照并对静态资产执行 fail-closed staged 漏登检查。`src/assets/playground/` 中的隔离媒体夹具归入产品体验家族，并必须由对应 `experience.*` 的 `fixtureAssetPaths` 显式认领，不能借 Playground 名义绕过资产登记。

### 10.1 生产资产运行证据层

- `utils/asset-usage.ts` 是业务层唯一证据分发入口：调用方只上报稳定 key、关系、状态和扁平 allowlist 元数据，不依赖 Storage 或 Debug IPC。
- 主进程用 `createModelContextAssetResolver` 校验 key，并把运行时 version / fingerprint 快照写入 `agent_asset_usage`；未知 key、解析失败和写盘失败只告警，不阻断 Agent 主链路。
- `agent_asset_usage` 只是关联索引：LLM 正文仍在 `llm_debug_logs`，Trace 仍由 tracer 管理，资产正文仍在各生产注册表；索引按 20,000 行与约 32 MB 双上限裁剪。
- LLM 记录 Prompt、Provider 路由 / 策略、Tool availability 与 Skill；Agent / Tool 记录执行、审批、命令责任链、有效沙箱和真实路径守卫；Memory 记录召回、画像、去重、反馈分桶、向量生命周期与引用纠错。
- Tool Registry 为每个 call 注入实际 tool span，使 `shell_exec` 和文件工具内部守卫证据精确挂到执行节点；不记录 command、路径、reason、args 或结果正文。
- Debug 通过单一 `debug:asset-usage-query` 按 span / asset / session 查询；LLM JSON 与 JSONL 导出都附带证据，清空 LLM Debug 时同步清理对应会话关联。

## Playground 设计层与体验组合

共享 UI 实现落在 src/components/foundation/，不依赖 Playground、fixture 或业务 IPC。TabStrip 是当前工作区回流的首个通用标签实现：UiControlsPanel、WorkspaceExperienceCandidate 与正式 ChatRightDock 直接 import；ui-component-registry 的 behavior.tabs 指向它。组件管理固定操作槽和键盘焦点，业务层保留实例状态、关闭选择及资源释放责任。IconButton 提供 24/28/32px 固定图标操作槽与统一 label/tooltip/aria-label；工作区添加、审阅工具和候选工作区入口同源，hover/disabled 不改变几何。WorkspaceToolMenu 统一正式与候选添加菜单的键盘循环、Escape、失焦和焦点恢复，但不拥有业务工具列表或实例资源。DiffViewer / DiffViewControls 提供统一/并排内容、缺稿回退与固定尺寸模式按钮；基础故事、候选和 ReviewPanel 同源，数据仍由 session IPC 提供，不在基础层计算差异或读取文件。MarkdownRenderer/CodeBlock 通过 Foundation useSurfaceTheme 读取容器的语义变量与 color-scheme；Mermaid 的 initialize+render 由同一串行适配器管理，取消不发布结果、失败不堵队列、finally 清理测量节点，保持 strict 和资源上限。局部候选主题不进入生产主题注册表。现有其它基础故事尚不等于已提取的共享组件。

Playground 的导航工作域不等于产品架构层。产品设计只保留两层：

```text
基础 Foundation → 产品体验 Experience
```

- **Foundation** 只登记可脱离业务复用的设计语言、图标、通用组件、状态和通用交互能力。
- **Experience** 登记 Chat、人物世界、设置和工作区的业务语义、页面组合与流程。记忆归入设置的“记忆与相处”分区；伙伴状态条、生活事件卡、角色卡、记忆引用芯片和完整右侧工作坞等业务结构属于 Experience。空态、确认、错误等业务状态回到各自真实上下文验收，不作为独立体验入口。
- **Agent 实验** 是 Playground 的独立工作域，不是第三层产品架构；它只承载隔离试验。
- Experience 只能通过 `src/shared/product-experience-registry.ts` 的 `usesFoundation` 引用 Foundation；发现基础能力缺失时，先在 Foundation 建故事并登记真实来源，再回到 Experience 组合。
- Playground 的一级 Tab 事实表与当前验收边界见 [`docs/requirements/playground-navigation-world-polish-v1.md`](requirements/playground-navigation-world-polish-v1.md)；代码注册表是 key、来源、状态和依赖的事实源，文档只记录边界与原则。
- Foundation 组件资产与 Foundation 故事是两种不同资产：`src/shared/ui-component-registry.ts` 只回答“组件是什么、来源和生命周期是什么”；`src/shared/foundation-story-registry.ts` 只回答“Playground 展示哪些故事、属于哪个组件、如何分组、由哪类 renderer 渲染”。二者通过 `assetKey` 关联，不把 React 实现导入 shared 注册表。
- `src/components/playground/catalog.ts` 的 Foundation Tab、`FoundationComponentsPanel.tsx` 的分组和 `layout.foundation-workbench` 的故事摘要都从 Foundation 故事注册表派生；新增故事不能只改 catalog 或工作台文案。
- `UiControlsPanel.tsx` 与 `FoundationAdvancedStories.tsx` 是 renderer 实现面：registry 的 `renderer` 决定路由，单元测试同时校验 assetKey、viewId、renderer 分支和实际源码标记；新增候选故事必须补注册、renderer、E2E 和文档。
- 当前 Foundation 故事筛选由注册表派生为 13 个任务入口：按钮、输入与表单、标签与选择、弹层、菜单与提示、徽标与标签、状态反馈、加载与进度、工具卡、Markdown 与资产、文件与差异、布局与滚动、卡片。入口合并只改变导航密度，不减少 story 预览。参考 Alice 后补入的 IconButton、Card、Badge、Tag、Divider 保持 `playground` 生命周期；ToggleRow、NavItem、ThemePicker、划词工具条和 Kbd 暂不登记为本项目 Foundation。

## 目录结构

```
my-agent/
├── electron/
│   ├── main/
│   │   ├── index.ts          # App 生命周期 + 窗口管理 + Tray + Auto Update
│   │   ├── ipc/              # IPC 处理器（按领域拆分，清单以代码为准）
│   │   ├── agent/            # Agent Loop + Runtime + Prompt + Context + Pipeline + Subagent
│   │   ├── tools/            # ToolRegistry + 内置 / Skill / MCP 工具 + Middleware
│   │   ├── services/         # 内部服务（task-plan-service 等，工具调用的底层逻辑）
│   │   ├── sandbox/          # 沙箱系统 + 权限引擎
│   │   ├── mcp/              # MCP Client（stdio + SSE）+ Bridge
│   │   ├── memory/           # 向量存储 + Embedding 适配器
│   │   ├── llm/              # LLM 流式适配器 + Provider 路由 + Failover + Cache
│   │   ├── rag/              # RAG 文档管道（导入 + 分块 + 向量化 + 检索）
│   │   ├── scheduler/        # 定时任务调度器（interval + cron + SQLite 持久化）
│   │   ├── storage/          # SQLite + Session/Settings/Memory Store
│   │   └── utils/            # Logger + 错误脱敏 + Tracer
│   └── preload/              # contextBridge 暴露 API
├── src/
│   ├── App.tsx               # 主 UI
│   ├── components/           # SettingsPanel / MarkdownRenderer / DevPanel / MemoryPanel / SkillsPanel / FileBrowser / Toast
│   └── shared/types.ts       # 共享类型定义
├── __tests__/               # vitest Unit + Playwright E2E
├── methodology/              # 设计哲学沉淀
└── docs/                     # 项目文档
```

## 核心数据流

### 用户输入 → AI 响应（主链路）

```
用户输入 → 渲染进程(React) → IPC chat:send
    → 主进程 AgentRuntime.chat()
        ├─ 记忆检索（向量 + SQLite）
        ├─ 上下文组装（System Prompt 4 层 + 消息管道清洗）
        ├─ Token 预算检查
        └─ Agent Loop（AsyncGenerator）
            ├─ streamChat → LLM API（Provider Router 自动选择协议）
            ├─ yield text/thinking/tool_calls 事件
            ├─ 工具调用 → Middleware Pipeline → 权限检查 → 执行
            └─ yield done → 后台任务（画像/向量索引/标题）
    → IPC chat:event → 渲染进程按 sessionId 过滤后流式显示

工具确认请求沿同一 IPC 边界携带 sessionId，由对应会话的确认队列承接；主 Chat 与 workspace 侧边聊天不得跨会话消费确认。

`session_kind=workspace` 仍复用人格与工具 Runtime，但跳过长期画像、向量召回、画像提取、标题、向量索引和反思任务；临时工作区对话不得改变主伙伴记忆。

正式侧聊实例以所属主会话 ID 为 React 生命周期边界：同主会话隐藏/切换标签保留，主会话变化重建并沿 session:delete 清理旧运行。创建失败重试走 createWorkspace，不能向空 session 发送；旧发送 Promise 的错误仅能更新仍归属该 session 的实例，正文、草稿和工具确认不跨主会话延续。

侧边聊天可通过 `WorkspaceChatContext` 传入父会话 ID、项目路径和当前文件／审阅焦点；
侧边聊天错误态重试复用失败消息的稳定内容重新进入同一 workspace session；侧边聊天可通过 `WorkspaceChatContext` 传入父会话 ID、项目路径和当前文件／审阅焦点；主进程限制路径与正文长度，Runtime 只读取父会话最近有限消息及焦点内容作为本轮上下文，不复制到 workspace 历史，也不把 Renderer 提供的路径当作工具工作目录或权限依据。
```

### 工具调用链路

```
LLM 返回 tool_calls（可能多个）
    → Agent Loop 按 LLM 原始顺序分批
        ├─ 连续 concurrencySafe 工具 → 并行批次（Promise.all）
        └─ 非安全工具 → 刷新批次，串行执行
    → 每个工具：
        → PermissionEngine 权限检查（五层责任链）
            ├─ allow → 继续
            ├─ needs_approval → IPC tool:confirm-request → 用户确认/拒绝
            └─ deny → 返回拒绝结果
        → ToolRegistry.executeSingle(toolCall, toolContext)
            → MiddlewarePipeline（error-formatting → logging → truncation）
                → toolDef.execute(args, ctx)  ← ToolContext 注入 workdir/sessionId/signal
    → yield tool_end → 继续 loop
```

### 数据持久化流

```
对话完成
    ├─ SQLite：保存消息（含 toolCalls + tool results）+ 累加 token 用量
    ├─ 向量数据库：异步嵌入并索引用户消息
    └─ 日 Token 计数器：recordDailyUsage
```

- 开发者模式沿 `SettingsPanel → settings:set/get → settings-store → App → PrimarySidebar` 单一路径控制 Debug / Playground 可见性；默认关闭，关闭仅收回入口，不影响诊断服务、资产或历史数据。

- 模型配置的产品入口统一由 `ModelRoutingSettings` 组合真实设置存储、路由配置工厂与主进程模型发现；空清单不合成连接或用途，不恢复旧单连接身份。Chat 仅展示实际主模型，配置在正式模型页管理；Playground 获取仍是隔离 fixture。

- LLM 配置工厂提供主对话、辅助任务和独立生图配置；Runtime 的图片输入仍使用主对话配置，image_generate 才调用生图配置。
