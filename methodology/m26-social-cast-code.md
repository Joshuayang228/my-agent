# M26 交际圈与卡司 — 代码走读

> 理念章：[`m26-social-cast.md`](./m26-social-cast.md)
> 最近核对：2026-08-16

## 一、Roster 与 Role Pack

`companion/cast/` 从当前 universe 读取卡司，生成 roster line、availability 和 summon brief。卡司角色拥有自己的 Role Pack，但不会自动成为 active protagonist。

## 二、召唤会话

`startSummonSession()` 绑定目标 role，不改 activeRoleId，也不恢复对方生活时钟。召唤对话与主会话有 sessionKind 边界；匿名子 Agent 任务工不能冒充卡司朋友。

## 三、委派边界

召唤会话可按规则委派任务，但子 Agent system addon 明确“任务工不是卡司人设”，最终结果由当前角色转述。

## 四、测试证据

`companion-cast.test.ts`、`companion-summon.test.ts`、`companion-availability.test.ts`、`summon-delegation.test.ts`。

## 五、当前缺口

没有卡司之间自治群聊、长期多人关系图或云端共同世界。
