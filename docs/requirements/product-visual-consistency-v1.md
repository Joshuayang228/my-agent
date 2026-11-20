# 施工合同：产品视觉一致性与可替换视觉资产 v1

> 状态：已完成施工快照（冻结）
> 生命周期：已完成施工快照（冻结）
> 范围：统一全产品 4 大高频视觉触点（Chat 氛围壁纸、人物世界封面与头像、朋友圈关系提示与配图锚点、衣柜当前穿着同步），补齐用户与 AI 换图/重置工具链；不包含路飞具体图片重绘与人设内容精装（留待第 3 块人设精装）。

## Why

当前前端五大产品体验已完成 Foundation 回流，但视觉资产仍存在 3 个明显的产品级缺口：

1. **头像、主页壁纸与世界封面全部静态写死**：`avatarVisualPath` 与 `bannerVisualPath` 只能从内置 Role Pack 读取，用户既不能在设置中开关 Chat 氛围壁纸，也不能上传本地图片或通过生图替换/重置头像与封面。
2. **生图缺乏统一人物外观锚点**：自主朋友圈配图（`automatic-moment-media.ts`）与主动生图工具（`image_generate`）未统一注入角色外观锚点与当前穿着摘要，容易出现“头像一个画风、朋友圈配图变另一个人”的视觉割裂。
3. **后端活人感因子尚未以“去数值化”的方式透出到前端**：人物世界顶栏与朋友圈缺乏克制、自然的状态表达（如关系阶段与可见窗口提示、动态状态标签与换装状态同步），容易让后端 15 维活人感引擎“藏在黑盒里”。

## What：四大高频视觉触点与资产边界

1. **Chat 主页面（克制、沉浸、不抢话）**
   - 氛围壁纸（`CompanionSceneBackdrop`）：新增设置项 `companionChatBackdropEnabled`（默认 `'true'`），用户可在伙伴设置中一键切换「氛围陪伴 / 极简纯净」模式；保留极低干扰透明度与暗角，不影响气泡文字对比度。
   - 不展示任何 RPG 数值进度条（如“心情 75 / 好感 48”）。
2. **人物世界顶栏（`WorldProfileHeader`）与角色头像/封面资产管理**
   - 新增隔离于 Role Pack 之外的**角色视觉覆写存储**（保存在 `userData` 应用媒体目录，不修改内置 Role Pack 文件）：
     - 支持为当前活跃角色设置自定义 `avatar` 或 `banner`（来自用户本地选图或 AI 生图）；
     - 支持一键恢复 Role Pack 默认图；
     - 严格校验图片格式（PNG/JPG/WebP）、大小上限与路径安全。
   - 在人物世界顶栏或伙伴视觉设置提供轻量“更换头像 / 更换封面 / 恢复默认”入口；同时把顶栏静态占位标签替换为动态状态摘要。
   - 扩展 `image_generate` 工具支持可选 `targetVisualSlot?: 'avatar' | 'banner'`，用户在聊天中明确要求换头像或换主页封面时，AI 可经现有审批流生成并直接应用到当前角色。
3. **朋友圈（`MomentsPanel`）与外观一致性生图锚点**
   - 朋友圈顶部轻量展示当前关系阶段与可见范围（由《生活引擎映射一致性 v1》透传），绝不显示数值。
   - 自主朋友圈配图与 `image_generate` 绑定角色视觉时，统一从 Role Pack `profile.appearance` + 当前穿着衣柜摘要合成稳定的「角色外观锚点」，保持画风和形象一致。
4. **衣柜与生活切面同步**
   - 无论是生活引擎自动换装、界面手动换装，还是 Chat 工具 `companion_change_wardrobe` 换装，衣柜面板实时同步“此刻正穿着”状态，并与朋友圈润色和生图锚点共享同一事实源。

## How：分批施工顺序

1. **Batch 1 — 角色视觉覆写存储、Chat 氛围壁纸开关与 IPC 四处同步**：
   - 新增 `electron/main/companion/identity/visual-overrides.ts` 管理 `userData` 下按 `roleId` 隔离的 `avatar` / `banner` 覆写与安全读取/重置；
   - `getRoleVisuals` 优先读取有效覆写，缺省回退 Role Pack 默认图；
   - 新增设置项 `companionChatBackdropEnabled`（默认 `'true'`），接入 `App.tsx` 与伙伴设置页；
   - IPC 四处同步 `companion:set-role-visual`、`companion:reset-role-visual` 及视觉更新广播。
2. **Batch 2 — `image_generate` 换头像/封面联动、外观锚点注入与 UI 换图入口**：
   - `image_generate` 支持 `targetVisualSlot: 'avatar' | 'banner'`；
   - `automatic-moment-media.ts` 接入角色外观锚点与当前穿着摘要；
   - `WorldProfileHeader.tsx` / 设置页接入轻量换头像、换封面、恢复默认按钮；
   - 补齐单测、资产检查与全量门禁回归。

## 验收标准

1. **壁纸开关生效**：关闭 `companionChatBackdropEnabled` 后 Chat 氛围壁纸隐藏，开启后正常渲染，重启保持配置。
2. **视觉覆写与重置安全**：设置自定义头像/封面后 `getRoleVisuals` 返回新图，重置后恢复 Role Pack 默认图；非法格式、超大文件或路径穿越请求被拒绝；跨角色完全隔离。
3. **AI 生图换封面/头像**：`image_generate` 传 `targetVisualSlot: 'banner'` / `'avatar'` 时受原有审批门控保护，成功后写入覆写并广播刷新。
4. **外观锚点注入**：自主朋友圈配图描述包含角色稳定外观特征与当前穿着（存在时）。
5. **全量门禁**：`npm run test`、`npm run build`、`npm run arch:check`、`npm run assets:check`、`npm run docs:validate` 全部通过。

## 明确不做

- 不在前端展示任何数值型好感/心情/精力进度条；
- 不修改或覆盖仓库内置 Role Pack 的原始图片文件；
- 不在本合同中重绘路飞出厂立绘（留待第 3 块路飞人设精装）。
