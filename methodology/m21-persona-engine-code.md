# M21 人格引擎与 Role Pack — 代码走读

> 理念章：[`m21-persona-engine.md`](./m21-persona-engine.md)
> 最近核对：2026-08-16

## 一、Role Pack 是身份事实源

`companion/identity/loader.ts` 从 universe/role 资产加载具名角色；`profile.ts` 校验并格式化人物档案、表达基线和默认世界。当前不再使用 warm-partner / rigorous-advisor / tech-geek 三个抽象模板。

Role Pack 包含：manifest、PROTECTED、MUTABLE 默认值、profile、worldDefaults、voice、asideStyle 与场景资产。缺失或损坏资产 fail-closed，不能靠角色名自动推导职业或世界观。

## 二、PROTECTED 与 MUTABLE

`rolePackToPromptParts(pack, mutableBody)`：PROTECTED 永远来自 Pack；MUTABLE 先取按 role 持久化覆盖，没有覆盖才用 `mutableDefault`；voice 作为同一可变表达层追加。运行时不能修改 PROTECTED。

## 三、统一装配

`companion/orchestrator.ts` 是 activeRoleId、universeId、MUTABLE、世界薄片、catch-up、Moment、书架和 roster 的统一装配入口。Runtime 不应分别读取这些 store 再自行拼 Prompt。

## 四、会话绑定

Session 保存 role_id。`assertSessionRole()` 发现当前 active role 与会话绑定角色不一致时，不会静默换人格。切换主角走 `requestSwitch()`：暂停旧角色、写 activeRoleId、对新角色 catch-up/resume。

## 五、System Prompt

`prompt-builder.ts` 以中文组装：PROTECTED + 防注入、人物档案、默认世界、MUTABLE、能力/工作方法、关系/语气/专家度、Skill、用户画像/记忆/世界/Moment/资产/卡司、日期和中文尾锚点。精确时间由 Loop 临时追加到本轮 user message。

## 六、测试证据

`companion-role-profile.test.ts`、`companion-session-role.test.ts`、`prompt-builder.test.ts`、`prompt-registry.test.ts`、Role Pack loader 测试覆盖资产校验、角色隔离和 Prompt 装配。

## 七、当前缺口

没有自动生成新人格、自动改 PROTECTED 或无门槛长期演化；这些仍是愿景。
