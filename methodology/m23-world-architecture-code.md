# M23 生活世界架构 — 代码走读

> 理念章：[`m23-world-architecture.md`](./m23-world-architecture.md)
> 最近核对：2026-08-16

## 一、角色状态

`life/store.ts` 按 role 保存 world_json、pausedAt、lastTick、catchupSummary、DayScript、Event 和 Moment。`world-state.ts` 负责 Schema、默认值和损坏数据重置；旧三字段世界状态不迁移为虚构新事实。

## 二、时钟

`ticker.ts` 推进 active role 的生活时间；`engine.ts` 生成/发布到期事件；切换角色时旧角色 pause，新角色 resume。后台 tick 不直接写聊天消息。

## 三、离线 Catch-up

`catchup.ts` 根据 pausedAt 到当前时间计算离线跨度，生成有限摘要和到期事件；跨度和输出有上限，不能逐分钟模拟。结果进入世界薄片和 Moment，不修改用户会话历史。

## 四、Prompt 入口

Orchestrator 只注入当前角色的世界切片、catch-up 和近期生活证据；默认世界来自 Role Pack，当前地点/活动以运行状态为准。

## 五、测试证据

`companion-life.test.ts`、`companion-catchup.test.ts`、`world-state.test.ts`、`world-hub.test.ts`。

## 六、当前缺口

世界模拟是本地有限状态，不是开放式自治世界；复杂经济、多人同步和无限事件生成不在当前能力内。
