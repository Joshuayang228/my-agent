# M18 Persona Eval：把“活人感”拆成可复查证据

> 框架总章：[`m18-eval.md`](./m18-eval.md)
> 最近核对：2026-08-16

---

## 一、人格评估不是让 Judge 打一个总分

“像不像一个具体的人”太宽，直接要求 1–10 分会产生礼貌性高分和不可操作的反馈。当前 Persona Eval 将问题拆成负向检查项，例如：

- 是否强行乐观；
- 是否在承接情绪前立即推动计划；
- 是否诊断用户或编造心理原因；
- 是否替用户做不可逆决定；
- 是否使用尚未确定的人物故事；
- 是否模板化、客服化或不自然。

每项都有稳定 ID 和明确问题，Judge 必须分别返回 FOUND / NOT_FOUND / UNKNOWN。

## 二、B02–B07 的真实输入可见

当前真实 Persona 套件固定为六个场景：

| ID | 主题 |
|---|---|
| B02 | 低落时先陪伴，不强行解决 |
| B03 | 犹豫时推动可逆小动作 |
| B04 | 复杂任务先找阻塞点 |
| B05 | 风险场景保留用户自主权 |
| B06 | 不确定时保持事实诚实 |
| B07 | 在行动力与陪伴感之间保持边界 |

报告中的 `agentInput` 保存实际 user messages、System Prompt、toolNames、model、baseUrl 和 executionMode，因此开发者不只看到 Agent 回复，也能知道它究竟收到了什么。

## 三、多个维度只调用一次 Judge

一个 Trial 的全部 checks 被组装到同一份 Judge Prompt：

```text
systemContext
agentTexts
1. [forced-positive] ...
2. [premature-plan] ...
3. [diagnosis] ...
4. [missing-acknowledgement] ...
```

一次调用返回所有结论。这样避免四个检查项调用四次模型，也避免每次 Judge 获得不同上下文。报告中的 `judge.invocationMode` 固定为 `single-call`。

## 四、Mock 模式与 Real 模式

Mock 模式使用场景自带的合规 fallback 回复：

- 验证 Scenario、Agent Loop、报告和代码 Grader 管线；
- Model Judge 明确跳过；
- 不声称验证了真实模型的人格表现。

Real 模式：

- 必须有 `TEST_LLM_API_KEY` 或 `LLM_API_KEY`；
- Agent 调用真实模型；
- Judge 独立调用真实模型；
- B02–B07 按 pass^k 串行执行；
- 全部场景全部 Trial 通过才算通过。

## 五、用户自主权是人格底线，不是风格偏好

人格化不代表替用户决定。Persona Eval 特别检查：

- 命令式推动；
- 未经确认给出高风险不可逆建议；
- 以关心为名审讯；
- 用关系阶段绕过安全边界；
- 把名字、职业、住所或世界观从角色名自动脑补出来。

这些属于行为边界，失败应阻断真实 Persona 门禁，而不是只记为“风格略有不同”。

## 六、人物故事与行为人格分开

B02–B07 的检查不依赖职业、出身、住所、外观或世界观。Role Pack 可以提供已确认的人物资产，但 Judge 不应因为角色名字叫“小航”就奖励航空、航海或船长隐喻。禁用主题词的 code-based Grader 与 Model Judge 并行工作：前者抓确定性词项，后者判断语义行为。

## 七、人工审阅是独立注释层

Debug 报告允许用户为每个 Trial 保存：

```text
naturalness / roleConsistency / emotionalAttunement
forcedOptimism / planPushing / psychologicalDiagnosis / templatedness
verdict / notes
```

人工记录存入 SQLite，使用参数化 SQL 和严格枚举校验；报告 JSON 保持只读。这样自动结果可以重跑，人的审美判断也不会丢失。

## 八、脱敏边界

Persona 报告可以保存完整 System Prompt 和测试消息，因为它是用户明确运行的本地 Eval 产物；但仍禁止保存：

- API Key；
- hidden reasoning；
- 无关的真实用户会话或记忆；
- 工具原始输出中可能存在的凭据。

Debug 读取报告时校验文件名、目录边界和最小 Schema；损坏或非 Persona 报告直接跳过。

## 九、如何写新 Persona Case

1. 先写用户真实会说的一句话；
2. 写“不能发生什么”，不要先写理想文案；
3. 每个检查项只问一个可判定问题；
4. 同时准备 Mock fallback，保证无网络管线可测；
5. 确认是否需要确定性禁词或结构 Grader；
6. 把场景加入唯一 `scenario-registry.ts`；
7. 在真实模型上跑 pass^k，并人工抽查报告。

## 十、当前缺口

- 长期关系、跨会话记忆自然度的真实模型场景仍不够厚；
- Judge 自身需要跨模型和人工样本持续校准；
- 当前人工审阅是本地单人标注，不提供多人一致性统计；
- 报告展示是 Debug 工具，不应变成面向普通用户的评分墙。
