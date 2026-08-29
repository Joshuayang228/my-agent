# 模型 Provider 能力资产注册 v1 施工合同

> 状态：已落地（2026-08-29）
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 统一称呼：施工合同

## 1. 需求背景（Why）

Agent 生产资产目录已经覆盖 Prompt、伙伴与人格、记忆策略、权限与沙箱、Tool schema、Skill、Eval Case / Grader，但开发者仍无法从同一入口回答：

- 当前产品真正支持哪些 Provider 协议？
- Provider 是如何自动检测的？
- 哪条适配器支持 Tool、Response Format、Thinking、Prompt Cache 或 Vision？
- 辅助模型为什么会关闭 Thinking？
- Context Window 使用的是厂商真实值、代码启发式还是保守回退？
- Failover 发生时哪些字段会继承，哪些会被替换？
- Settings 中的模型预设来自哪里，Chat 快切和设置页是否一致？

历史上模型预设分别写在 `src/components/SettingsPanel.tsx` 和 `src/App.tsx`，曾形成两个事实源；当前 Settings 与 Chat 快切只消费共享注册表；截至 2026-08-29，注册表包含 24 个 Provider 入口，Chat 快切展示其中 2 个入口；模型 ID 不再由入口预设提供。如果继续在 Debug 再维护第三份展示清单，预设和能力会继续漂移。

本合同只登记 My Agent **当前代码真实实现**的 Provider 能力，不抓取或硬编码厂商官网的最新产品规格。外部模型上下文、价格、可用区域和型号更新频繁，只有进入生产适配器、预设或能力探测后，才能成为本项目的生产资产。

## 2. 功能目标（What）

1. 建立 Provider 入口唯一注册表，统一 Settings Provider 卡片和 Chat 快切，不再在 JSX 中复制 Base URL；模型 ID 与 Provider 入口解耦。
2. 登记 OpenAI Compatible、Anthropic Messages、Gemini GenerateContent 三条真实协议适配能力，展示路由方式、请求端点、认证方式摘要、Streaming、Tool、System Prompt、Response Format、Thinking、Prompt Cache 和当前 Vision 处理边界。
3. 登记 Provider 自动检测、辅助 Thinking 策略、Context Window 启发式、Vision 动态降级和顺序 Failover 等跨 Provider 运行策略。
4. 将每个内置 Provider 入口登记为 `provider-preset` 资产，显示稳定 key、Provider 身份、分组、标签、公开 Base URL、协议路由结果和是否进入 Chat 快切；不包含模型白名单或 API Key。
5. Debug「提示词管理器」保留“模型 Provider”分类，Provider 能力、策略和入口保持只读，不能载入为 Prompt 实验副本。
6. 用户当前模型（主模型 / 辅助模型）、API Key、自定义 Base URL、Fallback 配置和 `llmCapabilityCache` 属于用户 / 运行时配置；静态目录只展示内置默认与生产规则，当前生效值继续由 Debug「系统 / 请求与运行」查看。
7. 资产目录明确区分：
   - **adapter capability**：当前代码适配器确实能构造 / 解析的能力；
   - **preset**：产品提供的便捷 Provider 入口默认值；
   - **runtime probe**：Playground 或连接测试对具体 Base URL + Model 的探测结果；
   - **vendor claim**：外部厂商宣称但尚未进入代码的能力，不注册。

## 3. 技术方案（How）

### 3.1 Provider 入口唯一注册表

新增类似：

```text
src/shared/provider-presets.ts
```

注册项包含：

```ts
{
  providerId: string
  key: string
  group: string
  label: string
  baseUrl: string
  quickAccess: boolean
}
```

`model` 不属于注册表。Settings 的主模型 / 辅助模型是用户针对当前 Provider 的独立配置；连接测试仍要求用户填写模型 ID。

按 Alice 本地 Provider 清单收敛为五组共 24 个入口：

```text
海外直连：OpenAI、Anthropic、Google Gemini、xAI
国内服务商：DeepSeek、Kimi、阿里云百炼、MiniMax、智谱、硅基流动、小米 MiMo、火山引擎
编程套餐：Kimi / 阿里云 / MiniMax / 智谱 / 火山 / 小米 Coding Plan
聚合与代理：OpenRouter、PipeLLM、米羊、观猹
本地 / 自定义：Ollama、LM Studio
```

ListenHub（TTS）与 CLIProxy 订阅代理不作为普通聊天预设；它们属于不同的能力或本地运行前置条件，避免在模型选择里伪装成普通 Provider。

`SettingsPanel.tsx` 按 group 展示全部 Provider 入口；`App.tsx` 只读取 `quickAccess: true` 的 Provider 子集，用于切换 Base URL，不修改当前模型。新增 / 修改入口时只改注册表。公开地址只用于填充配置，API Key 仍由用户填写并由安全存储管理。

Provider 入口资产 key 使用稳定语义 key，例如：

```text
provider-preset:openai
provider-preset:anthropic
provider-preset:deepseek
provider-preset:local:ollama
```


### 3.1.1 Alice 对照与纳入边界（2026-08-29）

本轮先读取仓库内 Alice 构建产物 `_reference/framework-harness/repos/alice-source/main-chunks/providers-C3aFiGCn.js` 的 `BUILTIN_PROVIDERS`，确认入口、协议和默认模型，再映射到 My Agent。不会把 Alice 的 Provider 定义复制到运行时代码，也不会把厂商实时规格当作本项目能力保证。

- 纳入普通聊天选择：官方直连、国内服务商、聚合服务和本地 OpenAI Compatible 入口。
- 单列编程套餐：Coding Plan 的计费 / 模型开放范围与普通聊天入口不同，保留独立分组。
- 不纳入普通聊天预设：ListenHub（TTS）和 CLIProxy（本地代理账号）；前者不是聊天模型，后者需要单独的本地运行条件。
- 适配边界：除 Anthropic / Gemini 官方协议外，其他 Alice 入口先按 OpenAI Compatible 发送；MiniMax Token Plan 通过端点路径识别 Anthropic。未知自定义地址继续保守回退 OpenAI Compatible。
- 地址归一化：Anthropic / Gemini builder 会消除重复的 `/v1` 或 `/v1beta`，兼容旧配置和共享入口。

### 3.2 Provider 路由与协议能力

从 `electron/main/llm/provider-router.ts` 导出并复用 Provider 检测规则，运行时 `detectProvider` 和资产目录读取同一事实。

协议能力资产：

```text
provider-capability:openai
provider-capability:anthropic
provider-capability:gemini
```

能力内容必须来自真实请求构造器与流式适配器，而不是手写厂商宣传：

- **OpenAI Compatible**：`/chat/completions`、Bearer 认证、SSE、Tool schema、`response_format`、可选 `thinking`、OpenAI `image_url` 消息与 Vision 失败降级。
- **Anthropic**：`/v1/messages`、`x-api-key`、SSE、system 分离、Tool 映射、可选 `cache_control` Prompt Cache；只登记当前转换器真实支持的内容形态。
- **Gemini**：`:streamGenerateContent?alt=sse`、query API key、systemInstruction、generationConfig、functionDeclarations；只登记当前转换器真实支持的内容形态。

为避免 OpenAI 能力只能从私有闭包猜测，应将 OpenAI 请求 body 构造提取为生产纯函数，并让真实流式调用继续复用；资产目录可以用脱敏的合成配置调用三家纯构造器，判断字段和结构。

认证信息只登记方式摘要：

```text
Bearer header
x-api-key header
query parameter
```

禁止序列化真实 header 值或 API Key。

### 3.3 跨 Provider 策略资产

建议登记：

```text
provider-policy:auto-detection
provider-policy:aux-thinking
provider-policy:context-window
provider-policy:vision-fallback
provider-policy:sequential-failover
```

事实源：

- `provider-router.ts`：显式 Provider 优先、Base URL 正则检测、未知端点回退 OpenAI Compatible
- `thinking.ts`：能力缓存优先级、DeepSeek / Moonshot 启发式、辅助调用挂 `thinking.disabled`
- `agent/model-context-window.ts`：Claude 200K、Gemini 1M 的保守家族规则、8K 输出预留、未知模型 120K 回退
- `vision.ts`：Vision deny cache、图片失败后去图重试
- `failover.ts`：Fallback Model 顺序尝试和字段继承
- `aux-config.ts`：主模型 / 辅助模型唯一装配入口

如果稳定事实仍是局部常量，应导出常量或纯函数并让生产逻辑继续使用；禁止在 Provider registry 再写一套正则、窗口值或启发式。

### 3.4 生产资产类型

新增分类：

```text
PromptAssetKind: provider
```

新增类型：

```text
provider-capability
provider-policy
provider-preset
```

资产统一具备：

- stable key
- source
- version
- fingerprint
- ownership
- status
- dependencies / derivedFrom
- 脱敏结构化 content

预设依赖对应的协议能力；跨 Provider 策略可依赖多个能力或生产配置工厂。

### 3.5 Debug / Playground / Settings 边界

- **Debug「提示词管理器 → 模型 Provider」**：只读查看内置适配器能力、路由策略和预设资产。
- **Debug「系统 / 请求与运行」**：查看当前实际 Provider、Model、脱敏 Base URL、调用结果、Failover 记录和 Thinking 参数。
- **Playground「模型能力」**：对用户填写的具体端点做连接与 `thinking.disabled` 探测；探测结果属于运行时能力缓存，不改内置 Provider 能力资产。
- **Settings「模型」**：编辑用户当前 Base URL、Model、API Key 和辅助模型；内置预设只是填表模板，不等于厂商能力保证。

不进入静态资产目录：

- API Key、Authorization header、x-api-key 值或 Gemini query key
- 用户自定义 Base URL / Model / Fallback Model
- `llmCapabilityCache` 的具体用户探测结果、时间和备注
- LLM 请求 / 回复正文和 Token 消耗
- 厂商价格、实时模型列表、限流额度和区域可用性

## 4. 影响范围评估

- 共享资产：新增 Provider Preset Registry，Settings / Chat 快切共同消费。
- Provider Router：导出检测规则；必要时增加协议能力事实和纯请求构造器。
- OpenAI 适配器：从 `llm/index.ts` 提取请求 body 纯函数，保持真实请求语义不变。
- Thinking / Context / Vision / Failover：导出稳定常量或纯函数，注册表只读消费。
- 共享类型：增加 provider 分类及 capability / policy / preset 资产类型。
- Debug UI：增加“模型 Provider”分类与类型标签，结构化 Provider 资产禁止载入 Prompt 实验。
- 测试：预设唯一性、Settings / Chat 共用、路由检测、协议 body 事实、无凭据、用户缓存隔离、Context / Thinking / Failover 来源一致性、统一目录和 UI 分类。
- 文档：模型配置规则、架构、质量、注册管理方法论、progress、changelog、wishlist 和本合同状态。
- 不改：用户现有设置 schema、safeStorage、真实 Provider 选择优先级、请求重试次数、Failover 顺序、模型参数和 Playground 探测语义。

## 5. 实施步骤

1. 建立 Provider Preset 唯一注册表，迁移 Settings 和 Chat 快切，补两处消费一致性测试。
2. 导出 Provider 检测规则，提取 OpenAI 请求 body 纯函数，与 Anthropic / Gemini 构造器形成可验证的三协议事实源。
3. 导出 Thinking、Context Window、Vision 降级和 Failover 的稳定事实；不得改变现有运行行为。
4. 建立 Provider 能力 / 策略 / 预设资产注册表，生成稳定 key、版本、指纹、依赖和脱敏 content。
5. 扩展统一 Debug 目录与 UI 分类，禁止结构化 Provider 资产载入 Prompt 实验副本。
6. 补 Unit 和 UI E2E，运行现有 Provider Router、Thinking、Context、Failover 测试，确认适配行为不回归。
7. 更新合同、模块 / 质量 / 架构 / 方法论账本，执行完整门禁后提交并推送。

每一步必须独立验证。如果实施中发现某条“能力”只存在于注释或厂商文档、生产代码并未支持，应登记为缺口或 wishlist，不能为了让目录好看而宣称已支持。

## 6. 风险与权衡

- **外部规格过时风险**：模型窗口、价格和能力变化频繁，本目录只登记代码真相和保守启发式，不承担厂商实时目录职责。
- **凭据泄漏风险**：协议构造器会生成认证 header / query；注册表必须只保存认证方式，测试必须扫描并拒绝任何真实 / 合成 Key 值进入资产内容。
- **能力夸大风险**：协议适配器能构造 Tool 或 Image 字段，不代表所有模型都支持；资产文案必须写“适配器支持 / 具体模型需探测”，不能写成型号保证。
- **预设漂移风险**：Settings 与 Chat 必须消费同一注册表；禁止再在 JSX 里新增独立预设数组。
- **用户数据混淆风险**：内置预设、当前用户配置和能力探测缓存是三种生命周期，Debug 必须明确区分。
- **打包耦合风险**：共享预设不得 import Electron；Provider asset registry 放主进程并只依赖纯事实，避免 Renderer 引入 Node 模块。
- **范围膨胀风险**：本合同不包含在线模型列表同步、价格管理、Provider 插件市场、自动选择最优模型、动态 benchmark 或模型路由优化。
