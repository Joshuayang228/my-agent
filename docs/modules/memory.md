# 记忆（memory）

## 一句话

跨会话持久化用户信息，并在对话前检索注入 Prompt，使 Agent「越用越懂你」。

## 边界

整份备份包含模型连接时，导入先等待系统加密状态可持久恢复，再读取业务快照并进入提交；失败不会新增记忆或触发索引通知。此保护属于 settings-store 的敏感配置边界，不改变记忆内容、去重、索引模型或 RAG 暂缓范围。

朋友圈历史备份属于生活数据，不自动生成长期记忆或触发记忆抽取。它与已有记忆记录共用整份备份事务，但不进入记忆索引。

会话生成图片不是长期记忆：schema 17 的 messages.generated_images 保存工具媒体引用，由会话存储与受限媒体读取负责，不直接进入记忆检索。JSON 备份携带校验后的图片字节并恢复到应用专属目录；会话、记忆、设置和生活资产共用一次同步 SQLite 事务及快照替换，写盘失败补偿内存。向量索引不纳入 SQLite 提交；结构化记忆以持久 SQLite 为源，启动、成功提交与失败退避重试时核对派生镜像。恢复依赖可用的嵌入配置及服务，不承诺断电耐久性，也不重建无结构化源的对话向量。

记忆相关辅助模型仍统一通过 LLM 配置工厂读取；模型连接与用途路由变化不改变记忆存储、召回和分类语义，相关密钥不进入 Renderer 或备份。

正式模型配置现经专用双键保存及失败恢复；该补偿仅作用于 modelConnections / modelRoutes，不改变记忆 CRUD 或向量同步的事务边界。

**做**：用户与关系的结构化长期记忆（画像/偏好/事实/约定）、向量语义召回、remember/recall/forget 工具、MemoryPanel、对话索引、注入 L3。
**不做**：Agent 生活世界的原始事件（朋友圈、衣柜、文化角、家居、通讯录、足迹由伙伴世界承载；schema v15 的 `companion_moment_user_interactions` 也属于生活面用户态，不进入记忆存储、召回或画像）；当前任务 / 工具动作 / 运行轨迹（由 Chat、工作区和 Debug 承载）；项目文档 RAG 库（见 rag）；Skill 手册；会话内短期上下文压缩（见 context-manager，属运行时）。

## 短 Why

没有记忆的人格是失忆演员。记忆必须可写、可召回、可遗忘，并与 Prompt 组装联动。

## 主入口

| 类型 | 位置 |
|------|------|
| UI | `MemoryPanel` |
| IPC | `ipc/memory.ts` |
| 工具 | `remember` / `recall` / `forget` |
| Prompt | L3（画像 + 检索片段） |
| 后台 | profile 提取、对话向量索引、`memory/index-sync.ts` 结构化镜像恢复 |

## 依赖

- **依赖**：storage（SQLite）、memory/vector-store + embeddings、prompt-builder、llm（提取/嵌入）
- **被依赖**：chat 发送路径、companion 反思（用户消息/反馈信号）、DevPanel 可观测

## 不变量

- 设置中的 `companionResponseNote` 是用户显式维护的回应偏好，不写入 memory-store 或向量库，不受记忆 CRUD 控制；由伙伴设置清空和管理。它与记忆同在 L3 但独立组装，不能把此字段接入描述为记忆界面已完整回流。

- SQLite 是结构化记忆唯一事实源，向量镜像最终一致；增删改仅成功落盘后通知恢复服务，启动扫描不依赖上次内存通知。缺失 / 过期 / 重复镜像按稳定 id 核对，保留分类、角色与更新时间，不改对话向量。
- Prompt 不得重复堆叠同一段画像（避免双重注入）
- 对外错误不暴露内部路径 / SQL
- SQLite 与 Vectra 快照均使用原子替换，临时写入 / rename 失败保留旧文件；记忆 CRUD 写盘失败补偿内存且不发布成功通知。所有向量写入串行，失败清理 Vectra 更新事务；首次加载也纳入共享初始化，避免并发冷读覆盖新索引。
- 页面四类是六种存储类别的只读投影：identity / fact → 身份信息，workflow → 工作方式，voice / preference → 沟通偏好，feedback → 我们之间；唯一映射在 `src/shared/memory-groups.ts`，不按正文猜测、不改写旧数据。

## 必读文件

- `electron/main/storage/memory-store.ts`
- `electron/main/memory/vector-store.ts`
- `electron/main/memory/index-sync.ts`
- `electron/main/memory/embeddings.ts`
- `electron/main/tools/builtins/memory-manage.ts`
- `electron/main/agent/profile-extractor.ts`
- `electron/main/agent/prompt-builder.ts`
- `src/components/MemoryPanel.tsx`
- `electron/main/ipc/memory.ts`

## 必测点

- remember 后 recall 能命中；forget 后两侧干净
- 相关单测：`memory-tools`；语义去重相关测试（若有）；后台向量任务 teardown drain
- `memory-index-recovery` Unit 使用真实 SQLite / Vectra，覆盖未发通知的源恢复、分类与角色、重试取消、改删竞态、快照替换失败及并发冷读；嵌入模型用测试替身，不代表外部供应商质量。
- 同名独立 Electron 测试从正式数据页导入，在快照落盘后强退，验证源数据保留、嵌入服务失败后重启恢复、真实磁盘索引检索与重复启动不重复嵌入。
- 手动：MemoryPanel CRUD 与对话注入可感知
- 正式入口 UI：长文删短后不切换编辑器；增删改防重入、失败保留草稿、写入成功但刷新失败只重读、离页迟到响应隔离；四主题与 1166 / 600px 操作槽几何一致。
- Electron：独立数据目录中，从正式设置新增 / 修改，完整关闭并重启进程后读取一致，再从正式入口删除；不以 Renderer IPC 替身替代磁盘恢复证据。
- 整页：四类计数覆盖旧六类数据；搜索只筛当前类且不改计数，Escape 仅关闭局部控件；各类新增草稿独立保留；长列表内部滚动、搜索开关不挤动导航、IME 不提交。`memory-foundation-reuse` 校验正式 / 故事 / 业务控件 / Foundation 的真实 JSX 符号链，包含未使用导入和同名遮蔽负例。

## 已落地能力

向量空间隔离已接入：写入记录实际请求端点 / 嵌入模型的指纹、服务报告的模型和维度，查询在相似度计算前要求三者匹配；聊天模型与密钥轮换不改变请求空间。结构化镜像在核对时按当前请求空间重建，SQLite 不变；未配置时不会仅因空间未知清理镜像。旧对话不自动重建，无身份向量不再召回。策略资产召回 1.1.0 / 生命周期 1.3.0 从生产身份函数派生字段。成功保存模型配置或实际导入模型键后自动唤醒并取消旧请求；失败保存不发布通知。独立嵌入模型选择和服务端静默换模恢复仍归 S2。

- 单条与批量 Embedding 请求在空 Key 时省略 Authorization，有 Key 时保留当前连接凭据；不再用一次 404 永久禁用本进程全部连接，单次失败由调用方处理，结构化索引仍按既有 30 秒退避恢复。启动及手动记忆提交后的同步不再要求非空 Key；有 Key / 无 Key 两种正式 Electron 流程均验证源恢复、真实磁盘镜像与重复启动不重复生成。当前仍沿主用途端点与默认嵌入模型；独立嵌入模型选择、端点切换后的向量空间一致性仍属 S2，不表示任意本地服务支持默认模型。

状态：`已落地` · `部分` · `缺口`。能力增删或行为变了 → **同轮改本表**。

| 能力 | 状态 | 入口 / 落点 |
|------|------|-------------|
| 结构化记忆（画像 / 偏好 / 事实） | 已落地 | `memory-store` · MemoryPanel · `memory:*` IPC |
| remember / recall / forget 工具 | 已落地 | `tools/builtins/memory-manage.ts` |
| 向量语义召回注入 L3 | 已落地 | `vector-store` · `runtime.safeVectorSearch` |
| 对话后索引用户消息 | 已落地 | `vector-index-user`（不索引 assistant 原文） |
| 后台画像提取 | 已落地 | `profile-extractor` · task `profile-extract` |
| 语义去重（记忆写入） | 已落地 | M08 G6 |
| 记忆后台向量任务生命周期 | 已落地 | `drainMemoryBackgroundTasks`；保留非阻塞写入，同时为测试 teardown / 应用退出提供 drain 边界 |
| 本轮引用芯片（M29-G1） | 已落地 | `memory_citations` · `MemoryCitationChips`（Chat + Playground） |
| 对话内纠错（M29-G2） | 已落地 | `correctCitedMemory` |
| 敏感高亮与采集提示（M29-G3） | 已落地 | `sensitive-memory`；自动画像跳过敏感类别，凭据内容在存储/导入/向量召回层硬拒绝 |
| 敏感记忆提示 | 已落地 | 正式与故事紧凑卡第一行共用“敏感信息：涉及健康隐私，请谨慎保留。”（类别由现有检测结果提供）；不重复分类标签或操作说明，编辑保留提示；敏感检测与存储拒绝策略不变 |
| 正式记忆卡片布局 | 已落地 | 正式 MemoryPanel 复用 Playground 的长文本换行、敏感信息首行提示、日期与正文同层级右侧固定槽，以及编辑/删除/确认操作的固定尺寸；真实 memory IPC、CRUD 和敏感检测保持不变 |
| 记忆编辑与异步恢复 | 已落地 | 多行编辑器在本次编辑期间保持类型；增删改请求串行，失败保留内容并提示，成功后刷新失败独立重读；初次加载错误不冒充空列表，卸载后响应不写新页面；紧凑卡动作复用 Foundation IconButton |
| 敏感新增确认快照 | 已落地 | 正式 MemoryPanel 在检测出敏感内容后绑定当时的正文、分类和类别快照；确认只提交该快照，修改正文 / 切分组 / 取消新增会使旧确认失效；失败保留同一草稿和确认，成功关闭；Playground 候选仍只写隔离夹具 |
| MemoryPanel 页面基线 | 已落地 | Playground 隔离夹具：身份信息 / 工作方式 / 沟通偏好 / 我们之间；伙伴生活由人物世界呈现，运行轨迹由 Debug 承载；纠正仅写入 Renderer 内存 |
| Playground 记忆信息架构与密度基线 | 已落地 | 四类 Tab 是唯一一级导航；多条记忆使用独立条目卡，清单不再嵌套带背景、阴影和固定最小高度的页面预览框；普通模式不展示来源或“之后会”，隔离 Debug 开启后才可在右上角打开“查看来源”；`previewCompact` / `previewShowSource` 不影响正式 MemoryPanel |
| 记忆管理整页 | 已落地 | 正式设置与 Playground `MemorySurface` 共用 `MemoryPanel` 管理流程；四类导航和搜索同行，独立条目卡与列表后新增行、真实分类计数、分组独立草稿；TabStrip / TextField / IconButton / ActionButton 来自 Foundation。正式删除旧类别栏、顶部表单、关闭入口与底部技术说明。新增使用 identity / workflow / voice / feedback，最后一类保留当前 roleId；历史类别、IPC、存储与 Prompt 不变，来源和状态样张仍只在 Playground |
| 记忆分类语义色 | 已落地 | `MemoryPanel` 使用 accent / warm / success / muted；颜色只表达分类，不改变存储与 IPC |
| 记忆策略生产资产目录 | 已落地 | 全局 Debug「提示词管理器 → 记忆策略」；提取 / 去重 / 分桶 / 召回 / 生命周期 / 纠错策略有稳定 key、来源、版本、指纹和依赖；不再从 Chat 右侧调试半屏进入；记忆管理入口位于 Settings |
| 工作区侧边聊天会话隔离 | 已落地 | `session_kind = workspace` 的临时会话由存储层保留其类型、不进入主会话列表，且不改变记忆存储、召回或 L3 Prompt 注入边界；面板卸载时清理 |
| 备份导入记忆路径 | 已落地 | 整份预检复用 `assertMemoryContentAllowed`，2～20,000 字符且拒绝凭据；与普通 `addMemory` 共用 `writeMemoryToDatabase`，保留语义去重、角色分桶。会话 / 生活资产 / 设置 / 记忆同步提交，SQL 与最终快照失败恢复；仅成功落盘后发布索引核对及资产副作用，统计实际新增数 |
| 结构化记忆索引恢复 | 已接入，整体验收见回流合同 S1 | 主进程启动、记忆及模型配置成功提交唤醒单一核对 worker，失败按生产策略退避重试、退出中止请求；SQLite 提交后即使未发通知，重启仍可从源补齐。生命周期资产 1.3.0 从实际恢复策略派生；查询使用当前 Vectra 三参数 API |
| 项目文档 RAG | 不做（本模块） | 见 `rag/` |
| 模型配置提交后自动恢复索引 | 已落地 | settings-store 无载荷提交事件；成功保存 / 备份实际写入后唤醒，旧尝试取消并阻止迟到发布；失败保存不通知，停止后解除订阅；正式 Electron 有 Key / 无 Key验证 |

## 相关决策

- `DEC-004`：SQLite + 向量数据库的双层存储选择。
- `DEC-007`：Vectra 作为本地向量检索层。
- `DEC-009`：Embedding 复用 LLM API，不内置本地模型。

## 现状 / 缺口

**现状**：SQLite + Vectra；工具三件套；画像提取；敏感信息 fail-closed；凭据不进入长期记忆或 Prompt；语义去重；M29 芯片/纠错/敏感；体验契约见 `methodology/m29-asymmetric-memory.md`。
**边界**：四类导航是既有类别的确定性展示，不是对历史正文重新做语义分类；各分组草稿在当前页面生命周期保留，不新增跨应用重启草稿存储。项目 RAG 不归本模块。记忆页回流不能代表设置其余页面或全产品目标完成。

- 2026-09-14：复核本批设置门控与 Skills 入口收敛，未改变记忆存储、召回、敏感确认或编辑契约；记忆回归仍沿用本模块既有测试。
- 2026-09-16：复核 R09 Skills 回流：`skill-state-store` 仅复用 settings 表保存独立的启停键，不属于长期记忆，不写入 memory-store 或向量库；导出 settings 建表函数不改变记忆初始化、CRUD 或召回契约。
- 2026-09-16：敏感新增确认改为绑定不可变草稿快照；检测规则、存储拒绝策略和 memory IPC 不变。Playground 候选不走真实写入。该补验不关闭设置其余页面或全产品回流。
- 2026-09-17：复核生活资产备份。记忆导入继续走 `memoryStore.addMemory`，不改成裸 SQL；生活资产与播种标记不进入记忆存储、召回或画像。该复核不关闭备份以外的记忆缺口。
