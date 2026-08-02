# M23 生活世界架构

> 这份文档沉淀我们对「对话框外，她还在过日子」的设计思考。  
> 前半是**认知框架**——世界状态怎么建模、谁在推进、暂停与追赶。  
> 后半是**实战记录**——LifeEngine / tick / Catch-up 怎么落地。  
>
> 对照源：Alice day_scripts / worldTick / ensureDayScriptsForDateRange × 我们的 `companion/life/`  
> 上位契约：`docs/requirements/companion-architecture.md` · `companion-tech-spec.md` W2–W3  
> 沉淀时间：2026-08-02  
> **状态**：✅ 理念已沉淀（代码主线已通；剧本生成仍为确定性 mock，见 Gap）

---

# 第一部分：认知框架

## 一、第一性原理：生活世界是「暂停得住的平行时间线」，不是聊天装饰

伙伴感成立的关键不只是「聊的时候像个人」，而是**你没聊的时候，她也有一天在过**——并且这条时间线可以停、可以追，不会在后台偷偷把三个人都养成满级。

最容易踩的坑：

1. **后台人人养成**——多主角都在 tick，电量/算力爆炸，关系也假（你没选中的人也在过完整人生）。  
2. **只靠 Prompt 说谎**——没有剧本/事件库，只在 system 里写「你今天很忙」；换角、朋友圈、衣柜对不上。  
3. **整库灌进对话**——把所有日剧本塞进 L3，拖垮上下文，也破坏「干活优先」。

第一性原理：

```
生活世界 = 按角色分桶的可暂停时间线；仅活跃推进；切换时有限追赶；截面只派生

├─ 推论组 A：真相存在哪
│     §二 剧本+事件是真相 · Moments/Assets 只派生 · §三 按 role 分桶
│
├─ 推论组 B：谁在动、谁静止
│     §四 仅 active tick · 非活跃完全暂停 · §五 Catch-up≤7 日
│
└─ 推论组 C：和对话/干活的边界
      §六 生活不挡 Loop · §七 Prompt 只吃薄摘要
```

> **前置边界**：本章管「日子怎么过」；朋友圈/衣柜的产品语义见 M24/M25；名册见 M26。M23 只钉世界引擎与暂停哲学。

---

# 推论组 A：真相存在哪

## 二、单一真相：日剧本 + 事件；截面不得另起炉灶

最小世界推进单元：

| 层 | 是什么 | 谁写 |
|----|--------|------|
| DayScript | 某 role 某日的 theme + 时间槽草案 | Script Planner（现 mock，可换 LLM） |
| Event | 槽位物化：planned → published | Tick / Catch-up |
| Moments / Assets | 朋友圈帖、衣柜引用 | **投影**自事件，不是第二真相库 |

判据：朋友圈一条删了，若事件还在，世界仍在；若只有 UI 帖没有事件，那是假世界。  
**禁止** Moments/Assets 反向发明「没发生过的生活」。

## 三、按 roleId 分桶；宇宙资产与用户态分离

- 仓库资产：`universes/*/roles/*`（Identity）  
- 用户态生活：`companion_role_state` / `day_scripts` / `events`… **一律挂 roleId**  
- 用户全局：`activeRoleId`、记忆画像  

换主角 = 换时间线视角，不是把三个人的日子搅进同一张表乱写。

---

# 推论组 B：谁在动、谁静止

## 四、仅活跃 tick；非活跃完全暂停

产品硬约束（与世界框架一致）：

- 同时只有一个 `activeRoleId` 接管聊天 + 生活推进  
- `tickActiveRole` **只**处理当前 active；非活跃写 `paused_at`，**不** `ensureDayScripts`、不发布事件  
- 异常：active 仍带 `paused_at` → tick 跳过，等 resume/Catch-up（避免「半暂停还在长」）

这不是省电小优化，是关系诚实：你没选中的人，时间线冻结在切走那一刻。

## 五、Catch-up：细补最近 ≤7×24h，更早只概况

完整切换回曾暂停角色时：

```
fineStart = max(pausedAt, now - 7×24h)
若 pausedAt < fineStart → 写一条「期间概况」摘要（不逐日生成）
对 [fineStart, now] → ensureDayScripts + 发布/投影
清除 paused_at
```

Why 7 日：细补太长贵且无感；太短则「休假一个月回来像失忆」。7 日是可测的产品冻结值。  
约束：**不在打开瞬间伪造「正在发生」**——时间戳落在合理过去点；概况用规则模板即可（LLM 摘要是增强）。

---

# 推论组 C：和对话/干活的边界

## 六、生活不挡 Agent Loop

- Ticker：启动即 tick 一次，之后约 5 分钟间隔；失败只打日志  
- Catch-up：挂在换角事务上，可异步；不阻塞工具执行与权限链  
- 剧本生成：**活跃当日 prefer LLM**（M23-G1），失败/无 key → 哈希；Catch-up 细补默认哈希，避免换角连打多日 LLM

干活（写代码、查文件）的优先级永远高于「她中午吃了什么」的生成精致度。

## 七、Prompt 只吃薄切片

组装时注入的是：

- Catch-up 概况摘要（若有）  
- 名册短句、必要在场信息  

**不是**整段 day_scripts JSON。完整事件留给 Moments UI / 调试；对话只要「她最近大概怎样」，避免上下文被生活淹没。

召唤子会话：装载对方 Pack，**不** tick 对方生活、**不**跑对方 Catch-up——串门不推进别人的日子（与 M22 召唤不成长一致）。

---

# 第二部分：实战记录

## 做了什么（W2–W3）

| 项 | 落点 |
|----|------|
| pause / resume / ensure / tick | `life/engine.ts` |
| 定时推进 | `life/ticker.ts` |
| 确定性剧本 | `life/script-generator.ts` |
| Catch-up ≤7 日 | `life/catchup.ts` |
| 事件→圈/衣柜挂接 | `moments.ts` / `assets.ts`（详章 M24/M25） |
| 换角事务 | `orchestrator` 调 pause + runCatchup |

## 弯路与取舍

1. **先 mock 剧本再 LLM**：没有稳定时间线纪律时，LLM 只会制造更贵的谎言。  
2. **Catch-up 概况用规则串**：W3 验收「有摘要、有细窗」即可；漂亮叙事后置。  
3. **Life 不 import orchestrator**：active 从 settings + identity 解析，打破循环依赖。

## 与相邻章

| 章 | 关系 |
|----|------|
| M21/M22 | 人是谁、怎么成长；本章是「日子」 |
| M24/M25 | 截面派生规则 |
| M26 | 名册不进生活真相 |
| M01 | Loop 不感知剧本细节，只吃组装结果 |

## 自检问题

1. 非活跃角色还会不会悄悄多出 script/event？  
2. 切换后细补天数有没有超过 7？更早是不是只有概况？  
3. Moments 能不能在没有事件的情况下「发明」动态？  
4. tick 失败会不会拖垮主进程 / 挡工具？  
5. 召唤聊天有没有误推进对方生活？

## 暂缓 Gap（同步 wishlist）

| ID | 内容 | 处置 |
|----|------|------|
| M23-G1 | 日剧本换 LLM 生成器（现哈希 mock） | ✅ 2026-08-02 |
| M23-G2 | 世界状态加厚（居所/时区/短期情境结构化） | 暂缓 |
| M23-G3 | Catch-up 概况改 LLM 叙事 | 暂缓 |

代码走读见 `m23-world-architecture-code.md`。
