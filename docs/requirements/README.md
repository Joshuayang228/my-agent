# docs/requirements/ 索引

> 施工合同与批次说明的目录。  
> **不是**产品能力清单——「有什么」见 [`../modules/capability-catalog.md`](../modules/capability-catalog.md)。  
> 方案元规则见 [`docs-system-restructure.md`](./docs-system-restructure.md)。

## 怎么放文件

| 类型 | 含义 | 处置 |
|------|------|------|
| **进行中** | 仍指导未完成施工 | 保留；改行为时同步改文 |
| **已落地契约** | 主线已通，仍作长期不变量/验收参照 | 保留；文首标「已落地」；细节以代码为准 |
| **元 / 批次** | 文档体系或工程化批次说明 | 保留索引；勿与产品契约混读 |

不要把灵感写进本目录（去 `wishlist.md`）；不要把进度写进本目录（去 `progress.md`）。

---

## 进行中

| 文档 | 说明 |
|------|------|
| （暂无独立进行中大项） | 伙伴主线 W0–W6 + 召唤/反思已通；下一工程向以 methodology 深啃与内容打磨为主 |

若开新大功能：先写需求文档 → 用户确认 → 再编码（见根 `CLAUDE.md`）。

---

## 已落地契约（长期参照）

| 文档 | 说明 |
|------|------|
| [companion-world-framework.md](./companion-world-framework.md) | 产品终局：三槽、单活跃、Catch-up、生活世界 |
| [companion-architecture.md](./companion-architecture.md) | 模块边界与依赖方向 |
| [companion-tech-spec.md](./companion-tech-spec.md) | W0–W6 施工合同 / 验收 |
| [companion-mutable-reflection.md](./companion-mutable-reflection.md) | 自动反思写 MUTABLE（门闸 / 入队 / Settings） |

---

## 元 / 批次

| 文档 | 说明 |
|------|------|
| [docs-system-restructure.md](./docs-system-restructure.md) | 四维文档体系（产品/技术/质量/账本）；已落地 |
| [batch3-capability-gaps.md](./batch3-capability-gaps.md) | 工程化 Batch3 缺口清单（历史批次） |

---

## 与模块卡的关系

- 模块卡：横切边界 + 必读文件（薄）  
- 能力目录：已落地能力表 + Prompt 管线  
- requirements：Why/What/How 合同与批次——**开工前读，完工后标已落地，不删历史契约**
