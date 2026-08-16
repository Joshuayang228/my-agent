# M21 人格引擎与具名 Role Pack

> 代码走读：[`m21-persona-engine-code.md`](./m21-persona-engine-code.md)
> 最近核对：2026-08-16

---

## 一、第一性原理：人格是稳定身份与可变关系习惯的组合

人格不能只是语气形容词，也不能把所有内容都锁死。当前结构分为：

```text
PROTECTED  身份、价值观、事实诚实、安全底线
PROFILE    人物档案和表达基线
WORLD      默认生活世界
MUTABLE    可演化的表达、协作和关系默认值
RUNTIME    当前世界、关系阶段、记忆和本轮状态
```

判据是：改变后“还是不是同一个角色”。身份底线进入 PROTECTED；随着相处变化但不改变身份的行为习惯进入 MUTABLE；当前地点/心情不能写死进人物档案。

## 二、具名角色不是抽象模板

当前身份来自 Role Pack，而不是 warm-partner 等三种抽象 Persona。Role Pack 有 stable roleId、universe、来源和资产版本；名字不能自动推导职业、出身、住址或主题隐喻。角色故事只有在资产中明确写出时才是事实。

## 三、双锚点与防注入

System Prompt 开头放 PROTECTED 和中文防注入声明，结尾放中文身份尾锚点。两者每轮重建，防长上下文稀释和用户要求“忘掉身份”。防注入是认知提示，不替代工具权限和沙箱。

## 四、MUTABLE 已经是真实可变层

MUTABLE 默认值来自 Role Pack，按 role 的持久化覆盖、版本、校验、回滚和反思门由 M22 实现。它不是用户事实记忆；它是从长期互动中低频提炼出的行为默认值。

防退化原则：

- 不能改 PROTECTED；
- 不能制造用户没说过的关系；
- 不能强化依赖、操控或心理诊断；
- 变化必须可解释、可回滚、按 role 隔离。

## 五、人格与记忆联动但不合并

人格回答“我是谁”，记忆回答“我知道什么、我们经历过什么”。用户画像、召回记忆和 feedback 在 Prompt 的动态层进入；敏感记忆和错误引用仍由 M08/M29 管理。不能把记忆条目直接写进 PROTECTED。

## 六、人物档案与世界状态

Profile 描述相对稳定的外观、表达和背景；worldDefaults 是默认世界；当前地点、活动和事件以 M23 运行状态为准。Prompt 明示“默认档案不能覆盖当前状态”，避免静态资产和生活引擎打架。

## 七、会话与主角切换

每个会话绑定 role_id。切换 active role 走 pause/catch-up/resume；旧会话不会静默换人格。召唤卡司使用独立会话，不改变主角，也不恢复被召唤角色的生活时钟。

## 八、可观测与资产管理

Prompt、Role Pack、MUTABLE 版本和运行使用证据都能在 Debug 追溯 stable key、source、version、fingerprint；Playground 只能加载为实验草稿，不能复制一套生产 Persona 文案。

## 九、评估

人格质量同时依赖：

- Prompt/Role Pack 单测；
- B02–B07 真实 Persona pass^k；
- 禁用主题确定性 Grader；
- 人工自然度、角色一致性和情绪承接审阅。

## 十、当前缺口

- 没有自动生成新 Role Pack；
- 没有自动修改 PROTECTED；
- 没有无监督无限长期演化；
- 更长跨度的关系一致性仍需要跨会话真实 Eval。

这些限制是人格安全边界，不是“还差一个更长 Prompt”。
