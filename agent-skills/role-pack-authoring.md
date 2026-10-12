# Role Pack 与行为扩展

适用于新增一个伙伴、扩展现有伙伴的生活行为，或把一个明确能力接入伙伴团队。

## 设计边界

- Role Pack 描述“这个人是谁”：`manifest.json`、`protected.md`、`mutable.default.md`、`voice.md`、可选 `profile.json` 与 `world.default.json`。
- `behaviors/<behavior>.md` 只描述该行为的增量倾向。它不能改写平台规则、PROTECTED、MUTABLE 的持久化边界、工具权限或输出校验。
- Skill 描述“能做什么”，不等于人物身份。Skill 需要由明确的行为入口选择，不能因为角色被加载就静默激活。
- 事实、记忆、世界状态和用户偏好属于运行时输入，不写入稳定人物文件。

## 新人物流程

1. 在 `electron/main/companion/universes/<universe>/roles/<roleId>/` 建立 Role Pack。
2. `manifest.json` 至少提供 `id`、`name`、`description`、`canBeProtagonist`；需要旁白时再声明 `asideStyle`。
3. 用中文编写 `protected.md` 与 `mutable.default.md`。前者只写身份、价值观和不可漂移边界，后者只写可成长的表达默认值，不写当前行程或用户事实。
4. 有稳定人物档案或出厂世界时再添加 `profile.json` / `world.default.json`，并通过 loader 的 schema 校验；不要把原始 JSON 直接注入 Prompt。
5. 如果该人物确实有行为差异，再添加 `behaviors/<behavior>.md`。没有真实调用入口时不要创建占位行为。
6. 让 `loadRolePack` 和 Prompt 资产注册表能够发现文件；行为调用必须通过 `compileCompanionBehaviorPrompt`，并把行为资产 key 传给 LLM 追踪。

## 新行为流程

1. 先定义触发条件、允许的角色输入、运行时事实、输出格式、解析校验、失败回退和副作用。
2. 在 `prompts/compiler.ts` 的行为请求中选择需要的语义模块，不把主对话的完整文本复制过来。
3. 将领域事实留在行为服务，将结构化结果校验留在真实解析器；模型输出不直接写入数据库或世界状态。
4. 在 `prompts/registry.ts` 登记稳定行为 key、真实 source、inputs、validation、fallback 和 side effects；Debug 只能读取这些生产定义。
5. 为“正常输出、违反稳定身份、事实越界、格式错误、模型失败”各补至少一个测试。

## 团队扩展规则

新增成员只需要新的 Role Pack 和明确的关系 / 召唤 / 行为入口；不要复制一份主 Prompt，也不要把团队名册当作其他人物的全文身份。主对话通过 `rosterLines` 注入浅层名册，只有实际进入的角色才获得自己的人物定义和行为上下文。
