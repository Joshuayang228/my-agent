# 注册与管理：让 Agent 生产资产可追踪、可验证

> 本章是 My Agent 的独立方法论沉淀。
> 受 Alice 的结构化 Prompt 注册思路启发，但不复制外部项目的资产语义；以下规则来自本项目在 Prompt、Skill、伙伴资产、记忆策略、权限 / 沙箱策略、Eval Case / Grader 和模型 Provider 上的实际取舍。

## 1. 我们为什么需要注册表

Agent 的行为不是某一段 Prompt 单独决定的。

一次真实请求可能同时受到这些东西影响：

```text
稳定人格
+ 动态伙伴状态
+ 用户记忆召回
+ 记忆策略
+ Skill
+ Tool schema
+ 权限规则
+ 模型能力
+ Eval 约束
```

如果这些内容只是散落在：

- Markdown 文件
- JSON 文件
- 函数里的常量
- JSX 展示代码
- 数据库默认值
- 测试文件

那么开发者只能看到最终回复，却无法回答：

- 这条行为来自哪个资产？
- 它是哪一版？
- 为什么这次被注入？
- 为什么这次没有生效？
- 这次改动究竟改变了正文、策略还是运行时状态？

注册表的价值不是“把文件列出来”，而是把**行为来源变成可以引用的对象**。

## 2. 什么东西值得注册

一个东西满足以下任意条件，就值得考虑进入生产资产目录：

1. 会改变 Agent 的行为或模型输入；
2. 会改变工具是否执行、是否需要确认；
3. 需要版本回溯或指纹比较；
4. 需要被 Eval 引用；
5. 需要在 Debug 中解释“系统现在为什么这样”；
6. 未来可能被载入 Playground 做隔离实验。

当前资产目录的主要类型是：

```text
Prompt              模型可见的自然语言或模板
伙伴与人格          Role Pack、人物档案、默认世界、场景、生活 starter
Skill               可触发的工作能力和激活边界
Tool schema         模型可见的工具定义
记忆策略            提取、去重、召回、生命周期、纠错规则
权限与沙箱策略      档位、责任链、命令分级、路径边界、审批生命周期
Eval Case / Grader   场景、评分计划、结构化判据、Judge 检查项
Provider             协议适配能力、跨 Provider 策略和内置模型预设
```

这不是文件目录分类，而是**行为责任分类**。

## 3. 什么东西不应该注册

### 3.1 用户数据不是生产资产

用户的记忆、画像内容、会话历史和 MCP 返回内容，属于用户数据或外部数据。

它们应该记录：

```text
来源
时间
置信度
敏感性
纠正 / 删除状态
```

但不应进入和内置 Prompt、伙伴资产并列的生产资产目录。

### 3.2 运行时状态不是静态资产

当前心情、位置、精力、当天发生的事件、当前关系阶段，属于运行时状态。

正确的关系是：

```text
生产资产：默认世界、状态 schema、状态转换规则
运行时数据：当前世界切片、当前状态值、事件历史
```

不能因为 Debug 需要查看它们，就把每一次状态快照注册成资产。

### 3.3 日志不是注册表

LLM 回复、工具原始输出、调用耗时、Judge 结果和事件流属于运行记录。

注册表描述“它是什么”；运行记录描述“它什么时候被用过”。两者可以关联，但不能混为一物。

### 3.4 凭据永远不属于资产

API Key、密码、token、登录 Cookie 和用户私密凭据不进入资产 key、版本、指纹、报告或 Debug 目录。

## 4. 注册表不是第二事实源

这是最重要的原则。

错误做法：

```text
生产 Prompt
  + 复制一份到 registry.json
  + Debug 读取 registry.json
```

错误做法：

```text
记忆去重阈值在 memory-store.ts 有一份
注册表里再手写一份 0.85
```

正确做法：

```text
生产常量 / loader / 纯函数
          ↓
      注册描述器
          ↓
    Debug 生产资产目录
```

注册表可以整理元数据、生成结构化预览、计算指纹，但运行逻辑不能从注册表的复制值读取。

因此：

- Prompt 正文仍由 Prompt 生产常量提供；
- 伙伴档案仍由 Role Pack loader 提供；
- 记忆策略参数仍由 memory / vector 模块事实提供；
- Skill 正文仍由 Skill loader 提供；
- 工具 schema 仍由 ToolRegistry 提供；
- Provider 能力仍由真实请求构造器、路由规则和运行策略常量提供；
- 内置模型预设仍由共享 Provider Preset 注册表提供。

## 5. 统一字段和稳定身份

不同类型资产可以有专属字段，但应该共享一组可追踪字段：

```text
key
name
assetType
category
purpose
source
ownership
version
fingerprint
status
mode
dependencies
derivedFrom
```

### 5.1 key 是语义身份

key 表示“这是什么”，而不是“它现在放在哪个文件”。

例如：

```text
memory-strategy:vector-recall
companion:default:hang:profile
role-hang-protected-md
```

文件移动、文案润色和 UI 改名，不应随便改变 key。

### 5.2 source 是事实来源

source 必须能把开发者带回真正的生产来源：

```text
electron/main/memory/vector-store.ts
role-pack://default/roles/hang/profile.json
electron/main/companion/life/assets.ts#starter-definitions
```

不能只写“内置”“系统默认”这种无法定位的模糊标签。

### 5.3 version 和 fingerprint 解决不同问题

```text
version    人工理解的资产版本
fingerprint 机器判断内容是否变化
```

文案没改但组装结构变了，可以改变结构指纹；正文改了，应该改变内容指纹。

### 5.4 dependencies 记录行为前提

例如：

```text
memory-strategy:vector-recall
  → memory-recall-context
  → embedding-input
```

依赖关系让 Debug 能从资产看到行为链，而不是只能看到孤立卡片。

## 6. 三种资产生命周期

### 6.1 Production

生产资产来自代码、Role Pack、内置策略或经过确认的用户配置。

特点：

- 有稳定 key
- 有来源和版本
- Debug 只读
- 真实请求可以引用
- 改动需要测试

### 6.2 Experimental

实验资产来自生产资产的显式副本：

```text
production asset
→ derivedFrom
→ experiment draft
```

实验副本可以修改、A/B、跑 Eval，但不能因为在 Playground 里改过就自动影响真实会话。

### 6.3 Runtime

运行时数据包括：

- 当前状态
- 用户记忆
- 请求动态插槽
- 工具调用结果
- Eval 报告

它们可以引用生产资产，但不应反过来改写生产资产定义。

## 7. Debug、Playground 和 Settings 的分工

```text
Debug     生产真相：系统现在实际使用什么
Playground 隔离实验：如果改成这样会怎样
Settings  用户控制：用户允许修改什么
```

### Debug

Debug 必须展示：

- 生产资产列表
- 来源、版本、指纹
- 依赖和派生关系
- 真实请求引用
- 运行时状态的关联入口

### Playground

Playground 只允许：

- 显式载入生产资产为实验草稿
- 模拟上下文
- A/B 对比
- 运行隔离模型 / Eval

不能复制一套生产资产目录作为 Playground 的第二真相源。

### Settings

Settings 只提供用户真正拥有的编辑能力，例如：

- 用户安装的 Skill
- 用户自定义 L3 补充
- 记忆查看、纠正和删除

不把 Debug 变成源码编辑器，也不把 Playground 实验变成隐式设置写入。

## 8. 从“资产是什么”到“行为为什么”

成熟的注册管理不是只展示卡片，而是要形成来源链：

```text
资产定义
  ↓
实际组装器
  ↓
本次请求引用
  ↓
运行时动态插槽
  ↓
Agent 回复 / 工具执行
  ↓
Eval 或人工审阅
```

例如记忆召回问题应该能顺着这条链排查：

```text
memory-strategy:vector-recall
  ↓
向量检索参数
  ↓
memory-recall-context
  ↓
实际命中的 memory citations
  ↓
最终 System Prompt
  ↓
Agent 回复
```

如果只能看到策略卡片，却没有请求关联，那么它仍然只是“文档目录”，还不是可观测资产系统。

## 9. 我们的取舍

### 选择统一外壳，不选择单一语义

所有生产资产可以在“生产资产目录”统一查看，但 Prompt、Skill、记忆策略、权限策略不会被强行当成同一种对象。

统一的是：

```text
身份、来源、版本、指纹、状态、依赖、追踪
```

不统一的是：

```text
正文、策略参数、权限规则、Eval 判定、运行数据
```

### 先做可解释性，再做可编辑性

第一阶段先让开发者知道系统实际使用什么；只有当来源、依赖和运行链稳定后，才考虑实验编辑、Diff、导入导出和用户覆盖。

### 先做核心行为资产

优先级是：

```text
Prompt / 伙伴人格 / 记忆策略
→ 权限策略 / Eval
→ Provider 能力
→ 设计系统与外围应用
```

原因是前三类直接决定伙伴是否像一个可信的人、是否记得住用户、是否安全可控。

## 10. 当前状态与下一步

当前已经落地：

- Prompt 注册表
- Skill 注册表
- Tool schema 目录
- 伙伴与人格资产目录
- 记忆策略目录 v1
- 权限 / 沙箱策略目录 v1
- Eval Case / Grader 目录 v1
- Provider 能力目录 v1（三协议、五项策略、九个预设）

下一步再做：

- 伙伴结构化资产的 Playground 隔离草稿

这些后续项必须分别评估，不能因为已经有统一外壳，就一次性把所有系统配置都注册进去。
