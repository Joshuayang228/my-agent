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

## 技术方案（How）

- 以“模型实际可见”为边界，不只改 UI 标签。
- 静态 Prompt 直接修改生产常量；动态 Prompt 修改实际 builder，不在 Debug/Playground 复制第二份。
- 内置工具 schema 在各 `tools/builtins/*.ts` 原位中文化，保留 tool/argument 标识。
- Eval Judge 保留机器解析 token，仅将判断问题和格式说明中文化。
- 增加 Prompt 中文审计测试，扫描已登记的自有 Prompt 源和内置工具 schema；允许代码片段、标识符和显式协议 token。
- 增加结构审计：检查稳定 Prompt、动态区块、工具环境和协议契约是否仍从各自生产来源组装，避免 Playground 或辅助调用复制第二套规则。
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
5. 更新文档并完成全量门禁；真实 Persona `pass^3` 重新验收。

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
