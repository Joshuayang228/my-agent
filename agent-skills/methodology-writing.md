# Methodology Writing

## 定位

`methodology/` 文件夹是本项目自己的设计哲学沉淀，记录我们在每个模块和环节上的独立思考。

## 红线

- 禁止从 Alice 方法论或任何外部资料直接搬运内容。
- 禁止复制粘贴其他项目的文档段落。
- 禁止未经用户确认就写入具体观点。
- 每一个观点和设计决策必须经过用户对齐确认后才写入。
- 可以受 Alice 等方法论启发，但必须用自己的语言表达自己的思考。
- 如果参考了外部方法论，必须注明“受 XX 启发”，并说明自己的理解和取舍。

## 触发时机

1. 用户主动要求，例如“写方法论”“沉淀一下”“总结下思考”。
2. 重大功能完成后，可以主动询问用户是否要沉淀方法论，但不自动写。
3. 做完重大架构取舍后，可以提议沉淀。

## 写作流程

1. 提出观点清单：先列出想写的关键观点，通常 3 到 5 条。
2. 用户对齐：用户可以修改、补充、删除任何观点。
3. 撰写草稿：
   - 讲清为什么，即动机和取舍。
   - 不把方法论写成代码实现文档，代码实现放在 `docs/`。
   - 真实记录思考过程，包括走过的弯路。
   - 有个人风格，不写成教科书。
4. 用户审阅：写完后展示给用户确认。
5. **写完一章立即单独 commit**（用户确认通过后）：
   - 至少包含本章 `mNN-*.md` + 配对的 `mNN-*-code.md`（若有）。
   - **一个 commit 只做这一章**，不与并行会话的其他改动混提。
   - 索引文件（`methodology/README.md` / `docs/wishlist.md` / `docs/progress.md`）若混有他章改动：能干净拆出本章状态更新则一并提交；拆不开就本章正文先 commit，索引下轮再同步。
   - commit message 风格对齐仓库：`docs(MNN): …`；用户要求 push 时再推，不默认 push。

---

## 深啃五步（学 → 审 → 设计 → 改 → 沉淀）

啃一个尚未写满的方法论章节时，按五步推进。**「沉淀」才触发上面的写作流程**；前四步产出 Gap 清单与代码改动，不直接开写长文。

| 步骤 | 做什么 | 产出 |
|------|--------|------|
| 1. 学 | 读参考源（Alice 方法论 + Alice/CC/feiche 源码，按章节映射表选） | 理解行业实践 |
| 2. 审 | 对比我们的实现，列 Gap（尽量具体到文件/行） | Gap 清单 |
| 3. 设计 | 写改进方案，用户确认后再动代码 | 方案确认 |
| 4. 改 | 编码 + 测试（`tsc` + `npm run test`）；**允许「无代码改动」**（主干已在、只缺认知地图时） | 代码变更或明确记录「本轮不改代码」 |
| 5. 沉淀 | 走「写作流程」写入 `methodology/`，**用户确认后单独 commit 本章** | 理念章 + code 章 + git commit |

原则：

- 同心圆从内向外：先核心运行时，再上下文/安全，再可观测，最后伙伴差异化（顺序见 `methodology/README.md` 六部分）。
- 编号以 **M01–M32**（`methodology/README.md`）为准；不要再用旧深啃编号（旧 M11=任务生命周期、旧 M12=Eval，已并入新目录）。
- 「学到但暂缓」的项：章内实战记录可点一句 + **必须同步 `docs/wishlist.md`**；不在本 skill 维护 Gap 明细。
- 时间线与完成记录写 `docs/progress.md`，不在本 skill 里维护进度表。
- **每章沉淀收尾必 commit**（见上方写作流程第 5 步）；勿把多章或无关工程改动打进同一个方法论 commit。

### 「学」步骤：核心问题清单（模板）

进入「学」时，对照参考源至少回答下列问题（按章节裁剪，写入 Gap 清单）：

1. **状态 / 生命周期**：有哪些状态？转换条件是什么？谁持有状态？
2. **失败与恢复**：失败后如何继续 / 降级 / 熔断？哪些可重试、哪些不可？
3. **边界与隔离**：权限、进程、子 Agent、压缩递归——边界在哪、如何防泄漏？
4. **成本与可观测**：token / 延迟如何计量？能否按 caller 归因？
5. **与相邻模块的交点**：本模块触发/被谁触发？压缩、记忆、权限、Hook 谁先谁后？

占位章的「待覆盖内容」应优先写成这类问题，而不是功能愿望清单。

### 待补优先序与 Gap 真相源（禁止在本 skill 维护明细表）

**章节队列**以 `methodology/README.md`「待补队列 / 完整目录状态」为准。
**仍开着的工程/产品 Gap**以 `docs/wishlist.md`「待办缺口」为准。
**某章内部暂缓说明**以该章「实战记录 / 占位待做」为准。

本 skill **不维护**「增量补洞明细表」——易与 wishlist 双真相、快速过期。深啃或补洞前：

1. 打开 `methodology/README.md` 看下一章 / 状态
2. 打开 `docs/wishlist.md` 看未勾选项
3. 打开对应 `mNN-*.md` 实战记录看章内暂缓

学到但暂缓的新缺口 → **写入 wishlist**（并可选记一笔到该章实战记录），不要追加进本文件。

### 实现入口（深啃时从这里打开代码）

| 新编号 | 主要路径 |
|--------|---------|
| M01 | `electron/main/agent/loop.ts` |
| M02 | `electron/main/llm/`（流式解析）+ loop 事件 yield |
| M03 | `electron/main/errs/` |
| M04 | `electron/main/tools/` |
| M05 | `electron/main/llm/` |
| M06 | `electron/main/agent/prompt-builder.ts` |
| M07 | `electron/main/agent/context-manager.ts` |
| M08 | `electron/main/memory/` + `electron/main/storage/` |
| M09 | `electron/main/services/task-queue.ts` |
| M10 | `electron/main/sandbox/` |
| M11 | 无独立用户 Hook 模块（产品选择）；横切见 `tools/middleware.ts` + `permission-engine` + `tracer.ts` |
| M12 | `electron/preload/index.ts` + `electron/main/ipc/` |
| M13 | `electron/main/mcp/` |
| M14 | `electron/main/utils/tracer.ts` |
| M16 | `electron/main/storage/database.ts` + `tools/registry.ts` + `services/task-queue.ts` |
| M15 | 横切：`types.ts`（TerminalReason/TaskStatus/ExecutionMode）+ `loop.ts` + `task-queue.ts` + `mcp/client.ts` |
| M17 | `__tests__/unit/` + `evals/` + `vitest*.config.ts` + `__tests__/e2e/` |
| M18 | `evals/` |
| M19 | `electron/main/agent/subagent.ts` |
| M20 | `electron/main/skills/` |
| M21–M22 | `electron/main/companion/`（identity / growth/mutable-store · reflection-*）+ `prompt-builder.ts` |
| M23–M26 | `electron/main/companion/life/` · `cast/` · Moments/Assets UI |
| M27–M31 | Prompt 规范 + UI 截面（欢迎屏 / Settings / Memory / Moments / CastPanel） |

### 产品向 backlog（不占 mNN）

不在本 skill 列明细。灵感 / 查阅型债 / 差异化项一律进 `docs/wishlist.md`；决定要做再开 `docs/requirements/` 或记 `progress.md`。

## 文档结构

方法论文档分为两类：

### 1. 产品思考文档（如 m01-agent-loop.md）

**结构**：前半部分**认知框架** + 后半部分**实战记录**

**认知框架（两条硬要求：结构性 + 完整性）**：

**结构性原则——"第一性原理 → 推论"，不是平铺清单**：
- 认知框架必须先立一条**第一性原理**（这个模块最根本的一句话认知），然后所有章节都作为它的**推论**展开，而不是并列罗列 N 个注意事项。
- 第一章就是第一性原理 + 一张**推论地图**（用文字/树状图列出后续章节如何从根认知派生，通常分 2-4 组）。
- 章节按推论分组，每组开头有一句**组导语**，说明这组在回答第一性原理的哪个侧面。
- 每章开头尽量回扣主干（"第一性原理说…落到实现就是""这是 X 的另一半"），让读者始终知道当前在解决根问题的哪一部分。
- 判断标准：读者读完第一章，就能预测后面大致会讲什么——因为一切都从根认知长出来。
- 反面教材是"平铺点列表"（一、二、三…每节一个独立观点，节间无推导关系）。M4/M5 第一版就是这个毛病，后来重构成"第一性原理 → 三组推论"。
- 正面参考：M1（6行骨架→9问题域→逐个解决）、M2（"工具是契约"→元数据/description/并发都是推论）、M3（"LLM层是纯函数管线"→多Provider/重试分层都是推论）。

**完整性原则——认知地图，不是改动日志**：
- 沉淀该领域学到的**所有核心原则**，不限于本次实现的范围
- "学到但暂时没做"的原则也要写，标注"暂未实现"或在实战记录说明为什么暂缓
- 目标是建立该领域的**完整认知地图**，而不是改动日志
- 通常 8-11 个认知章节，每个章节讲清一个核心原则 + 判据

**实战记录**：
- 我们这次做了什么改动
- 踩了什么坑、为什么踩、怎么爬出来
- 暂缓项说明（哪些 gap 暂时不做、原因是什么）
- 设计检查清单（供后续参考的要点）

**写作要求**：
- 讲清设计动机、权衡、取舍
- 回答"为什么这样设计"而不是"怎么实现"
- 代码实现细节放在 `docs/` 里，方法论只讲设计哲学
- 真实记录思考过程，包括走过的弯路
- 有个人风格，不写成教科书

### 2. 代码走读文档（如 m01-agent-loop-code.md）

**配对原则：每写一个理念章，必须同步写对应的 code 章。** 理念章讲"为什么"，code 章讲"代码怎么体现这个为什么"。

#### 结构模式

每个 code 章节对照理念章的 §N 编号组织，每节展示**三源对照**：

```
## §N 对照：[理念章对应节名]

### CC 的实现
[CC 源码 + 逐行注释]

### Alice 的实现（如有）
[Alice 源码 + 逐行注释]

### 我们的实现
[我们的源码 + 逐行注释]

### 字段/结构对比表（有差异时必须列）

| CC | 我们 | 说明 |
|---|---|---|
| field_a | fieldA | 相同语义，命名不同 |
| field_b | — | 我们暂未实现，原因 |
| — | fieldC | 我们特有，因为... |

**发现**：[从对比中得到的洞察，通常1-3句话]

**方法论对照**：→ `mXX-章节名.md` §N.N（对应节名）
```

当没有 CC/Alice 可对照时（如我们特有的模块），只展示我们的实现 + 设计决策说明。

#### 注释密度要求

代码走读文档中的代码块是**教学材料**，不是生产代码：

- 每一行核心逻辑都要有注释（包括函数签名、类型定义、关键变量）
- **↑箭头注释风格**：多字段的对象/类型定义，用 `// ↑ 说明` 写在字段行末或下方，逐字段解释
- **①②③编号注释风格**：函数签名/控制流/复杂表达式，在代码块内用数字标注，代码块后统一解释
- 避免"显而易见"的注释（如 `i++  // i 加 1`），但**TypeScript 语法特性必须解释**（如 `async function*`、`yield*`、`??`、类型守卫）
- 注释语言：中文为主，代码标识符/专有名词保留英文

#### "发现"段落的写法

每个对比节结尾的**发现**段落，是 code 章节的核心价值所在：

- 说清楚"CC/Alice 这样做，我们那样做，差异的原因是什么"
- 如果我们比 CC 少了某个功能，说明是暂缓还是设计选择
- 如果我们比 CC 多了某个功能，说明是我们的独特需求
- 如果完全一致，说明"这证明了方法论 §N 的设计是正确的"

**反面示例**（不要写）：
> "我们的实现和 CC 类似。"

**正面示例**（这样写）：
> "CC 把 Continue 和 Terminal 分成了两个独立类型，我们用 ContinueReason + TerminalReason 实现了相同的语义分离。差异在于 CC 还有 stop hook 重试场景（StopHookActive），我们暂未实现——因为目前还没有 stop hook 机制。"

## 文件命名

```text
methodology/
├── README.md                      ← 章节目录 + 待补队列（唯一权威）
├── m01-agent-loop.md              ← 理念章
├── m01-agent-loop-code.md         ← 代码走读章
├── m11-hook-extension-architecture.md  ← 占位章也用 mNN- 前缀
└── gap-audit-2026-07.md           ← 独立主题（不占编号）
```

编号与文件名一一对应 `methodology/README.md` 的 M01–M32。占位章创建时即用 `mNN-主题.md`，不再用无编号临时名。

---

## 占位章节写作规范

新建占位章节时，文件应包含：

```markdown
# MXX 章节名

> **所属**：Part N 分组名
> **核心问题**：一句话说明这章要回答什么
> **状态**：📋 待写

---

## 待覆盖内容

- 要点1
- 要点2（通常3-7条，来自讨论时的设计决策）

## 参考源

- Alice chXX：...
- CC sourcemap：...
- 我们自己的实现文件
```

占位章节不需要用户对齐就可以创建（结构性骨架），但**正式写作时仍需走完整流程**（观点清单 → 用户对齐 → 草稿 → 用户审阅）。

---

## 参考源映射表

写各章节时优先查阅对应参考源，避免重复检索：

| 我们的章节 | Alice 方法论 | CC sourcemap | feiche |
|---|---|---|---|
| M01 Agent Loop | ch03-agent-loop | query/ | agent/ |
| M02 Streaming | ch15（范式二：事件流） | streamChat | stream/ |
| M03 错误体系 | ch01（可丢弃组件）| errors/ | retrier.go |
| M04 工具系统 | ch04-tool-system | tools/ | tool_catalog |
| M05 LLM 路由 | ch11-llm-routing | services/api/ | llm/ |
| M06 System Prompt | ch14-prompts | context.ts | prompt/ |
| M07 上下文压缩 | ch05（§context）+ ch15（范式三）| compact/ | compressor |
| M08 记忆系统 | ch05（§memory）+ blog-04 | memory/ | memory/ |
| M09 后台任务 | ch15（范式四）| tasks/ | tasks/ |
| M10 权限与安全 | ch07+ch12 | permissions/ | permission/ |
| M11 Hook 架构 | ch15（范式一：声明式契约）| hooks/ | observer.go |
| M12 IPC 架构 | ch13-electron-client（feiche spec）| — | electron-client-design.md |
| M13 MCP | ch08-mcp | services/mcp/ | mcp-integration-design.md |
| M14 可观测性 | ch13-observability | tracing/ | observability/ |
| M15 状态机 | ch01（状态优先）| session state | — |
| M16 并发数据 | ch15（并发相关范式）| Tool.ts / StreamingToolExecutor | `2026-04-03-sandbox-concurrency-queue-design.md` |
| M17 测试架构 | ch15 **范式二**（事件流可插测试中间件）+ **范式十一**（接口稳定/实现可替换）；**非**范式五（范式五=权限，属 M10） | 无独立 eval 目录；Harness Guide | aisdk-testing-design.md（HTTP 边界 replay） |
| M18 Eval | — | Harness Guide | observability/ |
| M19 多Agent | ch06-multi-agent | coordinator/ | a2a/ |
| M20 自进化 | ch09+ch10 | — | — |
| M21 人格引擎与设定集 | ch16 + ch14 | context.ts | — |
| M22 成长 MUTABLE | ch14/ch16 PersonaReflection | — | — |
| M23 生活世界 | ch16 + ch18 | dayscript / paths | — |
| M24 朋友圈事件层 | ch18 | Moments 相关 | — |
| M25 资产层衣柜 | ch18 | assets / wardrobe | — |
| M26 交际圈卡司 | ch16 子 Agent 人设 | role-prompt-map | — |
| M27 对话两空间 | ch16 aside | — | — |
| M28 冷启动关系 | ch16；Reflection 门控 | PersonaReflectionService | — |
| M29 记忆透明 | ch16 自洽3 | — | — |
| M30 叙事与能力边界 | ch18 + ch19/20 | — | — |
| M31 主动在场 | ch18 | — | — |

> Part VI 施工批次见 `docs/requirements/companion-world-framework.md`（W0–W6），勿按 M 号顺序工程实现。

### 路径速查

| 来源 | 路径 | 看什么 |
|------|------|--------|
| Alice 方法论 | `_reference/framework-harness/repos/alice-methodology/chapters/` | 设计理念（21 章） |
| Alice 源码 | `_reference/framework-harness/repos/alice-source/` | 解包格式化 JS（main-index / main-chunks） |
| Alice 源码（完整解包） | `D:\alice-extracted\out\`（本机） | 完整 main/ + renderer/，repo 内副本不够时用 |
| CC 源码 | `_reference/framework-harness/repos/claude-code-sourcemap-main/.../restored-src/src/` | 生产级 TS |
| learning-claude-code | `_reference/learning-claude-code-master/` | CC 机制导读（如 Ch.06 task-system） |
| feiche 源码 | `_reference/feiche/feiche/` | feiche-agents / server / env / sandbox |
| feiche spec | `_reference/framework-harness/repos/wps-cowork/vibe/spec/` | 设计文档（如 concurrency-queue-design.md），**不是** feiche 本体 |
