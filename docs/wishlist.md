# 心愿池

> 只保存**尚未完成**的缺口、暂缓项和灵感，不承诺执行。完整旧心愿池（含 107 个已完成项）见 [`../_archive/ledgers/wishlist-through-2026-08-16.md`](../_archive/ledgers/wishlist-through-2026-08-16.md)。
> 决定开工 → 写施工合同或进入对应方法论队列；完成或明确取消 → 从本文件移出，并在 Progress 留痕。
> 每个未完成项必须有唯一 `WISH-xxx` ID；ID 不复用，来源和重启条件尽量写在同一行。

## 待办缺口

### 安全与韧性

- [ ] **WISH-001 · URL Fetch DNS rebinding 深度防护** — 当前已有 DNS 预解析、私网黑名单、重定向阻断和响应上限；若威胁模型需要对抗主动竞态攻击，再引入固定地址连接器或进程级网络策略。历史证据见 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。；来源：安全审计
- [ ] **WISH-002 · Tool Result Injection 结构化分类器** — 当前已有中英文启发式探针和不受信任内容边界；后续可用离线分类器 / Eval 扩展。；来源：安全审计 / Gap Audit
- [ ] **WISH-003 · 长任务韧性复核** — 复核分层超时、心跳保活和可重试 / 不可重试错误码白名单，来源：2026-07 Gap Audit。
- [ ] **WISH-004 · 可逆性 / Undo 设计** — 为高风险工具和用户可见修改建立可逆操作模型，来源：2026-07 Gap Audit。

### 存储、上下文与启动

- [ ] **WISH-005 · 迁 better-sqlite3 / 增量快照** — 等 sql.js 全量 export 出现明确体感问题再评估。；来源：M16 方法论
- [ ] **WISH-006 · Context Engineering 专项** — 复核 just-in-time 检索、结构化工作笔记、context reset 与压缩边界，来源：2026-07 Gap Audit。
- [ ] **WISH-007 · 启动性能专项** — 评估等待窗口内并行 I/O、阶段计时和“超时不缓存 null”，来源：2026-07 Gap Audit。
- [ ] **WISH-008 · 配置源与本地热更新复核** — 判断是否需要统一配置源抽象，而不是继续由各模块独立监听，来源：2026-07 Gap Audit。

### 多 Agent 与自进化

- [ ] **WISH-009 · M19 多 Agent：Swarm / Handoff** — 复核动态 Agent 列表、Mailbox 权限冒泡和控制流 / 数据流侧信道。；来源：M19 方法论
- [ ] **WISH-010 · M20 自进化** — 自动改进、代码级自进化和主动提案；版本备份与回滚已落地。；来源：M20 方法论
- [ ] **WISH-011 · Generator–Evaluator 架构** — 评估独立 evaluator，避免生成器自评过宽，来源：2026-07 Gap Audit。

### Playground、Skill 与国际化

- [ ] **WISH-012 · Playground Prompt Lab 加厚** — 从 Debug 选择资产、模拟上下文、A/B 对比和模型 / 参数切换；用户已明确暂缓。；来源：用户讨论 / M32
- [ ] **WISH-013 · 伙伴结构化资产 Playground 草稿** — 支持从 Debug 显式载入 profile / 默认世界为隔离草稿、Diff 和人工回流；不得直接写生产 Role Pack。；来源：资产注册管理方法论
- [ ] **WISH-014 · Skill Diff 审阅与导入导出** — 补版本 diff、导入导出和迁移策略。；来源：Skill 管理施工合同
- [ ] **WISH-015 · 中文 Prompt → 英文 Prompt 多语言版本** — 当前生产只维护简体中文；未来在同一资产 key 下维护 `zh` / `en` 独立版本，运行时按 locale 单选，不做中英韩并发注入。；来源：Prompt 中文统一施工合同 / Alice 参考
- [ ] **WISH-022 · 已采用 UI 组件无障碍专项复核** — 按组件注册表的 `needs-review` 清单复核焦点管理、键盘操作、读屏语义、颜色之外的状态表达和窄屏溢出；优先检查 ResizeHandle、Toast、Tabs 与后续 Dialog / Menu Primitive。；来源：UI 组件资产注册方法论

### 伙伴人格与视觉资产

- [ ] **WISH-023 · 主角人物事实模型与激活决策** — 在 Playground / Debug 收尾、伙伴行为人格人工验收通过后，明确是否保留并激活小航；建立姓名、性别 / 性别表达、年龄段、称谓、外观边界、家乡、家庭、教育、职业和关键经历等结构化事实，并标注可主动表达、仅在询问时表达和禁止编造的边界。未经人工确认不得写入生产 Role Pack。；来源：伙伴模块现状 / 用户讨论
- [ ] **WISH-024 · 主角生活世界与关系设定** — 在人物事实模型确认后，补充城市、住所、房间、常去地点、路线、作息、食物、音乐、书籍、颜色、固定物品和其他角色关系等生活世界；与 `world.default.json`、生活世界组装器和 `WISH-013` 的隔离草稿、Diff、人工回流流程对齐。；来源：`playground-world-living-dimensions-v1.md` / 伙伴模块现状
- [ ] **WISH-025 · 人物聊天人格 Prompt 与一致性 Eval** — 将确认后的人物事实和生活世界接入 Role Pack 的稳定身份与动态上下文分层；补充人物事实一致性、反编造、长期稳定性、用户追问和边界拒答 Eval。不得把未经确认的人物设定直接写入聊天 Prompt，也不得在 Playground 复制生产 Prompt。；来源：Prompt 中文统一施工合同 / Persona Eval
- [ ] **WISH-026 · 人物视觉资产与生图 Prompt** — 单独建立人物视觉资产的来源、版本、用途、风格边界、参考图和生图 Prompt 管理流程；与聊天人格 Prompt 分离，并通过 Playground 隔离草稿、人工确认、Diff 和生产回流门禁接入 Role Pack。该项不等同于 `WISH-017` 的生图朋友圈能力。；来源：用户讨论 / 资产注册管理方法论

### 产品体验

- [ ] **WISH-016 · 人格化错误承接** — 评估错误码到伙伴语气模板的映射，避免技术错误提示破坏关系体验；来源：2026-07 Gap Audit。
- [ ] **WISH-017 · M24-G3 生图朋友圈** — 非本阶段。；来源：M24 方法论
- [ ] **WISH-018 · 原生语音输入** — 暂缓；待选择系统 STT 或云端 Whisper，见 [`deferred/native-voice-input.md`](./deferred/native-voice-input.md)。；来源：docs/deferred/native-voice-input.md
- [ ] **WISH-019 · 真终端（node-pty / xterm）** — 当前右坞是命令控制台，不支持 vim 等交互程序。；来源：Chat Right Dock 施工合同

## 灵感

- [ ] **WISH-020 · 设置：账号 / 隐私云同步 / 用量统计大盘 / 自动化工作流** — Alice 有，我方无后端；不得先做假入口。；来源：Alice 产品参考
- [ ] **WISH-021 · 侧栏 Wiki / 待办 / 定时应用模块** — Alice 应用区参考，需先确认是否符合我方产品 IA。；来源：Alice 产品参考

## 明确不做

以下不是待办，不得重新登记为工程欠债：

- OS 级 Shell 强隔离；
- Python 嵌入沙箱。

只有 DEC-037 的威胁模型触发条件变化时，才重新立项独立受限 Runner。
