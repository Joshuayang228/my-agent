# 提示词全链路覆盖与内容审阅施工合同 v2

状态：进行中（只读盘点完成，生产修复方案待确认）
日期：2026-10-27

## 背景与授权边界

用户要求“把所有的提示词，包括记忆提炼那些都梳理清楚，看看 Alice 梳理了哪些，是怎么做注册的”。本轮执行全链路盘点与参考源码核对，不修改生产 Prompt、模型协议、记忆采集、权限或 UI。提示词管理器上轮已回流，不代表全部输入来源及语义质量已闭环。

以当前工作区为证据，基准提交 a481be60；既有 memory-store、工具权限、运行时等无关未提交修改保持原状，不属于本次变更。数量均为本次快照，不作为运行时永久常量。工具、用户 Skill 与 MCP 数量随加载变化，本轮不启动它们来补数。

## What：完成的定义

1. 每条会进入模型或生成系统的路径，能说明固定规则、包装、人物增量、运行时数据和输出协议分别来自哪里。
2. 固定指令及系统提供的请求预填有真实来源、稳定 key、版本与指纹；运行时用户文字、生成结果、记忆和图片描述不逐条伪装成内置资产。
3. 聊天、后台提炼、生图、Embedding、前端入口和 Eval 明确不同的调用边界，测试对边界外路径不能作全量承诺。
4. 模板占位符、登记的语义输入和实际展开值分别解释；不编造变量含义，不拿当前模板重建未保存历史。
5. “有注册 / 接入调用 / 内容已审阅 / 效果已验证”分别记录；共享规则审阅与人物写作分开。

## 本轮只读盘点结果

### 注册定义快照

实际 getPromptAssets() 返回 63 个 prompt 类型定义：32 个 builtin、28 个 role-pack、2 个 user（自定义 System / Playground 草稿入口定义）、1 个 external（Eval 外部输入）。不是 63 个互不重叠的规则，也不是 63 个模型调用。63 项有 75 条 definitions 引用，去重后 68 个生产符号；Role Pack 文件本身另按 sourcePath 覆盖。

Eval Judge 为单独 eval-judge 类型，不混入 63。伙伴结构、场景、记忆策略、权限、Provider、工具、Skill / MCP 和 Eval Case / Grader 通过统一 model-context-assets 聚合，不因默认只看提示词就消失。

### 共享入口完整对应（本轮快照）

下表表示登记和静态调用来源核对，不代表每条规则已完成语义评审或真实模型效果验收。

| 任务 | 注册 key | 实际路径与边界 |
|---|---|---|
| 主对话 | prompt-compiler、loop-default | compiler → compileMainSystem / compileDefaultSystem → Agent Loop；区分带人物与无人物兜底 |
| 当前时间 / 截断恢复 / 拒绝后行为 | loop-time-context、loop-output-recovery、permission-denial | agent-behaviors → compileAgentRequest；拒绝结果是数据，固定包装有登记 |
| 语气与立场 | reply-stance、tone-control、expertise-level | reply-stance / tone-control / expertise；动态判定不等于人物身份 |
| 关系与成长 | relationship-stage、relationship-milestones、companion-mutable-state | growth / milestones / mutable；当前状态与稳定身份分开 |
| 世界 / 召唤 / 工作区 | companion-context、workspace-context | runtime-context、世界切片、名册与召唤；当前事实不是新的稳定身份 |
| Skill 上下文 | skill-context | 激活 Skill 的固定包装；正文来自实际加载的 Skill，外部来源另登记 |
| 记忆提取 | profile-extraction、profile-extraction-input | profile-extractor → compileProfileRequest → EXTRACTION_PROMPT + buildProfileExtractionInputPrompt → JSON 校验 / 写入 |
| 画像 / 记忆注入 | user-profile-context、memory-recall-context | 读取真实记忆后格式化并注入主对话，不把用户记忆变成内置 Prompt |
| Embedding 输入 | embedding-input | embeddings 的原文 input 是运行时数据，不是对话压缩或新的提炼指令 |
| 对话压缩 | l3-collapse、l4-autocompact、compact-restore-context | context-manager → compileCompactRequest；上下文摘要与长期记忆提取分开 |
| 后台人物公共编译 | companion-compiler | compileCompanionBehaviorPrompt 复用身份 / 成长 / 表达，不复制整个主对话 |
| 朋友圈文案 | companion-moment-polish | 已发布事件 → compileMomentRequest → 润色 / 校验；失败回规则底稿，不凭空制造事件 |
| 日程 | companion-day-script | script-generator → compileDayRequest → 结构化日程 / 校验 / 回退 |
| 暂停生活补叙 | companion-catchup | catchup → compileCatchupRequest；范围和事实仍受生命周期校验 |
| 人格反思 | companion-reflection | reflection-service → compileReflectionRequest；消费角色反馈，更新可变层，不改稳定身份 |
| 子任务 | subagent-system | compileSubagentSystem；角色说明与召唤边界分别归源 |
| 标题 / 模型诊断 | session-title、connection-test、playground-model-test | session-store / settings / model-test 使用固定注册配方 |
| 显式自定义与实验 | settings-system-prompt、playground-default、playground-draft | 用户拥有的内容与隔离实验输入，不把用户私有正文登记成公共内置内容 |
| Eval 输入 | eval-input；另有 eval-judge | 生产签发与 Eval 签发分域；外部测试内容不冒充生产固定规则 |

### Role Pack 文件快照

- `ayu`：6 项：`protected.md`、`mutable.default.md`、`summary.txt`、`scenes/display.md`、`scenes/interact.md`、`scenes/execute.md`。
- `chen`：6 项：`protected.md`、`mutable.default.md`、`summary.txt`、`scenes/display.md`、`scenes/interact.md`、`scenes/execute.md`。
- `hang`：4 项：`protected.md`、`mutable.default.md`、`voice.md`、`summary.txt`。
- `lin`：4 项：`protected.md`、`mutable.default.md`、`voice.md`、`summary.txt`。
- `xia`：4 项：`protected.md`、`mutable.default.md`、`voice.md`、`summary.txt`。
- `zhou`：4 项：`protected.md`、`mutable.default.md`、`voice.md`、`summary.txt`。

人物四种 behaviors 增量是 loader 支持的扩展，不代表现有六人已写全。必须区分“框架支持文件”与“当前文件实际存在并被加载”；不能为凑全套自动填人物经历或写空文件。

### 记忆不是一个单独 Prompt

- 自动提炼：当前画像提取 Prompt 支持 identity / workflow / voice / preference / fact / feedback；输入包含用户与助手近期对话，并携带已知事实防重复。生产校验另限制类别、长度、数量和敏感内容。
- 显式记忆：remember / recall / forget 等工具及其 schema 从真实 ToolRegistry 进入目录；显式工具操作不等于后台自动采集。
- 六个策略 key：profile-extraction、semantic-deduplication、feedback-bucket、vector-recall、vector-lifecycle、citation-correction（均以 memory-strategy: 为前缀）。它们来源于真实代码，不都是 LLM Prompt：当前去重是文本相似度规则，纠错也有确定性计划。
- 召回：向量输入 / 索引 / 阈值属于数据与策略；给主对话的固定包装才是 Prompt。对话压缩服务上下文窗口，不自动等价于长期记忆写入。
- 与 Alice 不同：尚不能把“已有自动画像”说成“已有完整项目记忆子代理、情感提炼、记忆重整与迁移能力”。是否增加这些能力须按我们的旅程与数据边界决定。

### 生图、朋友圈和其他输入

| 路径 | 已有内容 | 真实边界 |
|---|---|---|
| image_generate | 工具描述 / 参数 schema 已聚合；requestGeneratedImage 接收 args.prompt，独立生图协议发送 | 实际图片描述是用户 / Agent 在本轮生成的数据；没有固定模板时不能发明一个生产资产。生图请求并未经过 RegisteredModelRequest 聊天签发 |
| 人物世界配图快捷入口 | App.tsx 中预填“生成图片并用 targetAssetId 绑定”的固定句子 | 系统提供的可编辑请求草稿，发送前仍需用户操作；目前未纳入同样注册 / 来源检查 |
| 聊天生图按钮 | App.tsx 预填“请生成一张图片：” | 请求预填，不是 System Prompt；应跟随共享生产来源登记，不复制到 Playground |
| 朋友圈文本 | 已发布事件的规则底稿 + 可选 LLM 润色 | 不是独立创造生活事实的自由发帖 Agent |
| 朋友圈评论 | moment-interactions.ts 的确定性短句池 / 社交规则 | 当前不是独立评论 LLM，不能假装存在相应 Prompt |
| 朋友圈图片 | moment-images.ts 读取事件明确关联的受控图片 | 不等于自主策划配图、生成、识图回写、发布的完整闭环 |
| 主动问候 | proactive-greeting 对已有 Moment 做短预览；companion:policy:proactive-delivery 已登记投递策略 | 当前是确定性提醒，不存在独立问候 LLM Prompt，不推断用户已读 |
| 看图理解 | 附件随主对话走聊天模型管线 | 图片是运行时多模态输入；不因为没有独立识图 key 就判作漏登记，也不等于具有 Alice 式配图识图回写能力 |
| 定时任务 | scheduler 保存用户 task.prompt，runtime.runHeadless 使用它 | 用户任务文本是用户输入；固定后台包装由现有编译路径负责，不逐条注册用户任务正文 |
| 工具 / Skill / MCP | 实际 schema、激活正文、外部描述经生产聚合器展示 | 来源随加载变化；Agent 编码技能 / 测试夹具不自动成为产品内置 Skill |

## Alice 本地源码核对

证据为本地提取版本，不代表厂商最新状态；未启动 Alice、未运行它的脚本或数据库初始化。对内嵌字面量做 AST 静态读取，未执行参考代码。

### 覆盖了什么

内嵌快照含 17 组、1389 个唯一 key。不是 1389 次模型调用：包含固定短句、结构记录、工具说明、旧版本提取指令等。类型为 constant 1134、template 233、record 15、array 5、record_of_arrays 2；其统计函数另列 total，不能把前三类小计当作全量。

| Alice 来源分组 | 条目数 |
|---|---:|
| prompts-channel | 3 |
| prompts-env | 26 |
| prompts-main | 3 |
| prompts-memory | 51 |
| prompts-novel | 90 |
| prompts-persona | 134 |
| prompts-pocket | 133 |
| prompts-query-misc | 67 |
| prompts-reading | 42 |
| prompts-roles | 24 |
| prompts-schedule | 1 |
| prompts-services | 49 |
| prompts-skills | 21 |
| prompts-thoughts | 22 |
| prompts-tools-agent-hint | 1 |
| prompts-tools | 660 |
| prompts-world | 62 |

记忆 51 项覆盖：组合项目 / 用户记忆提取、事实提取、画像字段提炼、ReAct 记忆 Agent、门卫、语义去重（NEW / MERGE / CONFLICT / SKIP）、已有记忆包装、迁移 / 重整、情感提取 / 门控、主体校准、专用工具描述，以及上下文压缩占位。LEGACY 等 key 的存在不能证明这些路径同时活跃。本轮实际核到 MemoryReactAgent 使用 MEMORY_REACT_SYSTEM_PROMPT_I18N、query 使用 COMBINED_SYSTEM_PROMPT_I18N。

朋友圈 / 图片相关覆盖：buildMomentTextI18n、SPEND_MOMENT_SYSTEM、buildFriendCommentI18n、buildAliceReplyI18n；buildImageSystemPromptI18n + buildImageUserPromptI18n 让文本模型先编写图片描述，另有外貌、风格锚点、天气 / 场景、分场景 fallback、JSON 输出约束、封面、人物 / 动态识图、搬家场景生成等定义。实际 query 生图构造先组装人物 / 场景，调用 callLLMForJSON 取得 prompt / aspectRatio，格式错误进入 fallback；这比我们直接向图片模型传入 args.prompt 多了一层已实现的视觉描述策划。

### 如何登记与消费

1. `main-chunks/prompts-novel-BnB59tzO.js` 的内嵌 c 对象，按来源组 / key 保存 description、params、type、zh/en/ko、entries/items；开发源也支持读取 YAML / YML。
2. `_()` 初始化；内嵌来源或 YAML loader 均写入同一个 Map。未显式 type 时按 params / entries / items 推断 template / record / constant。
3. `yamlPt` / `yamlPtRaw` / record / array accessor 从该 Map 取值，支持 if / unless / each 与变量替换。取值、目录和更新共享这一份数据。
4. `getAllPromptEntries()` 沿 Map.values() 返回来源、说明、声明参数、语言文本和从正文提取的 placeholders；`persona:getAllPrompts` 直接调用它，不维护另一个手写 Debug 目录。
5. role-prompt-map 单独将人物映射到身份、朋友圈、日程、外貌、展示等 key；归属不是历史使用证明。
6. 引擎支持修改 / 保存 YAML 及备份、重载；我们保留 Debug 只读边界，不照搬其编辑入口与多语言。

已见的边界：Map.set 同 key 会覆盖，未见此 loader 对重复 key 报错；取不到 key 记录警告并返回空值；未替换变量可保留 {{name}}。当前引擎条目未提供我们同等的 version / fingerprint / dependencies / ownership 契约；也不能仅根据这个提取快照断言它有完整的 CI 防漏测试。借鉴统一来源和模板发现，不把它当成无需验证的全覆盖保证。

### 可定位证据

- Alice `_reference/framework-harness/repos/alice-source/main-chunks/prompts-novel-BnB59tzO.js`：237 起记忆，3006 附近图片，10260 引擎初始化，10424 目录，10492 重载，10528 附近更新。
- Alice `main-index.js:19711`：persona:getAllPrompts；`main-chunks/role-prompt-map-hWtTzBdL.js:25`：人物映射。
- Alice `main-chunks/MemoryReactAgent-Dr6d0JzY.js:129`、`query-B_tFgAOJ.js:38756`：记忆实际调用；同 query 的 20920 附近：图片描述策划与 fallback。
- 本项目 `electron/main/prompts/registry.ts`、`registered-request.ts`、`electron/main/debug/model-context-assets.ts`：注册 / 签发 / 聚合。
- 本项目 `electron/main/agent/profile-extractor.ts`、`prompts/profile-extraction.ts`、`memory/strategy-registry.ts`：提取 / 包装 / 策略。

## 缺口与建议优先级

| 编号 | 已确认的问题或边界 | 后续动作 |
|---|---|---|
| G1 | App.tsx:1160 与 :1534 有系统提供的生图请求预填；AST 防漏只扫描主进程正文和聊天调用，不能覆盖它们 | 将预填归到共享生产纯函数，登记真实符号；覆盖 Renderer / shared 及预填数据流，负例验证漏登与错 key |
| G2 | 生图 / Embedding 使用独立协议；聊天签发测试不覆盖这两条路径 | 分别登记固定包装（若存在）与数据入口，明确原始运行时参数归属；对独立模型出口建立来源测试，不强套聊天消息类型 |
| G3 | prompt-compiler 登记 6 组语义 slots，正文实际有 29 个不同占位符 | 区分语义输入与模板占位符；补显式映射 / 来自实际编译器的变量目录，标出缺失和未知；不自动编写变量含义 |
| G4 | 现有门禁对 Prompt 命名、定义符号及注册配方有效，但不是任意字符串语义识别器 | 以调用出口 + 固定模板发现 + 输入来源三类证据共同验证；未知分支不能静默免检 |
| G5 | compiler 的 task_plan 规则重复；reply-stance 的情绪信号可先于任务执行；关系阶段依赖代理指标 | 在独立场景中先验证冲突与结果，再修改共享规则；与人物写作分开，不能用人设补框架 |
| G6 | 记忆有采集、去重、召回、反思等不同责任；尚无 Alice 式全套记忆 Agent | 先审用户 / 助手主体、原话依据、敏感内容、临时事实、人物分桶、纠正与冲突处理；新增提炼 / 记忆 Agent 属于能力决策，不以搬 Prompt 冒充落地 |
| G7 | 人物外貌 / 风格 / 配图策划、独立评论 / 回复等不是已有完整能力 | 标明“未实现”与“未登记”区别；根据首个人物旅程选择要补的闭环，不为对齐数量全部复制 |

## How：后续施工方案（待确认，未实施）

- 保留 `prompts/registry.ts` + 真实生产常量 / Role Pack + `model-context-assets` 聚合与聊天签发，不整体替换为 YAML。
- 固定中文指令、模板包装和 UI 请求预填各有可追溯的生产定义；用户原文、提炼结果、实际图片描述、工具结果是运行时数据，目录只登记它们的包装 / 生产配方，不静默增加日志采集。
- UI 预填来源放共享纯模块，使 Renderer 和主进程注册读取同一来源；key 仍受统一键工厂约束。具体载荷和来源传播在实施前核对共享类型，不能仅靠新建目录项宣布接线完成。
- 审阅变量从真实模板 / 编译输入派生，声明语义组保留，不因名称不同误报“未注入”。若需要新的变量说明字段或来源载荷，列出共享类型 / loader / 注册 / 四处 IPC 范围后再实施。
- 自然语言内容审阅以任务场景为单位：先公共执行与记忆边界，再主对话 / 后台生活，最后人物差异与视觉。每项标记登记、接入、静态审阅和效果验收状态。
- 范围不包含新人物经历、自动生图发布、新的情感记忆采集或完整 ReAct 记忆子代理；这些能力需用户决定后另有完整施工边界。

## 实施顺序与验收

1. 对 G1–G4 完成单一事实源、真实接线和正 / 负例门禁，防漏测试扫描 Renderer / shared / main / Eval，并覆盖图片独立出口及输入预填；模型输入数据不被当作内置正文。新增声明但无消费者同样失败。
2. 逐项审 G5–G6：任务执行、情绪回应、关系连续性、记忆主体、敏感信息、去重和反馈分桶；明确每个场景预期、失败 / 回退与来源，不只检查关键字。
3. 需要改变 Debug 变量展示时，先 Playground → 用户查看 → 明确回流；本轮没有改变 UI。
4. 类型、Unit、构建、资产与文档门禁通过；涉及 UI 增补主题 / 宽度 / 字号及真实 Electron 验收。真实付费模型或图片生成须另有明确授权，不以测试替身证明人物效果。
5. 稳定事实吸入模块卡后才能冻结合同；全部输入路径的已登记 / 运行时 / 非模型 / 未实现状态都可解释，才称覆盖闭环。

## 本轮验证与证据边界

静态 AST 导出 Alice 1389 条内嵌元数据；真实生产纯函数导出本项目 63 项 Prompt 定义及相关目录元数据。导出不含用户记忆或凭据，不运行参考代码；工具 / 用户 Skill / MCP 未初始化，不对它们的运行时数量作保证。

现有定义防漏、Role Pack 文件、聊天签发正反例与只读盘点共 3 文件 / 10 项通过；盘点临时用例仅输出本地证据，完毕移除，不成为每次 Unit 写报告的副作用。此次测试通过只证明现有门禁范围，不证明 Renderer / 图片请求已经补齐。

本轮不改生产代码、正式 UI、共享类型、生产 Prompt、采集策略或任何用户资料；没有真实模型请求或生图费用。后续修复未开工，合同仍进行中。
