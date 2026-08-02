# M31 主动在场代码走读

> 对应 `m31-proactive-presence.md`。

---

## 一、模块地图

```
src/shared/companion-presence.ts  # buildColdStartCopy
companion/presence.ts             # re-export
companion/life/ticker.ts          # 活跃推进（无 UI 推送）
companion/life/moments.ts         # 截面内容
companion/cast/availability.ts    # describeCastPresence（召唤查询）
agent/runtime.ts                  # sendDesktopNotification（失焦回复）
欢迎屏 / MomentsPanel / AssetsPanel / CastPanel
```

---

## 二、打开即在场

```
buildColdStartCopy(activeRole meta) → 欢迎屏
hint: 聊天、朋友圈和衣柜都跟着当前主角；对话进行中不能换人
```

---

## 三、静默推进 vs 触达

| 机制 | 是否推送 UI |
|------|-------------|
| life ticker → publish moments | 否（用户打开面板才见） |
| 桌面 Notification | 是（失焦 + 有回复正文） |
| 定时问候 | 无 |

---

## 四、约束速查

| 约束 | 落点 |
|------|------|
| 内容派生 World | moments/assets 非独立编造 |
| 欢迎文案一致 | shared 模块 |
| 不挡 Loop | ticker catch 日志 |
| 主动推送预算 | 未做 → M31-G1/G2 |

---

## 五、已知简化

- 无「新动态」轻提示（M31-G1）  
- 无勿扰时段（M31-G2）  
- 无定时问候（M31-G3）  
