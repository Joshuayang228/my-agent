# 施工合同：体验调试（Debug / Playground）

> 状态：**已落地**（Phase 0–2：G1–G5；G6–G8 仍暂缓）  
> 日期：2026-08-04  
> 上位：[`methodology/m32-experience-debug-playground.md`](../../methodology/m32-experience-debug-playground.md)  
> 参考：Alice `/debug` · `/playground` · `enableDebugMode`（本地 `alice-source/_extract/`）

---

## 1. 需求背景（Why）

DevPanel 已有 Prompt 查看、traces、单轮 LLM 试跑，但心智仍是「侧栏杂项」：

- Debug（透视真相）与 Playground（安全试错）混在同一排 tab  
- 工具只有注册表，不能走真实权限路径手测  
- Prompt 试验虽可不写 settings，但缺少「载入当前实装 → 会话覆盖」工作流

目标：让产品作者能**看清生产实装**、在隔离场里**试 Prompt / 试工具**，不污染真会话与全局设置。

---

## 2. 功能目标（What）— Phase 0

| ID | 目标 | 验收 |
|----|------|------|
| **G1** | DevPanel 显式拆成 **Debug / Playground** 两面 | 顶层两键切换；Debug 面只读透视；Playground 面只放试验 |
| **G2** | 工具手测 | 选工具 → JSON 参数 → 执行；走 Registry + 权限检查；deny 不可绕过；需确认/破坏性工具必须勾选「确认风险」 |
| **G3** | Prompt 会话级覆盖 | Playground 可「载入当前实装」到编辑器；试跑只用该文本；**不写** `settings.systemPrompt`；UI 标明仅本次有效 |

### 不做（Phase 0）

- G4 世界态树、G5 色板 Storybook、G6 错误卡夹具、G7 对话内 debugMode 叠加、G8 aside 预览  
- 独立 `/debug` `/playground` 路由（可仍用侧推 DevPanel）  
- Webhook / 狼人杀等 Alice 产品专属 tab  

---

## 2b. Phase 1 — G4 世界态透视

| ID | 目标 | 验收 |
|----|------|------|
| **G4** | Debug 面「世界态」tab + 聚合只读 IPC | 一眼看到活跃角色、MUTABLE、world 薄片、今日剧本、近 Moments、画像/近记忆；长字段截断；无 API Key |

**不做（Phase 1）**：完整 Alice 生活树编辑、写操作。

IPC：`debug:world-snapshot` → `buildDebugWorldSnapshot()`（截断：记忆≤20、Moments≤10、MUTABLE≤2k 等）。

---

## 2c. Phase 2 — G5 设计 token 场

| ID | 目标 | 验收 |
|----|------|------|
| **G5** | Playground「设计 token」tab | 展示当前主题颜色 / radius / motion；基础按钮·输入样例；无完整 Storybook |

**不做（Phase 2）**：G6 错误卡夹具全家桶、G7 对话叠加、G8 aside 预览。

---

## 3. 技术方案（How）

### 3.1 UI（`src/components/DevPanel.tsx`）

```text
[ Debug | Playground ]     ← surface
Debug:     Prompt实装 | 世界态 | 系统 | 调用链 | 事件
Playground: Prompt试验 | 工具手测 | 设计 token
```

文案纪律：Debug Prompt =「生产实装（只读）」；Playground =「会话覆盖，不写设置」。

### 3.2 IPC（三处同步）

| Channel | 行为 |
|---------|------|
| 已有 `debug:system-prompt` / `playground-run` / `tools` / … | 保持 |
| 新增 `debug:tool-run` | `{ name, args, confirmRisk? }` → 权限检查 → `registry.executeAll`；返回结果 / needsConfirmation / deny |

`ToolContext`：`sessionId: 'debug-playground'`，`workdir: getWorkspaceRoot() \|\| cwd`。

权限：

1. `checkToolPermission(name)` — deny 直接拒绝  
2. `shell_exec` 另跑 `checkCommandPermission`（读当前 sandbox 设置）— deny 拒绝  
3. `needs_approval` 或 `isDestructive` → 无 `confirmRisk` 则返回 `needsConfirmation`，不执行  

### 3.3 依赖方向

`ipc/debug` → `tools/registry`、`sandbox/permission-engine`、`agent/playground`；**不**反向依赖 `ipc/`。

---

## 4. 影响范围

| 区域 | 影响 |
|------|------|
| 前端 | DevPanel 重构 tab IA |
| 主进程 | `debug.ts` + 可选 `debug-tool-run` 辅助 |
| preload / types | `electronAPI.debug.toolRun` |
| 测试 | 权限门闸 + args 解析单测（不 Mock 真 LLM） |
| 文档 | wishlist 勾 G1–G3；progress / changelog；本合同收尾标已落地 |

破坏性：无；Dev 专用 IPC，不影响主聊天路径。

---

## 5. 实施步骤

1. 写本合同（本文件）  
2. 主进程 `debug:tool-run` + 单测  
3. preload + `vite-env.d.ts`  
4. DevPanel 两面 IA + Prompt 载入实装 + 工具手测 UI  
5. `tsc` + `npm run test`；文档收尾  

---

## 6. 风险与权衡

| 风险 | 缓解 |
|------|------|
| Dev 手测误伤本机 | deny 不可绕过；破坏性/ask 强制 confirmRisk；结果区展示 permission chain |
| 用户误以为覆盖了全局 Prompt | 固定警告文案；不提供「写入设置」按钮（本 Phase） |
| DevPanel 文件变胖 | 本 Phase 仍单文件；若 >500 行再拆子组件（不阻塞验收） |
