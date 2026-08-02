# M27 对话行为与两空间代码走读

> 对应 `m27-conversation-two-spaces.md`。

---

## 一、模块地图

```
agent/prompt-builder.ts     # aside 协议 + executionMode 行为提示
agent/loop.ts               # 工具轮 Discarding companion text
agent/runtime.ts            # 召唤会话行为短声明
src/components/MarkdownRenderer.tsx  # splitAside 双栏渲染
Role Pack asideStyle        # universes/*/roles/*/（字段映射 aside_style）
```

---

## 二、aside 协议

```
buildSystemPrompt
  if persona.aside_style:
    ## Response format
    1. main — professional, helpful
    2. optional <aside>...</aside> — {aside_style}, one sentence, not every turn

rolePackToPromptParts: aside_style ← pack.asideStyle
```

UI：

```
splitAside(raw) → { main, asides[] }
ReactMarkdown(main)
asides → italic muted 小字
```

---

## 三、工具轮丢弃正文

```
if (toolCalls.length > 0) {
  // 不把 content 写入历史
  messages.push({ content: '', toolCalls })
  yield tool_calls
} else {
  messages.push({ content })
  yield done
}
```

目的：历史轨迹服务工具链，不为陪伴旁白买单。

---

## 四、相关行为提示（非独立引擎）

- `executionMode === 'plan-first'` → 先明文计划再工具  
- `confirm-all` → 提示每步需用户批  
- `task_plan` + 收尾自检段落（L2）  
- summon：`【召唤子会话】…不推进生活世界`

---

## 五、约束速查

| 约束 | 落点 |
|------|------|
| 两空间可拆 | `<aside>` + UI split |
| 工具轮历史干净 | loop 丢 content |
| 人设只染 aside 风格 | Pack.asideStyle |
| 不问/做状态机 | 规范层；Gap M27-G1 |

---

## 六、已知简化

- 无 ask/act 分类器（M27-G1）  
- 无 aside Eval（M27-G2）  
- 无情绪控制器（M27-G3）
