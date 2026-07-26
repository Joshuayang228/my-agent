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
- [ ] **M22–M27 伙伴章** — 工程占位补完后再启动
- [ ] **迁 better-sqlite3 / 增量快照** — M16 暂缓；等 sql.js 全量 export 体感卡顿再评估

### 已写章节的增量补洞（详见 skill「增量补洞索引」）

- [ ] **M13** — SSE UI + 类型同步；断线重连；Schema 保真；Elicitation/Resources；工具名字符集规范化
- [ ] **M12 C4** — 确认对话框串行队列（并发确认会覆盖 UI）
- [ ] **M04 工具** — 元数据函数化 / 并发数上限 / 工具别名
- [ ] **M07 压缩** — G2 L2 去重；G5 image 剥离；G8 prompt cache；G9 内部压缩回调；G13 token 估算
- [ ] **M08 记忆** — G6 语义去重
- [ ] **M09 后台任务** — 前后台 token 分离；断线重连；长任务断点续接
- [ ] **M14 可观测** — 日志脱敏；DevPanel 树状调用链；Observer 接口化
- [ ] **M18 Eval** — B 类真实 LLM + LLM-as-Judge；pass^k；Baseline diff
- [ ] **M19 多 Agent** — Swarm 模式
- [ ] **M20 自进化** — G2 自动改进 / G3 代码级自进化 / G4 主动提案 / G5 撤销栈
- [ ] **M21 人格** — G3 MUTABLE 动态演化（P0）；G5 具名角色 Character Bible

### 工程债 / 产品向

- [x] ~~M10 shell 权限统一 + loadRules 接线~~ — 2026-07-26 已做
- [ ] **权限规则可视化编辑器** — 当前设置页为 JSON textarea
- [ ] **M17 G1** — `agent-loop.test` 等存量单测迁 `_streamChatOverride`（少用 `vi.mock(llm)`）
- [ ] **M17 G2** — LLM 适配层 SSE fixture / replay（参考 aisdk-testing-design）
- [ ] **M17 G3** — 可选真对话 E2E（无 `TEST_LLM_API_KEY` 则 skip）+ 与 skill 规范对齐
- [ ] **M17 G4** — IPC handler 可测性 / 单元测（与 M12 协同）
- [ ] **Playground** — 免上下文快速测试（查阅型）
- [ ] **会话 Runtime 中心化** — UI 不再承担会话读写
- [ ] **具名角色 / 子 Agent 人设库 / 活人感** — 差异化特色

---

## 灵感

> 格式：`- [ ] 一句话描述 — 来源`

### 可观测性（灵犀参考）

- [ ] **Observer 接口抽象** — 把 tracer 埋点从 loop.ts 里抽成 Observer 接口（`OnLLMStart/End`、`OnToolStart/End`），监控代码和业务代码解耦。来源：灵犀 `observability/observer.go`
- [ ] **日志脱敏** — 落盘日志加 API key / token 过滤。来源：灵犀 `otel_observer.go` 的 `marshalMessagesWithSelectiveSanitize`
- [ ] **Context 传播 identity** — `sessionId` / `userId` 自动注入 span attributes，不用手动传参。来源：灵犀 `observability/context.go`
- [ ] **异步 span 链接** — 后台任务（标题生成/画像提取/向量索引）创建 linked span，不影响主 trace 但可追溯。来源：灵犀 `context.go` 的 `StartLinkedAsyncSpan`

### 沙箱与安全

- [ ] **Python 嵌入沙箱** — CGO 嵌入 Python 解释器 + PEP 578 审计钩子 + 9 个预注册 CGO 函数做能力代理。来源：灵犀 `pyairscript/cgo_sandbox/sandbox/`
- [ ] **PII 脱敏 + 文本预算** — span attributes 超长文本用 `preview + sha256 + chars` 三段式替代存全文。来源：灵犀 `observability/text_capture.go`
- [ ] **Session-based 采样** — 按会话 ID 哈希做确定性采样，同一会话全收或全丢。来源：灵犀 `observability/session_sampler.go`

### 架构参考

- [ ] **CompositeObserver 组合模式** — 多个 Observer（追踪/计费/事件上报）组合扇出，Start 正序 End 逆序。来源：灵犀 `observability/composite_observer.go`
- [ ] **Callback 组件化** — reasoning/content/tool 三种 UI 组件各有独立 Start/Progress/Complete 生命周期。来源：灵犀 `feiche-agents/cc/callback.go`
