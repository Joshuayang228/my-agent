# 主角团文案（Cast Content）

> 状态：已落地（2026-08-02 加厚）  
> 资产目录：`electron/main/companion/universes/default/`

## 三角色定位（互不抢戏）

| id | 名 | 一句话 | 日常味 |
|----|----|--------|--------|
| `lin` | 小林 | 沉稳收束：先听清，再给结论 | 待办、复盘、通勤务实 |
| `zhou` | 小周 | 外向点火：先抛点子，再一起收 | 约人、灵感、咖啡馆窗景 |
| `xia` | 小夏 | 安静敏锐：少说，说到点上 | 留白、观察、夜色静坐 |

## 文件职责

| 文件 | 用途 |
|------|------|
| `protected.md` | 硬人格 / 底线（L1，勿互抄小传） |
| `voice.md` | 语气与 aside |
| `mutable.default.md` | 默认可成长区种子 |
| `summary.txt` | 名册 / 冷启动浅层 |
| `manifest.json` | UI 名与 description |

NPC（`chen` / `ayu`）：主对话只用 summary；完整 `protected` 仅召唤子会话装载。

## 分味联动

- 日剧本：`life/script-generator.ts` 按 `roleId` 选活动池  
- 衣柜 starter：`life/assets.ts` 按 `roleId` 播种（**仅空库**；已有衣柜不覆盖）

## 改文案注意

- 勿在三份 `protected` 里写互相矛盾的对方小传（关系走 `relations.json`）  
- Eval C01 / 单测只断言「有 protected / 无他人全文」，不锁死具体句子  
- 已写入用户磁盘的 MUTABLE / 衣柜不会因 Pack 更新自动重置
|