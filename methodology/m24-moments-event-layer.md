# M24 朋友圈与事件层

> 这份文档沉淀我们对「日子如何对用户可见」的设计思考。  
> 前半是**认知框架**——事件真相、朋友圈截面、与对话世界的边界。  
> 后半是**实战记录**——publish / project / IPC 可见范围。  
>
> 对照源：Alice Ch.18（朋友圈与社交）× 我们的 `life/moments.ts` + events 表  
> 上位：M23（生活世界真相）· `docs/requirements/companion-tech-spec.md` W3  
> 沉淀时间：2026-08-02  
> **状态**：✅ 理念已沉淀（纯文本 Moments 已通；生图非本阶段）

---

# 第一部分：认知框架

## 一、第一性原理：朋友圈是「生活事件的可见投影」，不是第二套人生剧本

用户要感到「她有在过自己的日子」，最直觉的截面是朋友圈式时间线。危险在于：产品一兴奋就让运营/模型**直接写朋友圈文案**，事件库却是空的——于是对话里说在咖啡馆，圈里却在家烤肉，世界碎了。

第一性原理：

```
朋友圈 = published 事件的 UI 投影；事件层才是真相；截面可重建、可沉没

├─ 推论组 A：两层职责
│     §二 事件层 vs Moments 缓存 · §三 动态可沉，事件仍在
│
├─ 推论组 B：何时可见、给谁看
│     §四 planned→published→project · §五 仅 active 时间线
│
└─ 推论组 C：和对话/资产的边界
      §六 不与对话互相打架（薄一致） · §七 挂衣柜引用但不拥有资产
```

> **前置边界**：日剧本与暂停属 M23；衣柜本体属 M25。本章只钉「事件如何变成可见动态」。

---

# 推论组 A：两层职责

## 二、事件层是真相；Moments 是派生缓存

| 层 | 存什么 | 可否独立编造 |
|----|--------|--------------|
| Event | type / scheduledAt / status / payload（activity, mood, location…） | **否**——只由剧本物化或引擎写入 |
| Moment | text + meta + eventId 外键 | **否**——必须从 published 事件投影 |

判据：删掉 `companion_moments` 整表，只要 events 还在，应能**幂等重建**时间线。若不能，说明 Moments 偷存了独立真相——架构违规。

文案格式当前是规则拼接（活动 + 心情 + 地点 + 可选着装），不是 LLM 小作文。先保证「可见且同源」，再生图/华丽文案。

## 三、动态可沉，事件仍在

产品上时间线可以只展示近期窗口；旧 Moment 行可清理或不再查询。  
**事件**仍保留在生活历史上（至少在细补窗与审计需要范围内），供 Catch-up、调试、未来一致性校验。  
「圈沉了」≠「那天没过」。

---

# 推论组 B：何时可见、给谁看

## 四、状态机：planned → published → project

```
DayScript 槽位 → insertEvent(planned)
tick / Catch-up → markEventPublished（scheduled_at 落入窗内）
               → projectMomentFromEvent（幂等 insert moment）
```

- **planned**：日子排了但还没「发生到该时刻」  
- **published**：时间到了（或 Catch-up 追赶到），对世界「已发生」  
- **moment**：用户可见的一条动态  

禁止：跳过事件直接 `insertMoment`；禁止给 unpublished 事件发朋友圈。

## 五、仅 activeRoleId 的时间线对用户可见

存储按 `roleId` 分桶；IPC/UI **再限**当前 active——切换主角 = 换一整面生活 UI，不把三人动态混刷。  
Catch-up 物化的是**该角色**暂停期细窗内的事件→moments，不是别人的。  
非活跃角色：不 tick，故不会在后台偷偷刷圈（与 M23 暂停哲学一致）。

---

# 推论组 C：和对话/资产的边界

## 六、与对话一致性：薄约束，不完美同步

理想态：聊天里提到的地点/情绪与最近 Moment 不互相打脸。  
现状诚实边界：

- Prompt 吃 Catch-up 摘要 + 名册等薄切片，**不**整库灌 moments  
- 无强制「每条回复先对齐最新动态」的校验器  

这是已知缺口（记 Gap）：先保证同源，再做对话一致性硬校验。宁可圈朴素，也不要两套文案打架。

## 七、可挂衣柜，但不拥有资产

moment 槽事件可带 `assetId`；投影时查资产名写入 text/meta。  
着装真相在 Assets（M25）；朋友圈只**引用**。资产删了，动态文案可降级为无着装句——事件仍在。

生图朋友圈：明确非本阶段（tech-spec 风险表）；纯文本先闭环。

---

# 第二部分：实战记录

## 做了什么（W3）

| 项 | 落点 |
|----|------|
| 投影 / 发布 | `life/moments.ts` |
| 表 | `companion_events` · `companion_moments` |
| IPC | `companion:get-moments`（仅 active） |
| UI | `MomentsPanel.tsx` |
| 触发 | `tickActiveRole` · `runCatchup` |

## 弯路与取舍

1. **先投影缓存、不每次 join 拼文案**：列表快；重建路径仍在（`projectMomentFromEvent`）。  
2. **纯文本**：躲过生图范围爆炸。  
3. **一致性校验后置**：同源优先于「聊圈对齐裁判」。

## 与相邻章

| 章 | 关系 |
|----|------|
| M23 | 事件从哪来、谁 pause/tick |
| M25 | assetId 指向的衣柜 |
| M27 | 对话两空间——圈是世界侧可见面 |
| M31 | 主动在场可引用近期动态（增强） |

## 自检问题

1. 能否从 events 重建 moments？有没有无 eventId 的孤儿动态？  
2. 非 active 角色会不会在 UI 出现？  
3. planned 事件会不会提前出现在朋友圈？  
4. 朋友圈文案是否可能不经过事件层直接写入？

## 暂缓 Gap（同步 wishlist）

| ID | 内容 | 处置 |
|----|------|------|
| M24-G1 | 对话与最近 Moment 一致性校验 | 暂缓 |
| M24-G2 | LLM 润色动态文案（仍绑定 event） | 暂缓 |
| M24-G3 | 生图朋友圈 | 非本阶段 |

代码走读见 `m24-moments-event-layer-code.md`。
