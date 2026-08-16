# M22 成长核：MUTABLE 与反思 — 代码走读

> 理念章：[`m22-growth-mutable.md`](./m22-growth-mutable.md)
> 最近核对：2026-08-16

## 一、按 role 持久化

`growth/mutable-store.ts` 保存 roleId、body、version、updatedAt；每次有效修改产生版本，可列历史、读取当前和回滚。旧全局成长时钟只作为迁移源。

## 二、校验边界

`mutable-validate.ts` 限制长度和结构，拒绝修改身份、价值观或安全边界的内容。MUTABLE 只能调整表达、协作偏好和关系中的行为默认值。

## 三、反思门

`reflection-gate.ts` 根据用户消息量、冷却、active role 和状态决定是否运行；`reflection-service.ts` 通过 TaskQueue 后台调用统一辅助模型配置，生成候选后校验再保存；`reflection-log.ts` 只记录结构化结果。

## 四、回滚

回滚不会改 Role Pack 默认值，只把某个历史 MUTABLE 版本恢复为当前；当前内容会继续保留版本证据。

## 五、测试证据

`companion-mutable.test.ts`、`companion-reflection.test.ts`、`relationship-stage.test.ts` 覆盖版本、校验、门闸、任务和角色隔离。

## 六、当前缺口

反思仍依赖模型输出；没有无监督持续学习，也不允许自动修改 PROTECTED。
