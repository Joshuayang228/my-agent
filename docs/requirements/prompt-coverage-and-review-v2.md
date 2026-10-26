# 提示词全链路覆盖与内容审阅施工合同 v2

状态：进行中（用户已授权按旅程补齐，生产施工中）
日期：2026-10-27

## 背景与授权边界

用户最初要求“把所有的提示词，包括记忆提炼那些都梳理清楚，看看 Alice 梳理了哪些，是怎么做注册的”。最初盘点阶段只读；其后用户明确授权按旅程补齐，当前生产施工边界与结果以下文“旅程补齐授权与施工边界”为准。提示词管理器已回流，不代表全部输入来源及语义质量已闭环。

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

## How：盘点阶段提出的施工方案（实施情况见后文）

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

## 盘点阶段验证与证据边界（历史记录）

静态 AST 导出 Alice 1389 条内嵌元数据；真实生产纯函数导出本项目 63 项 Prompt 定义及相关目录元数据。导出不含用户记忆或凭据，不运行参考代码；工具 / 用户 Skill / MCP 未初始化，不对它们的运行时数量作保证。

现有定义防漏、Role Pack 文件、聊天签发正反例与只读盘点共 3 文件 / 10 项通过；盘点临时用例仅输出本地证据，完毕移除，不成为每次 Unit 写报告的副作用。此次测试通过只证明现有门禁范围，不证明 Renderer / 图片请求已经补齐。

盘点阶段未改生产代码、正式 UI、共享类型、生产 Prompt、采集策略或任何用户资料，也没有真实模型请求或生图费用。此段是盘点时记录；当前修复状态以下文生产接线为准。

## 旅程补齐授权与施工边界（2026-10-27）

用户明确要求“根据我们的用户旅程地图的功能，把所有的提示词梳理出来，比如评论有功能，但没有提示词，就要梳理出来，我们补上；开始补齐”。据此批准本轮生产补齐，不再重复询问已列来源和调用范围。此前只读边界属于盘点阶段，本节为后续施工依据。

- 旅程依据：product-experience-map-v1 六条旅程及其人物世界六面；逐项登记模型生成、用户输入、确定性行为、运行时数据或尚无产品入口。不是为每个按钮强加模型。
- 评论：增强已有 NPC 评论生成路径，保持评论者选择、用户评论独立存储、既有 meta 结构和人物分桶；只使用公开名册资料，新增注册 Prompt / 固定配方 / 校验与原短句回退。沿用现有 preferLlm 开关及辅助模型配置，不新增调度触发；已启用路径中每条选中的 NPC 评论最多新增一次辅助模型请求。不引入新的自动回复 UI 或存储。
- 生图：UI 预填抽到共享生产纯函数并注册；图片工具通过固定包装编译成有来源证明的独立图片请求，图片协议拒绝未签发请求。保持一次图片请求、不自动增加文本模型策划调用、不重试、不扩大权限。
- 记忆：已有提取 / 输入 / 召回 / 压缩 / 六策略逐项映射；补主体和事实来源等场景验证，不新增未经决定的情感采集或记忆子代理。
- 变量：注册目录从真实模板派生占位符，保留原语义输入；主对话显式绑定实际字段来源。只补数据契约，不改 Debug 布局和交互。
- 文件范围：prompts、共享请求预填纯模块、App 对应两处调用、image-generation / image-generate、moments 评论生成服务、共享 Prompt 类型、相关门禁 / Unit / E2E 与模块卡和本合同。新增 journey → 生产来源映射及一致性测试。既有无关未提交文件不修改。
- 替换记录：两处 App 内联请求文本改为同文案生产构造器；图片服务 raw string 参数改为专用签发对象；NPC 旧短句保留为回退；不删历史数据、接口或人物设定，不新增依赖。
- 验收：现有功能有真实消费者，新增模板和配方进入目录；漏登、错 key、未签发图片请求、变量漂移有负例；评论覆盖成功 / 未配置 / 失败 / 非发布事件；全量 Unit / 类型 / 构建 / 资产 / 文档门禁。测试仅本地协议或模型替身，不请求付费服务。

### 用户补充：不能以“现为规则实现”排除提示词需求

用户进一步要求“需要提示词，但没有提示词的功能也要梳理出来，我们才好补齐”。旅程矩阵同时记录 A 已有并注册、B 已有未治理、C 功能需要生成但尚无 Prompt、D 无需 Prompt、E 尚缺产品闭环；C 必须列出目标、触发、事实输入、输出、校验、回退与生产消费者。不得用“现在是固定句”把 NPC 评论从 C 错分到 D。E 不以新增一个未消费的 Prompt 冒充完成。

| 旅程 / 功能 | 类别与判断 | 本轮落点 / 缺口 |
|---|---|---|
| 首次聊天、日常回应、任务执行 | A，需要人物表达与行为规则 | 现有主对话编译；审任务 / 情绪优先级 |
| 记住重要信息、识别反馈 | A，需要提炼指令与输入包装 | 六类长期信息，补主体 / 原话依据反例 |
| 召回、压缩后继续任务 | A，需要包装 / 摘要规则 | 原记忆与摘要分源，不拿压缩替代长期记忆 |
| 用户主动记住 / 修改 / 删除记忆 | D，用户明确内容与确定性校验 | 工具 schema 已注册；不为 CRUD 增加付费模型 |
| 人物日程、暂停补叙、反思 | A，需要生成 Prompt | 已有公共行为与人物增量入口 |
| 朋友圈正文 | A，需要事实约束与人物表达 | 事件底稿 + 已注册润色，不虚构新事件 |
| NPC 评论动态 | C → A，原固定短句需要生成 Prompt | 已接入独立注册 / 签发 / 公开名册与动态输入 / 短评论校验 / 原短句回退，接入现有发布链 |
| 用户手工发表评论、点赞 | D，是用户输入与确定性存储 | 保持原文与用户身份，不用模型替用户说话 |
| 主角回应用户评论 | E，需要回复 Prompt，也缺自动回复产品闭环 | 当前没有独立回复存储 / 触发 / 展示契约；列为能力缺口，不能把 NPC 评论冒充回复。新 UI 仍需候选验收 |
| 图片内容生成、人物世界资产配图 | B/C → A，需要固定图片约束及请求模板 | 已接入 UI 草稿与图片包装 / 专用签发，保留用户明确风格，不臆造人物外貌 |
| 朋友圈自主配图策划 / 生成 / 回写 | E，需要视觉策划及识图 Prompt，也缺完整自动发布链 | 不把读取已有图片当成功能已完成；按独立闭环列出，不能只补死模板 |
| 文化角手工作品 / 笔记、衣柜换装、家居 / 通讯录 / 足迹资料维护 | D，当前为用户维护与明确引用 | 不能给保存 / 筛选 / 浏览强加模型；未来自动提炼内容是单独的 C/E 条目 |
| 自主阅读感想、资产图片识别回填 | E，需要提炼 Prompt 与真实材料输入 / 校验 | 当前不存在对应自动生成入口，缺口保留，不捏造阅读经历 |
| 主动问候 | D（已有动态提醒）；E（自主撰写个性问候） | 现有提醒是确定性预览；若新增独立表达，需单独的触发 / 预算 / 内容生成 / 防打扰闭环 |
| 看图聊天、工作区侧聊、召唤 | A，复用已注册主对话与独立情境边界 | 图片 / 文件是数据，不额外复制整套 System |
| 定时任务 | A/D，用户任务文字与原框架编译 | 不把用户任务逐条变成内置 Prompt |
| 设置、模型连接、工具 / Skill、Debug | A/D | 诊断固定输入有登记；浏览与配置保存无需生成 Prompt；工具描述与激活包装另治理 |

此矩阵与前文 G1–G7 一起指导补齐，既不遗漏有意义的生成需求，也不宣称当前没有触发 / 数据 / UI 的愿景已经实现。

### 仍需提示词的能力缺口：具体补齐单元

下面列的是需要生成能力的目标，不是已经存在的 Prompt。不要为通过注册测试创建没有消费者的空模板。顺序优先服务“看动态 → 互动 → 关系连续性”，再补视觉与自主生活。共享规则完成不代表人物内容或模型效果已经验收。

| 优先级 / 功能 | 生成目标与触发 | 事实输入 → 输出 | 校验 / 失败边界 | 缺少的真实消费链 |
|---|---|---|---|---|
| P1 主角回复用户评论 | 用户提交评论后，以主角身份回应该条评论 | 所属人物、动态、评论线程、允许的关系记忆 → 单条回复 | 身份与父评论一致、去重、限长、失败保留用户评论不造回复 | 评论回复的触发、预算、父子存储、展示、重启去重；NPC 评论不替代该链 |
| P1 人物视觉锚点 | 首个人物资料确认时形成外貌 / 风格约束 | 用户批准的外貌材料、衣物 / 场景 → 稳定视觉约束与可变场景描述 | 缺材料不推断年龄、身份和经历；无授权不持久改变身份 | Role Pack 视觉资产约定、图片输入组装、人工验收，不是改通用生图字符串就完成 |
| P2 动态自主配图 | 已发布事件选择需要配图后生成具体画面 | 事件事实、视觉锚点、实际衣物 / 地点 → 图片描述与协议参数 | 不编新事件；结构校验、预算、权限；生成失败保留纯文字动态 | 策划 → 生图 → 图片安全保存 → 同人物动态回写 → 失败 / 重启幂等 |
| P2 资产识图回填 | 用户明确选择图片及目标资产后提炼可见特征 | 图片、资产类型、已知事实 → 可核对字段建议 | 区分观察 / 推测，不凭图片杜撰人物身份；失败不覆盖旧资料 | 图像读取、模型能力路由、字段校验、确认与写入；当前看图聊天不等于自动回填 |
| P2 自主阅读感想 | 真实阅读进度或明确材料到达时生成笔记 | 作品材料、已读范围、人物表达 → 带来源范围的感想 | 无材料不假装读过；不以书名编造情节；失败不新增笔记 | 阅读材料来源、进度事件、笔记归属与写入 / 去重 |
| P2 自主穿搭 / 家居 / 足迹叙事 | 已有真实生活事件需要生成解释或行动建议时 | 现存衣物、家居 / 地点、事件与选择限制 → 建议或事件文案 | 不把建议当成已穿 / 已搬家 / 已到访；只能引用真实资产 | 通用日程 / 动态表达已覆盖，独立自主选择与状态变更未形成闭环；手工维护仍无需 Prompt |
| P2 个性化主动问候 | 已有防打扰门闸允许发送后撰写表达 | 允许引用的近期事实、人物语气、投递目的 → 一条问候 | 不泄露记忆，不制造紧急感；无依据 / 失败跳过或原提醒 | 限次与呈现回执已有；个性表达生成及费用 / 保存契约未接入 |
| P3 深层记忆整理 | 发现明确冲突、项目归纳或用户批准整理时 | 有来源的记忆候选 → 新增 / 合并 / 冲突建议 | 敏感检查、主体、证据、可撤销；模型不能直接覆盖事实 | 现有精确 / 向量去重与纠正保留；完整冲突合并、项目记忆 Agent、情感采集未实现，需独立闭环 |

### 本轮生产接线与验证范围

- `moments.ts#projectMomentFromEvent` → `moment-comment-service.ts#resolveCastInteractions` → `compileMomentCommentRequest` → `chatComplete`；公开名册与实际正文进入 Prompt，原选人 / 同框及短句回退不变。
- `App.tsx` 两处预填 → `src/shared/request-draft-prompts.ts`；`image-generate.ts` → `compileImageGenerationRequest` → `requestGeneratedImage`，对象私有证明在网络前检查。
- `profile-extractor.ts#maybeExtractProfile` 在真实写入前检查用户原话证据；注册记忆策略读取同一生产常量。原话匹配是结构与来源门，不宣称解决全部语义误归属。
- `compiler.ts` 实际模板提取 29 个占位符并绑定请求字段；注册表保留原语义分组。共享类型为可选扩展，既有主进程 / preload / Renderer 都透传同一类型，无新 IPC 频道或参数。
- 正文定义门禁扩大到生产 Renderer / shared；图片调用静态门禁覆盖别名 / 变量，运行时拒绝原字符串 / 伪造 / 复制。预填作为用户可编辑草稿，不是自动发送或系统指令。
- 此表为施工差距说明，不另建第二份运行时 Prompt 目录。实际 Prompt key、正文与来源仍以生产注册表为准；E 类缺口保持显式，不填虚假注册项。

### 本批次收工证据（不冻结剩余能力合同）

- 按 code-review L2 核对公开名册 → 评论配方 → 输出解析 → 动态 meta，以及图片工具权限检查 → 固定签发 → 图片协议 → 原安全落盘链；没有扩大路径、自动重试、默认启用模型或记录运行时正文。未知语义内容仍是模型效果风险，不把结构校验当事实证明。
- 全量 Unit：239 文件 / 1535 项通过；标准 `tsc --noEmit`、Vite 客户端 / 主进程 / preload 构建通过。资产门禁 11 文件 / 102 项通过；无独立 lint 脚本，差异空白检查通过。未请求真实付费模型，没有以替身证明人物质量。
- 额外 `tsconfig.node.json` 检查仍报告 67 条全仓既有类型 / 工程 include 债；本轮两个 shared 模块显式纳入工程，变更的生产实现无该专项错误。不将标准类型检查通过写成全仓 Node 工程全绿。
- 稳定事实已吸入 companion / memory / agent-runtime、architecture、quality 与账本。主角回复评论、视觉锚点等后续闭环及关系阶段语义审查仍留在本合同，未伪装完成。
- staged 门禁曾发现 shared 新来源未归属、评论服务未同步伙伴策略目录，已补治理清单的明确 Prompt 来源及真实共用的评论策略资产；策略值由生成 / 解析和目录同源消费，没有跳过门禁或修改脚本判定规则。
