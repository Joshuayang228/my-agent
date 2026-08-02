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
- [x] ~~**第二主角槽**~~ — 薄 Pack「小周」已挂（2026-08-02）；内容仍可打磨
- [x] ~~**第三主角**~~ — 薄 Pack「小夏」`xia` 已挂满 3 槽（2026-08-02）；内容仍可打磨
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
- [x] ~~**Part VI M22–M31**~~ — 2026-08-02：伙伴方法论主线已收齐
- [x] ~~**Part VI 加厚修订**~~ — 2026-08-02：M22–M31 均已加厚
- [ ] **M22-G1** 成长时钟 `companionGrowthStartedAt` 按 role 分桶（现全局一份）
- [ ] **M22-G2** 反思用的 feedback 记忆按 role 过滤
- [ ] **M22-G3** MUTABLE 结构性防退化校验（现仅 Prompt 软约束）
- [ ] **M22-G4** 生活世界事件作反思信号（现仅用户消息 + feedback）
- [ ] **M23-G1** 日剧本换 LLM 生成器（现哈希 mock）
- [ ] **M23-G2** 世界状态加厚（居所/时区/短期情境结构化）
- [ ] **M23-G3** Catch-up 概况改 LLM 叙事（现规则模板）
- [ ] **M24-G1** 对话与最近 Moment 一致性校验
- [ ] **M24-G2** LLM 润色动态文案（仍须绑定 event）
- [ ] **M24-G3** 生图朋友圈（非本阶段）
- [ ] **M25-G1** 用户编辑/删除资产 UI
- [ ] **M25-G2** 获得事件自动入库（`maybeGrantFromEvent` 尚未挂 publish 主路径）
- [ ] **M25-G3** bookshelf 等其它 asset kind
- [ ] **M26-G1** 卡司出现在 Moments 互动（评论/同框）
- [ ] **M26-G2** 召唤会话与 M19 子 Agent 任务协作
- [ ] **M26-G3** NPC 多场景 prompt 组（执行/展示/互动）
- [ ] **M27-G1** 问/做/安慰/推回显式策略或轻量分类
- [ ] **M27-G2** aside 频率/质量 Eval（过油/缺失）
- [ ] **M27-G3** 情绪语气收放控制器（非纯靠模型）
- [ ] **M28-G1** relationshipStage 显式状态驱动 Prompt/行为
- [ ] **M28-G2** 熟悉度区分「交心 vs 纯干活」信号
- [ ] **M28-G3** 换角后的「再认识」微文案（不重置成长时钟）
- [ ] **M29-G1** 本轮注入/引用记忆的 UI 标注（id 或摘要芯片）
- [ ] **M29-G2** 「记错了」对话内一键纠错（触发 forget/更新）
- [ ] **M29-G3** 敏感类别采集提示与面板高亮
- [ ] **M30-G1** 关系里程碑对象与回调提示
- [ ] **M30-G2** 压缩保护「关系最小集」显式白名单
- [ ] **M30-G3** 用户专家度 → 能力解释粒度
- [ ] **M31-G1** 基于新 Moment 的可选轻提示（可静音）
- [ ] **M31-G2** 勿扰时段 / 频率预算
- [ ] **M31-G3** 定时主动问候（须严格派生 World）
- [x] ~~**自动反思写 MUTABLE**~~ — 2026-08-02：门闸 + 对话后入队 + Settings 手动/强制；需求见 `docs/requirements/companion-mutable-reflection.md`

- [x] ~~**Alice 前端走查 → 设计方案 + P0/P1**~~ — 2026-08-02：方案 `frontend-companion-surfaces.md`；P0 状态条/Moments/角色架；P1 衣柜主视觉/名册关系卡
- [ ] **P2 UI**：场景弱背景（方案 G6）

### 工程债 / 产品向

- [x] ~~M10 shell 权限统一 + loadRules 接线~~ — 2026-07-26 已做
- [ ] **原生语音输入** — Electron Web Speech API 不可靠，已从输入栏移除 Mic；若要做需主进程/系统 API 方案
- [ ] **权限规则可视化编辑器** — 当前设置页为 JSON textarea
- [x] ~~**M17 G1** `agent-loop` 迁 `_streamChatOverride`~~ — 2026-07-26
- [x] ~~**M17 G2** — LLM SSE fixture / replay~~ — 2026-07-26
- [x] ~~**M17 G3** — 可选真对话 E2E（无 `TEST_LLM_API_KEY` 则 skip）~~ — 2026-07-26
- [x] ~~**M17 G4** — IPC 可测纯逻辑单测~~ — 2026-07-26
- [ ] **Playground** — 免上下文快速测试（查阅型）
- [x] ~~**会话 Runtime 中心化** — chat:send 只传本轮用户消息~~ — 2026-07-26

---

## 灵感

> 格式：`- [ ] 一句话描述 — 来源`

### 可观测性（灵犀参考）

- [x] ~~**Observer 接口抽象**~~ — 2026-07-26 已做（`electron/main/utils/observer.ts`）
- [x] ~~**日志脱敏**~~ — 已有 sanitize；2026-07-26 勾掉重复项
- [ ] **Context 传播 identity** — `sessionId` / `userId` 自动注入 span attributes，不用手动传参。来源：灵犀 `observability/context.go`
- [ ] **异步 span 链接** — 后台任务（标题生成/画像提取/向量索引）创建 linked span，不影响主 trace 但可追溯。来源：灵犀 `context.go` 的 `StartLinkedAsyncSpan`

### 沙箱与安全

- [ ] **Python 嵌入沙箱** — CGO 嵌入 Python 解释器 + PEP 578 审计钩子 + 9 个预注册 CGO 函数做能力代理。来源：灵犀 `pyairscript/cgo_sandbox/sandbox/`
- [ ] **PII 脱敏 + 文本预算** — span attributes 超长文本用 `preview + sha256 + chars` 三段式替代存全文。来源：灵犀 `observability/text_capture.go`
- [ ] **Session-based 采样** — 按会话 ID 哈希做确定性采样，同一会话全收或全丢。来源：灵犀 `observability/session_sampler.go`

### 架构参考

- [x] ~~**CompositeObserver 组合模式**~~ — 2026-07-26 已做（`observer.ts` CompositeObserver）
- [ ] **Callback 组件化** — reasoning/content/tool 三种 UI 组件各有独立 Start/Progress/Complete 生命周期。来源：灵犀 `feiche-agents/cc/callback.go`
