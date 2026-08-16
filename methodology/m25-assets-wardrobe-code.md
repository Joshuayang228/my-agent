# M25 资产层：衣柜与书架 — 代码走读

> 理念章：[`m25-assets-wardrobe.md`](./m25-assets-wardrobe.md)
> 最近核对：2026-08-16

## 一、资产与 Moment 分离

`life/assets.ts` 定义角色资产，`grant-asset.ts` 负责授予，`companion/asset-registry.ts` 提供生产目录。Moment 可引用资产，但删除 Moment 不删除资产；删除资产后旧 Moment 只能降级展示，不能反向重建资产。

## 二、Starter 与用户状态

Role Pack/生活 starter 定义初始衣柜和书架；数据库保存当前持有状态。静态注册表展示定义、来源、版本和 fingerprint，不读取用户运行数据。

## 三、Prompt 薄片

Orchestrator 只注入有限书架/衣柜摘要，避免把完整资产库塞进 System Prompt。

## 四、测试证据

`companion-assets.test.ts`、`bookshelf-slice.test.ts`、资产注册表测试。

## 五、当前缺口

没有交易、跨角色赠送、云同步或复杂库存经济。
