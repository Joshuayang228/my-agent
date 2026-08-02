# 自动反思写 MUTABLE — 短需求

> 状态：**已落地**（2026-08-02）。索引见 [README.md](./README.md)。  
> 对照 Alice `PersonaReflectionService` + `runPersonaReflection`，自研落地。

## Why

MUTABLE 已有存储/版本/手动 UI，但缺少「低频从互动里固化默契」的管线——人格只会手动改，不会随相处微调。

## What（本轮）

1. **门闸**（按 `roleId` 分桶）  
   - 冷启动：`companionGrowthStartedAt` 起不满 **72h** → skip  
   - 冷却：该角色上次反思起不满 **24h** → skip  
   - 信号：近 **7 日** 该角色会话用户消息 **≥ 5** 条，否则 skip  
2. **触发**：主对话结束后后台入队 `persona-reflection`（与 profile-extract 同级）；门闸内静默跳过  
3. **Runner**：aux/主模型 LLM；输入 = 当前 MUTABLE + 近 7 日用户消息摘要 + PROTECTED 摘要（防漂移）+ feedback 记忆；输出 JSON `{ newMutable, summary }`；`null` = 不改但仍记 lastRun  
4. **写入**：`setMutable`（已有版本历史）；**绝不写 PROTECTED / Pack 文件**  
5. **手动**：设置页「立即反思」；可选 `force` 跳过门闸（仍要求有 API key）  
6. **范围**：仅 **activeRoleId**（召唤子会话不触发反思）

## 非目标

- 不自动改 PROTECTED  
- 不写完整方法论章（另开对齐）  
- 不接 Alice worldFacts 全量；本轮用记忆 feedback + 用户消息即可  

## 验收

- [x] 单测：门闸 72h/24h/消息不足  
- [x] 单测：runner 返回 null 只记 log 不写 mutable  
- [x] 单测：返回正文则 `setMutable` 版本 +1  
- [x] 设置页可看上次反思时间并手动触发  
