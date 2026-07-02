# CLAUDE.md — My Agent 项目权威规则

> 本文件是本项目面向所有开发 Agent（Claude Code 主力，偶尔 Cursor / Codex）的**唯一权威规则源**。
> Claude Code 会自动加载本文件。其他工具（Cursor / Codex）的入口文件已配置为「必须先读本文件」。
> 高频、强约束、必须默认执行的规则写在正文常驻；低频、场景化的详细规则放 `docs/agent-skills/`，按索引表引导按需读取。

## 项目定位

My Agent 是一个人格化桌面 AI Agent：有性格、有记忆、能成长，目标是成为用户的数字伙伴，而不只是命令式工具。

产品方向优先保护：

- **人格化交互和长期记忆是核心差异化**——关系型 AI、活人感、人设系统、情感记忆，这是我们的核心竞争力。
- **基础设施层对齐 Claude Code**——Agent Loop、上下文压缩、工具系统、System Prompt 结构等框架能力，参考 CC 的生产验证方案，不重复发明。参考源码：`_reference/framework-harness/repos/claude-code-sourcemap-main/`。
- **工具 ≠ 内部服务**——工具是 AI 可见、可调用、会进入对话历史的能力；内部服务是框架私有能力（调度器、日志、自动备份），不暴露为工具。

## 启动上下文

开始较大的代码任务前，先读：

1. `docs/architecture.md` — 当前系统架构
2. `docs/progress.md` — 当前项目状态
3. 与任务直接相关的 `docs/*.md`

小任务（typo、注释、单文件少量改动）只读相关文件即可。若从上一轮 summary 恢复且信息完整，可跳过；但 summary 可能过时（如跨天恢复）时仍应读文件确认。

## 规则冲突优先级

规则冲突时按此裁决：

1. **安全红线** — 密钥泄露、权限绕过、数据破坏
2. **用户显式指令** — 用户明确说"这样做"
3. **开发流程规范** — 本文档和 agent-skills 的流程约束
4. **代码风格标准** — 命名、格式、注释
5. **建议性规则** — 性能优化、可读性建议

示例：用户明确要求"暂时硬编码 token 测试"时，不以安全红线拒绝（用户知情授权）；但"push 时保留硬编码 token"应拒绝并给替代方案。

---

## 硬约束（常驻，必须默认执行）

以下规则「漏了就出事」，不下沉 skill，每次都生效。

### 安全红线

- 禁止硬编码 API Key、密码、token 或任何凭据；一律走环境变量或 Electron `safeStorage`。
- `.env` 必须在 `.gitignore` 中。
- 对外错误信息只暴露用户友好内容，不暴露堆栈、内部路径、SQL 语句。
- 文件路径操作做防穿越检查；SQL 用参数化，禁止拼接用户输入。

> 沙箱分级、权限规则引擎、命令安全分级等详情见 `docs/agent-skills/security-checklist.md`。

### 架构分层依赖方向

主进程 import 方向必须遵守：

```text
ipc/（入口）→ agent/（核心）→ llm/（外部服务）
                    ↓
              storage/、tools/、memory/
```

**禁止反向依赖**：
- `agent/` 禁止 import `ipc/`
- `llm/` 禁止 import `agent/`、`ipc/`
- `storage/` 禁止 import `agent/`、`ipc/`、`llm/`
- `tools/builtins/` 禁止 import `agent/`、`ipc/`

**允许方向**：`ipc/` → `agent/`/`storage/`/`tools/`/`llm/`/`memory/`；`agent/` → `llm/`/`tools/`/`storage/`；`tools/` → `llm/`（仅需要时）；所有模块 → `utils/` 和 `src/shared/types.ts`。

新增模块前先明确它属于哪一层。

### IPC 三处同步

修改 IPC 接口时**必须同步三处**，否则运行时报"方法未定义"：

1. `src/shared/types.ts` — 类型定义
2. `electron/preload/index.ts` — preload 桥接层
3. `electron/main/ipc/*.ts` — 主进程处理器

改完用 `tsc` + 测试验证。

### 质量底线

- 修 bug 先定位根因，禁止猜测式修改。
- 同一方法失败两次必须换路径，禁止第三次盲试。
- 禁止 Mock 真实 AI 调用（测试场景除外）。
- **禁止分期实现或临时方案**——每次给出完整可用实现，不留"TODO 后续补""先用简化版"。功能确实复杂需分步时，在需求文档里明确拆分边界，每步独立可验证。
- 编辑文件前先 Read 最新版本；删代码前说明原因，大段删除先获用户确认；改依赖（package.json 等）声明新增/移除了什么。
- 不确定的假设用 **[待确认]** 标记并告知用户，禁止默默假设后往下走。
- 文件 >500 行时优先读目录/关键章节，不全量读浪费 token。

### Git 提交与推送门控

功能开发完成且测试通过后**必须**立即 commit + push：

- commit 前必须通过单元测试（`npm run test`）和类型检查（`npx tsc --noEmit`）。
- 严禁本地积压大量未提交修改；严禁只 commit 不 push。
- 遇 `Failed to connect to 127.0.0.1` 类代理报错，检查代理端口（Clash 常见 7890 / 7897），更新或 `git config --global --unset http.proxy` 尝试直连，直至推送成功。

> commit 规范、分支命名、PR 流程详见 `docs/agent-skills/git-workflow.md`。

---

## 需求文档规范

**适用场景**：跨 3 个以上文件的新功能、架构变更、复杂功能模块。这类任务**必须先写需求文档，用户确认后再动手**。

必须包含：需求背景（Why）、功能目标（What）、技术方案（How：架构/数据流/关键接口/依赖）、影响范围评估（破坏性/测试/文档）、实施步骤（按逻辑顺序、每步可验证）、风险与权衡。

---

## 开发流程闸（防偷懒，必须默认执行）

以下三道闸是自循环时最容易被跳过的，缺了它 agent 会「没确认就写、没研究就造、没验证就说完成」。

### 闸 1：接需求分三态

- **逃生口**（可跳过确认直接改）：单行 typo / 格式 / 注释修正；单文件 <10 行且用户意图明确；用户明说"直接改""帮我改一下"。
- **新需求**（首次提出）：严格按 **思考 → 提问 → 复述 → 方案 → 等许可** 五步，用户确认后才编码。**"复述确认"和"等许可"两步不可省。**
- **已批准方案的子任务**：简化为"一句话汇报当前要做什么 → 直接执行"，无需重走五步。

### 闸 2：先研究后协作（硬门）

接到需求先查项目参考，再搜外部，不要直接自己实现。搜索优先级：
1. Claude Code 源码 `_reference/framework-harness/repos/claude-code-sourcemap-main/`
2. Alice 方法论 `_reference/framework-harness/`
3. GitHub / npm / 社区方案 → 最后才自研

自己实现前必须说明：**搜了什么、为什么现有方案不适用**。
**豁免**（一句话说明理由即可）：行业标准库常规集成、纯 UI 或 <3 文件小改动、已批准方案指定了实现方式的子任务。

### 闸 3：完成前按序验证

声称"已完成 / 已修复"前**必须按顺序**执行，即使用户一直说"继续"也不能跳过第 1 步：
1. **自审**（对照 `docs/agent-skills/code-review.md` 清单，跳过了 Phase 6 就在此补做）
2. 运行测试并展示通过结果
3. 确认 build 通过
4. 确认无新增 linter 报错

禁止未经验证就说"已完成""已修复"。

---

## 场景规则索引（按需读取 `docs/agent-skills/`）

遇到以下场景，先读对应文件再动手：

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

> 索引指向的是「查阅型」详细规则；正文的「硬约束」始终生效，无需等索引触发。

## 工作方式

- 用户明确要求修改时直接推进；需求含糊或风险较高时先问清楚。
- 新增功能前搜索项目内已有实现，避免重复造轮子（冗余搜索策略见 `docs/agent-skills/typescript-guidelines.md`）。
- 复杂功能优先查项目参考资料：`_reference/framework-harness/`、Alice 方法论、项目 `docs/`，再考虑 GitHub/npm 或自研。
- 所有响应用**简体中文**，技术术语保留英文原文；重要信息可加粗。
- 长对话（>10 轮）关键操作前先复述当前目标；发现自己重复、偷懒或模糊化时主动建议开新会话。

## 前端验收

涉及 UI 的改动尽量用浏览器或截图检查：深色/浅色主题、文本溢出遮挡错位、主要交互是否真实可操作（不只是元素存在）。

## 收尾沉淀

功能完成后按实际影响范围更新文档（不机械全更，也不遗漏）：

- `docs/progress.md` — 当前进度时间线（状态变化必更新）
- `docs/changelog.md` — 用户可见变更（功能/修复必更新）
- `docs/architecture.md` — 架构或模块边界变化时
- `docs/features.md` — 用户可见功能变化时
- `docs/api-contracts.md` — IPC / 类型 / 接口变化时
- `docs/decisions.md` — 技术决策时
- `docs/pitfalls.md` — 踩坑和修复经验
- `docs/rules-feedback.md` — 规则不合理或冲突时

## 规则自进化

遇到规则不合理、冲突、缺失或过时时：

1. 立即记录到 `docs/rules-feedback.md`（一行描述 + 建议改动）
2. 累计 3 条反馈后主动建议修订规则
3. 用户确认后批量更新本文档和相关 agent-skills 文件

## 其他工具入口

- `AGENTS.md`（Codex）、`.cursor/rules/core.mdc`（Cursor）均已改为「必须先读本 CLAUDE.md」的重定向入口，不再各自维护规则。
- `.cursor/` 旧规则已归档至 `_archive/cursor-legacy/`，仅作历史参考，不再是规则来源。
