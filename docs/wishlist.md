# 心愿池

> 放灵感、外部参考启发、闪现的想法。**不承诺执行，只防止遗忘。**
> 决定了要做的 → 写进 `module-roadmap.md`。做完了的 → 记在 `progress.md`。

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
- [ ] **Callback 组件化** — reasoning/content/tool 三种 UI 组件各有独立 Start/Progress/Complete 生命周期。来源：灵犀 `lingxi-agents/cc/callback.go`
