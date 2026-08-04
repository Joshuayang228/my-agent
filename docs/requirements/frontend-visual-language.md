# 施工合同：前端视觉语言 + 设置补齐

> 状态：**已落地**（Phase 1–3，2026-08-04）  
> 日期：2026-08-04  
> 参考：Alice 方法论 Ch.19《UI/UX 设计哲学》；Alice 设置 / Chat 截图；既有 [frontend-companion-surfaces.md](./frontend-companion-surfaces.md)、DEC-018  
> 路线（已锁定）：**C** — 同一合同，分 Phase 实现：语言骨架 → 设置 IA → Chat 气质

---

## 1. 需求背景（Why）

公开 alpha 基建（伙伴世界、权限、可观测）已通，但渲染层仍偏「工具堆砌」：

- Chat 首屏缺少伙伴身份与问候重心，输入区/侧栏信息密度高、留白弱
- 设置仅 7 栏，大量已有能力挤在「通用 / 模型」；对照 Alice 的「基础 / 高级」分层明显不足
- CSS token 有主题与少量 `--companion-*`，但**没有成文的前端语言**，迭代易再漂移（多套相近色、硬切、贴标签竖线）

目标不是抄 Alice 插画与模块全家桶，而是借其**克制原则 + IA 分层**，让 My Agent 看起来像「数字伙伴桌面端」，而不是深色 DevTools。

---

## 2. 功能目标（What）

### 2.1 前端语言（Design System Lite）

落地一份可执行规范（写入 `docs/agent-skills/frontend-guidelines.md`，CSS 在 `src/index.css`），核心采纳 Alice Ch.19 七公理，并写明**我方例外**：

| 公理 | 我方落地 |
|------|----------|
| 结构自显，拒绝贴标签 | 禁止卡片左侧 accent border；层级用底色 / 字重 / 留白 |
| 时间连续，拒绝硬切 | View 切换、设置分栏、弹层：≥150–280ms fade；有输入的确认框禁点遮罩关闭 |
| 颜色是语义，不是装饰 | 每主题 ≤3 语义主色（bg / text / accent）；companion 暖金只作生活面点缀 |
| 图标统一 | 继续 Lucide；禁止 emoji 当图标 |
| 信息分层 | 设置基础 / 高级；Chat 默认隐藏开发入口 |
| 流式即时 | 保持现有 Callback 三通道；本轮不重做流式协议 |
| 视觉边界完整 | 确认 / Toast 留在应用内（已有则保持） |

**Token 前缀约定**：

- 全局：`--bg-*` / `--text-*` / `--accent-*` / `--radius-*` / `--motion-*`（补齐 radius / motion）
- 生活面：沿用 `--companion-*`（与 [frontend-companion-surfaces](./frontend-companion-surfaces.md) 一致）
- 默认气质：**浅色纸感优先**（`light` / `mist` / `golden` 对齐 Alice 纸白+暖金语义）；`dark` 等深色保留给工具向用户，不删

**字体**：

- UI 正文：系统栈（PingFang / Segoe UI / sans）
- 问候 / 空态标题：允许一种衬线展示字体（web-safe 或本地 `serif` fallback），**仅用于 Chat 空态与伙伴身份位**，不污染设置表单

**不做（本轮）**：主题全家桶扩到 Alice 级诗意卡文案库；系统级毛玻璃依赖；整站插画；账号登录；Wiki / 待办 / 日历产品模块。

### 2.2 设置信息架构

三栏布局（对齐 Alice，适配现有全屏 Settings）：

```text
[ 应用侧栏 ] → [ 设置分类列 ] → [ 详情区 ]
```

分类目标（基础 / 高级）：

| 分组 | 栏目 | 本轮策略 |
|------|------|----------|
| 基础 | 通用 | 语言占位（可先仅 UI 语言=简体）、外观主题卡、字体大小档 |
| 基础 | 伙伴 | **从通用拆出**：活跃主角快捷切换、动态轻提示 / 勿扰、主动问候、MUTABLE / 反思 |
| 基础 | 模型 | Provider / Key / 主模型 / 辅助模型 / temperature 等（现有搬家） |
| 基础 | 记忆 | 入口说明 + 跳转 Memory 面板；可选「专家度」解释粒度（已有 `userExpertiseLevel`） |
| 基础 | 安全 | 沙箱模式、执行模式、权限规则编辑器（现有） |
| 基础 | 连接 | MCP 列表（从高级上提或保留高级；**推荐基础可见、高级放参数**） |
| 基础 | 数据 | 导出 / 导入（现有） |
| 基础 | 关于 | 版本、文档链接、开源说明 |
| 高级 | 参数 | max tokens、top_p、token 预算（从模型拆出） |
| 高级 | 工具 | Skills 说明入口；shell / 项目 cwd 说明（项目选择仍在 Chat 输入区，DEC-020） |
| 高级 | 开发者 | Playground / Debug / Trace 入口（现有） |

**假入口纪律**：无后端能力的项（账号、隐私云同步、统计大盘、自动化工作流、语音 STT）→ **不出现可点死链**；若需占位，仅在「关于 / 路线图」用只读一句 + 链到 `docs/wishlist.md` / deferred，**禁止半残表单**。

### 2.3 Chat 气质（Phase 3）

在不大改 DEC-018「居中输入 + 侧栏 View」前提下：

- 侧栏顶部：**活跃主角身份条**（名 / 一句状态或 tagline，可进角色架）
- 空态：衬线问候 + 短句；弱化四宫格工具卡，改为 3–4 条建议 pill（文案可角色分味后置）
- 输入区：更大圆角容器、内工具条克制（+ / 发送圆形主按钮语义）
- 开发入口下沉到底栏次级区（Playground / Debug），与「设置」分组

---

## 3. 技术方案（How）

### 3.1 架构 / 数据流

- **无新 IPC 也可完成 Phase 1–2 大半**：主要是 `SettingsPanel` 拆分与 CSS token
- Phase 2 若需「界面语言 / 字号」持久化：扩展 `settings-store` + `src/shared/types` + preload（IPC 三处同步）
- 主题仍走现有 `data-theme` + `onThemeChange`

### 3.2 关键接口 / 文件

| 区域 | 文件 |
|------|------|
| Token / 动效 | `src/index.css` |
| 设置壳 | `src/components/SettingsPanel.tsx` → 拆 `settings/` 子组件（按栏目） |
| Chat / 侧栏 | `src/App.tsx`（Phase 3） |
| 规范 | `docs/agent-skills/frontend-guidelines.md`（新建或补全） |
| 可选持久化 | `electron/main/storage/settings-store.ts`、`src/shared/types.ts`、preload |

### 3.3 依赖

- 不新增 UI 框架；继续 React + Tailwind + Lucide
- 不引入 Alice 私有资产

---

## 4. 影响范围

| 维度 | 影响 |
|------|------|
| 破坏性 | Settings 分类 ID 重排；用户书签式「上次打开的设置 tab」若未持久化则无感 |
| 测试 | 现有 Settings / companion 单测不破；补 Settings 导航 smoke（可选）；`tsc` + `vitest` |
| 文档 | 本文件；`frontend-guidelines`；模块卡「已落地能力」UI 行；`changelog` / `progress` |
| 产品 | 不改变伙伴世界语义；仅露出与观感 |

---

## 5. 实施步骤（每步可验证）

### Phase 1 — 语言骨架（约 1 会话）✅

1. [x] 写 `agent-skills/frontend-guidelines.md`（公理 + token 表 + 禁区）
2. [x] `index.css` 补 `--radius-*` / `--motion-*` / `--font-*`；`light`/`mist`/`golden` 纸感；去左侧 accent 竖线（blockquote / DevPanel compact）
3. [x] Settings 导航 / `.settings-*` / `.app-shell` / `.view-transition` 套用 motion 与圆角  
**验收**：切主题软过渡；无卡片左侧色条；文档可独立阅读

### Phase 2 — 设置补齐（约 1–2 会话）✅

1. [x] 基础/高级导航：通用·伙伴·模型·记忆·安全·连接·数据·关于 / 参数·工具·开发者
2. [x] 「通用」仅外观语言字号；伙伴/参数拆出；MCP→连接
3. [x] 记忆 / 工具入口页（跳转面板，无假表单）
4. [x] `uiFontScale` 本机 localStorage（不做 IPC）；语言仅简体中文占位  
**验收**：已有设置项可在新 IA 找到；无死链；自动保存不变

### Phase 3 — Chat 气质（约 1 会话）✅

1. [x] 侧栏身份条（点进角色架）+ 空态衬线问候 + 4 条建议 pill
2. [x] 输入卡 `--radius-xl`、占位跟主角名、发送按钮略放大
3. [x] Skills / Debug 下沉侧栏底栏次级；顶栏去掉技能主入口  
**验收**：空态偏伙伴桌面；工具路径仍在底栏 / 快捷键

每 Phase 结束：`npm run test` + `npx tsc --noEmit`；UI 相关按 CLAUDE 前端验收自查。

---

## 6. 风险与权衡

| 风险 | 缓解 |
|------|------|
| 一次改全站失控 | 严格 Phase；Phase 1 先 token/规范不换布局 |
| 抄 Alice 过界（账号/Wiki） | 假入口纪律；wishlist 单列 |
| 深色用户不适 | 保留 dark；默认不强制改用户已选主题 |
| Settings 巨型文件 | 拆 `settings/*`，单文件职责 |

与 DEC-018：**不推翻**「居中输入 + 侧栏 View」；本轮是把混合风格里的 **Alice 伙伴权重拉高**，Codex 终端感降权。

---

## 7. 验收总表

- [x] `frontend-guidelines.md` 含七公理我方释义 + token + 禁区（Phase 1）
- [x] 设置基础/高级分类齐全；已有能力无遗漏搬家（Phase 2）
- [x] 无能力项无死链（Phase 2）
- [x] Chat 空态有身份 + 问候；开发入口不抢主视觉（Phase 3）
- [x] Phase 1–3：`npm run test` + `tsc` 通过
- [x] `changelog` / `progress` / 模块卡已更新

---

## 8. 确认闸

用户确认本施工合同后，从 **Phase 1** 开工；不跳 Phase 写 Chat 大改。
