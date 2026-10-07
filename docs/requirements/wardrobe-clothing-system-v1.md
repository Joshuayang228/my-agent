# 衣柜与穿搭系统 v1 施工合同

> 状态：进行中，字段与范围已确认，Playground 候选施工中
> 生命周期：本合同用于指导衣柜第一版的 Playground 候选、真实数据链、正式回流和质量验收；施工完成后，稳定事实必须吸入 `docs/modules/companion.md`、`docs/architecture.md`、`docs/quality.md` 和 `docs/progress.md`，再将本合同冻结为已完成施工快照。
> 创建日期：2026-10-01
> 上位文档：[`companion-world-model-v1.md`](./companion-world-model-v1.md) · [`playground-world-living-dimensions-v1.md`](./playground-world-living-dimensions-v1.md)
> 参考实现：本地 Alice 源码快照与 [`18-moments-social.md`](../../_reference/framework-harness/repos/alice-methodology/chapters/18-moments-social.md)

## 1. 需求背景（Why）

衣柜是人物世界中最直接的“自我呈现”切面。它不是普通的图片列表，也不是朋友圈的附属页面，而是一个长期保留、可被 Agent 和后续生图引用的生活资产空间。

当前需要把以下边界一次定清：

1. 衣柜只管理真正穿在身上的衣物，不把包、相机、雨伞等随身物件混入衣柜。
2. “当前穿着”需要成为页面主区域，用户打开后先看到人物此刻穿什么。
3. 衣物库存第一版只展示图片和名称，避免把统计信息、颜色和场合说明堆到用户面前。
4. `换上` 是第一版真实可操作能力，不能只做一个静态样张按钮。
5. 底层 Schema 需要完整保留后续推荐、生图一致性、生活事件和回顾所需的数据，即使第一版 UI 不展示这些字段。
6. 上衣、裤子、鞋子等单件衣物与一套穿搭不是同一层概念，需要避免沿用 Alice 的单一 `isWearing` 模型造成数据表达不足。

Alice 的实现验证了几条重要原则：衣物是长期资产；朋友圈动态过期不影响衣物资产；图片既是展示图，也是后续生活生图的参考资产；Agent 可以浏览衣柜、执行换衣和选择每日穿搭。但 Alice 的核心运行态更接近“当前穿着一件衣物”，其分类也没有完整表达上装、下装、鞋履组成的穿搭组合。因此本合同吸收 Alice 的资产链和视觉经验，按 My Agent 的人物世界模型升级穿搭结构。

## 2. 产品目标（What）

### 2.1 第一版用户目标

用户进入人物世界的“衣柜”后，应能快速回答：

```text
她现在穿什么？
衣柜里有哪些衣物？
我能不能让她换上一件？
这件衣物的图片和名称是什么？
```

第一版完整交付：

- 当前穿着主区域；
- 衣物库存图片网格；
- 轻量分类切换；
- 衣物图片点击预览；
- 单件衣物 `换上`；
- 当前穿着状态同步；
- 无图、生成中、生成失败、空衣柜和读取失败状态；
- 真实数据保存、按角色隔离、刷新和重载恢复；
- 后续穿搭组合所需的 Schema 基础。

### 2.2 第一版 UI 展示范围

衣物卡片只展示：

- 图片；
- 名称；
- 当前是否正在穿着；
- 固定位置的 `换上` 操作槽。

第一版不在衣物卡片和当前穿着主区域展示：

- 颜色；
- 穿过次数；
- 最近穿着时间；
- 适用场合；
- 花费；
- 购买来源；
- AI 视觉描述。

这些字段仍然必须进入数据模型，并允许 Debug 或后续 Agent 逻辑读取。

### 2.3 衣物边界

衣柜第一版只纳入穿着类衣物：

| 类型 | 第一版处理 |
|------|------|
| 上装 | 支持 |
| 下装 | 支持 |
| 外套 | 支持 |
| 鞋履 | 支持 |
| 连体衣 / 裙装 | Schema 预留；UI 可归入单件衣物，不做复杂特例 |
| 套装 | 作为穿搭组合处理，不作为普通单件衣物处理 |
| 包 | 不进入衣柜，归入家居 / 生活物件 |
| 相机 | 不进入衣柜，归入家居 / 生活物件 |
| 雨伞 | 不进入衣柜，归入家居 / 生活物件 |
| 首饰、帽子等配饰 | Schema 预留；第一版不做独立分类交互，待真实数据和 UI 需求确认 |

### 2.4 当前穿着与穿搭组合

第一版 UI 以“当前穿着”为主区域，但不把它限制成一件衣物。底层采用穿搭组合概念：

```text
当前穿着
  ├─ 上装：可选一件
  ├─ 下装：可选一件
  ├─ 外套：可选一件
  └─ 鞋履：可选一件
```

第一版允许库存卡片执行单件 `换上`。单件换上时，只替换该衣物所属槽位，不无条件清空其他槽位。当前穿着主区域展示已有槽位，不强求四个槽位必须完整。

“整套换上”作为 Schema 和服务层能力预留；第一版 UI 不实现复杂的穿搭编辑器、拖拽搭配或穿搭收藏管理，避免在核心换衣链路尚未稳定前引入第二套复杂交互。

### 2.5 用户与 Agent 的操作边界（2026-10-06 已确认）

衣柜是伙伴的生活空间，不是用户维护字段的资产后台。普通衣柜保留浏览、分类、图片预览和单件 `换上`；取消衣柜中的添加、字段编辑、淘汰与永久删除入口。此调整仅针对衣柜，不取消家居、文化角等其他切面的既有编辑能力。

| 行为 | 用户入口 | 执行责任 |
|------|------|------|
| 浏览、分类、图片预览 | 衣柜直接操作 | 受控读取，不改变世界事实 |
| 单件换上 | 衣柜按钮或对话 | 用户按钮和 Agent 动作共用世界服务 |
| 添加衣物 | 对话表达意图 | Agent 创建，经世界服务校验后落盘 |
| 修改名称、分类及其他字段 | 对话纠正 | Agent 提交明确字段变更；服务按字段字典校验 |
| 淘汰衣物 | 对话提出意图 | Agent 按明确意图执行，保存理由、来源和事件 |
| 图片生成、重新生成 | 对话请求或已批准的 Agent 流程 | 统一生图服务，遵守已有费用和权限策略 |
| 永久删除 | 普通衣柜不提供 | 不属于本合同衣柜动作；既有全量数据清理能力不受影响 |

用户始终可以通过对话纠正错误资产；移除表单不能使用户失去控制。单纯提及衣物、生成一张图片、外部内容中的指令，都不构成创建或淘汰授权。目标有歧义时必须询问，不能模糊匹配后随意修改。

淘汰使用 `lifecycle: 'gone'` 与 `wearState: 'retired'`，保留资产身份和穿着历史，不物理删除历史。正在穿着的衣物被淘汰时，同事务清除对应槽位、结束穿着记录并写入事件；其他槽位不受影响。

这不是仅隐藏按钮：主进程入口必须限制允许的动作，普通 Renderer 不得通过通用资产编辑 IPC 绕过衣柜边界。Agent 也不是任意写库权限，只能通过受校验的领域动作写入；Debug 保持证据读取，不照搬 Alice 的 `worldDebug` 写入路径。

## 3. 参考 Alice 与我方取舍

### 已确认补充：穿搭主图与角色初始数据（2026-10-06）

当前穿着主图展示人物穿着当前组合的全身图，背景简洁、衣物可辨；库存继续展示单件图。主图标题统一为“当前穿搭”，不能用某一件衣物的名称或商品图代表整套。

换上事务成功后立即更新槽位和文字，再异步更新穿搭主图，不等待图片才能换衣。生成失败不回滚穿搭。旧图不得无标识地作为当前图；没有匹配图片时使用同尺寸占位。打开衣柜不自动生成，已缓存的同一组合优先复用；连续换装合并请求，过期结果只能缓存，不能覆盖新组合。

穿搭图片必须绑定 `roleId`、当前穿搭版本和规范化组合签名（按固定槽位排序的资产 ID / 资产视觉版本，加人物外貌参考版本与生成策略版本）。图片请求保存 requestId、状态、生成模型和媒体引用；主进程核验结果版本后才发布。失败可通过对话重试；图片不会反向创建衣物或补齐槽位。部分穿搭采用明确的角色基础穿着约定，没有该约定时只展示已知衣物，不偷偷推测为拥有新资产。

每个本版内置角色由 Role Pack 提供三套完整初始组合：日常休闲、外出通勤、轻松运动，按角色风格配置，允许共用衣物 ID。每套包含上装、下装、鞋履，外套可选；默认选择其中一套。不新增套装编辑器。2026-10-07 用户要求在“全部”之后添加“套装”：Playground 展示三套隔离组合的图片、名称与换上；整套换上一次替换全部槽位，未指定外套清除旧外套，组合失败不发布部分槽位，成功返回正在穿着。套装不伪装成单件衣物，不计入单件库存；正式整套换上与数据服务仍须单独施工、验收和回流许可。

初始衣物来源为 `seed`，穿过次数为 0，不虚构购买、价格或历史穿着；初始选中不算一次实际换装。预置图片作为角色资产提供，不在首次打开强制付费生图。播种标记、衣物和初始穿搭须同事务写入，按角色及稳定 seed key 幂等；淘汰后重启不得补种。未知 / 用户自定义角色未提供 Role Pack 初始衣柜时保留空态，不套用小林数据。

第一批先完成 Playground：三套隔离初始组合、无维护入口、全身主图或准确占位、生成中 / 失败 / 缓存恢复和几何稳定性。第二批在 Phase 2 实现上述 Role Pack 播种、真实换装与生成服务；未通过真实链路验证不宣称生产已完成。

### 3.1 吸收的 Alice 设计

本合同吸收以下经过源码和方法论确认的做法：

1. **资产层与事件层分离**：朋友圈是近期事件投影，衣柜是长期资产；朋友圈过期不删除衣物。
2. **图片是资产的一部分**：衣物图片既服务 UI 展示，也作为后续人物生活生图的视觉参考。
3. **图片优先的网格**：固定图片比例，支持多图预览，缺图时保留稳定占位，不让卡片尺寸跳动。
4. **当前状态明确标记**：库存中可以看出哪件正在穿着，详情和列表状态保持一致。
5. **Agent 可操作**：至少具备浏览衣柜和换上指定衣物的能力；每日选衣作为后续组合能力的来源。
6. **生图失败可恢复**：生成中、失败和重新生成是明确状态，不用错误图片冒充衣物图。
7. **Debug 渐进披露**：来源、AI 描述、花费、穿着统计和生成诊断属于 Debug / 详情能力，不抢第一版用户主视觉。

### 3.2 不直接复制的 Alice 设计

操作权限补核对（2026-10-06）：Alice 的网格没有字段编辑入口，但 `_extract/index-ppRSWnkN.js` 的衣物详情包含重新拍照、带理由淘汰和永久删除，分别调用 `worldDebug` 的 `enrichFact`、`retireFact`、`deleteFact`。因此不能将 Alice 描述为完全只读。My Agent 吸收 Agent 主导的资产维护方式，但不复制普通详情中的删除入口或 Debug 写入通道；保留已确认的用户 `换上`。

本地源码补核对（2026-10-06）：`query-B_tFgAOJ.js` 的生活图片链读取 `getCurrentOutfit`，将 imagePath 传入 `prepareAliceImageGen.currentOutfitPath`，同时将名称、描述和颜色组织成穿着描述。这里验证了图片参考与文本约束并用；不代表所有 Provider 都接受相同参考格式。其天气检查会触发自动换衣或购买，我方本版不采用该自动机制。`setFactWearing` 会清除其他衣物状态并更新统计；我方采用独立槽位和事务事件，不能复制其单件模型或将所有换衣都解释为已发布朋友圈。

以下内容不作为我方第一版默认行为：

- 不复制 Alice 的团建经费、消费引擎和自动购买机制；
- 不把 Alice 的人物事实、分类命名和虚构生活事件带入 My Agent；
- 不把所有衣物统一成单一 `isWearing`，以免无法表达上装、下装、外套和鞋履并存；
- 不把配饰、包、相机、雨伞都归入衣柜；
- 不在首屏展示花费、穿过次数和最近穿着；
- 不因为 Alice 有“整套搭配”标签，就直接制造一个没有真实数据和编辑流程的套装入口；
- 不让打开衣柜自动触发高成本生图；
- 不把 Playground fixture 或 Alice 样张写入正式数据库。

## 4. 数据模型（How：Schema）

### 4.1 衣物资产

衣物资产属于长期 `companion_assets`，资产类型为穿着类衣物。字段设计以 Alice 已验证的 `name`、`category`、`imagePath`、`thumbnailPath`、`extraImages`、`description`、`color`、`aiDescription`、`isWearing`、`wearCount`、`lastWornAt`、`cost`、`transactionId`、`acquiredAt` 为基础，但不把这些字段全部塞进 UI 或单一 JSON。建议把稳定身份、展示信息、视觉资产、穿着统计、来源审计和生成状态分组维护。

```ts
type WardrobeItemCategory =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'shoes'
  | 'dress'
  | 'jumpsuit'
  | 'accessory';

type WardrobeItemPayload = {
  schemaVersion: 1;
  category: WardrobeItemCategory;
  subcategory?: string | null;
  garmentForm?: 'single' | 'one_piece' | null;
  brand?: string | null;
  model?: string | null;
  size?: string | null;
  fit?: 'slim' | 'regular' | 'relaxed' | 'oversized' | 'unknown';
  material?: string[];
  colors?: string[];
  pattern?: string | null;
  styleTags?: string[];
  seasonTags?: Array<'spring' | 'summer' | 'autumn' | 'winter' | 'all'>;
  occasionTags?: string[];
  weatherTags?: Array<'hot' | 'warm' | 'cool' | 'cold' | 'rain' | 'wind' | 'unknown'>;
  description?: string;
  aiDescription?: string | null;
  visualAttributes?: {
    silhouette?: string | null;
    neckline?: string | null;
    sleeve?: string | null;
    length?: string | null;
    texture?: string | null;
    dominantColors?: string[];
    negativeAttributes?: string[];
  };
  images?: WardrobeImageAsset[];
  primaryImageId?: string | null;
  thumbnailImageId?: string | null;
  wearState: 'available' | 'wearing' | 'laundry' | 'repair' | 'retired';
  wearCount: number;
  lastWornAt?: number | null;
  firstWornAt?: number | null;
  acquiredAt?: number | null;
  acquiredVia?: WardrobeAcquisitionSource;
  sourceEventId?: string | null;
  sourceMomentId?: string | null;
  transactionId?: string | null;
  cost?: number | null;
  currency?: string | null;
  lifecycle: 'active' | 'pending' | 'gone';
  retiredAt?: number | null;
  retiredReason?: string | null;
  generation: {
    status: 'none' | 'pending' | 'ready' | 'failed';
    requestId?: string;
    errorCode?: string;
    errorMessage?: string;
    promptAssetKey?: string;
    provider?: string;
    model?: string;
    attemptCount?: number;
    startedAt?: number;
    completedAt?: number;
    updatedAt?: number;
  };
};

type WardrobeImageAsset = {
  id: string;
  roleId: string;
  kind: 'reference' | 'thumbnail' | 'generated' | 'moment' | 'preview';
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  altText?: string;
  visualHash?: string | null;
  sourceEventId?: string | null;
  sourceMomentId?: string | null;
  generationRequestId?: string | null;
  createdAt: number;
  updatedAt?: number;
};

type WardrobeWearRecord = {
  id: string;
  roleId: string;
  itemId: string;
  slot: OutfitSlot;
  outfitId?: string | null;
  startedAt: number;
  endedAt?: number | null;
  source: 'user' | 'agent' | 'event' | 'seed';
  eventId?: string | null;
};

type WardrobeAcquisitionSource =
  | 'user_created'
  | 'agent_generated'
  | 'event'
  | 'moment'
  | 'purchase'
  | 'gift'
  | 'migration'
  | 'seed';
```

硬约束：

- `name` / `subject` 是用户可见的稳定名称；不使用 AI 描述替代名称。
- `category` 决定单件换上时更新哪个穿搭槽位。
- `wearCount` 与 `lastWornAt` 由成功的换上动作更新，不能由渲染层推测。
- 图片引用必须走现有受控媒体读取和备份恢复链；不能把未经归属校验的本地路径直接交给 Renderer。
- `generation` 只描述图片资产生成状态，不把生图状态混进衣物生命周期。
- 资产必须带 `roleId`，切换角色后不能出现旧角色衣物。
- `schemaVersion` 必须随结构性字段变化递增；不能靠 Renderer 猜测旧字段含义。
- `wearState` 表示衣物当前可穿状态，`lifecycle` 表示资产是否仍属于当前世界；两者不能合并成一个布尔值。
- `images` 是图片资产集合，`primaryImageId` 只保存当前主图引用；不能把多张图片拼成逗号分隔字符串。
- 穿着历史按独立事件保存，查询时返回 `WardrobeWearRecord[]`，不在衣物 payload 中追加历史数组；`wearCount` 和 `lastWornAt` 是可重建的派生摘要。
- `sourceEventId`、`sourceMomentId`、`transactionId` 都是来源关联，不代表衣物一定拥有对应的朋友圈或消费记录；缺失必须允许为空。
- `generation` 内的 Provider、Model、Prompt asset key 只允许进入 Debug / 审计数据；正式 UI 不暴露内部调用细节。

### 4.1.1 字段分组与展示策略

| 字段组 | 典型字段 | 第一版 UI | 后续用途 |
|------|------|------|------|
| 稳定身份 | `id`、`roleId`、`name`、`schemaVersion` | 名称 | 资产引用、角色隔离、迁移 |
| 分类与形态 | `category`、`subcategory`、`garmentForm` | 轻量分类 | 穿搭槽位、推荐、检索 |
| 视觉描述 | `description`、`aiDescription`、`visualAttributes` | 不展示 AI 描述 | 生图一致性、Debug 证据 |
| 视觉资产 | `images`、`primaryImageId`、`thumbnailImageId` | 主图、预览 | 生图、朋友圈、备份恢复 |
| 风格属性 | `colors`、`pattern`、`styleTags`、`material`、`fit` | 不展示 | 搜索、推荐、Prompt 薄片 |
| 场景属性 | `seasonTags`、`occasionTags`、`weatherTags` | 不展示 | 每日选衣、事件规划 |
| 穿着状态 | `wearState`、`wearCount`、`lastWornAt`、`wearHistory` | 正在穿着 | 回顾、推荐、事件重建 |
| 来源审计 | `acquiredVia`、`sourceEventId`、`sourceMomentId`、`transactionId` | 不展示 | 解释来源、备份、Debug |
| 经济信息 | `cost`、`currency` | 不展示 | 未来消费 / 预算能力 |
| 生命周期 | `lifecycle`、`retiredAt`、`retiredReason` | 不展示；退役不进默认列表 | 退役、恢复、审计 |
| 生成状态 | `generation` | 生成中 / 失败提示 | 真实生图、重试、诊断 |

### 4.1.2 字段字典与实施等级（2026-10-06）

等级：**核心**表示本版真实读写和测试；**保存**表示本版接受、校验、持久化和备份真实数据，但无需展示；**预留**表示定义契约，允许缺省，相关业务另行启用。所有数据字段均应有含义，不能用随机值或样张填补未知事实。

写入责任统一解释：下表“明确编辑”“创建”“纠正”均指用户通过对话提出、由 Agent 提交的领域动作，或已批准的生活流程；不代表 Renderer 字段表单权限。视觉分析只能更新有依据的描述，不能改写获得事实、角色归属或历史统计。

统一格式：时间是 UTC Unix **毫秒**，未知时间为 `null`，不能用初始化时间冒充获得或穿着时间；ID 为非空稳定字符串；可选字段缺省表示未知，`[]` 表示已知无条目；更新时缺省表示不修改，`null` 表示明确清空可空字段。必填枚举遇到未知值应拒绝写入，不能默默归为上装。以下字典中的资产外层字段沿用 `companion_assets`，不会在 payload 再存一份。

| 字段 | 值域、含义与默认值 | 写入者 / 变化时机 | 等级 |
|------|------|------|------|
| `id` | 必填稳定资产 ID；创建后不变 | 资产服务创建 | 核心 |
| `roleId` | 必填所属角色 ID；不能被切角改写 | 资产服务创建与归属校验 | 核心 |
| `name` | 必填去除首尾空白的名称，1–120 字符 | 创建或明确编辑 | 核心 |
| `schemaVersion` | 必填，本版 `1`；结构升级使用新版本 | 资产服务 | 核心 |
| `category` | 必填，取值见下表 | 创建或分类纠正 | 核心 |
| `subcategory` | 可空细分类，如“衬衫”，1–80 字符 | 明确编辑 / 有依据识别 | 预留 |
| `garmentForm` | `single` 单件、`one_piece` 连体；未知缺省；组合由 outfit 表达 | 创建 / 纠正 | 预留 |
| `brand` / `model` | 可空品牌 / 产品型号，各最多 120 字符，不推测品牌 | 明确编辑 / 可信来源 | 预留 |
| `size` | 可空尺码原文，如 M、38；不据图片猜测 | 明确编辑 | 预留 |
| `fit` | `slim` 修身、`regular` 常规、`relaxed` 宽松、`oversized` 超宽松、`unknown` 未知 | 明确编辑 / 可信识别 | 预留 |
| `material` | 材质短文本数组，如棉、亚麻；未知缺省 | 明确编辑 / 可信来源 | 预留 |
| `colors` | 颜色短文本数组，如灰蓝、白；不混入 CSS 色码 | 明确编辑 / 视觉识别 | 保存 |
| `pattern` | 可空图案说明，如条纹、纯色 | 明确编辑 / 视觉识别 | 预留 |
| `styleTags` | 风格短文本数组，如休闲、正式 | 明确编辑 / 有依据识别 | 预留 |
| `seasonTags` | `spring` 春、`summer` 夏、`autumn` 秋、`winter` 冬、`all` 四季；`all` 不与其他值共存 | 明确编辑 / 分类 | 预留 |
| `occasionTags` | 场合短文本数组，如通勤、运动；不代表发生过对应活动 | 明确编辑 / 分类 | 保存 |
| `weatherTags` | `hot` 炎热、`warm` 温暖、`cool` 凉爽、`cold` 寒冷、`rain` 雨天、`wind` 有风、`unknown` 未知；不隐含温度阈值 | 明确编辑 / 分类 | 预留 |
| `description` | 可选衣物描述，最多 4000 字符 | 创建 / 编辑 | 保存 |
| `aiDescription` | 可空视觉分析文本，最多 4000 字符；与名称分离 | 真实视觉分析 | 保存 |
| `visualAttributes.silhouette` | 可空轮廓，如直筒、A 字 | 视觉分析 / 明确编辑 | 预留 |
| `visualAttributes.neckline` / `sleeve` | 可空领型 / 袖型 | 视觉分析 / 明确编辑 | 预留 |
| `visualAttributes.length` / `texture` | 可空长度 / 纹理描述 | 视觉分析 / 明确编辑 | 预留 |
| `visualAttributes.dominantColors` | 主要颜色文本数组；分析结果，不覆盖人工颜色 | 视觉分析 | 预留 |
| `visualAttributes.negativeAttributes` | 不应出现的视觉特征，如“无印花”；不是负面评价 | 明确生图约束 | 预留 |
| `images` | 图片引用集合，默认 `[]`；引用现有媒体记录，不复制文件或凭据 | 媒体服务成功绑定 | 核心 |
| `primaryImageId` | 可空主图 ID；必须属于此资产 `images` | 主图选择 / 成功生成 | 核心 |
| `thumbnailImageId` | 可空缩略图 ID；不得引用其他角色媒体 | 媒体派生服务 | 保存 |
| `wearState` | 默认 `available`；完整取值见状态表 | 后端，`wearing` 由当前槽位派生 | 核心 |
| `wearCount` | 必填非负整数，默认 `0`；成功进入穿着状态的次数 | 换上事务 | 核心 |
| `firstWornAt` / `lastWornAt` | 可空首次 / 最近成功换上时间；不因页面读取改变 | 换上事务 | 核心 |
| `acquiredAt` | 可空实际获得时间；未知不猜测 | 可信创建来源 | 保存 |
| `acquiredVia` | 可选来源枚举，见下表 | 创建流程确定 | 保存 |
| `sourceEventId` / `sourceMomentId` | 可空获得来源事件 / 动态 ID；后续提及用多对多关联表 | 资产服务校验同角色关联 | 保存 |
| `transactionId` | 可空实际交易 ID；消费系统未启用时缺省 | 真实交易来源 | 保存 |
| `cost` / `currency` | 可空非负有限金额 / 三位大写货币代码；两者同时提供；未有来源时缺省 | 真实购买记录 | 预留 |
| `lifecycle` | `active` 已确认持有、`pending` 待确认资产、`gone` 已退出衣柜；经明确授权创建的资产默认 active | 资产服务 | 核心 |
| `retiredAt` / `retiredReason` | 可空退出时间 / 原因；原因最多 1000 字符 | 明确退役动作 | 保存 |

短文本标签最长 80 字符，数组最多 32 项，去重并保留顺序。预留字段有真实输入时可保存，不创建模拟业务来填值。待洗、维修、消费、推荐等机制本版不提供用户操作。

### 4.1.3 枚举与槽位含义

| `category` | 含义 | 本版换上行为 |
|------|------|------|
| `top` | T 恤、衬衫、毛衣等上装 | 替换 `top` |
| `bottom` | 裤子、半裙等下装 | 替换 `bottom` |
| `outerwear` | 夹克、风衣、大衣等外套 | 替换 `outerwear` |
| `shoes` | 鞋履，按一双作为一件资产 | 替换 `shoes` |
| `dress` | 连衣裙，不含半裙 | 预留，暂不允许换上；未来需同时处理上下装冲突 |
| `jumpsuit` | 连体裤等连体衣物 | 预留，暂不允许换上；不得默默当作上装 |
| `accessory` | 帽子、首饰等穿戴配饰 | 预留，暂不允许换上；包、相机、雨伞仍归家居 |

`acquiredVia`：`user_created` 用户明确添加；`agent_generated` Agent 明确创建衣物资产（仅生成图片不会自动获得衣物）；`event` 已发布事件授予；`moment` 有依据的动态恢复；`purchase` 实际购买；`gift` 实际赠送；`migration` 明确数据转换；`seed` 已确认 Role Pack 初始资产。普通对话提及不自动成为资产，图片与衣物创建来源分别记录。

其中 `user_created` 表示用户通过对话明确要求创建、由 Agent 执行，不表示提供用户直接添加表单；`agent_generated` 表示经批准的 Agent 生活流程创建。动作执行者与用户意图来源必须分别记录，不能因为经过 Agent 就丢失用户来源。

| `wearState` | 含义 | 本版约束 |
|------|------|------|
| `available` | 当前未穿、可换上 | 与 active 生命周期一起允许换上 |
| `wearing` | 被当前穿搭槽位引用 | 查询派生，不允许用户单独写入 |
| `laundry` | 待洗 / 清洗中 | 预留维护状态；本版不能换上 |
| `repair` | 维修中 | 预留维护状态；本版不能换上 |
| `retired` | 已退出衣柜 | 由 gone 生命周期派生，不提供独立写入 |

当前穿搭引用为穿着事实源；若持久化 wearState 摘要，必须同事务更新且可从槽位重建。pending / gone 资产不能成为当前穿着；退役或删除正在穿着的资产时，同事务清除槽位，保留历史事件。

### 4.1.4 图片与生成字段字典

`WardrobeImageAsset` 是现有媒体资产的领域投影。磁盘位置保存在主进程媒体服务，`uri` 是读取时产生的受控引用；临时 URI 不作为备份中的稳定身份。

| 字段 | 允许值与含义 | 写入者 / 时机 | 等级 |
|------|------|------|------|
| `image.id` / `roleId` | 必填图片身份 / 所属角色；绑定时核验 | 媒体服务 | 核心 |
| `image.kind` | `reference` 参考、`thumbnail` 缩略、`generated` 生成结果、`moment` 动态关联、`preview` 派生预览 | 媒体服务绑定 | 保存 |
| `image.uri` | 当前授权读取引用，不是任意文件路径 | 受控读取服务 | 核心 |
| `image.mimeType` | 实际检测的媒体类型，不据文件名猜测 | 媒体服务 | 保存 |
| `image.width` / `height` | 可选正整数原图尺寸 | 媒体检测 | 保存 |
| `image.aspectRatio` | 可选正数 `width / height`，尺寸未知则缺省 | 读取投影计算 | 保存 |
| `image.altText` | 可选图片描述，最多 1000 字符 | 明确编辑 / 有依据分析 | 保存 |
| `image.visualHash` | 可空视觉指纹；算法尚未启用时缺省，不替代文件校验 | 后续媒体分析 | 预留 |
| `image.sourceEventId` / `sourceMomentId` | 可空图片来源关联；与衣物获得来源独立 | 媒体绑定校验 | 保存 |
| `image.generationRequestId` | 可空实际生成请求 ID | 真实生图链 | 核心 |
| `image.createdAt` / `updatedAt` | 创建时间必填，修改时间可选 | 媒体服务 | 保存 |
| `generation.status` | 必填：`none` 未请求、`pending` 在途、`ready` 最近请求成功、`failed` 最近请求失败；默认 none | 生图服务 | 核心 |
| `generation.requestId` | 可选最近请求 ID，pending 时必填；用于拒绝迟到结果 | 生图调度 | 核心 |
| `generation.errorCode` / `errorMessage` | 可选稳定错误分类 / 脱敏友好说明；失败时提供 | 生图服务 | 核心 |
| `generation.provider` / `model` | 可选实际 Provider / Model ID；无真实请求时缺省 | 生图记录投影 | 保存 |
| `generation.promptAssetKey` | 可选实际注册的 Prompt 引用；沿用生产资产注册纪律 | 生图记录投影 | 保存 |
| `generation.attemptCount` | 可选非负整数，此资产累计真实受理请求次数；刷新不递增 | 生图调度 | 保存 |
| `generation.startedAt` / `completedAt` / `updatedAt` | 可选开始、终结、状态更新时间；pending 无 completedAt | 生图服务 | 保存 |

重生成时保留旧主图：pending / failed 不代表原有图片不可看；成功绑定新图后才切换主图。重复提交和迟到结果按 requestId 校验；生图状态描述最近请求，图片是否存在由主图引用判断。

### 4.1.5 当前穿搭与穿着历史字典

| 字段 | 含义、值域及写入规则 | 等级 |
|------|------|------|
| `CurrentOutfit.roleId` | 必填所属角色，不随页面切换改写 | 核心 |
| `CurrentOutfit.slots` | 必填对象，默认 `{}`；top / bottom / outerwear / shoes 的值为同角色 active 衣物 ID；空槽省略 | 核心 |
| `CurrentOutfit.updatedAt` | 必填最近实际变化时间，读取不改变 | 核心 |
| `CurrentOutfit.source` | 必填 user 用户操作、agent 工具、event 已发布事件、seed 已确认初始数据 | 核心 |
| `CurrentOutfit.outfitId` | 可空已保存组合引用；尚无组合能力时缺省 | 预留 |
| `WardrobeWearRecord.id` / `roleId` / `itemId` | 必填事件记录 ID、角色、衣物引用 | 核心 |
| `WardrobeWearRecord.slot` | 必填 top / bottom / outerwear / shoes | 核心 |
| `WardrobeWearRecord.outfitId` | 可空当时组合引用 | 预留 |
| `WardrobeWearRecord.startedAt` / `endedAt` | 开始必填，结束可空；换下时结束，不修改此前开始时间 | 核心 |
| `WardrobeWearRecord.source` | 必填 user / agent / event / seed | 核心 |
| `WardrobeWearRecord.eventId` | 关联已提交换衣事件 ID | 核心 |

穿着记录通过现有事件与关联链保存，分页查询投影为上述记录；不在每件衣物 JSON 中维护无限历史数组。本版记录真实变化用于计数和审计，历史时间线 UI 留待后续。

换上必须在一个事务中完成槽位替换、结束旧记录、开始新记录、更新统计和记录事件。重复换上同一槽位同一衣物是幂等成功，不增加 wearCount、不更新时间、不追加事件。切换 A → B → A 算 A 的第二次穿着；读页面、模型推荐、生图和失败请求均不计数。历史、状态和统计冲突时以已提交事件重建，不能凭 UI 状态修补数据库。

### 4.1.6 Alice 字段与我方字段的对应关系

| Alice 参考字段 / 语义 | 我方处理 |
|------|------|
| `name` | 保留为稳定用户可见名称 |
| `category` | 保留，但分类值升级为上装 / 下装 / 外套 / 鞋履等可映射槽位 |
| `image_path` | 不直接暴露路径；转为受控 `WardrobeImageAsset.uri` |
| `thumbnail_path` | 保留为 `thumbnailImageId` 的派生资源 |
| `extra_images` | 升级为结构化 `images[]`，每张图有来源和生成关联 |
| `description` | 保留为人类可读描述 |
| `color` | 从单字符串升级为 `colors[]`，兼容单主色展示和多色衣物 |
| `ai_description` | 保留，但作为生成 / Debug 视觉描述，不替代名称 |
| `is_wearing` | 不再作为唯一事实；由 `wearState` 与 `CurrentOutfit.slots` 共同派生 |
| `wear_count` | 保留为统计摘要，来源于穿着事件 |
| `last_worn_at` | 保留为统计摘要 |
| `cost` | 保留为可选经济信息，不进入第一版 UI |
| `transaction_id` | 保留为可选来源关联 |
| `acquired_at` | 保留为资产获得时间 |
| 退役 / gone | 从资产生命周期明确建模，不与“暂时没穿”混淆 |
| 多语言 `i18n` | 当前产品只做简体中文；结构可预留，不在本合同实现多语言 Prompt / UI |

### 4.2 当前穿着

当前穿着是角色运行态的派生状态，不能通过 UI 直接复制一份独立事实。建议结构如下：

```ts
type OutfitSlot = 'top' | 'bottom' | 'outerwear' | 'shoes';

type CurrentOutfit = {
  roleId: string;
  slots: Partial<Record<OutfitSlot, string>>;
  revision: number;
  updatedAt: number;
  source: 'user' | 'agent' | 'event' | 'seed';
  outfitId?: string | null;
};
```

第一版可以将 `CurrentOutfit` 存在现有角色状态 / companion 资产状态中，但必须保持“当前穿着引用衣物资产 ID”的关系，不在当前穿着里复制衣物名称、图片和统计字段。

### 4.2.1 穿搭图片与初始组合字段

以下为本版后端施工契约，不表示已在共享类型或数据库落地。

| 字段 | 值域与含义 | 写入责任 |
|------|------|------|
| `CurrentOutfit.revision` | 非负整数，初始 0；每次实际槽位变化递增，同组合重试不递增 | 换装事务 |
| `outfitImage.roleId` | 所属角色稳定 ID | 世界服务 |
| `outfitImage.outfitRevision` | 发起请求时的穿搭 revision；发布时核验 | 图片调度服务 |
| `outfitImage.signature` | 规范化槽位、衣物视觉版本、角色参考版本和生成策略版本的摘要；缓存键，不含凭据 | 主进程纯函数 |
| `outfitImage.requestId` | 唯一请求 ID，用于防重与取消 / 过期结果隔离 | 图片调度服务 |
| `outfitImage.status` | `none` 无匹配图、`pending` 在途、`ready` 可展示、`failed` 本次失败 | 图片调度服务 |
| `outfitImage.mediaId` | 可空受控媒体 ID，成功后绑定；不直接保存 Renderer 临时 URI | 媒体服务 |
| `outfitImage.errorCode` / `errorMessage` | 可空错误分类 / 脱敏提示，失败不清除当前穿搭 | 图片调度服务 |
| `outfitImage.provider` / `model` / `promptAssetKey` | 实际生成溯源，仅 Debug 可见 | 统一生图入口 |
| `outfitImage.createdAt` / `updatedAt` | UTC Unix 毫秒 | 图片调度服务 |
| `seed.version` / `seed.key` | Role Pack 初始衣柜版本 / 稳定播种键；标记已播种，不能因为资产减少再次补种 | Role Pack loader 与播种事务 |
| `seed.items[].key` | 稳定衣物键，复用同一件时引用同一个键 | Role Pack 资产 |
| `seed.outfits[].key` / `name` / `slots` | 稳定组合键 / 名称 / 槽位引用衣物键；本版每套上装、下装、鞋履非空 | Role Pack 校验器 |
| `seed.defaultOutfitKey` | 必须指向已定义完整组合，初始化一次选中 | 播种事务 |
| `seed.outfits[].mediaKey` | 可空预置全身图资产键，必须与组合及角色外貌一致；缺失显示准确占位 | Role Pack loader |

图片缓存与请求记录不放进衣物 payload，不将人物整套图绑定为某件外套的主图。生成调度必须有取消、去重及失败可观测记录；连续换装采用尾沿合并，定时窗口由服务统一维护，不散落在 Renderer。

### 4.3 穿着事件

每次成功换上都应形成可解释的事件信号：

```text
wardrobe_changed
  role_id
  item_id
  slot
  previous_item_id
  source: user | agent | event
  created_at
```

事件负责记录变化和关联；衣物资产负责保存当前累计统计；当前穿着负责提供当前读取结果。朋友圈是否展示该事件由现有事件投影规则决定，不能由衣柜页面直接创建朋友圈内容。

## 5. 数据流与能力链路

```text
真实衣物资产 / 用户确认 / Agent 生成
  ↓
companion_assets（roleId + wardrobe payload）
  ↓
衣柜读取与图片受控读取
  ↓
用户点击“换上”或 Agent 调用 wardrobe.change
  ↓
主进程校验角色、资产类别和归属
  ↓
更新 current outfit slot + wearCount + lastWornAt
  ↓
写入 wardrobe_changed 事件
  ↓
刷新衣柜主区域、库存状态、Chat / Prompt 薄片和后续生图参考
```

失败路径必须完整：

- 资产不存在：拒绝写入并返回用户友好错误；
- 资产属于其他角色：拒绝写入并记录安全诊断；
- 图片读取失败：保留衣物名称和换上能力，展示可重试的缺图状态；
- 换上写入失败：当前穿着、库存状态和统计不能出现部分成功；
- 角色在请求期间切换：迟到响应不能覆盖新角色页面；
- 生图失败：衣物仍可保留为无图资产，不把失败结果当成正式图片。

## 6. UI 与 Playground 方案

### 6.1 Playground 候选结构

第一阶段只在 Playground 建立隔离候选，不修改正式人物世界默认行为：

```text
衣柜

当前穿着
  [主视觉 / 当前穿搭图片或稳定占位]
  上装   图片 + 名称
  下装   图片 + 名称
  外套   图片 + 名称（没有则不显示空槽）
  鞋履   图片 + 名称
  [换上]

我的衣物
  [全部] [上装] [下装] [外套] [鞋履]
  [图片] [图片] [图片]
  名称    名称    名称
  换上    换上    换上
```

候选必须使用现有 Foundation 组件、主题 token、共享图片预览器和稳定操作槽。不得为了衣柜单独造新的按钮、卡片、输入框、颜色语义或图片查看器。

### 6.2 展示原则

2026-10-06 待验收候选修正：删除“当前这一套”及主区域重复标题，取消左右分栏和大卡片外框；当前穿着全身图居中，保持 3:4 比例且上限 240 × 320px，衣物信息置于图片下方，宽屏四列、窄屏两列。补齐 9 件单品和小林三套全身图；无图、生成中、失败的主图占位同尺寸。该布局仅供 Playground 验收，不代表正式回流许可。

2026-10-06 用户确认的单行视图候选：衣柜内部使用同一条 Foundation 标签行“正在穿着 | 全部 / 上装 / 下装 / 外套 / 鞋履”，分隔符不参与焦点或选中。默认正在穿着只展示全身图与槽位衣物名称；全部与分类只展示对应衣物网格，不同时堆叠穿搭区。换上成功返回正在穿着，失败留在衣物列表并显示错误；视图切换保留穿着状态和导航几何。只在 Playground 候选启用，正式回流仍须单独许可。

- 当前穿着是首屏主视觉，库存是次级区域；
- 图片优先，名称是唯一必需文字；
- 分类使用轻量 Tab / segmented control，不做侧栏筛选面板；
- 缺图占位必须与有图状态保持相同宽高比；
- 长名称最多两行，不能把网格高度撑开；
- `换上` 始终预留固定宽度和高度，hover / 非 hover 不改变卡片几何；
- 当前穿着状态不能只依靠颜色，必须有文本或结构标识；
- 图片点击进入共享 `ImageViewer`，不在衣柜内另造预览逻辑；
- 长列表在局部滚动容器内滚动，不拖动整个应用布局；
- 深色和至少一种浅色主题都必须验证；
- 窄屏下主视觉、分类和卡片仍保持可读，不用缩放字体解决溢出。

### 6.3 状态样张

Playground 至少覆盖：

1. 当前穿着有四个部件；
2. 当前穿着只有一至两个部件；
3. 库存有图；
4. 库存无图；
5. 图片生成中；
6. 图片生成失败并可重试；
7. 长名称；
8. 当前正在穿着的衣物；
9. 空衣柜；
10. 读取失败但保留已有内容；
11. 换上进行中、成功和失败；
12. 图片预览工具栏与关闭路径。

## 7. Agent 与后端能力

### 7.1 第一版必须完成

- `wardrobe.browse`：返回衣物名称、类别、当前穿着槽位和必要图片状态；
- `wardrobe.change`：按稳定资产 ID 优先，名称匹配仅作为受控辅助；
- Renderer 点击 `换上` 走正式 IPC，不能只修改本地 React state；
- 主进程校验 `roleId`、资产归属、类别和当前活跃角色；
- 换上动作写入统计和 `wardrobe_changed` 事件；
- 切换角色、刷新、重载后状态一致；
- 真实衣物图片通过统一生图资产链生成、读取、备份和恢复。

- 衣物创建、字段更新与淘汰提供 Agent 可调用的领域动作，走世界服务，不暴露普通 Renderer 通用写入；这些能力属于本版，不是仅取消按钮后留空的后续能力。
- 写入统一经过角色归属、动作权限、字段白名单、类别、来源关联和重复请求校验；用户换上与 Agent 换上共用事务服务。
- Agent 写入保存请求 ID、执行来源、意图来源、理由与关联事件；失败不返回成功结果。淘汰正在穿着的衣物同事务结束穿着并清除槽位，保留历史。
- Agent 工具进入现有 ToolRegistry、权限与生产资产注册链；不直接沿用 Alice 的免审批声明，不新增绕过权限的 Debug 写入入口。
- 创建与生图分别记录状态，生图失败不能重复创建衣物；同一请求重试不能重复创建、淘汰或累计穿着次数。

### 7.2 后续预留但本合同不交付

- 基于天气、心情、计划和最近对话的整套穿搭推荐；
- 用户创建、命名、保存和删除穿搭组合；
- 穿搭历史时间线；
- 颜色和场合筛选；
- 配饰、包和随身物件与穿搭关联；
- 自动购买衣物和预算 / 消费引擎；
- 打开衣柜自动生成生活照片。

后续能力不能通过在第一版 UI 中提前露出假按钮完成“占位”，需要另立施工合同或在本合同变更记录中明确批准范围。

## 8. 施工顺序与每步验收

### Phase 0：合同确认与数据边界

- [x] 用户确认本合同的衣物边界、当前穿着模型和第一版展示范围。
- [ ] 复核现有 `companion_assets`、图片资产和角色隔离契约。
- [ ] 明确不迁移旧 Alice 资产，不把 Playground fixture 写入生产。

验收：合同中的 Schema、非目标和回流门槛被用户确认；没有未决的产品级歧义。

### Phase 1：Playground 候选

- [ ] 在 Playground 建立衣柜主视觉、当前穿着槽位、库存分类和卡片。
- [ ] 只使用 Foundation 组件和隔离 fixture。
- [ ] 使用语义正确的真实生图服饰样张，不使用茶桌等无关图片冒充衣物。
- [ ] 覆盖全部状态样张和几何稳定性验证。
- [ ] 候选移除衣柜添加 / 编辑 / 删除 / 淘汰按钮和表单，保留换上；不删除其他生活切面的共用编辑器能力。

验收：用户通过截图或内嵌浏览器确认信息层级、分类和操作位置。

### Phase 2：数据与后端

- [ ] 冻结共享类型、资产 payload 和当前穿着读取模型。
- [ ] 如需 IPC，按四处同步规则更新 shared types、preload、handler 和 `vite-env`。
- [ ] 实现角色归属、资产类别、换上事务、统计更新和事件记录。
- [ ] 实现 Agent 创建、纠正与淘汰领域动作，封闭普通 Renderer 通用写入衣柜的绕过路径。
- [ ] 验证对话授权、歧义询问、跨角色拒绝、重复请求、失败回滚与淘汰历史保留。
- [ ] 接通图片读取、生图状态、备份恢复和错误路径。

验收：真实 Electron 流程覆盖读取、换上、刷新、重载、角色切换和失败回滚。

### Phase 3：正式回流

- [ ] 用户明确确认 Playground 候选可以回流。
- [ ] 按 `playground-to-production` 流程回流正式衣柜。
- [ ] 正式页与候选同步主题、窄屏、长文本、图片预览和操作槽行为。
- [ ] 不把 Playground 导航、调试字段、fixture 或衣柜实验入口带入正式产品。

验收：正式人物世界的衣柜与 Playground 已确认候选一致，且使用真实数据链。

### Phase 4：收工与文档

- [ ] 更新 `docs/modules/companion.md` 的已落地能力与缺口。
- [ ] 按实际分层更新 `docs/architecture.md`、`docs/quality.md`、`docs/progress.md` 和 `docs/changelog.md`。
- [ ] 增加衣柜单测、IPC / Electron E2E 和图片状态回归。
- [ ] 运行自审、测试、类型检查、构建、lint、资产门禁和 `npm run docs:validate`。
- [ ] 通过项目 Git 门控后 commit + push。

## 9. 影响范围评估

### 9.1 可能修改

- `src/components/AssetsPanel.tsx` 与 Playground 人物世界候选；
- `src/components/world/WorldAssetEditor.tsx` 及衣物编辑 / 图片状态；
- `electron/main/companion/life/assets.ts`、事件 / 状态查询与存储；
- `src/shared/types.ts`、`electron/preload/index.ts`、相关 IPC handler、`src/vite-env.d.ts`；
- 图片生成、受控媒体读取、备份恢复和角色隔离测试；
- companion 模块卡、架构、质量、进展与变更日志。

### 9.2 破坏性策略

项目仍处于开发阶段，不保留旧 UI 和用户数据兼容层。允许在明确验证后破坏性调整测试数据和衣柜 payload，但不得静默删除未知用途的生产代码或绕过现有角色归属与媒体安全校验。

### 9.3 主要风险

| 风险 | 缓解 |
|------|------|
| 单件换上与整套穿搭概念混淆 | 用 `CurrentOutfit.slots` 引用资产 ID，第一版 UI 只做单件换上 |
| 图片语义错误导致生图不一致 | 只使用真实服饰样张；图片生成失败保留明确状态，不回退到无关图片 |
| Playground 与正式页再次分叉 | 先候选验收，再按回流技能同步；正式页和故事格同轮回归 |
| hover / 操作导致卡片跳动 | 所有操作槽固定占位，加入几何稳定性测试 |
| 旧角色数据混入当前衣柜 | 读取、写入、迟到响应和图片读取都校验 `roleId` |
| 把后续统计提前堆进首屏 | Schema 与展示层分离，第一版 UI 明确只显示图片、名称和状态 |
| 把家居物件继续塞进衣柜 | 在资产创建和编辑入口校验衣物类别，包 / 相机 / 雨伞路由到家居 |

## 10. 完成定义

本合同只有在以下条件全部满足后才能冻结：

1. Playground 候选经过用户确认，且截图覆盖主视觉、库存、分类、换上和边缘状态。
2. 衣柜只管理穿着类衣物，家居物件边界清晰。
3. Schema 保留图片、类别、颜色、风格、场合、穿着统计、生图状态和来源等后续字段。
4. 当前穿着通过槽位引用衣物资产，不复制第二份衣物事实。
5. `换上` 真实写入后端，统计、事件、UI 和 Prompt 薄片一致。
6. 图片生成、读取、预览、失败重试、备份恢复和角色隔离均有真实证据。
7. 正式回流没有带入 Playground fixture、Debug 字段或实验入口。
8. 深浅主题、窄屏、长名称、长列表、空态、失败态、hover 和加载态通过验收。
9. 测试、类型检查、构建、lint、文档门禁和 Git 门禁全部通过。
10. 普通衣柜无资产维护表单；Agent 创建、纠正与淘汰真实可用，Renderer 绕过写入被拒绝，用户仍可通过对话控制资产。

## 11. 确认闸

字段与范围已由用户确认，当前执行 Phase 0 和 Phase 1；在 Playground 候选得到明确验收前，不修改正式衣柜的产品布局和默认行为。

2026-10-06 用户确认第 2.5 节操作边界；本次仅同步施工合同，不代表后端已实现或正式回流已获许可。下一步先调整并验收 Playground 的衣柜维护入口，再按 Phase 2 完成真实数据链。

## 12. 服装图标对照候选

2026-10-07 用户许可在 Playground 比较 Phosphor 与 IconPark 的服装图标。默认原 Lucide 图标不变，统一状态控制可切换两组候选；正在穿着与全部继续使用 Lucide，套装 / 上装 / 下装 / 外套 / 鞋子使用各组五个代表性服饰图形。不要求类别只包含图标所画的具体服装；衣架、西服等语义是否合适仍由用户验收。

边界：仅隔离静态 SVG 素材及显式 previewTabIcons 注入，生产图标与默认行为不变，不安装第二套 runtime。用户许可构成本次外部静态素材选型例外，不代表全局允许混用图库或已获正式回流许可。来源版本、修改记录、原始许可证随素材保存；IconPark 已归档，仅取静态图形，风衣蓝色填充转单色轮廓，不依赖其 React runtime。

所有图标固定 14px，继承标签文字颜色，与文化角共用 TabStrip 的尺寸和间距。切换不能改变分类、穿搭、操作状态或几何；图片槽位、分隔符和无下划线规则保持。验收覆盖深浅、宽窄、素材可加载与非空图形、切换后状态保留及 hover / 选中占位。此候选不改变数据 Schema、Agent 操作或真实生图流程。
