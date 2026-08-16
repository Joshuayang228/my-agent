# M28 冷启动与关系阶段 — 代码走读

> 理念章：[`m28-cold-start-relationship.md`](./m28-cold-start-relationship.md)
> 最近核对：2026-08-16

## 一、关系阶段

`growth/relationship-stage.ts` 用按角色的交互证据推导保守阶段；阶段是 Prompt hint，不是用户标签或权限。切换主角不会继承另一角色阶段。

## 二、冷启动

新角色使用 Role Pack 默认身份/世界和初始 MUTABLE；成长时钟按 role 开始。没有足够证据时不制造亲密历史。

## 三、反思门与会话绑定

关系阶段参与 reflection gate，但不能单独触发反思。Session role_id 防止 activeRole 切换后旧会话人格漂移。

## 四、测试证据

`relationship-stage.test.ts`、`companion-session-role.test.ts`、`companion-reflection.test.ts`。

## 五、当前缺口

阶段是代理指标，不是心理诊断；没有面向用户展示的精确“亲密等级”。
