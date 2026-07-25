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
├── m01-agent-loop.md              ← 理念章（产品思考）
├── m01-agent-loop-code.md         ← 代码走读章
├── streaming-design.md            ← 占位章（待写，尚未重命名）
├── error-system.md                ← 占位章
```

编号对应 `methodology/README.md` 的完整章节目录（M01–M27）。现有已写章节文件名为 `mNN-主题.md`，新增占位章节暂用描述性名称，内容就绪后批量重命名为 `mNN-主题.md`。

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
| M16 并发数据 | ch15（并发相关范式）| — | concurrency-queue-design.md |
| M17 测试架构 | ch15（范式五）| eval/ | aisdk-testing-design.md |
| M18 Eval | — | Harness Guide | observability/ |
| M19 多Agent | ch06-multi-agent | coordinator/ | a2a/ |
| M20 自进化 | ch09+ch10 | — | — |
| M21 人格引擎 | ch16-alive-agent + ch14-prompts | context.ts | — |
| M22–M27 伙伴类 | ch16+ch18+ch19+ch20（Alice 特有章节）| — | — |

Alice 方法论路径：`_reference/framework-harness/repos/alice-methodology/chapters/`
CC sourcemap 路径：`_reference/framework-harness/repos/claude-code-sourcemap-main/.../restored-src/src/`
feiche 源码路径：`_reference/feiche/feiche/`（feiche-agents / feiche-server / feiche-env / feiche-sandbox）
feiche spec 路径：`_reference/framework-harness/repos/wps-cowork/vibe/spec/`（设计文档，如 concurrency-queue-design.md）
