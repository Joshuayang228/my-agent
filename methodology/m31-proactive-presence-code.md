# M31 主动在场 — 代码走读

> 理念章：[`m31-proactive-presence.md`](./m31-proactive-presence.md)
> 最近核对：2026-08-16

## 一、Presence

`companion/presence.ts` 判断应用/窗口是否适合提示。主动在场不是无条件推送。

## 二、Moment 轻提示

`moment-tips.ts` 检查静音、15 分钟冷却、22–8 默认勿扰、每日默认最多 3 条和当天计数。提示只发新 Moment 摘要，不暴露私密回复正文。

## 三、主动问候

`proactive-greeting.ts` 默认关闭；启用后仍需每日一次、勿扰、Presence 和角色状态门闸。Runtime/Scheduler 执行时继续遵守 Headless 工具策略。

## 四、测试证据

`moment-tips.test.ts`、`proactive-greeting.test.ts`、`companion-presence.test.ts`。

## 五、当前缺口

没有云推送、多设备协调或复杂打扰学习；主动策略仍以明确规则为主。
