# M20 自进化与 Skill 管理 — 代码走读

> 理念章：[`m20-self-evolution.md`](./m20-self-evolution.md)
> 最近核对：2026-08-16
> 事实源：`electron/main/skills/loader.ts`、`skills/registry.ts`、`ipc/skills.ts`、`evals/skill/`

---

## 一、当前“自进化”只落地为受控资产演进

系统不会让模型自动改自己的主进程代码或 System Prompt。当前可变面是用户 Skill 与按角色 MUTABLE：

- Skill 可以创建、校验、编辑、版本备份、回滚、删除和隔离试跑；
- MUTABLE 由 M22 成长核负责；
- PROTECTED、权限策略、工具实现和核心 Prompt 不能由普通运行自动改写。

因此本章的代码事实是“可审计的 Skill 生命周期”，不是自治代码改写系统。

## 二、Frontmatter 只用数据解析器

`loader.ts` 使用 `js-yaml` 的 `JSON_SCHEMA` 解析 Frontmatter，不执行 JavaScript tag、模板或表达式。校验字段包括：

```text
name / description / version
when_to_use / allowed_tools
disable_model_invocation
```

名称、正文长度、字段类型和文件路径都有边界。解析失败返回结构化 issue，不把任意 YAML 当作可执行配置。

## 三、加载与唯一身份

内置 Skill 和用户 Skill 分目录扫描，统一形成 `SkillDefinition`：

```text
meta
body
source（builtin / user）
filePath
```

用户 Skill 可覆盖同名内置 Skill 时，来源和版本仍可在 Debug 资产目录追踪。Skill 的运行身份由 name 和激活工具名 `skill_invoke_<normalized-name>` 组成。

## 四、按需激活

每个允许模型调用的 Skill 注册一个激活工具。激活前，System Prompt 只包含 name、description、when_to_use 和调用方式；模型调用激活工具后，正文作为 tool_result 进入上下文，并记录：

```text
name / toolName / source / version / fingerprint
reason（截断）/ activatedAt
```

普通日志只记录 reason 的 hash/长度，不落正文。

## 五、工具白名单

激活 Skill 的 `allowed_tools` 是收窄条件，不是提权入口。Runtime 的工具解析从当前生产 Registry 中取交集；Skill 不可能声明一个系统不存在或父级不可用的工具后获得它。

Skill 激活工具本身只改变本轮 Agent 上下文，不直接写文件，因此 metadata 为只读。真正的副作用仍由后续具体工具经过权限/沙箱门闸。

## 六、保存与校验

`ipc/skills.ts` 在写入前调用 `validateSkillContent()`：

1. 校验名称和正文长度；
2. 解析 Frontmatter；
3. 返回 error / warning；
4. 只有无 error 时才保存；
5. 保存后 reload Registry，使 Debug 和运行入口一致。

Playground 的隔离试跑不把草稿自动保存为生产 Skill；保存是显式写操作。

## 七、版本备份

覆盖现有 `SKILL.md` 前：

```text
读取旧内容
→ 内容变化才备份
→ .versions/v{N}.md
→ N 单调递增
→ 最多保留 10 版
→ 写入新当前版本
```

版本按数字排序，避免 v10 排在 v2 前。相同内容重复保存不产生无意义版本。

## 八、回滚

`rollbackSkill(name, version)` 读取历史快照并复用 `saveSkill()`：当前内容会先被备份，再把目标版本写为当前，因此“回滚操作本身也可回滚”。版本列表和内容读取都校验 name 与正整数 version。

## 九、隔离 Eval

Skill Eval 独立于普通 Eval：

```text
evals/skill/cases.ts
evals/skill/runner.ts
evals/skill/grader-definitions.ts
evals/skill/report.ts
```

它验证触发、正文注入、allowed_tools、回复证据和报告；默认 Mock，无网络、无费用。Debug 只读展示报告和生产 Skill 资产来源。

## 十、安全边界

- 不使用 eval 或可执行 YAML；
- Skill 名称经过路径守卫，不能目录穿越；
- 正文和 Frontmatter 有大小边界；
- allowed_tools 只收窄；
- 历史版本位于 Skill 自己的 `.versions`；
- API Key、MCP env、用户记忆不进入 Skill 资产；
- 自动运行不能自行保存或删除 Skill。

## 十一、测试证据

- `skill-management.test.ts`：解析、校验、保存、删除与 IPC；
- `skill-versioning.test.ts`：备份、去重、上限、数字排序和回滚；
- `skill-eval.test.ts`：Case、Runner、Grader 和报告；
- `skill-eval-reports.test.ts`：Debug 报告读取边界；
- `model-context-assets.test.ts`：Skill 注册资产来源与 fingerprint。

## 十二、当前缺口

- 没有根据运行失败自动重写 Skill；
- 没有模型主动提出并自动应用 Skill 改进；
- 没有代码级自修改或自动 PR；
- 没有跨设备 Skill 分发和签名信任链。

这些仍是愿景，不能写成当前已有的“自进化闭环”。
