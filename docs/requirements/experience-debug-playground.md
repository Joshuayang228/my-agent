# 施工合同：体验调试（Debug / Playground）

> 状态：**已落地**（Phase 0–6：Debug 五域 + 真实上下文 / LLM 日志 / 世界时间线 / 工具清单）
> 日期：2026-08-04（Phase 6：2026-08-09）
> 上位：[`methodology/m32-experience-debug-playground.md`](../../methodology/m32-experience-debug-playground.md)  
> 参考：Alice `/debug` · `/playground` · `enableDebugMode` / `showTokenStats` / `showToolCalls` / `showThinking`

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

## 2d. Phase 3 — 独立全页入口（对齐 Alice）

| 目标 | 验收 |
|------|------|
| Debug / Playground **各为侧栏独立入口** | 不再嵌在聊天右侧抽屉；进入后占主内容区（同 Moments/记忆） |
| 两页心智分离 | 各页标题即身份；可提供「去另一页」弱链，但不是顶栏二选一嵌套壳 |
| 快捷键 | Ctrl+Shift+D → Debug 全页；Ctrl+Shift+P → Playground 全页（与 Alice 双入口一致） |

**不做**：真实 URL 路由 `/debug`（Electron 无 React Router 时用 `activeView` 即可）；Alice 生活树全量 tab。

---

## 2e. Phase 4 — G7 对话内 debugMode 叠加

> **与全页 Debug / Playground 无关**：侧栏入口仍是透视台 / 试验场；本 Phase 只改**主聊天**在开关打开后的信息密度。

| ID | 目标 | 验收 |
|----|------|------|
| **G7** | 设置 + 聊天底栏可开关 `conversationDebugMode`（默认关） | 关掉后主聊天仍像产品；打开后叠加调试层 |
| G7a | Token / 上下文常显 | 有 usage 时显示用量条（非仅 hover）；有 session 预算则显示占比 |
| G7b | 工具可审计 | debug 开：工具卡完成后默认展开；展示 args；本轮结束后保留工具卡；消息流可见 `role=tool` |
| G7c | 事件条 | 可折叠「本会话事件」：tool / usage / compact / error 等短日志 |
| G7d | Thinking | 打开 debug 时默认展开 reasoning |

**不做（Phase 4）**：G6 错误卡夹具全家桶；G8 行内 aside；把全页 Debug 嵌回聊天抽屉。

设置键：`conversationDebugMode` = `'true' | 'false'`（`AppSettings`，默认 `'false'`）。

---

## 2f. Phase 5 — 需要才补（不硬堆）

| 目标 | 验收 | 不做 |
|------|------|------|
| Debug「系统」补全 | 沙箱 / 审批 / 对话 Debug / Token 预算；权限规则列表；Skills 列表；MCP | Alice 生活树全量 tab |
| Debug「调用链」用满已有 IPC | 今日 Token、前后台 lane、caller 统计 + Span 树 | 新造一套 LLM 日志库 |
| Playground「体验夹具」= G6 精简 | 空态 + 3 张常用错误卡 + 权限确认静态样例 | 完整 Storybook / 狼人杀 / Webhook |

---

## 2g. Phase 6 — Debug 五域诊断闭环

> 对照 Alice Debug 全量页面后，不复制生活树栏目数量；按本项目真实数据与调试问题收拢为五个顶层域。

| ID | 目标 | 验收 |
|----|------|------|
| **G9** | 顶层固定为「提示词管理器 / 上下文 / 世界态 / 运行记录 / 系统」 | 不新增 Alice 产品专属顶层 tab；调用链与事件并入运行记录内部视图 |
| **G9a** | 上下文绑定真实 LLM 调用 | 默认读取最近一次持久化请求；展示实际 `requestMessages` / `requestTools`，不以重组预览冒充实发内容 |
| **G9b** | 运行记录补完整 LLM 日志 | LLM 调用列表支持状态与元数据搜索、分页、详情、JSON/JSONL 导出及 Debug 日志两步清空；Span / 实时事件保留为内部视图 |
| **G9c** | 世界态补计划与发布状态时间线 | 同时展示今日剧本槽位与 `companion_events` 的 planned / published 状态，Moments 继续作为事件投影截面 |
| **G9d** | 系统补真实能力清单 | 展示 Tool Registry 的名称、说明、参数与只读 / 破坏性 / 并发元数据；Skills / MCP / 权限仍复用现有系统态 |

**只读边界**：不复制 Alice 的「重新生成日程 / 旅行 / 设置心情 / 换装 / 强制完成 / 添加物品」等写操作。清空仅作用于可重建的 Debug 日志，并要求界面内二次确认。

---

## 3. 技术方案（How）

### 3.1 UI

```text
侧栏底：… | Skills | Debug | Playground | 主题
主区 activeView:
  debug      → DevPanel surface=debug（全页）
  playground → DevPanel surface=playground（全页）

Debug 内：     提示词管理器 | 上下文 | 世界态 | 运行记录 | 系统
运行记录内：  LLM 调用 | Span 调用链 | 实时事件
Playground 内： 设计系统 | UI 控件 | 页面基线 | 对话试验 | 模型测试 | 工具 | 体验夹具
```

文案纪律：Debug Prompt 资产 =「生产来源（只读）」；即时重组结果 =「装配预览」；真实实发内容只认「上下文」中的持久化请求快照；Playground =「会话覆盖，不写设置」。

### 3.1a IA 全量审计（2026-08-09）

| Surface | Tab | 归属判断 | 结论 |
|---------|-----|----------|------|
| Debug | 提示词管理器 | 生产 Prompt 资产 + 当前组装结果 | 保留；合并原「Prompt 实装」与资产目录 |
| Debug | 上下文 | 最近一次真实 LLM 请求 + 用户画像 / 注入记忆 | 新增；以持久化 requestMessages 为事实源 |
| Debug | 世界态 | 当前角色、生活、计划/发布事件真实快照 | 保留并补时间线 |
| Debug | 系统 | 运行环境、配置、权限、Skills、MCP | 保留 |
| Debug | 运行记录 | LLM 日志 / Span / 当前会话事件 | 合并原「调用链」「事件」；LLM 调用为默认视图 |
| Playground | 设计系统 | token 与基础视觉实验 | 保留 |
| Playground | UI 控件 | 正式组件的隔离状态故事 | 保留 |
| Playground | 页面基线 | 正式页面组合态实验 | 保留 |
| Playground | 对话试验 | 隔离 Prompt 覆盖与多轮试跑 | 保留 |
| Playground | 模型测试 | 连通、thinking 能力实验 | 保留 |
| Playground | 工具 | Registry + 权限路径手测 | 保留 |
| Playground | 体验夹具 | 空态、错误、确认等模拟状态 | 保留 |
| Playground | 提示词目录 | 生产资产浏览，不是实验 | 移入 Debug |

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

### Phase 6

1. 扩展现有 LLM Debug 查询契约（筛选 / 顺序 / 存储量），不新建日志生命周期
2. 新建上下文与 LLM 日志 UI；调用链 / 事件改为运行记录内部视图
3. 世界快照增加最近事件；世界态增加计划 / 发布状态时间线
4. 系统页接入现有 `debug:tools` 注册表只读清单
5. 聚焦单测 + `tsc` + unit + build + UI 截图验收；更新模块卡 / progress / changelog

---

## 6. 风险与权衡

| 风险 | 缓解 |
|------|------|
| Dev 手测误伤本机 | deny 不可绕过；破坏性/ask 强制 confirmRisk；结果区展示 permission chain |
| 用户误以为覆盖了全局 Prompt | 固定警告文案；不提供「写入设置」按钮（本 Phase） |
| DevPanel 文件变胖 | 世界态与 LLM / Context / Prompt 面板拆入 `src/components/debug/`；主壳只保留导航与运行记录编排 |
