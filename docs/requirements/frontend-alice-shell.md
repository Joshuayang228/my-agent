# 施工合同：前端壳层对齐 Alice 布局（大气改造 Phase A）

> 状态：**已落地**（Phase A，2026-08-05）  
> 日期：2026-08-05  
> 上位：[`frontend-visual-language.md`](./frontend-visual-language.md)（已落地语言骨架）· [`frontend-companion-surfaces.md`](./frontend-companion-surfaces.md)  
> 参考：Alice 侧栏截图 + `_extract` 路由（`/chat` · `/debug` 二级导航）· DEC-018  
> 路线：**先抄布局骨架与气质，不抄 Alice 产品模块全家桶**

### 已锁定决策（2026-08-05）

| 项 | 决定 |
|----|------|
| 默认主题 | 无本地记录时默认 `mist`（纸感）；有记录则保持用户上次选择 |
| Skills | **不进底栏宫格**；放 Secondary「工具」+ 设置里已有入口。Alice 有 Skills（设置页 / Playground 可见），但底栏不强调 |
| 设置 | **继续独立全屏** |
| 其余 | 按本合同 Phase A 执行 |

---

## 1. 需求背景（Why）

视觉语言 Phase 1–3 已补 token / 设置 IA / Chat 轻气质，但**壳层信息架构仍偏工具条拼装**：

- 侧栏顶部身份条 + 小按钮堆叠，缺少 Alice 那种「大号新话题 CTA + 品牌区」重心  
- 会话行只有标题，无时间戳 / 摘要，列表「挤」且不大气  
- 底栏生活入口是一排小图标，开发入口挤在同一行，不像 Alice 底栏「双入口 + 宫格」  
- 全页 Debug / Moments 等与 Chat 共用「单栏主区」，没有 Alice 在 Console 页那种**二级导航列**，主内容缺少呼吸感  

目标：让桌面壳**第一眼像伙伴产品**（留白、层级、入口清晰），而不是深色聊天工具。

---

## 2. 功能目标（What）— Phase A（本轮）

### 2.1 抄什么（Alice 壳）

```text
┌────────────┬──────────────────┬────────────────────────────┐
│ Primary    │ Secondary（可选） │ Main                         │
│ ~240–260px │ ~200px           │ flex-1                       │
│            │                  │                              │
│ 品牌/主角  │ 仅非 chat 全页：  │ chat / moments / debug …     │
│ 大号新话题 │  分组导航         │                              │
│ 会话列表   │  （生活·工具·Dev）│                              │
│ 底栏宫格   │                  │                              │
└────────────┴──────────────────┴────────────────────────────┘
```

| Alice | 我方映射 | Phase A |
|-------|----------|---------|
| 顶栏头像 + 名 + 一句 tagline | 活跃主角头像字 / 名 / `companionBlurb` 或固定 slogan | ✅ |
| 大号「+ 新话题」主按钮 | 「+ 新对话」主 CTA（占满宽，带强调底） | ✅ |
| 会话行：标题 + 时间 + 摘要 | 标题 + 相对/绝对时间；摘要用最近一条消息截断（有则显示） | ✅ |
| 底栏 Playground / Debug 独立字钮 | 保留现有入口，改成底栏上排双钮（有字） | ✅ |
| 底栏 3×2 宫格（Wiki/待办…） | **只放我们已有能力**：朋友圈 / 物什 / 名册 / 记忆 / 角色架 / 设置（或 Skills）；**禁止假入口** | ✅ |
| Debug 中栏分组导航 | 非 chat 全页时出 Secondary：生活组 + 工具组 + 开发组 | ✅ |
| 纸白 + 大留白 | 默认推荐浅色主题观感；间距加大（见 3.2） | ✅ |

### 2.2 不抄什么

- Alice Wiki / 待办 / 定时 / 邮件 / 狼人杀 / 完整生活树 tab  
- 插画、账号体系、毛玻璃重度依赖  
- 把 Chat 改成三栏（聊天时仍是 **Primary + Main**，Secondary 收起）  
- 推翻 DEC-018「居中输入卡片」——本轮只动壳与侧栏，输入区可同步加大 `max-w` / 留白，不重做气泡协议  

### 2.3 验收

1. 冷启动浅色主题下，侧栏一眼能看出：品牌区 → 新对话 → 会话 → 底栏宫格（截图可宣传）  
2. 进入 Moments / Debug / Playground / 记忆 等：出现二级导航列；点项切换 `activeView`  
3. Chat：无二级列；主区仍居中对话，不挤成仪表盘  
4. 无假入口；开发入口仍次于生活入口（底栏上排双钮，宫格以生活/设置为先）  
5. `tsc` + `npm run test` + `npx vite build` 通过  

---

## 3. 技术方案（How）

### 3.1 组件拆分（避免 App.tsx 继续膨胀）

| 组件 | 职责 |
|------|------|
| `src/components/shell/PrimarySidebar.tsx` | 品牌区、新对话、会话列表、底栏 |
| `src/components/shell/SecondaryNav.tsx` | 非 chat 时的分组导航 |
| `src/components/shell/AppShell.tsx`（可选） | 三栏 flex 容器；或仍由 App 组装 |

`App.tsx` 只保留状态与事件，布局 DOM 迁出。

### 3.2 视觉参数（大气感，非换皮）

- Primary 宽：`260px` → 可维持或 `248px`；内边距 `px-3` → 会话行 `py-2.5`  
- 新对话按钮：`h-10`、圆角 `var(--radius-lg)`、`accent-subtle` 或实色强调（浅色主题下忌刺眼霓虹）  
- 会话行：两行结构（标题 + `时间 · 摘要`）；字号 13 / 11  
- 底栏宫格：`grid-cols-3 gap-1`，图标 18–20 + 下标文字 10px  
- Main：chat 内容区上下留白略增；输入卡 `max-w-2xl` → `max-w-3xl`（可选，同 Phase）  
- 二级列：`w-[200px]`，分组标题 uppercase muted，选中项字重 + 弱底，**禁止左侧 accent 竖线**（遵守七公理）  

### 3.3 Secondary 导航信息架构（只列已有 View）

```text
生活
  朋友圈 → moments
  物什   → assets
  名册   → cast
  角色架 → shelf
工具
  记忆   → memory
  Skills → skills
  设置   → settings（可仍全屏，点设置可直接进全屏）
开发
  Debug      → debug
  Playground → playground
```

Chat 时 Secondary **不渲染**（或宽度 0），避免三栏挤对话。

### 3.4 数据

- 会话摘要：优先 `session.messages` 最后一条非空文本截断（切换会话已加载则可缓存）；列表页若无消息则只显示时间  
- 不新增 IPC（除非 list API 已有 preview 字段可顺用）  

### 3.5 依赖与风险

| 风险 | 缓解 |
|------|------|
| App.tsx 大搬家回归 | 分步：先抽 PrimarySidebar 行为不变 → 再加 Secondary → 再调间距 |
| 深色主题突然变「假 Alice」 | 结构抄 Alice，颜色仍走现有 CSS 变量；不强制删 dark |
| 用户要「更像」插画 | 记 wishlist，本轮不做 |

---

## 4. 实施步骤

1. 本合同确认  
2. 抽 `PrimarySidebar`（行为对齐现状）  
3. 加 `SecondaryNav` + 三栏壳（chat 两栏）  
4. 会话行时间/摘要 + 底栏宫格 + 大号 CTA  
5. 微调 Main 留白 / 输入卡宽度  
6. 更新 `frontend-guidelines.md` UI 架构节 + changelog / progress  
7. 验证门：test / tsc / vite build  

---

## 5. 后续 Phase（本合同不做）

| Phase | 内容 |
|-------|------|
| B | Chat 消息区排版大气化（气泡间距、空态全幅、状态条重排） |
| C | 生活面（Moments/衣柜）卡片节奏对齐 Alice 时间线密度 |
| D | 可选：主题诗意文案 / 轻纹理背景（有资产再上） |

---

## 6. 待你拍板

1. **默认主题**：是否 Phase A 起冷启动默认改为 `light` / `mist`（更纸感）？还是保持用户上次选择？  
2. **底栏宫格 6 格**：朋友圈 / 物什 / 名册 / 记忆 / 角色架 / 设置 —— Skills 是否挤进宫格，还是只留二级导航？  
3. **设置**：继续独立全屏，还是也走「二级列 + 主区」？（建议 Phase A **仍全屏**，少动 SettingsPanel）  
