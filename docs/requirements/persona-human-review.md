# 真人格人工验收闭环

> 状态：已落地（2026-08-13）

## 需求背景（Why）

Persona Eval 的 Model Judge 能稳定检查明确的行为约束，但无法替代用户对活人感、语气自然度、关系感和审美的最终判断。尤其是“是否强行乐观”“是否立即推进计划”“是否擅自诊断用户”等人格体验维度，需要在 Debug 中逐 Trial 看到真实 Agent 输入与回复后，由人留下可复查的判断。

人工判断必须和自动 Eval 分层：不能篡改 CLI 生成的原始 JSON，不能改变自动 `pass^k`，也不能反向驱动 Prompt 或生产配置。

## 功能目标（What）

在 Debug「质量 / Eval」的每个 Persona Eval Trial 下增加可折叠的人工审阅区：

- 正向体验维度使用 1–5 分：活人感 / 自然度、角色一致性、情绪承接。
- 风险维度使用三态：无、轻微、明显；包含强行乐观、立即推进计划、擅自心理诊断、模板化。
- 总体结论使用三态：通过、需要修改、无法判断。
- 支持中文人工备注、保存、清空当前 Trial 审阅。
- 报告顶部展示人工审阅进度和结论统计。
- 历史报告切换后加载对应的人工记录；保存后立即更新当前视图。

明确不做：账号 / reviewer 系统、多人协作、自动改 Prompt、自动修改原始报告、人工结果混入自动 PASS/FAIL、Codex 上下文压缩压力测试。

## 技术方案（How）

### 数据与边界

数据分两层：

```text
原始 Persona Eval 报告（eval-reports/*.json，只读）
+
本地人工审阅记录（my-agent.db / persona_eval_human_reviews，可更新）
```

审阅记录通过 `reportFileName + scenarioId + trialId` 关联。SQLite 使用现有 `sql.js` 单库和 schema migration；所有 SQL 使用参数化绑定。报告文件名与 ID 由主进程校验，拒绝空值、目录穿越及控制字符。

### IPC

新增 Debug API，并同步共享类型、preload、主进程 handler、`window.electronAPI` 类型声明：

- `debug.personaEvalHumanReviewsList(reportFileName)`
- `debug.personaEvalHumanReviewSave(review)`
- `debug.personaEvalHumanReviewDelete({ reportFileName, scenarioId, trialId })`

读取一次报告的全部审阅记录，避免按 Trial 查询造成 N+1 IPC / SQL。

### UI

人工审阅区默认折叠，标题显示“未审阅”或已保存结论。打开后使用按钮组完成评分，备注使用 textarea，保存和清空操作均在应用内完成，不使用系统 `alert` / `confirm`。自动 Eval 结果与人工审阅统计分块展示、单独命名。

## 影响范围评估

- 破坏性：不改原始报告格式、不改自动 Judge、不改 Prompt 组装；新增数据库表和 Debug IPC，旧数据库通过迁移兼容。
- 安全：不保存 API Key；SQL 参数化；不允许通过 report 文件名穿越路径。
- 测试：增加人工审阅 store 单测；回归现有报告读取、数据库迁移、Debug / UI E2E；改 UI 后验收浅色、深色和窄窗口。
- 文档：完成后更新 `docs/quality.md`、`docs/modules/agent-runtime.md`、`docs/progress.md`、`docs/changelog.md`，并将本合同标记为已落地。

## 实施步骤与验收

1. 新增类型、schema v12 和参数化 review store；单测覆盖新增 / 更新 / 列表 / 删除 / 输入校验。
2. 完成 Debug IPC 四处同步；空报告或非法输入返回安全结果，不泄露内部错误。
3. 改造 Persona Eval 面板，支持报告切换、人工统计、逐 Trial 保存 / 清空。
4. 运行 TypeScript、Unit、Mock Eval、Vite build、UI E2E；Electron 关键流程回归。
5. 自审并提交、推送；更新模块卡和质量账本。

验收标准：人工记录可跨应用重启保留；同一 Trial 重复保存不产生重复记录；自动报告文件内容和自动判定保持不变；Debug 中可以明确区分自动结果和人工判断。

## 风险与权衡

- 1–5 与三态风险等级是有意的轻量量表，避免把人工审美伪装成精确科学分数。
- 不引入 reviewer 字段，先满足单用户桌面审阅；未来多人协作若需要另行立项。
- sql.js 采用现有全量快照写盘，记录量小且审阅写入低频，暂不迁移数据库引擎。
