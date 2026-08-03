# M31 主动在场代码走读

> 对应 `m31-proactive-presence.md`（加厚修订版）。按理念节号对照。

---

## §二 对照：在场层级落点

| 层级 | 代码 | 是否推 UI |
|------|------|-----------|
| L0 | `life/ticker.ts` → `tickActiveRole` → `publishAndProjectDue` | 否 |
| L1 | `buildColdStartCopy` + Moments/Assets/Cast 面板 | 用户打开才见 |
| L2 | `moment-tips.ts` → `companion:moment-tip` → App toast | ✅ 可静音 |
| L3 | `runtime.sendDesktopNotification` | 失焦 + 有回复正文 |
| L4 | — | 未做（M31-G3） |

**发现**：L0 与 L1 分离，让「日子在过」不必等于「吵你」。

**方法论对照**：→ §二

---

## §三 对照：打开即在场

### 我们的实现

```text
src/shared/companion-presence.ts
  buildColdStartCopy({ name, description })
    → title / subtitle / hint

electron/main/companion/presence.ts
  re-export（主进程与单测进口）

渲染：欢迎屏读 active 角色元数据后调用同一函数
```

| 字段 | 作用 |
|------|------|
| title | 身份招呼 |
| subtitle | Pack description |
| hint | 圈柜绑定 + 禁中途换角（产品纪律的人话版） |

**发现**：纯函数、无 I/O——在场文案不依赖 DB，换角即时一致。

**方法论对照**：→ §三

---

## §四 对照：截面内容

| 截面 | API / 模块 |
|------|------------|
| Moments | `companion:get-moments` ← `listMomentsForRole(active)` |
| Assets | `companion:get-assets` |
| Catch-up | 组装进 Prompt 的 summary；非推送 |

均按 active 过滤；非活跃不 tick → 不刷圈。

**方法论对照**：→ §四

---

## §七 对照：查询式 presence

### 我们的实现（`cast/availability.ts`）

`describeCastPresence(roleId)` / `checkCastAvailability`：

- 可读 day_script / events 生成「在忙什么」  
- **不** `resume` / **不** `tick`  
- 供召唤前 UI 与 Prompt 情境  

与推送式在场完全不同路径。

**方法论对照**：→ §七

---

## §六 / §十 对照：桌面通知（干活线）

```text
runtime.sendDesktopNotification(assistantContent)
  窗口存在且 !focused 且 Notification 支持
  → 标题 My Agent，body 截断回复
```

触发于**对话完成**，不是 moment publish。  
生活线 L2 走应用内 toast（见下），故意不复用桌面 Notification。

**方法论对照**：→ §六 §十

---

## §五 对照：L2 Moment 轻提示（M31-G1）

```text
tickActiveRole
  → publishAndProjectDue
  → maybeNotifyNewMoments(roleId, published)
       muted / published<=0 / 无文案 / 15min 冷却 → 跳过
       else broadcast companion:moment-tip { toast }
App: onMomentTip → useToast
设置：companionMomentTipsMuted
```

**发现**：内容预览来自已投影 Moment，不另造文案；失败不阻断 tick。

**方法论对照**：→ §五、§二 L2

---

## L0 失败隔离

```text
ticker: tickActiveRole(...).catch(err => log.warn)
```

不抛到 Electron 主进程致命路径——在场不得绑架干活运行时。

**方法论对照**：→ §十、检查清单 5

---

## 已知简化

| Gap | 代码 |
|-----|------|
| M31-G1 | ✅ `moment-tips` + 静音 + 冷却 |
| M31-G2 | 无 quiet hours 配置 |
| M31-G3 | 无 cron 问候任务 |
