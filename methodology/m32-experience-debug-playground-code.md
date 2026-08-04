# M32 体验调试 — 代码走读

> 对照 [`m32-experience-debug-playground.md`](m32-experience-debug-playground.md)。  
> 本轮**无新模块**——展示 Alice 三面在源码中的落点，以及我们 DevPanel 薄实现如何对应（或尚未对应）各推论。  
> 源码：`_reference/framework-harness/repos/alice-source/`（asar 抽出的 renderer + 已解主进程）× `src/components/DevPanel.tsx`

---

## 推论组 A：三面分工

### §二 Alice：两条路由，不是一个大杂烩

主壳路由（minify 后仍可读）：

```javascript
// alice-source/_extract/index-ppRSWnkN.js（节选语义）
// path:"/playground" → Yi   （来自 page-playground-*.js）
// path:"/debug"      → ZM() （Debug Console，定义在主壳内）
```

Playground 侧栏 tab 清单（同一文件内的配置数组，语义还原）：

```text
icons | design-system | components | chat | model | tools | skills | mcp
| permission | illustrations | error-card | face-reading | multi-agent
| context | otel | prompts | memory | ququ | suggestions | onboarding
| …（产品专属 tab 略）
```

Debug Console `ZM()` 按产品域分组（不是按「工程师喜欢的文件树」）：

```text
内核: promptManager, dayScript, recentEvents, activityLog
生活: diary, location, livingSpace, moment, interests, thoughts
社交: letters, messages
资产: wardrobe, items, sharedMemory, lifeLedger, avatarGallery, coverGallery
用户: aliceTodo, context, userProfile, userMemory
系统: skillsTools, opcRelations, llmLogs, system
```

→ 理念章 §二：透视（Debug）与试验（Playground）心智分离；入口可以都在侧栏。

### §三 调试开关与侧栏入口

```javascript
// 语义还原自主壳 store / 侧栏
// enableDebugMode / debugActivated / developerModeUnlocked
// 侧栏：onClick → navigate("/debug")，title: "Debug Console"
```

对话气泡区域同时解构 `showThinking`、`showToolCalls`、`enableDebugMode`、`debugActivated`、`showTokenStats`——调试态是**叠加字段**，不是替换整个 Chat 路由。

→ 理念章 §三。

### §四 我们：DevPanel 已拆两面（Phase 0）

```typescript
// App activeView: 'debug' | 'playground' → 主区全页 DevPanel(surface=…)
// 侧栏双入口；不再右侧抽屉嵌套
// Debug:     prompt | world | system | traces | events
// Playground: prompt-lab | tool-run | tokens
```

对照：

| Alice | 我们现状 | Gap |
|-------|----------|-----|
| `/debug` 世界态树 | Debug「世界态」：角色/MUTABLE/world/剧本/Moments/记忆（只读截断） | G4 ✅；完整生活树仍薄 |
| `/playground` 试验+UI 场 | Prompt 试验 + 工具手测 + 设计 token；无完整 Storybook | G5 ✅；G6 错误卡仍缺 |
| debugMode 叠加 | Ctrl+Shift+D 开面板，无对话内叠加策略 | M32-G7 |

---

## 推论组 B：试验隔离

### §五 Prompt 试验：载入实装 + 会话覆盖

Playground「Prompt 试验」：`载入当前实装` → 编辑 System → `playgroundRun`。  
主进程仍走 `electron/main/agent/playground.ts`，**不写** `settings.systemPrompt`。

→ 理念章 §五；G3 已落地（单轮隔离；非完整多轮 PlayGround 会话）。

### §六 工具手测：`debug:tool-run`

```typescript
// electron/main/agent/debug-tool-run.ts
// preflight: checkToolPermission (+ shell_exec → checkCommandPermission)
// deny → 拒绝；needs_approval / isDestructive → 需 confirmRisk
// 通过 → registry.executeAll(..., { sessionId: 'debug-playground' })
```

→ 理念章 §六；G2 已落地。

---

## 推论组 C：体验夹具

### §七 / §八 色板与控件场

- 规范：`docs/agent-skills/frontend-guidelines.md` + CSS token（视觉语言合同已落地）  
- 产品内场：Alice 在 Playground `design-system` / `components`；我们**尚未**有对等页  

→ G5/G6；实施时施工合同应写清「只做 P0–P1 夹具，不复制狼人杀 tab」。

---

## 本地源码索引（给下一轮施工）

| 用途 | 路径 |
|------|------|
| Alice Playground 包 | `_reference/framework-harness/repos/alice-source/_extract/page-playground-*.js` |
| Alice 主壳（含 `/debug`） | `_reference/framework-harness/repos/alice-source/_extract/index-ppRSWnkN.js` |
| Alice 设置页（含开发者解锁文案） | `_extract/page-settings-*.js` |
| Alice 主进程数据面 | `alice-source/main-index.js`、`main-chunks/` |
| 我们 DevPanel | `src/components/DevPanel.tsx` |
| 我们 debug IPC | `electron/main/ipc/`（debug 相关）+ `src/vite-env.d.ts` `electronAPI.debug` |

查找技巧：asar 内路径用反斜杠键（`out\\renderer\\assets\\...`）；`asar list` 看得到、`extract-file` 要用 Node API 或反斜杠形式。
