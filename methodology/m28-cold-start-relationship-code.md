# M28 冷启动与关系阶段代码走读

> 对应 `m28-cold-start-relationship.md`。

---

## 一、模块地图

```
src/shared/companion-presence.ts   # buildColdStartCopy（主/渲染共用）
companion/growth/reflection-gate.ts # 72h / 24h / ≥5 msgs
companion/growth/reflection-service.ts # ensureGrowthStartedAt
companion/orchestrator.ts          # switch 门控、会话 role_id
agent/runtime.ts                   # assertSessionRole 组装
欢迎屏 / SettingsPanel             # 文案与反思说明
```

---

## 二、欢迎文案

```
buildColdStartCopy({ name, description })
  → title: 嗨，我是{name}
  → subtitle: description
  → hint: 聊天/圈/柜跟当前主角；对话中不能换人
```

纯函数、无 I/O；换角后空会话重读 active 角色元数据即可。

---

## 三、成长冷启动门闸

```
shouldReflectNow(roleId)
  growthStartedAt = settings.companionGrowthStartedAt
  if now - growthStartedAt < 72h → cold-start-72h
  if now - lastRunAt < 24h → cooldown
  if userMsgs(7d, roleId) < 5 → insufficient-messages
  force → 跳过以上（Settings 确认）
```

`ensureGrowthStartedAt`：首次对话路径打点，已存在则不改。

---

## 四、换角 / 会话（与冷启动交界）

- 流式中 `requestSwitch` → 拒绝  
- 成功切换：pause + activeRoleId + Catch-up（M23）  
- `sessions.role_id` 创建时写入；组装 `assertSessionRole`  
- **不**在 switch 时重置 `companionGrowthStartedAt`

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 欢迎与主进程文案一致 | shared companion-presence |
| 72h 内不自动反思 | reflection-gate |
| 禁中途换角 | orchestrator + streaming-gate |
| 无阶段枚举 | Gap M28-G1 |

---

## 六、已知简化

- 无 relationshipStage 状态机（M28-G1）  
- 熟悉度不区分交心/干活（M28-G2）  
- 换角无专门「再认识」微文案（M28-G3）  
- 成长时钟全局：M22-G1  
