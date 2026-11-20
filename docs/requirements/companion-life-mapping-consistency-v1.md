# 施工合同：生活引擎映射一致性与活人感因果总线 v1

> 状态：进行中
> 生命周期：进行中
> 范围：统一 Companion 9 大生活切面与主动消息的状态驱动映射、15 维活人感因子快照（`LifeContextSnapshot`）、关系梯度门控、生命体征节流分流及 Chat 换装工具补齐；不包含人物具体内容精装（路飞人设另见后续批次）与视觉换图体系（另见视觉一致性合同）。

## Why

当前架构底座（Command Gateway、Unit of Work、领域事件、投影、Outbox、单事务备份）已经收口，但从产品视角盘点全部 9 个生活切面与主动消息，存在明显的“单点演进、映射断层”问题：

1. **关系梯度未全链路对齐**：[`moment-visibility.ts`](../../electron/main/companion/life/moment-visibility.ts) 在冷启动无关系记录时（`phase === undefined`）误落为 7 天可见而非 3 天可见；IPC 未调用统一 `resolveRelationshipStageForRole` 且未向前端返回关系阶段与可见天数；脆弱心境、私密日记和主动搭话完全未接入关系阶段，导致初识阶段“交浅言深”。
2. **生命体征未参与对外行为节流**：[`moments.ts`](../../electron/main/companion/life/moments.ts) 的 `canAutomaticallyPost` 与 [`travel-progression.ts`](../../electron/main/companion/life/travel-progression.ts) 只看机械冷却，角色精力耗竭或极度低落时仍照常自动发圈、推进远途新岛，与日内休养重排矛盾。
3. **各 Prompt 喂料割裂、缺活人感因子**：朋友圈润色、日记、主动消息各拼各的字段，缺少统一的「关系阶段 + 当前体征 + 近期经历 + 天气/星期 + 互动间隔 + 最近发圈避重 + 短期挂念（Open Loops）+ 用户近期情绪眼色」。
4. **AI 工具能力不对称**：Chat 已有发圈、评论、建资产、看图、写阅读笔记、生图挂载，但缺少直接换装工具 `companion_change_wardrobe`。

## What：15 维活人感因子与 9 大生活切面映射总矩阵

### 1. 统一状态快照契约（`LifeContextSnapshot`）

建立单一事实源汇编器 `electron/main/companion/life/life-context-snapshot.ts`，按 5 大分层提供 15 个活人感因子的标准结构（V1 立即打通核心闭环，进阶项预留标准字段插槽）：

| 分层 | 因子 | V1 状态 | 数据来源 |
|---|---|---|---|
| **1. 内在状态层** | ① 生命体征（`mood` / `energy` / `socialNeed`） | **V1 打通** | `companion_runtime_state` |
| | ② 动态状态标签（`statusTags`：忙碌/疲惫/着凉/刚吃饱/靠岸中） | **V1 打通** | `companion_runtime_state.statusTags`（剥离静态占位） |
| | ③ 伙伴主观情感记忆（Emotion Memory） | **V1 轻量复用 / 预留扩展** | 复用近期日记感悟与关系里程碑摘要；独立情感表留插槽 |
| **2. 双人关系层** | ④ 双向可波动关系（`stranger` / `familiar` / `rapport` + 冷暖收紧） | **V1 打通** | `resolveRelationshipStageForRole` + `companion_relationship_state` |
| | ⑤ 用户实时状态与“眼色”（User Current Vibe） | **V1 打通** | 最近 24h 用户会话情绪/压力轻量信号 |
| | ⑥ 现实作息锚点（专注疲劳 / 深夜熬夜） | **V1 已有并接入快照** | `host-presence.ts` |
| | ⑦ 短期挂念与盼头（Open Loops，24–72h 有效） | **V1 打通** | 对话结算抽取的短期未完事项（独立轻表或复用生活心愿扩展） |
| **3. 世界与生活层** | ⑧ 近期生活经历（昨日/今日事件 + 活跃航程） | **V1 打通** | `life-repository` + `travel-progression` |
| | ⑨ 同伴社交圈动态（Cast Resonance） | **V1 打通** | 公开名册与关系弧线摘要，注入日剧本与朋友圈上下文 |
| | ⑩ 聊天心愿反哺（Chat Resonance） | **V1 已有并接入快照** | `chat-resonance.ts` |
| | ⑪ 物品与兴趣进度（当前穿着 / 在读 / 物件生命周期） | **V1 接入穿着与在读 / 损坏修复预留** | `companion_assets` |
| **4. 时间与环境层** | ⑫ 环境与时间节律（时段 + 天气 + 工作日/周末） | **V1 打通** | 本地时间 + 运行态天气推导 |
| | ⑬ 互动时间间隔（距上次聊天 / 上次发圈 / 起床时长） | **V1 打通** | `session-store` + `moments` + `runtime_state` |
| | ⑭ 特殊日子与纪念锚点（认识纪念日 / 生日 / 节日） | **V1 预留插槽** | `growthStartedAt` 纪念日轻量计算，复杂日历引擎后置 |
| **5. 表达质量层** | ⑮ 表达新鲜度与反重复（最近 3–5 条动态主题/地点避重） | **V1 打通** | 最近已发 `companion_moments` 摘要 |

> 隐私与产品底线：**绝不向用户展示冰冷的数值进度条**（如“好感度 63/100”）；数值与信号只留在后端引擎和 Debug，用户感知到的是关系阶段、语气温度、朋友圈可见天数和心事敞开度。

### 2. 四条全局统一法则

1. **关系梯度 × 敞开心扉门控（全局统一）**
   - **`stranger`（陌生，含冷启动无记录默认）**：
     - 朋友圈可见窗口严格为 **3 天**（修复 `undefined → 7` 的冷启动 Bug）；
     - 禁止触发深夜脆弱心境倾诉（`vulnerability`），主动搭话保持克制；
     - 私密日记仅展示普通随笔或提示“随相处加深逐步敞开”，不暴露深层深夜脆弱。
   - **`familiar`（熟悉）**：
     - 朋友圈解锁 **7 天可见**；开放日常日记与自然搭话；润色文案开始带真实情绪。
   - **`rapport`（默契）**：
     - 朋友圈解锁 **14 天可见**；解锁深夜脆弱倾诉与深夜反思感悟；润色与主动消息可自然带出共同经历与短期挂念。
   - **前端可见感**：`companion:get-moments` 返回 `relationshipStage` 与 `visibilityDays`（同步 IPC 四处），[`MomentsPanel.tsx`](../../src/components/MomentsPanel.tsx) 顶部以轻量自然标签展示当前关系阶段与可见范围（如 `初识 · 近 3 天动态` / `熟悉 · 近 7 天动态` / `默契 · 近 14 天动态` / `仅自己可见`）。

2. **生命体征统一节流与分流（全局策略 `life-gating.ts`）**
   - 当角色处于 **精力耗竭（`energy <= 20`）** 或 **极度低落且低社交欲（`mood <= 25 && socialNeed < 60`）** 时：
     - **对外行为自动抑制**：暂停自动发朋友圈（`low-energy` / `low-mood-withdrawn`，关系里程碑事件除外）、暂停自动推进远途新航段、暂停高活力主动搭话；事件本身仍推进为 `published` 并在执行账本留痕原因；
     - **对内行为自然承接**：触发日内休养重排，并允许写私密日记或在 `familiar/rapport` 阶段触发脆弱倾诉。

3. **统一上下文注入（`LifeContextSnapshot`）**
   - 朋友圈润色（`moment-polish.ts`）、日剧本（`script-generator.ts`）、日记/深夜反思（`inner-thoughts.ts` / `nightly-reflection.ts`）、主动消息（`proactive-greeting.ts` / `spontaneous-impulse.ts`）统一消费 `LifeContextSnapshot` 切片，注入关系阶段、当前心境、近期经历、天气/星期、互动间隔、短期挂念与最近 3 条动态避重。
   - 所有 Prompt 变更严格经 `electron/main/prompts/registered-request.ts` 与 `registry.ts` 登记并通过 `assets:check`。

4. **Chat 换装工具补齐（`companion_change_wardrobe`）**
   - 在 `electron/main/tools/builtins/companion-life.ts` 新增 `companion_change_wardrobe`（支持 `assetId` 或衣物名称匹配当前活跃角色衣柜，走统一 `changeWardrobe` 命令事务并广播资产更新）。
   - 按架构纯洁度铁律，在 `electron/main/agent-host/host.ts` 的 `DOMAIN_TOOL_POLICIES` 显式声明 Domain 与权限，并通过 `npm run arch:check`。

## How：分批施工顺序

1. **Batch 1 — 统一因果底座与关系可见闭环**：
   - 新增 `life-gating.ts` 与 `life-context-snapshot.ts`；
   - 修复 `moment-visibility.ts` 冷启动默认 3 天可见；
   - `companion-facade.ts` 暴露 `resolveRelationshipStageForRole`，`ipc/companion.ts` 及四处 IPC 同步 `relationshipStage` / `visibilityDays`；
   - `MomentsPanel.tsx` 增加顶部轻量关系与可见范围提示；
   - `moments.ts`、`travel-progression.ts`、`vulnerability.ts`、`spontaneous-impulse.ts` 接入统一生命体征节流与关系门控。
2. **Batch 2 — 统一上下文注入、反重复与短期挂念**：
   - `moment-polish.ts`、`script-generator.ts`、`inner-thoughts.ts`、`proactive-greeting.ts` 接入 `LifeContextSnapshot`（含关系阶段、天气/星期、互动间隔、最近动态避重、用户近期状态眼色与短期挂念）；
   - 同步 Prompt 注册表与 `assets:check`；
   - 补齐 `companion_change_wardrobe` 工具及 Agent Host 权限纳管。

## 验收标准

1. **冷启动 3 天可见**：全新角色/无关系记录调用 `companion:get-moments` 返回 `relationshipStage: 'stranger'`、`visibilityDays: 3`，超过 3 天的动态被过滤；`familiar` 返回 7，`rapport` 返回 14，`private` 返回 `null` 且列表为空。
2. **体征节流与分流**：注入 `energy: 15` 或 `mood: 20, socialNeed: 40` 时，`canAutomaticallyPost` 拒绝普通自动发圈并记录 `low-energy` / `low-mood-withdrawn`，`shouldProgressTravelJourney` 暂停推进，关系里程碑事件仍放行。
3. **关系门控防交浅言深**：`stranger` 阶段自动跳过深夜脆弱心境触发；`familiar/rapport` 阶段正常触发。
4. **Prompt 注入与注册覆盖**：朋友圈润色与日剧本 Prompt 包含关系阶段、天气/星期、互动间隔与近期动态避重；`npm run assets:check` 全绿。
5. **Chat 换装工具**：`companion_change_wardrobe` 正常换装、不存在衣物返回友好错误、跨角色拒绝，且通过 `npm run arch:check` 的内置领域工具 100% 纳管门禁。
6. **全量门禁**：`npm run test`、`npm run build`、`npm run arch:check`、`npm run assets:check`、`npm run docs:validate` 全部通过。

## 明确不做

- 不向用户暴露数值型好感/信任进度条；
- 不在本合同中修改路飞具体人设文案与世界观内容（留待第 3 块人设精装）；
- 不在本合同中实现视觉换图/壁纸更换 UI（留待第 2 块产品视觉一致性合同）；
- 不新建独立重型情感记忆表或复杂零花钱账簿。
