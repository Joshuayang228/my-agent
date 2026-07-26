# M17 测试架构方法论

> 这份文档沉淀我们对「如何测试依赖 LLM 的 Agent」的设计思考。
> 前半部分是**认知框架**——测试栈怎么分层、在哪 mock、什么算门禁。
> 后半部分是**实战记录**——现状、弯路、暂缓项与检查清单。
>
> 对照源：Alice Ch.15 **范式二**（事件流可插测试）+ **范式十一**（稳定接口/实现可替换）× feiche/wps-cowork `aisdk-testing-design.md`（HTTP/SSE 边界 replay）× 我们的 `__tests__/` + `evals/` + Playwright
> 沉淀时间：2026-07-26
>
> **与 M18 的分工**：M17 回答「测试栈长什么样」；M18 回答「Eval 里测什么行为、怎么判」。行为证据与 grader 细节只在 M18 展开。

---

# 第一部分：认知框架

## 一、第一性原理：分轨测确定性与概率性，可测性来自稳定边界

Agent 代码里同时住着两类东西：

- **确定性框架**：权限链、错误码、压缩触发条件、队列状态机——同样输入应同样输出。
- **概率性智能**：LLM 选词、工具选择的「感觉」、人格语气——同样输入也可能不同路径。

若把它们塞进同一套「单测 + 偶尔 mock 一下 API」，失败时分不清是代码 bug 还是模型抖了一下；若处处 `vi.mock` 整模块，生产路径和测试路径会悄然分叉（缺一个新 export 就炸）。

第一性原理：

**测试栈必须把「确定性代码路径」和「概率性行为证据」分轨；可测性来自稳定边界上的注入 / replay，而不是到处替换内部实现。**

```
第一性原理：分轨测确定性与概率性；可测性 = 稳定边界注入/replay

├─ 推论组 A：分几层、各层测什么
│     §二 四层金字塔 · §三 Unit vs Eval 边界 · §四 速度与门禁
│
├─ 推论组 B：在哪 mock、怎么 mock
│     §五 DI 优先于 vi.mock · §六 基础设施 mock · §七 HTTP/SSE 边界（学到暂缓）
│
└─ 推论组 C：边界与诚实
      §八 E2E 与人工验收 · §九 禁止项 · §十 与相邻模块
```

> **映射纠正**：旧 skill 表把 M17 指到 Alice「范式五」——那是**最小权限**（属 M10）。测试可迁移性主要来自范式二（事件流边界可插重放）与范式十一（接口稳定、实现可丢弃）。

---

# 推论组 A：分几层、各层测什么

> 第一性原理说「分轨」。落到工程上，就是明确每一层允许消耗什么资源、失败代表什么语义。

## 二、四层金字塔：Unit → Eval → E2E → 人工

| 层 | 命令 | 测什么 | LLM | 失败语义 |
|----|------|--------|-----|----------|
| **Unit** | `npm run test` | 纯函数 / 状态机 / 权限链 / 解析器等代码路径 | **禁止**真实调用 | 代码 bug |
| **Eval** | `npm run eval:run` | Agent **行为过程证据**（工具序、错误码、降级…） | 默认脚本 LLM（DI）；B 类可真 LLM（见 M18） | 行为退化或能力未达标 |
| **E2E** | `npm run test:e2e` | 真窗口 / IPC / 渲染链路是否通 | 可选 `TEST_LLM_API_KEY` | 集成断裂 |
| **人工** | 发版 checklist | 活人感、关系感、无法断言的体验 | 真实 | 产品判断 |

不是「三层」是因为 Eval 已独立成一等公民（有独立 vitest config），不能再塞进「集成测试」这个模糊口袋。人工层必须写出来——伙伴产品有大量不可自动化的体验，否认它会逼人用假精确的 LLM judge 填洞。

**判据**：某一层失败时，你是否能立刻知道该修代码、改场景，还是改产品预期？分不清说明分层糊了。

## 三、Unit vs Eval：路径断言 vs 行为证据

| 问题 | 放哪 |
|------|------|
| `ask` 规则是否在审批库之后匹配？ | **Unit**（`permission-engine`） |
| 用户拒绝破坏性工具后，是否出现 `execution_mode_changed`？ | **Eval**（transcript 过程证据） |
| `sanitizeToolCallPairs` 是否修孤立 tool_call？ | **Unit** |
| 压缩后 preamble 是否仍在发给 LLM 的 messages 里？ | **Eval**（capturing mock） |
| logger 在非 Electron 环境是否降级不崩？ | **Unit** |

粗规则：

- 能**不跑 agentLoop** 就断言 → Unit  
- 必须跑完一轮（或多轮）loop、靠 **transcript / workdir** 断言 → Eval  
- 必须点 UI / 起 Electron → E2E  

**禁止**：在 Unit 里用真实 API；在 Eval 的 A 类场景里依赖模型随机性。

## 四、速度与门禁：频率决定配置隔离

| 层 | 期望 | 门禁角色 |
|----|------|----------|
| Unit 整套 | 通常 **&lt; 数秒～十几秒** | **commit 前必过**（与 `tsc` 并列） |
| Eval 单场景 | **&lt; 30s**（config 已设） | 能力爬坡 / 发版前 / 改 Loop·权限·压缩时跑 |
| E2E | 分钟级、吃环境 | **默认不进**「小改必跑」；有 Key 再跑真对话 |
| 人工 | 不定 | 发版 / 人格大改 |

**为什么 Unit 与 Eval 必须两套 vitest 配置**（已落地）：超时、频率、失败语义、token 成本都不同——混在一个 `npm run test` 里，要么拖垮开发反馈，要么把概率失败当成 CI 红灯。细节见 M18 code 章「隔离机制」。

---

# 推论组 B：在哪 mock、怎么 mock

> 第一性原理说「稳定边界」。mock 越靠近外部世界、越少替换内部模块，测试越像生产路径。

## 五、DI 优先于 `vi.mock`：`_streamChatOverride`

对 Agent 主干，LLM 就是最贵、最不该在单测里真打的边界。我们在 `AgentLoopOptions` 上留了显式注入点：

```text
生产：streamChat = defaultStreamChat
测试/Eval：streamChat = options._streamChatOverride ?? defaultStreamChat
```

`_` 前缀 = 「非生产契约」：业务代码不许靠它走捷径。

**为什么不满足于 `vi.mock('.../llm')`**：

1. Eval runner 要在「vitest 只是宿主」的前提下工作，mock 框架不是依赖。  
2. 整体 mock 模块时，真实模块新增 export（如 `LLMError`）会导致测试运行时才炸——已在 M05 踩过。  
3. DI 让生产路径与测试路径共用同一段 `agentLoop` 分支，只替换叶子。

**约定（对齐后生效）**：

- **新写的** loop / 集成向测试：优先 `_streamChatOverride` + `evals/mock-llm`（或同等工厂）。  
- **存量** `agent-loop.test.ts` 仍用 `vi.mock`：工程债，渐进迁移，不阻塞本轮沉淀。

受 Alice 范式十一启发：稳定的是「stream → 事件」接口；实现（真 Provider / 脚本序列 / 将来 SSE replay）可丢弃替换。

## 六、基础设施 mock：Electron / DB / logger 可以 `vi.mock`

不是所有依赖都值得开 DI 口子。下列属于**宿主环境**，Unit 里用 `vi.mock` 合理：

| 依赖 | 原因 |
|------|------|
| `electron`（`app.getPath` / `BrowserWindow`） | 非 Electron 进程根本没有 |
| `logger` | 降噪；断言逻辑不依赖日志文案 |
| `database` / `vectra` | 重 I/O；测记忆逻辑时常替掉存储 |

**纪律**：mock 要尽量薄（只提供被测路径用到的符号）；给被 mock 模块加 export 时，**同步扫**所有 `vi.mock` 了它的测试文件。

## 七、HTTP/SSE 边界 replay：学到、暂缓

feiche `aisdk-testing-design` 的原则：**mock 在 HTTP 边界，不在内部接口**——录真实 SSE，replay 进真实解析管线，断言 part 序列。

这对我们意味着：将来测 `llm/` 流式解析时，理想形态是「fixture `.sse` + 本地 replay server」，而不是手写一串 `yield { type: 'text' }`。

**本轮暂缓**：Eval 的脚本 LLM 已覆盖 Loop 行为；适配器级 SSE 录放是增量工程债（见实战记录），不阻塞 M17 认知地图。

受 Alice 范式二启发：事件流边界天然支持「录一遍、放一遍」；我们已在 Loop 出口用 transcript 做 Eval，SSE 层是同一思想往下沉一层。

---

# 推论组 C：边界与诚实

> 分轨之后，还要承认：有些层现在测得不够，有些东西根本不该自动化硬测。

## 八、E2E：冒烟诚实，真对话可选

`typescript-guidelines` 曾要求 E2E「必须真实对话流、禁止只测元素存在」。理想正确，但现状是：

- `chat.test.ts` 偏 UI 冒烟（标题、侧边栏、输入框）。  
- 真对话依赖 Key、模型、网络，不适合当默认门禁。

**对齐后的诚实分层**：

1. **冒烟 E2E**（当前）：验证壳子能起来、主控件可点——允许存在，且标明「冒烟」。  
2. **可选真对话 E2E**：有 `TEST_LLM_API_KEY` 才跑；无 Key **skip 不红**。  
3. **禁止**：把冒烟当成「对话质量已测」。

伙伴体验的主战场仍在人工 + M18 B 类，不在 Playwright。

## 九、禁止项（测试栈红线）

1. Unit / 默认 Eval **禁止**打真实 LLM（CLAUDE 质量底线：禁止 Mock 真 AI——此处「Mock」指用假数据冒充已测真模型；脚本 LLM 显式注入除外）。  
2. 禁止用 Eval 替代 Unit 去测纯函数分支（慢、噪、难定位）。  
3. 禁止 grader 偷看 `AgentLoopOptions` / system prompt（M18 Generator-Evaluator；M17 只强调分层时不要破坏这条）。  
4. 禁止把 E2E 或真 LLM Eval 绑进每次 commit 的必跑命令。

## 十、与相邻模块的交点

| 模块 | 交点 |
|------|------|
| M01 Loop / M02 Streaming | 事件流 = Unit 可收集的序列 = Eval transcript |
| M10 权限 | 规则与责任链 → Unit；确认后行为 → Eval |
| M14 可观测 | 非 Electron 降级必须可单测；span 可作 Eval 补充证据 |
| M15 状态机 | 转移表与 reason → Unit；跨工具的模式降级 → Eval |
| M18 Eval | 本分章之上的行为度量层 |

---

# 第二部分：实战记录

## 这次沉淀做了什么

- 对齐四层金字塔、DI 优先、门禁与 E2E 诚实分层。  
- 纠正 Alice 映射（范式二 / 十一，非范式五）。  
- 无强制代码迁移；工程债进 wishlist。

## 现状对照（2026-07-26）

| 项 | 状态 |
|----|------|
| Unit / Eval 双 vitest 配置 | ✅ |
| `_streamChatOverride` + `evals/mock-llm` | ✅ |
| 权限 / 队列 / 压缩 / 路由等 Unit 覆盖 | ✅ 较厚 |
| `agent-loop.test` 仍 `vi.mock(llm)` | ⚠️ 存量债 |
| SSE fixture replay | ❌ 未做 |
| E2E 真对话 | ❌ 基本无；冒烟有 |
| IPC Unit | ❌（归 M12 / 工程债） |

## 弯路

1. **整体 mock LLM 模块**：省事，但 export 漂移即炸 → 转向 DI。  
2. **把 Eval 想成「高级单测」**：超时和语义都冲突 → 独立 config。  
3. **E2E 规范写太满**：理想对话流写进 skill，现实只有冒烟 → 本分章改成「冒烟 + 可选真对话」，避免规范撒谎。

## 暂缓项 / 后续补齐

- [ ] **G1** 将 `agent-loop.test.ts`（及同类）迁到 `_streamChatOverride`  
- [ ] **G2** LLM 适配层 SSE 录放（参考 aisdk-testing-design）  
- [ ] **G3** 可选真对话 E2E（无 Key skip）+ 规范与 skill 对齐  
- [ ] **G4** IPC 主进程 handler 的可测性（与 M12 协同）  

## 设计检查清单

1. 新测试：失败时能立刻判断该看代码还是看场景吗？  
2. 需要假 LLM：走了 DI 还是又 `vi.mock` 了整模块？  
3. 改了被大量 mock 的模块的 export：扫过相关测试文件吗？  
4. 新场景：该进 Unit、Eval，还是 E2E？  
5. 有没有把真 LLM 或 E2E 塞进 commit 必跑？  
6. Eval grader 是否仍只看 transcript / workdir？  
|
