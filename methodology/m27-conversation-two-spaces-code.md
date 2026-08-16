# M27 对话行为与两空间 — 代码走读

> 理念章：[`m27-conversation-two-spaces.md`](./m27-conversation-two-spaces.md)
> 最近核对：2026-08-16

## 一、主答与 Aside

`src/shared/aside.ts` 解析 `<aside>...</aside>`，主答负责办事，aside 只提供一句轻量内心声。`MarkdownRenderer.tsx` 使用同一解析器展示，避免 Eval 和 UI 各写一套规则。

## 二、质量边界

aside 有长度、频率和内容限制：不能放代码块、多步说明或替代主答；连续过多会判为“过油”。Mermaid 使用 strict securityLevel。

## 三、回复立场与语气

`reply-stance.ts` 根据用户情绪/任务信号给启发式立场；`tone-control.ts` 调整表达收放。两者是 Prompt hint，不改变身份、工具权限或安全边界。

## 四、测试证据

`aside-quality.test.ts`、`conversation-debug.test.ts`、`resolve-tools-for-message.test.ts` 和 Renderer E2E。

## 五、当前缺口

Aside 质量仍需真实 Persona Eval 和人工审阅持续校准。
