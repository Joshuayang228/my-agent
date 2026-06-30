# Agent Harness

这是本项目面向 Codex、Claude Code、Cursor 等开发 Agent 的通用规则主体。工具专用入口文件只负责指向本文档，不复制整套规则。

本文档保留高频、强约束、默认执行的规则；低频或场景化规则放在 `docs/agent-skills/` 中按需读取。

## 项目定位

My Agent 是一个人格化桌面 AI Agent：有性格、有记忆、能成长，目标是成为用户的数字伙伴，而不只是命令式工具。

开发时优先保护这些产品方向：

- 人格化交互和长期记忆是核心差异化。
- Agent Loop、工具系统、MCP、Skill、沙箱和上下文管理是基础设施层。
- 工具是 AI 可见、可调用、会进入对话历史的能力；内部服务是框架私有能力，不应暴露为工具。

## 启动上下文

开始较大的代码任务前，先阅读：

1. `docs/architecture.md`
2. `docs/progress.md`
3. 与任务直接相关的 `docs/*.md`

如果任务很小，例如 typo、注释、单文件少量修改，可以只读取相关文件。

## 按需规则路由

遇到以下场景时，先读对应文档：

| 场景 | 读取文件 |
|------|----------|
| TypeScript / 主进程 / 工具系统开发 | `docs/agent-skills/typescript-guidelines.md` |
| React / CSS / UI 改动 | `docs/agent-skills/frontend-guidelines.md` |
| Bug 修复 / 调试 | `docs/agent-skills/debug-guide.md` |
| 代码审查 / 自审 | `docs/agent-skills/code-review.md` |
| Git / commit / push / PR | `docs/agent-skills/git-workflow.md` |
| 部署 / 打包 / 发版 | `docs/agent-skills/deploy-checklist.md` |
| LLM Provider / 模型配置 / 上下文压缩 | `docs/agent-skills/model-config.md` |
| 安全 / 密钥 / 权限 / 沙箱 | `docs/agent-skills/security-checklist.md` |
| 写文档 / 文章 / README | `docs/agent-skills/writing-style.md` |
| `methodology/` 方法论沉淀 | `docs/agent-skills/methodology-writing.md` |

## 工作方式

- 用户明确要求修改时，直接推进实现；需求含糊或风险较高时，先问清楚。
- 批量修改、架构变更、跨 3 个以上文件的新功能，**必须先写需求文档**（见下方"需求文档规范"），用户确认后再动手。
- 新增功能前搜索项目内已有实现，避免重复造轮子。**使用冗余搜索策略**（见 `docs/agent-skills/typescript-guidelines.md`）：从多个角度（关键词/文件名/类型/调用链/测试）覆盖同一目标。
- 复杂功能优先查项目参考资料：`_reference/framework-harness/repos/claude-code-sourcemap-main/`、Alice 方法论、项目 `docs/`，再考虑 GitHub/npm 或自研。
- 改文件前先读取最新版本，尊重工作区已有改动，不回滚用户未要求回滚的内容。
- 删除代码前说明原因；涉及大段删除时先获得用户确认。

## 需求文档规范

**适用场景**：跨 3 个以上文件的新功能、架构变更、复杂功能模块。

**必须包含的内容**：

1. **需求背景**（Why）
   - 为什么要做这个功能？解决什么问题？
   - 当前痛点是什么？
   - 不做会有什么后果？

2. **功能目标**（What）
   - 用户视角：用户能做什么新事情？
   - 系统视角：系统增加了什么能力？
   - 成功标准：如何验证功能达成？

3. **技术方案**（How）
   - 架构设计：新增哪些模块？改动哪些现有模块？
   - 数据流：输入 → 处理 → 输出的完整链路
   - 关键接口：新增的类型、函数签名
   - 依赖关系：需要哪些外部库或服务？

4. **影响范围评估**
   - 破坏性变更：是否影响现有 API？
   - 测试工作量：需要新增/修改哪些测试？
   - 文档更新：需要更新哪些文档？

5. **实施步骤**
   - 按逻辑顺序列出步骤（不是文件列表）
   - 每步说明预期结果和验证方式

6. **风险与权衡**
   - 已知的技术风险
   - 设计权衡（为什么选 A 而不是 B）
   - 未来可能的扩展点

**示例**（简化版）：
```markdown
# 需求文档：工具大结果落盘

## 1. 背景
shell_exec 执行 find / 返回几十 MB 内容，直接放入上下文导致 413 错误。
当前做法是硬截断，AI 看不到完整结果，影响任务完成率。

## 2. 目标
- 用户视角：AI 能处理任意大小的工具输出
- 系统视角：工具结果超过阈值时自动落盘，返回文件路径
- 成功标准：shell_exec find / 不再导致 413，AI 能通过 file_read 读取完整结果

## 3. 技术方案
新增中间件 resultPersistenceMiddleware，在工具执行后检查结果大小：
- 超过 maxResultSizeChars → 写临时文件，返回路径 + 提示
- 未超过 → 直接返回

数据流：
ToolRegistry.executeSingle → middleware chain → resultPersistence 检查 
→ 超限时写 workdir/.tmp/tool-results/xxx.txt → 返回路径提示

关键接口：
- ToolDefinition 新增字段 maxResultSizeChars?: number
- 新增函数 writeLargeResult(content, toolName, workdir): Promise<string>

## 4. 影响范围
- 破坏性：无（向后兼容）
- 测试：新增中间件单元测试
- 文档：更新 architecture.md 的中间件部分

## 5. 实施步骤
1. 扩展 ToolDefinition 类型 → 验证：tsc 通过
2. 实现 writeLargeResult 函数 → 验证：单元测试
3. 实现 resultPersistenceMiddleware → 验证：单元测试
4. 集成到 ToolRegistry → 验证：E2E 测试（shell_exec 大输出）
5. 更新文档

## 6. 风险与权衡
- 风险：临时文件清理失败可能留垃圾 → 缓解：进程退出时注册清理
- 权衡：为什么不用流式返回？→ LLM API 不支持工具结果流式传输
- 扩展点：未来可以支持结果压缩（gzip）
```

## 架构约束

主进程代码遵守分层方向：

```text
ipc -> agent -> llm / tools / storage
              -> memory
```

禁止反向依赖：

- `agent/` 不应 import `ipc/`
- `llm/` 不应 import `agent/` 或 `ipc/`
- `storage/` 不应 import `agent/`、`ipc/` 或 `llm/`
- `tools/builtins/` 不应 import `agent/` 或 `ipc/`

允许依赖方向：

- `ipc/` 可以依赖 `agent/`、`storage/`、`tools/`、`llm/`、`memory/`
- `agent/` 可以依赖 `llm/`、`tools/`、`storage/`
- `tools/` 仅在工具实现需要时依赖 `llm/`
- 所有模块可以依赖 `utils/` 和 `src/shared/types.ts`

新增模块前先明确它属于哪一层。

### IPC 三处同步约束

修改 IPC 接口时，**必须同步三处**：

1. `src/shared/types.ts` — 类型定义
2. `electron/preload/index.ts` — preload 桥接层暴露的 API
3. `electron/main/ipc/*.ts` — 主进程 IPC 处理器

不同步会导致运行时类型错误或"方法未定义"。改完后用 tsc + 测试验证。

## 规则冲突优先级

当规则之间发生冲突时，按以下优先级裁决：

1. **安全红线** — 密钥泄露、权限绕过、数据破坏等安全问题
2. **用户显式指令** — 用户明确说"这样做"的要求
3. **开发流程规范** — 本文档和 agent-skills 的流程约束
4. **代码风格标准** — 命名、格式、注释等规范
5. **建议性规则** — 性能优化、可读性建议等

示例：用户明确要求"暂时硬编码 token 测试"时，不能以"安全红线"拒绝（因为用户知情且授权）；但如果用户要求"push 时保留硬编码 token"，应拒绝并建议替代方案。

## 质量底线

- 不硬编码 API Key、密码、token 或其他凭据。
- `.env` 必须保持在 `.gitignore` 中。
- 对用户展示的错误信息应友好，不暴露内部路径、堆栈或敏感实现细节。
- 修 bug 先定位根因，避免猜测式修改。
- 新功能尽量配套测试；修 bug 优先补复现测试。
- 完成后按变更风险运行合适的测试、类型检查或构建。
- 同一方法失败两次后换路径，不做第三次盲试。
- 禁止 Mock 真实 AI 调用，测试场景除外。
- **禁止分期实现或临时方案** — 每次给出完整可用的实现，不留"TODO 后续补"或"先用简化版"。如果功能确实复杂需分步，在需求文档里明确拆分边界，每步独立可验证。
- **收尾沉淀强约束** — 功能完成后必须更新以下文档：
  - `docs/progress.md` — 当前进度时间线（必更新）
  - `docs/changelog.md` — 用户可见变更记录（功能/修复必更新）
  - `docs/architecture.md` — 架构或模块边界变化时更新
  
  不要只更新 progress.md 就结束。也不要机械更新所有文档——按实际影响范围决定。
- **Git 提交与推送强门控** — 功能开发完成且通过测试后，**必须**立即执行 Git 提交（Commit）与推送（Push）：
  - 严禁将大量未提交的修改堆积在本地；
  - 严禁只 Commit 而不 Push；
  - 如遇网络代理问题应检查端口（如 Clash 的 7890、7897），解决后重新 Push，以确保 GitHub 远程与本地保持一致。具体流程见 `docs/agent-skills/git-workflow.md`。

## 前端验收

涉及 UI 的改动，应尽量用浏览器或截图检查关键状态，至少关注：

- 深色和浅色主题是否可用。
- 文本是否溢出、遮挡或错位。
- 主要交互是否真的可操作，而不只是元素存在。

## 文档更新

按影响范围更新文档：

- 当前状态变化：`docs/progress.md`
- 用户可见功能变化：`docs/features.md`
- 架构或模块边界变化：`docs/architecture.md`
- IPC、类型或接口变化：`docs/api-contracts.md`
- 技术决策：`docs/decisions.md`
- 踩坑和修复经验：`docs/pitfalls.md`
- 变更记录：`docs/changelog.md`
- 规则不合理或冲突：`docs/rules-feedback.md`

不要为了形式机械更新所有文档；也不要在明显影响文档时遗漏沉淀。

## 旧 Cursor 规则的地位

`.cursor/rules/` 和 `.cursor/skills/` 是历史规则来源，包含许多仍有价值的项目经验。但它们带有 Cursor 专用入口、工具名和流程假设。

迁移期间：

- 本文档是通用规则主体。
- `docs/agent-skills/` 是从旧 Cursor 规则提炼出的通用按需规则。
- 旧 Cursor 规则只作为历史参考资料。
- 如果旧规则与本文档冲突，优先遵守本文档。
- 如果发现本文档缺少重要项目规则，可以从旧规则中提炼后补充到本文档。

## 规则自进化

当遇到规则不合理、相互冲突、缺失或过时的情况时：

1. 立即记录到 `docs/rules-feedback.md`（一行描述 + 建议改动）
2. 累计 **3 条反馈**后，主动建议修订规则
3. 用户确认后，批量更新本文档和相关 agent-skills 文件

规则不是一成不变的——项目演进时规则也要跟着调整。
