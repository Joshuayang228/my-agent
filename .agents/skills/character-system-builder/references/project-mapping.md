# My Agent 生产映射

核对基线：2026-10-13。执行时先读现行来源，不能将这张路由表当作永远不变的 schema。路径相对于 My Agent 仓库根；技能参考的内部链接相对于技能目录。

## 写作与资产落点

| 职责 | 当前落点 | 写作约束 |
|---|---|---|
| 稳定身份 / 价值观 | `roles/<roleId>/protected.md` | 人物不会因用户指令随意换身份；不能覆盖平台安全与权限 |
| 简介与角色资格 | `manifest.json`、`summary.txt` | 简介是名册浅注入；不放完整隐私故事或冒充主角资格 |
| 人物故事 / 外观 / 偏好 / 表达参数 | 可选 `profile.json` | 类型以 `companion/types.ts` 为准；未知事实不填成既定经历 |
| 初始习惯与成长 | `mutable.default.md` | 只定义出厂成长基线；不直接覆盖已有运行时成长记录 |
| 对话与日常表达 | 可选 `voice.md`、manifest 的 `asideStyle` | 语气基线与本轮策略分离；不强制每句话旁白或同一比喻 |
| 默认世界 | 可选 `world.default.json` | 出厂背景 / 初始状态，不重置已运行的当前地点与资产 |
| 人物行为差异 | 可选 `behaviors/moment-polish.md`、`day-script.md`、`catchup.md`、`reflection.md` | 可改变人物选择和表达；不能改平台任务、JSON、校验、回退或副作用 |
| 团队与名册关系 | 宇宙 `relations.json`、角色 summary；主角入口由宇宙 manifest 管理 | 关系边有方向，不自动补对称；同时仍只有一个活跃主角 |
| 召唤场景 | 注册体系认识 `scenes/display.md`、`interact.md`、`execute.md` | 使用前检查 `companion/cast/scene-prompts.ts` 与真实召唤调用；识别文件不等于当前主对话会注入它 |
| 当前生活 / 用户事实 / 关系 | 实际组装器提供的动态情境、记忆与成长状态 | 不固化进 protected 或默认世界，不人为回写生产历史 |
| 媒体与生活面 | 现有 Companion 资产 / 事件 / 生图链 | 先追踪实际入口与存储形状，不自行新增 loader 不认识的视觉文件 |

角色路径根：`electron/main/companion/universes/default/roles/`。完整体系可以包含某些明确未设定的维度；没有用户材料时，记录缺口，不复制别人的档案填满。

## 按任务读取生产来源

- 身份与文件形状：`electron/main/companion/types.ts`、`identity/loader.ts`、`identity/profile.ts`；`roles/hang/` 只供结构核对，不当作默认人物内容。
- 语义职责：`electron/main/prompts/compiler.ts` 的平台规则、人物定义、成长、行为、情境、输出契约六类模块。L1–L4 是旧模型，不再按编号写人物 Prompt。
- 全入口与 key：`electron/main/prompts/keys.ts`、`registry.ts` 中的 `definitions` 字段、`registered-request.ts`、`electron/main/companion/identity/source-assets.ts`。核心 key 用常量，人物来源用工厂；不手填 key 与原始 messages 绕过签发。
- 后台行为：`electron/main/prompts/companion-behaviors.ts` 与对应 life / growth 服务；检查 loader 的实际行为白名单。没有人物增量的行为仍使用通用模板，不被误记为漏写。
- 召唤与关系：`electron/main/companion/cast/scene-prompts.ts`、`electron/main/companion/cast/`、`electron/main/companion/orchestrator.ts` 的角色组装入口，按调用链定位。
- 质量：`docs/quality.md`、`evals/scenario-registry.ts`、`evals/scenarios/b02-protagonist-behavior.ts`。不以一个泛化 Judge 分数替代用户对人格的体验判断。

## 修改角色与扩展框架分开

新增角色：根据 loader 写已授权的角色资产，按用户决定修改主角资格 / 宇宙入口 / 关系；运行 `companion-identity`、`companion-role-profile`、`prompt-compiler` 和 `prompt-registration-coverage` 对应 Unit，再跑资产门禁。不直接改运行数据库来激活角色。

新增行为：先确认用户目标，读取相关 DEC / 施工合同，再补 typed key、生产正文构造器、definitions 注册、实际调用配方、输入事实、解析 / 回退 / 副作用和行为 Eval。仅添加 `behaviors/new-name.md` 不会产生新行为；当前 loader 不认识的文件不得作为已交付 Prompt 入口。

共创文件是设计记录，不是生产 Prompt 第二事实源。批准投产后，运行正文仅在 Role Pack / 生产构造器维护；工作记录只保留依据、版本、差异和引用。

提交遵守仓库规则：自审、`npx tsc --noEmit`、`npm run test`、必要 build、`npm run assets:check` 和 staged `npm run docs:validate`，只提交本轮授权的文件。人物行为改变同轮更新伙伴模块；未支持能力写入 wishlist。
