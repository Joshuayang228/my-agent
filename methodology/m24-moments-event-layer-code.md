# M24 Moment 与事件层 — 代码走读

> 理念章：[`m24-moments-event-layer.md`](./m24-moments-event-layer.md)
> 最近核对：2026-08-16

## 一、事件到 Moment

`life/moments.ts` 把可公开生活事件转成 Moment；不是所有内部 tick 都可发布。`moment-consistency.ts` 校验角色、时间、事件和资产事实，拒绝从文案反推未存在的世界事实。

## 二、展示与互动

`moment-format.ts` 生成 Prompt/列表薄片；`moment-polish.ts` 只润色展示，不改变事实；`moment-interactions.ts` 记录用户互动；`moment-tips.ts` 决定是否发送轻提示。

## 三、幂等

事件和 Moment 有独立 ID/状态；发布后标记，重启不会重复生成同一条。互动不会修改原 Moment 正文。

## 四、测试证据

`moment-consistency.test.ts`、`moment-interactions.test.ts`、`moment-polish.test.ts`、`moment-tips.test.ts` 及其他 `moment-*` 测试。

## 五、当前缺口

Moment 仍由有限模板/模型润色产生；没有社交网络推荐算法或云端动态流。
