# 提示词中文统一

> 状态：**进行中**（2026-08-12）
> 对象：My Agent 自有、会进入模型上下文的自然语言提示词
> 关联模块：[Agent 运行时](../modules/agent-runtime.md)、[伙伴世界](../modules/companion.md)、[质量总控](../quality.md)

## 需求背景（Why）

当前产品面向简体中文用户，但历史实现混用了中英文 Prompt。本轮只收敛中文自然语言 Prompt；英文版本、多语言 Prompt 资产和按语言选择的运行时属于后续工作，登记在 `docs/wishlist.md`。历史英文分散在默认 System、上下文压缩、用户画像、生活世界生成、子 Agent、内置工具 schema 与 Eval Judge 中，导致：

1. Debug「提示词管理器」难以直接人工审阅；
2. 模型在中文对话中可能受英文措辞影响而漂移语气；
3. 同一行为约束存在中英文两套表达，维护和 Eval 校准成本高；
4. 新增 Prompt 时没有自动门禁，容易再次混入英文自然语言。

## 功能目标（What）

1. My Agent 自有、实际发送给模型的自然语言提示词统一为简体中文。
2. 覆盖：
   - 主对话 System / Prompt 四层组装；
   - 上下文压缩、续写恢复、画像、标题、反思、生活世界等辅助调用；
   - 内置工具 description、参数说明、input examples 中的自然语言；
   - 子 Agent / Skill 上下文；
   - Eval 场景与 Model Judge 问题。
3. 保留不可翻译的协议与代码契约：tool 名、JSON key、文件路径、代码、Provider/API 字段、`VIOLATION_FOUND / NOT_FOUND / UNKNOWN`、`[PROTECTED] / [MUTABLE]` 等结构 token。
4. 自定义用户 Prompt、用户安装的 Skill、第三方 MCP 工具描述保持原文，不篡改外部资产。
5. 新增单元门禁，阻止自有 Prompt 源重新出现完整英文自然语言指令。
6. 当前生产范围只包含简体中文自然语言 Prompt；本轮不做韩文或其他语言版本。

## 语言与结构原则

“中文统一”不是把中文和英文逐句并排，也不是把所有英文字符从模型上下文中删除，而是：

- 当前生产 Prompt 先、且只用简体中文写清楚意图、行为、优先级、边界与例外。
- 英文只保留必要的技术术语、工具名、JSON key、代码标识、协议 token、外部原文或 canonical name；不得出现完整英文自然语言规则。
- 同一条行为规则只保留一份中文自然语言表达，禁止中文规则后再复制一份英文规则。
- 英文 Prompt 版本暂不进入生产，也不在本轮维护中英对照 Prompt；未来翻译成英文后，必须作为独立版本审校并另行验收。
- 本轮不做韩文或其他语言 Prompt。
- Prompt 结构按稳定身份、动态上下文、行为策略、工具环境和协议契约分层；每层有单一来源和明确生命周期。
- 动态生活 / 世界 / 关系 / 用户偏好内容使用独立区块注入，不直接改写稳定人格模板。
- 可变人格、热更新覆盖和会话实验副本与身份核心分离；Playground 实验不自动回写生产 Prompt。

参考 Alice 的实现思路：稳定主人设模板保留动态插槽，角色与用途通过 Prompt 映射组织，`<alice_life_context>`、`<alice_world_facts>` 等动态上下文独立注入；我们当前只采用其分层和单语言选择思路，不复制其多语言资产范围、产品语义或具体文案。

## Prompt 资产结构基线

Alice 最值得借鉴的不是同时维护多种语言，而是把 Prompt 当作可追踪、可组合的结构化资产。本合同将以下规则定为 Prompt 管线的长期基线；本轮生产语言固定为 `zh-CN`，不因此提前实现英文或韩文。

### 注册表与稳定标识

- 所有 My Agent 自有、会进入模型上下文的 Prompt，都必须在结构化 Prompt 注册表中登记；注册表是 Debug、测试和运行时索引的单一事实源。
- 每个 Prompt 必须拥有稳定的 `key`。`key` 表示用途和语义身份，不随文案润色、实现文件移动或 UI 展示名称变化；若语义确实变化，应新增 key 并保留旧 key 的迁移记录。
- Prompt 按 `purpose`（用途）和 `role`（角色）分组，例如主对话、压缩、标题、反思、Eval Judge、Companion、System、Sub-agent；禁止按页面位置或临时调用点随意分组。
- Prompt 注册项必须指向真实生产来源，不能只登记一个 Debug/Playground 副本。静态 Prompt 指向生产常量，动态 Prompt 指向实际组装器。

### 资产对象与语言版本

每个 Prompt 资产至少应能表达以下字段：

```ts
interface PromptAsset {
  key: string;
  purpose: string;
  role: string;
  source: string;
  version: string;
  mode: "static" | "dynamic";
  locales: {
    "zh-CN": {
      template: string;
    };
    // 未来可增加独立翻译版本；当前不实现 en-US 或其他语言。
  };
  slots?: string[];
}
```

- `source` 记录 Prompt 的生产常量、Role Pack 资产或动态组装器来源。
- `version` 用于 Debug、快照、Eval 报告和问题回溯；文案或组装逻辑发生影响模型行为的变化时必须递增或生成可追踪版本记录。
- `mode` 区分稳定静态模板与依赖运行时状态的动态 Prompt。
- `locales` 将未来不同语言版本放在同一个稳定资产对象下，但每种语言必须是独立版本；当前只维护 `zh-CN`，不写中英逐句对照，不加入韩文。
- 运行时未来扩展多语言时，必须根据 `locale` 选择并注入一个版本，禁止把多种语言版本同时发送给模型。

### 动态插槽与状态分离

- 稳定人格、身份核心和长期行为边界属于稳定 Prompt；生活状态、世界事实、关系、用户偏好、会话信息和热更新覆盖属于动态上下文，必须分开维护。
- 动态内容通过注册项声明的 `slots` 由实际组装器独立替换；禁止在 JSX、临时字符串拼接或 Playground 中复制模板后进行未登记的任意替换。
- 动态插槽必须有明确名称、来源和生命周期；缺失、越权或类型不匹配时应在组装阶段显式失败或安全降级，不能静默改写稳定人格。
- Debug 和 Eval 应能区分“稳定模板内容”“动态插槽值”和“最终组装结果”，便于判断问题来自人格资产、动态状态还是组装逻辑。

### Debug 可追溯性

Debug「提示词管理器」必须能够从注册表展示模型实际使用的 Prompt 资产信息，至少包括：

- `key`、用途、角色和当前 locale；
- `source`、`version`、`mode`（静态 / 动态）；
- 声明的动态插槽及其来源；
- 脱敏后的稳定模板、动态区块和最终组装结果；
- 本次调用实际选择的 Prompt 资产与版本，必要时关联请求、会话或 Eval Trial。

Debug 展示必须来自主进程注册表和真实组装链路，不得为了展示效果维护第二套 Prompt 文案；敏感信息、用户隐私和凭据必须按现有脱敏规则处理。

## 技术方案（How）

- 以“模型实际可见”为边界，不只改 UI 标签。
- 静态 Prompt 直接修改生产常量；动态 Prompt 修改实际 builder，不在 Debug/Playground 复制第二份。
- 内置工具 schema 在各 `tools/builtins/*.ts` 原位中文化，保留 tool/argument 标识。
- Eval Judge 保留机器解析 token，仅将判断问题和格式说明中文化。
- 增加 Prompt 中文审计测试，扫描已登记的自有 Prompt 源和内置工具 schema；允许代码片段、标识符和显式协议 token。
- 建立并维护结构化 Prompt 注册表：登记稳定 `key`、用途、角色、来源、版本、静态 / 动态模式、当前 locale 和动态插槽。
- 增加结构审计：检查稳定 Prompt、动态区块、工具环境和协议契约是否仍从各自生产来源组装，避免 Playground 或辅助调用复制第二套规则。
- 增加注册表一致性测试：每个模型可见自有 Prompt 必须有稳定 key，注册来源必须可追溯到真实生产常量或组装器，动态插槽必须已声明。
- 增加 Debug 可追溯性验收：能够查看本次调用实际使用的 Prompt key、用途、角色、来源、版本、locale、动态插槽和最终组装结果。
- 当前只测试中文生产 Prompt；未来英文版本完成后，再新增语言版本等价性测试和按 locale 选择测试。

## 影响范围

- **生产行为**：不改工具名、参数名、权限语义和数据结构，只改变模型看到的自然语言说明。
- **兼容性**：已保存的自定义 Prompt / Skill / MCP 不迁移。
- **测试**：更新依赖英文文案的断言；运行 Unit、Mock Eval、真实 Persona Eval、TypeScript、Build。
- **文档**：更新 agent-runtime / companion 模块卡、质量门禁、changelog / progress。

## 实施步骤

1. 建立模型可见 Prompt 清单与中文审计门禁。
2. 中文化主 Agent、上下文与辅助调用 Prompt。
3. 中文化内置工具 schema、子 Agent 与 Skill 上下文。
4. 中文化 Eval Judge 和测试场景中的模型可见说明。
5. 建立 Prompt 注册表与 Debug 来源 / 版本追踪，补齐稳定 key、用途 / 角色分组、动态插槽和 `zh-CN` 资产登记。
6. 更新文档并完成全量门禁；真实 Persona `pass^3` 重新验收。

## 风险与权衡

- 中文翻译可能改变模型行为边界，因此必须重新跑真实 Persona Eval，不能只靠 Unit。
- 中英逐句混写会让模型面对重复规则和不清晰优先级，因此当前生产 Prompt 禁止完整英文自然语言；未来英文版本必须独立翻译、审校和验收。
- 过度翻译协议 token 会破坏解析；本合同明确保留固定 token 与代码标识。
- 第三方或用户资产可能继续包含英文，这是外部输入，不属于自有 Prompt 中文化门禁。


## 验收结果

- 主 Agent、上下文压缩、画像提取、Playground、子 Agent 与 Companion 动态提示已统一为简体中文。
- 内置工具的 description、参数说明、输入示例和框架自有回传提示已统一为简体中文。
- Eval Judge 问题与 Eval 自有工具说明已统一为简体中文；解析 token 保留不变。
- 新增 `prompt-language.test.ts`，直接检查生产组装结果、内置工具 schema 与 Eval 自有判断问题。
- Model Judge 解析兼容 `[1]`、`1`、`1.`、`1、` 编号格式，避免语言切换导致格式波动误判。
- 用户自定义 Prompt、用户安装 Skill、第三方 MCP 内容和网页/命令原始输出不做翻译。
- 每个模型可见的自有 Prompt 都能通过稳定 `key` 在注册表中找到，并可追溯到真实来源、版本和当前 `zh-CN` 资产。
- Debug 能显示本次调用实际使用的 Prompt key、用途、角色、来源、版本、locale、动态插槽和最终组装结果；动态值按现有隐私与脱敏规则展示。
  - 2026-08-14 已落地调用级来源追踪：主对话、L3/L4 压缩、画像、标题、连接测试、Playground、伙伴后台任务和初次子 Agent 调用均声明稳定 key；LLM Debug 详情展示注册表解析结果，历史实发正文仍以 System / Messages 为准。
- 稳定人格模板与动态状态可以分别审阅和测试；动态插槽只能由已声明的实际组装器替换。
- 未来增加英文时，在同一个 Prompt 资产 key 下维护独立语言版本，由运行时按 locale 单选注入，不并发注入多种语言。
