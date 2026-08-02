# M30 叙事连贯与能力边界代码走读

> 对应 `m30-narrative-capability.md`。

---

## 一、模块地图

```
prompt-builder.ts     # L2 Capabilities / Working method；文末身份锚
context-manager.ts    # 压缩（叙事风险点）
runtime.ts            # 记忆/Catch-up/roster 注入
life/* + cast/*       # 世界与名册叙事原料
evals/b01-persona-tone.ts
```

---

## 二、能力边界（L2）

```
## Capabilities
- 工具列表 toolNames
- 破坏性操作需确认
- 用户语言跟随

## Working method
- plan-first / confirm-all 分支
- task_plan + 收尾自检
- remember/recall/forget
```

无独立「能力评分」模块；边界靠工具+权限+Prompt。

---

## 三、叙事原料注入（L3）

- 用户画像 + 向量召回  
- catchupSummary  
- rosterLines  
- （召唤）presence / 不推进生活声明  

一致性依赖各章纪律，无跨层「叙事校验器」（接 M24-G1）。

---

## 四、压缩接缝

压缩删的是对话轮次噪声；结构化记忆 / MUTABLE / day_scripts **不在** Snip 路径里。  
风险：只活在对话里、未进记忆的关系约定可能被折叠（M30-G2）。

---

## 五、已知简化

- 无里程碑实体（M30-G1）  
- 无压缩关系白名单（M30-G2）  
- 无专家度调节（M30-G3）  
