# 心愿池

> 放灵感、外部参考启发、闪现的想法，以及**已识别但未排期的缺口**。**不承诺执行，只防止遗忘。**
> 决定了要做的 → 方法论相关进 `methodology/README.md` 待补队列或对应章节实战记录；动手中的记 `progress.md`。做完了的 → 从本文件勾掉/删除，并记 `progress.md`。

---

## 待办缺口（从方法论/审计同步，防遗忘）

> Agent 在深啃或收尾时若留下「暂缓 / 占位 / 工程债」，必须同步到本节。规则见根目录 `CLAUDE.md`「wishlist 同步」。

### 方法论占位章（按 README 待补队列）

- [x] ~~**M12 IPC**~~ — 2026-07-26 已沉淀（四处同步；confirm 超时清理）
- [x] ~~M15 状态机设计~~ — 2026-07-26 已沉淀（理念 + code；无代码改动）
- [x] ~~**M16 并发与数据架构**~~ — 2026-07-26 已沉淀（G1/G2/G3/G9 代码 + 理念/code 章）
- [x] ~~**M17 测试架构**~~ — 2026-07-26 理念+code 已沉淀
- [x] ~~**M13 MCP 集成**~~ — 2026-07-26 已沉淀（理念+code；元数据保守默认纠偏）
- [ ] **迁 better-sqlite3 / 增量快照** — M16 暂缓；等 sql.js 全量 export 体感卡顿再评估

### 已写章节的增量补洞（真相源：本节 + 各章实战记录；skill 不维护明细）

- [x] ~~**M13** SSE UI + 工具名规范化 + 断线重连 + Schema 保真 + Elicitation/Resources~~ — 2026-07-26
- [x] ~~**M12 C4** 确认对话框串行队列~~ — 2026-07-26
- [x] ~~**M04 工具** — 元数据函数化 / 工具别名 / 并发上限~~ — 2026-07-26
- [x] ~~**M07** G5/G13 + G2 连续 tool 去重 + G8 system 前缀 + G9 onCompact~~ — 2026-07-26
- [x] ~~**M08 记忆** — G6 语义去重~~ — 2026-07-26
- [x] ~~**M09 后台任务** — token 前后台分离；task:sync；checkpoint 列~~ — 2026-07-26
- [x] ~~**M14** 日志脱敏 + DevPanel 树 + Observer 接口化~~ — 2026-07-26
- [x] ~~**M18 Eval** — B01 + Judge + pass^k + Baseline diff~~ — 2026-07-26
- [ ] **M19 多 Agent** — Swarm 模式
- [ ] **M20 自进化** — G2 自动改进 / G3 代码级自进化 / G4 主动提案 / G5 撤销栈
- [x] ~~**W0** Universe + Role Pack（新主角×3 同团；废旧模板）~~ — 2026-08-01
- [x] ~~**W1** Orchestrator 单活跃门控 + MUTABLE 分桶 + 冷启动~~ — 2026-08-02
- [x] ~~**W2** LifeEngine 暂停/剧本/tick~~ — 2026-08-02
- [x] ~~**W3** Catch-up≤7 日 + 朋友圈 Moments~~ — 2026-08-02
- [x] ~~**W4** Assets 衣柜~~ — 2026-08-02
- [x] ~~**W5** 交际圈卡司 / 名册注入~~ — 2026-08-02
- [x] ~~**W6** 主动在场与体验横切收齐~~ — 2026-08-02
- [x] ~~**第二主角槽**~~ — 小周 Pack 已加厚（2026-08-02）
- [x] ~~**第三主角**~~ — 小夏 Pack 已加厚；3 槽内容分味（2026-08-02）
- [x] ~~**Pack 内容打磨**~~ — 三角色 + NPC + 分味剧本/衣柜；见 `companion-cast-content.md`
- [x] ~~**名册/召唤摘要 UI**~~ — CastPanel（2026-08-02）；完整子会话装载仍可后置
- [x] ~~**MUTABLE 设置 UI**~~ — Settings 读写/版本回滚（2026-08-02）
- [x] ~~**召唤子会话（完整 Pack 装载）**~~ — `startSummon` + session_kind=summon（2026-08-02）；CastPanel「开聊」
- [x] ~~**召唤忙闲婉拒**~~ — 对照 Alice `checkFriendAvailability`（2026-08-02）；可 force
- [x] ~~**M22 成长核方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M23 生活世界方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M24 朋友圈/事件层方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M25 资产层/衣柜方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M26 交际圈/卡司方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M27 对话两空间方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M28 冷启动/关系阶段方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M29 信息不对称/记忆透明方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M30 叙事/能力边界方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M31 主动在场方法论**~~ — 2026-08-02：理念+code 已沉淀
- [x] ~~**M32 体验调试方法论**~~ — 2026-08-04：理念+code；工程 Gap 见下（先施工合同）
- [x] ~~**M32-G1** DevPanel 拆 Debug / Playground 两面~~ — 2026-08-04：顶层 surface 切换
- [x] ~~**M32-G2** 工具手测（真执行 + 权限路径）~~ — 2026-08-04：`debug:tool-run` + confirmRisk
- [x] ~~**M32-G3** Prompt 会话级覆盖（非全局 settings）~~ — 2026-08-04：载入实装 + playgroundRun
- [x] ~~**M32-G4** 关键世界态透视（记忆 / 日程 / 角色快照）~~ — 2026-08-04：`debug:world-snapshot` + Debug「世界态」
- [x] ~~**M32-G5** 产品内设计 token / 基础控件场~~ — 2026-08-05：Playground「设计 token」
- [x] ~~**M32-G6** 错误卡 / 空态 / 权限确认夹具~~ — 2026-08-05：Playground「体验夹具」精简 3+1；非全家桶
- [x] ~~**M32-G7** 对话内 debugMode 叠加策略~~ — 2026-08-05：`conversationDebugMode` + 聊天 Overlay / 工具保留
- [ ] **M32-G8** aside Playground 预览（与行内 aside 耦合）
- [x] ~~**M32-G9** Playground 对齐 Alice（顶栏活目录 + UI 矩阵 + Prompt 目录）~~ — 2026-08-06 Phase 0；合同已落地；不装 Storybook
- [ ] **M32-G9 Phase 1** 控件矩阵加厚（确认框/记忆芯片/状态条）+ 可选多轮隔离对话
- [x] ~~**M32 Debug 系统态补全**~~ — 2026-08-05：沙箱/权限规则/Skills + 调用链统计展示
- [x] ~~**Part VI M22–M31**~~ — 2026-08-02：伙伴方法论主线已收齐
- [x] ~~**Part VI 加厚修订**~~ — 2026-08-02：M22–M31 均已加厚
- [x] ~~**M22-G1** 成长时钟按 role 分桶~~ — 2026-08-02：`companionGrowthStartedAtByRole`；旧键迁移到活跃主角
- [x] ~~**M22-G2** 反思用的 feedback 记忆按 role 过滤~~ — 2026-08-02：`memories.role_id` + `listFeedbackForRole`
- [x] ~~**M22-G3** MUTABLE 结构性防退化校验~~ — 2026-08-02：`mutable-validate` 规则门闸；setMutable/反思拒绝写入
- [x] ~~**M22-G4** 生活世界事件作反思信号~~ — 2026-08-02：Catch-up + 近 Moments 薄切片进反思 Prompt
- [x] ~~**M23-G1** 日剧本换 LLM 生成器~~ — 2026-08-02：tick 当日 LLM + 哈希回退；Catch-up 细补仍哈希
- [x] ~~**M23-G2** 世界状态加厚~~ — 2026-08-02：`world_json` 居所/时区/情境；Assemble L3 一行薄片
- [x] ~~**M23-G3** Catch-up 概况改 LLM 叙事~~ — 2026-08-02：`resolveCatchupSummary` LLM + 模板回退；Prompt 留在 catchup.ts
- [x] ~~**M24-G1** 对话与最近 Moment 一致性校验~~ — 2026-08-02：Assemble 近 3 条锚点 + 软校验（不拦 Loop）
- [x] ~~**M24-G2** LLM 润色动态文案~~ — 2026-08-02：tick prefer 润色；Catch-up 默认规则；校验拒新地点
- [ ] **M24-G3** 生图朋友圈（非本阶段）
- [x] **M25-G1** 用户编辑/删除资产 UI（`updateAsset`/`deleteAsset` + AssetsPanel）
- [x] **M25-G2** 获得事件自动入库（publish 读 `grantAsset`；幂等 `grant:{eventId}`；哈希剧本默认不填）
- [x] **M25-G3** bookshelf 等其它 asset kind（starter 分味 + 面板分栏；叙事注入另议）
- [x] **M25 旁路** 书架薄切片进 Assemble / Moment 可读引用 — `## Bookshelf` + 稀疏 `在读…`
- [x] **M26-G1** 卡司出现在 Moments 互动（评论/同框）— `deriveCastInteractions` → meta；面板展示
- [x] **M26-G2** 召唤会话与 M19 子 Agent 任务协作 — sessionKind 透传 + 任务工边界 Prompt
- [x] **M26-G3** NPC 多场景 prompt 组（执行/展示/互动）— `scenes/*.md` + summon 注入
- [x] **M27-G1** 问/做/安慰/推回显式策略或轻量分类 — `reply-stance` 启发式注入 Prompt
- [x] **M27-G2** aside 频率/质量 Eval（过油/缺失）— `shared/aside` + Eval C02
- [x] **M27-G3** 情绪语气收放控制器（非纯靠模型）— `tone-control` 紧/软/中性 + aside 策略
- [x] **M28-G1** relationshipStage 显式状态驱动 Prompt/行为 — 代理指标 → stranger/familiar/rapport 注入 Prompt
- [x] **M28-G2** 熟悉度区分「交心 vs 纯干活」信号 — `familiarity-mix` lean；task-leaning 压制 rapport
- [x] **M28-G3** 换角后的「再认识」微文案（不重置成长时钟）— `buildReacquaintCopy` + SwitchResult/toast
- [x] **M29-G1** 本轮注入/引用记忆的 UI 标注（id 或摘要芯片）— `memory_citations` 事件 + Chat 芯片
- [x] **M29-G2** 「记错了」对话内一键纠错（触发 forget/更新）— `correctCitedMemory` + 芯片按钮
- [x] **M29-G3** 敏感类别采集提示与面板高亮 — `sensitive-memory` 启发式 + MemoryPanel/remember
- [x] **M30-G1** 关系里程碑对象与回调提示 — 每角色每种一次；toast + Prompt 薄提示；反成就绑架
- [x] **M30-G2** 压缩保护「关系最小集」显式白名单 — compact instruction + 启发式并入摘要
- [x] **M30-G3** 用户专家度 → 能力解释粒度 — settings 覆盖 + 启发式；注入 Explanation grain
- [x] **M31-G1** 基于新 Moment 的可选轻提示（可静音）— tick 后应用内 toast；静音开关 + 15min 冷却
- [x] **M31-G2** 勿扰时段 / 频率预算 — 默认 22–8 + 日上限 3；可配置
- [x] **M31-G3** 定时主动问候（须严格派生 World）— 默认关；近 24h Moment + 勿扰 + 每日一次
- [x] ~~**自动反思写 MUTABLE**~~ — 2026-08-02：门闸 + 对话后入队 + Settings 手动/强制；需求见 `docs/requirements/companion-mutable-reflection.md`

- [x] ~~**Alice 前端走查 → P0/P1/P2**~~ — 2026-08-02：方案 `frontend-companion-surfaces.md`；含状态条/Moments/角色架/衣柜/名册/Chat 弱场景

### 工程债 / 产品向

- [x] ~~M10 shell 权限统一 + loadRules 接线~~ — 2026-07-26 已做
- [ ] **原生语音输入** — ⏸ 暂缓（2026-08-03）：Web Speech 已证不可靠；不做假 Mic。待选定 Win 原生 STT 或云端 Whisper 后单独立项。评估见 `docs/deferred/native-voice-input.md`
- [x] **权限规则可视化编辑器** — 设置页表单编辑 + 可选高级 JSON；热更新不变
- [x] ~~**M17 G1** `agent-loop` 迁 `_streamChatOverride`~~ — 2026-07-26
- [x] ~~**M17 G2** — LLM SSE fixture / replay~~ — 2026-07-26
- [x] ~~**M17 G3** — 可选真对话 E2E（无 `TEST_LLM_API_KEY` 则 skip）~~ — 2026-07-26
- [x] ~~**M17 G4** — IPC 可测纯逻辑单测~~ — 2026-07-26
- [x] **Playground** — DevPanel「Playground」单轮试跑；无 Assemble/记忆/工具
- [x] ~~**会话 Runtime 中心化** — chat:send 只传本轮用户消息~~ — 2026-07-26

---

## 灵感

> 格式：`- [ ] 一句话描述 — 来源`

### 可观测性（灵犀参考）

- [x] ~~**Observer 接口抽象**~~ — 2026-07-26 已做（`electron/main/utils/observer.ts`）
- [x] ~~**日志脱敏**~~ — 已有 sanitize；2026-07-26 勾掉重复项
- [x] **Context 传播 identity** — AsyncLocalStorage TraceContext → startSpan 自动注入；chat/task-queue 已接线
- [x] **异步 span 链接** — `startLinkedAsyncSpan` + task-queue 入队捕获 interactionSpanId；无 parent、有 links

### 沙箱与安全

- [ ] **Python 嵌入沙箱** — ⏸ 搁置（2026-08-03）：灵犀 CGO 嵌入 Python，与 Electron 栈不对齐；现有策略型沙箱对个人桌面够用。真要强隔离再评估 OS/容器方案。来源：灵犀 `pyairscript/cgo_sandbox/sandbox/`
- [x] ~~**PII 脱敏 + 文本预算**~~ — 2026-08-03 已做（`text-capture.ts`；tracer attributes / error 接入）
- [x] ~~**Session-based 采样**~~ — 2026-08-03 已做（`session-sampler.ts`；`MY_AGENT_TRACE_SAMPLE_RATE`；默认 1 全收）

### 架构参考

- [x] ~~**CompositeObserver 组合模式**~~ — 2026-07-26 已做（`observer.ts` CompositeObserver）
- [x] ~~**Callback 组件化**~~ — 2026-08-03 已做（`src/components/chat/callbacks/`：reasoning/content/tool 三通道 + App 接线）

### 前端 / 产品面（施工合同外）

- [x] ~~**前端视觉语言 + 设置 IA**~~ — Phase1–3 已落地：`docs/requirements/frontend-visual-language.md`
- [ ] **设置：账号 / 隐私云同步 / 用量统计大盘 / 自动化工作流** — Alice 有、我方无后端；合同明确不做假入口
- [ ] **侧栏 Wiki / 待办 / 定时应用模块** — Alice 应用区；非本轮视觉合同范围
