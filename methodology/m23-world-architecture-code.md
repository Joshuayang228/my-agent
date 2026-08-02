# M23 生活世界代码走读

> 对应 `m23-world-architecture.md`。

---

## 一、模块地图

```
electron/main/companion/life/
  engine.ts            # pause / resume / ensureDayScripts / tickActiveRole
  ticker.ts            # 启动 + 周期 tick（默认 5min）
  script-generator.ts  # DayScript：LLM + 哈希回退（M23-G1）
  world-codec.ts       # 世界状态编解码（无 IO）
  world-state.ts       # ensure / 情境刷新（M23-G2）
  catchup.ts           # ≤7×24h 细补 + 概况摘要
  store.ts             # role_state / day_scripts / events …
  moments.ts           # 到期发布 + 投影朋友圈
  assets.ts            # 衣柜挂接（moment 槽）
  dates.ts             # 本地日历日工具
```

换角：`orchestrator.requestSwitch` → `pauseRole(旧)` → 写 `activeRoleId` → `runCatchup(新)`。  
组装：`loadRoleAssembleInput` 带上 `catchupSummary` / `worldSlice`（若有）→ `prompt-builder` L3。

---

## 二、tick 数据流

```
startLifeTicker
  → tickActiveRole(now)
       resolveActiveRoleId()          # settings.activeRoleId + 校验
       若 paused_at != null → return  # 异常半暂停
       ensureDayScripts(today, today)
       publishAndProjectDue(roleId, now)
       touchLastTick
```

`ensureDayScripts` 可对任意 role 调用（供 Catch-up）；**日常 tick 只应对 active**。

---

## 三、Catch-up（catchup.ts）

```
CATCHUP_FINE_MS = 7 * 86400000
fineStart = max(pausedAt, now - CATCHUP_FINE_MS)
pausedAt < fineStart → setCatchupSummary(规则模板)
ensureDayScripts(fineStart日 … now日)
publishAndProjectRange(fineStart, now)
clearPausedAt + touchLastTick
```

单测应锁：天数上限、概况路径、不伪造「此刻正在发生」。

---

## 四、剧本物化

`resolveDayScript(roleId, date, { preferLlm })` → theme + slots → `insertDayScript` → 每槽 `insertEvent(planned)`；  
moment 槽可 `pickWardrobeAssetId` 写入 payload（派生引用）。  
`tickActiveRole`：`preferLlm: true`；`runCatchup` → `ensureDayScripts` 默认哈希。

---

## 五、约束速查

| 约束 | 代码落点 |
|------|----------|
| 仅 active tick | `tickActiveRole` + ticker |
| 非活跃暂停 | `pauseRole` / `paused_at` |
| ≤7 日细补 | `computeFineStart` / `CATCHUP_FINE_MS` |
| 不挡主进程 | ticker `.catch` 只打日志 |
| 无循环依赖 | life 不 import orchestrator |

---

## 六、已知简化

- 剧本文案：✅ 当日 LLM + 哈希回退（M23-G1）；Catch-up 细补仍哈希  

- Catch-up 摘要：✅ LLM 叙事 + 模板回退（M23-G3；Prompt 在 `catchup.ts`）  

- 世界状态：✅ `world_json` 居所/时区/情境（M23-G2）；Assemble `## World slice` 一行
