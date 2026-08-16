# M29 信息不对称与记忆透明 — 代码走读

> 理念章：[`m29-asymmetric-memory.md`](./m29-asymmetric-memory.md)
> 最近核对：2026-08-16

## 一、三种视图

用户记忆面板展示可管理条目；Runtime 获取为当前角色/请求筛选后的画像与召回；Debug 只展示策略、计数和资产证据。三者不是同一 payload。

## 二、敏感与角色边界

敏感记忆有标识；feedback 按 role 分桶；普通用户事实可共享。记忆正文不进入资产目录、普通日志或 LLM Debug。

## 三、纠错

`memory:correct-citation` 支持删除、更新和替换，并同步向量索引。用户纠正优先于模型猜测。

## 四、测试证据

`citation-correct.test.ts`、`sensitive-memory.test.ts`、`memory-feedback-role.test.ts`、`memory-tools.test.ts`。

## 五、当前缺口

没有逐条展示“本次回答引用了哪条记忆”的普通用户解释面；当前主要在 Debug 和引用纠错入口提供证据。
