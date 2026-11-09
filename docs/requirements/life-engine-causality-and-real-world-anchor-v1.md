# 人物世界引擎因果重编排与现实作息锚点施工合同

> 状态：进行中（2026-11-10）
> 统一标识：`REQ-LIFE-CAUSALITY-AND-REAL-WORLD-ANCHOR-V1`
> 负责人：Agent
> 关联模块卡：[`docs/modules/companion.md`](../modules/companion.md)
> 目标模块：`electron/main/companion/life/`、`src/components/world/`、`src/components/playground/`

---

## 1. 背景与目标（Why）

当前人物世界引擎虽然建立了日剧本（DayScript）与计划事件（Event）的物化流水线，但在深层活人感体验上存在两个关键脱节：

1. **日内事件离散割裂，缺乏动态因果迁移（问题 4）**：
   - 每日生成 5~7 个固定槽位后即静态入库为 `planned`；
   - 当中途发生重大生理突变（如精力耗尽 `energy <= 25`、深夜遭遇严重小情绪 `vulnerability`、或航海两难投票出现剧烈结果）时，引擎依然机械地按原计划在下午物化“剧烈户外探险”，缺乏根据实时突变动态重编排（Re-planning）后续计划槽位的能力。
2. **与宿主现实环境缺乏作息与专注关怀共鸣（问题 6）**：
   - 虽然当前主会话模型输入中已具备本地时间戳（`[当前时间: YYYY-MM-DD HH:mm:ss]`），但角色并不知道用户是在**连续专注敲代码了 3 个小时未休息**，还是**离开工位 1 小时后刚刚返回**；
   - 缺乏非侵入式的宿主活跃度感知（系统空闲时长与连续交互时长），导致角色无法在合适时机发出真人般的疲劳关怀（Care Impulse），也没能将用户的作息劳逸吸收进次日的生活安排中。

本合同旨在建立**“日内因果状态机重编排”**与**“宿主专注作息现实锚点”**两大闭环，让伙伴内部生理自洽，同时与用户的真实工作作息产生温情共振。

---

## 2. 已确认范围（What）

### 范围 A：日内因果状态机与动态重编排（Dynamic Re-planning）
- **突变监听与自适应重编排**：
  - 当角色体征严重透支（`energy <= 25` 或 `mood <= 20`）、进入未安抚的脆弱心境、或完成重大决策时，触发 `replanRemainingSlots(roleId, cause)`；
  - 仅重新编排**当日尚未物化的 `status = 'planned'` 槽位**，绝不推翻整天，也绝不修改已发布的历史事件；
  - 重编排由专用提示词配方 `compileReplanSlotsRequest`（或高可靠规则保底）签发，将后续高负荷活动自适应置换为休息休整、同伴照顾、静静放空或喝药调理；
  - 每个被调整的槽位携带因果溯源元数据：`causedBy: { trigger: string, reason: string, at: number }`；
- **前后情境承接**：
  - 槽位物化到朋友圈（`Moments`）或航海日记时，提示词注入前序突变原因，使文案自然带有“因为上午风暴受了点伤，下午不得不卧床休息”的真实因果链。

### 范围 B：宿主环境作息感知与虚实关怀锚点（Host Presence & Care Anchor）
- **非侵入式宿主作息监控（严格遵循隐私红线）**：
  - 绝不监听键盘按键内容、绝不截屏、绝不扫描非相关进程；
  - 仅使用 Electron 原生 `powerMonitor.getSystemIdleTime()` 与应用内会话活跃时间差：
    1. **连续工作专注度**：用户在系统内活跃且空闲时长 `< 5分钟` 的连续时长（阈值：120 分钟轻度关切，180 分钟深度关切）；
    2. **深夜作息关注**：本地时间处于 23:30 ~ 05:00 且仍在高频交互；
    3. **工位归来感知**：系统空闲超过 45 分钟后首次重新检测到活跃；
- **现实生活关切触达（Care Impulse）**：
  - 达成阈值且满足防打扰冷却（同类关切每日最多 1 次，冷却至少 4 小时）时，触发角色的现实关切表达；
  - 关怀以角色第一人称口吻（路飞式大咧咧提醒或深夜温情劝睡）直接写入角色主会话（`sessionKind: 'main'`），并广播桌面轻提示；
- **反哺次日日剧本**：
  - 将前一日的宿主作息标签（如 `late_night_working`、`long_focus_hours`）纳入次日日剧本规划（`ScriptGenerator`）的 `lifeContext` 中，使角色次日晨起主动关怀“昨晚看你忙到那么晚，今天可别太拼了”。

### 明确不做项（Non-goals）
- 不引入系统常驻全局键盘钩子或鼠标宏；
- 不读取用户操作系统的本地文件、其他窗口标题或私人信息；
- 不在用户进行高危命令执行或重要工具调用时强行打断工作流。

---

## 3. 技术实现方案（How）

### 3.1 架构与目录规划
- `electron/main/companion/life/replan.ts`：日内计划槽位动态重编排服务
- `electron/main/companion/life/host-presence.ts`：宿主作息与连续专注监控服务
- `electron/main/prompts/replan-slots.ts` & `host-care.ts`：重编排与现实关切提示词配方
- `electron/main/companion/life/ticker.ts`：挂载重编排检查与宿主关切时钟推进
- `src/components/playground/LifeCausalityCandidate.tsx`：离线 Playground 候选展厅（支持因果重排对比与宿主关切模拟）

### 3.2 数据模型
- `companion_events.payload` 扩展字段：
  ```ts
  causedBy?: {
    trigger: 'vitals_exhaustion' | 'vulnerability' | 'co_decision' | 'manual'
    reason: string
    previousActivity?: string
    at: number
  }
  ```
- 宿主状态追踪：
  ```ts
  export interface HostWorkSessionState {
    lastActiveAt: number
    continuousActiveMinutes: number
    lastCareTriggeredAt: Record<string, number>
    yesterdayNightWork: boolean
  }
  ```

---

## 4. 验收与质量门禁

1. **类型检查**：`npm run typecheck` 0 错误。
2. **单测覆盖**：
   - `__tests__/unit/life-replan.test.ts`：测试精力枯竭重排、槽位因果标签继承、幂等性与降级保底；
   - `__tests__/unit/host-presence.test.ts`：测试空闲判定、连续专注时长累加、防打扰冷却与主会话关切投递。
3. **生产注册表与资产检查**：`npm run assets:check` 全部通过。
4. **编译与构建验证**：`npx vite build` 0 告警顺利通过。
5. **文档门禁**：`node scripts/docs-check.mjs` 0 错误。
