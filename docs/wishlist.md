# 心愿池

> 只保存**尚未完成**的缺口、暂缓项和灵感，不承诺执行。完整旧心愿池（含 107 个已完成项）见 [`../_archive/ledgers/wishlist-through-2026-08-16.md`](../_archive/ledgers/wishlist-through-2026-08-16.md)。
> 决定开工 → 写施工合同或进入对应方法论队列；完成或明确取消 → 从本文件移出，并在 Progress 留痕。

## 待办缺口

### 安全与韧性

- [ ] **URL Fetch DNS rebinding 深度防护** — 当前已有 DNS 预解析、私网黑名单、重定向阻断和响应上限；若威胁模型需要对抗主动竞态攻击，再引入固定地址连接器或进程级网络策略。历史证据见 [`../_archive/audits/security-audit-2026-08.md`](../_archive/audits/security-audit-2026-08.md)。
- [ ] **Tool Result Injection 结构化分类器** — 当前已有中英文启发式探针和不受信任内容边界；后续可用离线分类器 / Eval 扩展。
- [ ] **长任务韧性复核** — 复核分层超时、心跳保活和可重试 / 不可重试错误码白名单，来源：2026-07 Gap Audit。
- [ ] **可逆性 / Undo 设计** — 为高风险工具和用户可见修改建立可逆操作模型，来源：2026-07 Gap Audit。

### 存储、上下文与启动

- [ ] **迁 better-sqlite3 / 增量快照** — 等 sql.js 全量 export 出现明确体感问题再评估。
- [ ] **Context Engineering 专项** — 复核 just-in-time 检索、结构化工作笔记、context reset 与压缩边界，来源：2026-07 Gap Audit。
- [ ] **启动性能专项** — 评估等待窗口内并行 I/O、阶段计时和“超时不缓存 null”，来源：2026-07 Gap Audit。
- [ ] **配置源与本地热更新复核** — 判断是否需要统一配置源抽象，而不是继续由各模块独立监听，来源：2026-07 Gap Audit。

### 多 Agent 与自进化

- [ ] **M19 多 Agent：Swarm / Handoff** — 复核动态 Agent 列表、Mailbox 权限冒泡和控制流 / 数据流侧信道。
- [ ] **M20 自进化** — 自动改进、代码级自进化和主动提案；版本备份与回滚已落地。
- [ ] **Generator–Evaluator 架构** — 评估独立 evaluator，避免生成器自评过宽，来源：2026-07 Gap Audit。

### Playground、Skill 与国际化

- [ ] **Playground Prompt Lab 加厚** — 从 Debug 选择资产、模拟上下文、A/B 对比和模型 / 参数切换；用户已明确暂缓。
- [ ] **伙伴结构化资产 Playground 草稿** — 支持从 Debug 显式载入 profile / 默认世界为隔离草稿、Diff 和人工回流；不得直接写生产 Role Pack。
- [ ] **Skill Diff 审阅与导入导出** — 补版本 diff、导入导出和迁移策略。
- [ ] **中文 Prompt → 英文 Prompt 多语言版本** — 当前生产只维护简体中文；未来在同一资产 key 下维护 `zh` / `en` 独立版本，运行时按 locale 单选，不做中英韩并发注入。

### 产品体验

- [ ] **人格化错误承接** — 评估错误码到伙伴语气模板的映射，避免技术错误提示破坏关系体验；来源：2026-07 Gap Audit。
- [ ] **M24-G3 生图朋友圈** — 非本阶段。
- [ ] **原生语音输入** — 暂缓；待选择系统 STT 或云端 Whisper，见 [`deferred/native-voice-input.md`](./deferred/native-voice-input.md)。
- [ ] **真终端（node-pty / xterm）** — 当前右坞是命令控制台，不支持 vim 等交互程序。

## 灵感

- [ ] **设置：账号 / 隐私云同步 / 用量统计大盘 / 自动化工作流** — Alice 有，我方无后端；不得先做假入口。
- [ ] **侧栏 Wiki / 待办 / 定时应用模块** — Alice 应用区参考，需先确认是否符合我方产品 IA。

## 明确不做

以下不是待办，不得重新登记为工程欠债：

- OS 级 Shell 强隔离；
- Python 嵌入沙箱。

只有 DEC-037 的威胁模型触发条件变化时，才重新立项独立受限 Runner。
