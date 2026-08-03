# 第三批能力 Gap — 短需求边界

> 工程化 Gap 计划第三批。2026-07-26 实施。

## 范围

| ID | What | 验收 |
|----|------|------|
| M18 Eval B | B 类场景 + ModelBasedGrader；`runPassK`；`baseline` diff | 无 key 时 skip/不阻断；有单测覆盖 baseline |
| M13 Elicitation / Resources | Client 声明 elicitation；IPC 列表/读取 resources；UI prompt 响应 | preload / types / ipc 三处同步 |
| 会话 Runtime 中心化 | `chat:send` 只传本轮用户消息；历史由 session-store 加载 | App 乐观 UI + done 后 `session.get` 对齐 |
| M14 Observer | `AgentObserver` + Tracer/Composite 实现；loop LLM 埋点走接口 | observer 单测通过 |

## 非目标

- Swarm / M20 自进化 / 完整 Character Bible
- better-sqlite3 迁移
- 精美 Elicitation 表单 UI（本批用 `window.prompt`）
