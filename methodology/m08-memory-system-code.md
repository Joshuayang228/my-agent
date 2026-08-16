# M08 记忆系统 — 代码走读

> 理念章：[`m08-memory-system.md`](./m08-memory-system.md)
> 最近核对：2026-08-16

---

## 一、三条链路

当前 Memory 不是一个万能类：

| 链路 | 入口 | 产物 |
|---|---|---|
| 手动记忆 | `storage/memory-store.ts`、`ipc/memory.ts` | SQLite 记忆条目 |
| 画像提取 | `agent/profile-extractor.ts` | 经去重后写入长期记忆 |
| 向量召回 | `memory/vector-store.ts` | 与当前请求相关的召回片段 |

画像是结构化长期知识，向量索引是检索加速层；删除或纠正记忆时必须同步向量状态，不能把 embedding 当作事实源。

## 二、Memory Schema 与分类

分类：

```text
identity / preference / fact / workflow / voice / feedback
```

条目包含 id、content、category、时间、可选 roleId 和敏感性。IPC 校验分类、ID、正文长度和 roleId；SQL 全部参数化。

`feedback` 表示用户对协作方式的纠正/确认，写入时要求 roleId，并在构建画像时只注入当前角色桶，避免不同主角之间串味。其他用户事实默认跨角色共享。

## 三、敏感记忆

健康、财务、工作场所机密等条目可标记敏感。敏感性影响 UI 和自动处理；记忆系统禁止保存密码、API Key 或原始密钥。普通日志、资产目录和 LLM Debug 不记录记忆正文。

## 四、语义去重

新增记忆前先做标准化与语义相似度判断，阈值来自 `MEMORY_SEMANTIC_DEDUP_THRESHOLD`。同类近重复内容更新或跳过，不能无限累积同义句。feedback 还有独立数量上限。

## 五、画像提取

`maybeExtractProfile()` 的门闸：

- 至少 3 条用户消息；
- 最多读取最近 20 条消息；
- 两次提取至少间隔 2 分钟；
- 分类只允许固定白名单；
- 调用统一 LLM 配置与 Prompt 资产；
- JSON 解析、长度和内容经过校验；
- 写入时带 roleId/sessionId 证据。

它由 TaskQueue 后台执行，不阻塞主回复；失败不会把半成品画像写入。

## 六、向量召回与生命周期

`vector-store.ts` 负责 embedding、召回 topK、最小分数、陈旧提示和会话向量上限。真实正文仍在 SQLite/会话；向量条目只用于检索。召回结果经过时间感格式化，旧记忆会标明陈旧而不是假装刚发生。

Embedding 调用使用统一模型配置，不由各调用点手拼 API Key/baseUrl/model。

## 七、引用纠错

UI 的“记错了/改正”走 `correctCitedMemory()`：

```text
删除：删除 SQLite 条目 + 移除向量
更新：更新原条目 + 更新索引
替换：删除旧条目 + 新建纠正条目
```

`planCitationCorrection()` 是纯函数，先决定动作再执行；不存在的 SQLite 条目也可清理孤立向量引用。

## 八、Prompt 注入

`buildUserProfile(roleId)` 组装 identity/workflow/voice。向量召回和手动记忆作为 L3 动态上下文进入 `prompt-builder.ts`；压缩摘要不自动写成长期记忆。Session Memory 仍存在于压缩后的会话消息中，没有独立可编辑存储面。

## 九、策略注册表

`memory/strategy-registry.ts` 从生产常量生成只读资产：画像提取、语义去重、feedback 分桶、向量召回、向量生命周期和引用纠错。注册表不复制用户记忆，也不成为运行参数的第二事实源。

## 十、测试证据

- `memory-dedup.test.ts`：语义去重；
- `memory-aging.test.ts`：陈旧提示与召回；
- `memory-feedback-role.test.ts`：roleId 分桶；
- `sensitive-memory.test.ts`：敏感性；
- `citation-correct.test.ts`：删除/更新/替换计划；
- `memory-tools.test.ts`：remember/recall/forget；
- `memory-strategy-registry.test.ts`：资产来源和参数。

## 十一、当前缺口

- 压缩摘要没有独立 Session Memory 面板；
- 向量库与 SQLite 之间仍需依赖补偿逻辑保证最终一致；
- 没有跨设备同步或服务端加密备份；
- 画像提取仍依赖模型输出，需要持续 Eval 防止误记。

## 2026-08 安全校准

- 自动画像候选对健康、财务、凭据、精确住址等敏感类别 fail-closed，不再直接写入长期记忆。
- `remember`、Memory IPC、导入、纠错、SQLite 存储和向量召回均以 `assertMemoryContentAllowed()` 作为最终凭据拒绝边界；旧敏感向量也不再进入 Prompt。
