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
- [ ] **Part VI M22–M31** — 随 W0–W6 沉淀（框架见 `docs/requirements/companion-world-framework.md`）；旧占位已归档
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
- [ ] **召唤子会话（完整 Pack 装载）** — 当前仅浅层 brief
- [ ] **methodology M21–M31** 随 W 审核式深啃（代码后写；需观点对齐后写）
- [ ] **自动反思写 MUTABLE** — 存储/UI 已通，尚无低频反思管线

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
