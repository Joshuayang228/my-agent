# docs/requirements/ — 施工合同索引

> **统一称呼：施工合同**（勿称需求文档 / 需求合同 / 开工合同）。  
> **只放**开工前对齐 Why/What/How/验收的合同；完工后标已落地，作长期不变量参照。  
> **不是**能力清单——「有什么」见各 [`../modules/`](../modules/) 模块卡的「已落地能力」节。  
> **不是**文档体系说明——见 [`../docs-system.md`](../docs-system.md)。  
> **不是**暂缓评估 / 历史批次——评估见 [`../notes/`](../notes/)；已完成批次见 [`../../_archive/docs-legacy/`](../../_archive/docs-legacy/)。

## 怎么放文件

| 类型 | 含义 | 处置 |
|------|------|------|
| **进行中** | 仍指导未完成施工 | 保留；改行为时同步改文 |
| **已落地** | 主线已通，仍作长期不变量/验收参照 | 保留；文首标「已落地」；细节以代码为准 |

不要把灵感写进本目录（去 `wishlist.md`）；不要把进度写进本目录（去 `progress.md`）；不要把文档元规则、可行性评估、已完成工程批次写进本目录。

---

## 进行中

| 文档 | 说明 |
|------|------|
| （暂无） | 开新大功能时先写施工合同 → 用户确认 → 再编码（见根 `CLAUDE.md`「施工合同规范」） |

---

## 已落地（长期参照）

| 文档 | 说明 |
|------|------|
| [companion-world-framework.md](./companion-world-framework.md) | 产品终局：三槽、单活跃、Catch-up、生活世界 |
| [companion-architecture.md](./companion-architecture.md) | 模块边界与依赖方向 |
| [companion-tech-spec.md](./companion-tech-spec.md) | W0–W6 验收与技术方案 |
| [companion-mutable-reflection.md](./companion-mutable-reflection.md) | 自动反思写 MUTABLE（门闸 / 入队 / Settings） |
| [companion-cast-content.md](./companion-cast-content.md) | 三角色文案定位 + 分味剧本/衣柜约定 |
| [frontend-companion-surfaces.md](./frontend-companion-surfaces.md) | Alice 对照前端表面：生活/工具 IA、P0–P2 验收 |

---

## 与模块卡的关系

- 模块卡：横切边界 + 必读文件 +「已落地能力」表  
- 施工合同：大改开工前对齐——**开工前读，完工后标已落地，不删历史合同**
