import type { PersonaEvalHumanReview, PersonaEvalHumanReviewInput, PersonaEvalScenarioReport, DebugPersonaEvalReport } from '../../shared/types'
import { Badge } from '../foundation/Badge'
import { HumanReviewSection } from './PersonaEvalHumanReview'

export const personaReviewKey = (scenarioId: string, trialId: string) => JSON.stringify([scenarioId, trialId])
// 背景：历史审阅使用场景与轮次定位；意图：保留持久化键而不借报告内 trial.id 替换；约束：顺序来自保存报告，不能重排后再生成。
export const personaTrialId = (scenarioId: string, index: number) => `${scenarioId}-trial-${index + 1}`
export const personaReviewLabel = (review?: PersonaEvalHumanReview) => !review ? '未审阅' : review.verdict === 'pass' ? '已审阅 · 通过' : review.verdict === 'revise' ? '已审阅 · 需要修改' : review.verdict === 'uncertain' ? '已审阅 · 无法判断' : '已审阅 · 未下结论'

export function personaReportNotices(report: DebugPersonaEvalReport): string[] {
  const notices: string[] = []
  const count = (value: number) => Number.isInteger(value) && value >= 0
  if (!count(report.totalScenarios) || !count(report.passedScenarios) || report.totalScenarios !== report.scenarios.length || report.passedScenarios !== report.scenarios.filter(item => item.pass).length || !count(report.k) || report.k === 0 || report.scenarios.some(item => !count(item.k) || item.k === 0 || !count(item.passes) || item.k !== item.trials.length || item.passes !== item.trials.filter(trial => trial.pass).length)) notices.push('报告保存计数与逐项内容不一致；保留原值，不重新判分。')
  if (new Set(report.scenarios.map(item => item.id)).size !== report.scenarios.length) notices.push('报告含重复场景标识，逐项保留；重复场景不提供人工审阅写入。')
  return notices
}

/** 背景：人格报告的实际回复、自动依据和人工审阅不能由一个通过标志代替。
 * 意图：先阅读完整回复与判定，再按需展开输入 / Judge / 运行字段，审阅仍走既有持久化接口。
 * 约束：不重新评分；保留历史轮次定位、全部快照和零耗时，无法确定审阅归属时禁止写入。
 */
export function PersonaReportEvidence({ reportFileName, scenario, reviews, reviewsReady, reviewWritable, ambiguous, onSave, onDelete }: {
  reportFileName: string; scenario: PersonaEvalScenarioReport; reviews: Record<string, PersonaEvalHumanReview>; reviewsReady: boolean; reviewWritable: boolean; ambiguous: boolean
  onSave: (input: PersonaEvalHumanReviewInput) => Promise<boolean>
  onDelete: (input: Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>) => Promise<boolean>
}) {
  return <div data-testid={`persona-eval-scenario-${scenario.id}`}>
    <p className="debug-quality-state">保存场景：<code>{scenario.id}</code> · {scenario.passes}/{scenario.k} 轮通过</p>
    {!scenario.trials.length && <p className="debug-quality-state">该场景没有保存轮次，不补默认回复或人工结论。</p>}
    {scenario.trials.map((trial, index) => {
      const trialId = personaTrialId(scenario.id, index), review = reviews[personaReviewKey(scenario.id, trialId)]
      return <details className="debug-quality-fields" data-testid={`persona-eval-trial-${trialId}`} key={index}>
        <summary>第 {index + 1} 轮 · <Badge tone={trial.pass ? 'success' : 'danger'}>{trial.pass ? '通过' : '失败'}</Badge> · {trial.durationMs} ms · {reviewsReady ? personaReviewLabel(review) : '审阅未读取'}</summary>
        {trial.error && <p className="debug-quality-body debug-quality-fail">{trial.error}</p>}
        <section><h3>Agent 回复</h3>{trial.agentTexts.length ? trial.agentTexts.map((text, position) => <p className="debug-quality-body" key={position}>{text || '（空文本）'}</p>) : <p className="debug-quality-body">无 text 事件</p>}</section>
        <section><h3>自动判定证据</h3>{trial.graderResults.map((grader, position) => <details className="debug-quality-fields" key={position} open={!grader.result.pass}><summary>{grader.graderName} · {grader.result.pass ? '通过' : '失败'}</summary>{grader.result.violations.map((text, i) => <p className="debug-quality-body" key={`v:${i}`}>违规：{text}</p>)}{grader.result.evidence.map((text, i) => <p className="debug-quality-body" key={`e:${i}`}>依据：{text}</p>)}</details>)}</section>
        <details className="debug-quality-fields"><summary>Agent 实际输入</summary>{trial.agentInput ? <><dl><dt>模型</dt><dd>{trial.agentInput.model}</dd><dt>端点</dt><dd>{trial.agentInput.baseUrl}</dd><dt>执行模式</dt><dd>{trial.agentInput.executionMode}</dd><dt>工具</dt><dd>{trial.agentInput.toolNames.join('、') || '无'}</dd></dl>{trial.agentInput.messages.map((message, i) => <section key={i}><h3>{message.role}</h3><p className="debug-quality-body">{message.content}</p></section>)}<details className="debug-quality-fields"><summary>实际 System Prompt 快照</summary><pre>{trial.agentInput.systemPrompt}</pre></details></> : <p className="debug-quality-body">历史报告未记录输入快照，不推断实际输入。</p>}</details>
        <details className="debug-quality-fields"><summary>Judge 评分标准</summary>{trial.judge ? <><p className="debug-quality-body">保存计划：{trial.judge.graderName} · {trial.judge.invocationMode} · {trial.judge.checks.length} 项；计划本身不证明已执行。</p><p className="debug-quality-body">{trial.judge.systemContext}</p>{trial.judge.checks.map((check, i) => <p className="debug-quality-body" key={i}><code>{check.id}</code> · {check.question}</p>)}</> : <p className="debug-quality-body">没有保存 Judge 计划，不判断是否曾调用 Judge。</p>}</details>
        <details className="debug-quality-fields"><summary>轮次原始字段</summary><pre>{JSON.stringify({ id: trial.id, description: trial.description, mode: trial.mode, durationMs: trial.durationMs, reviewTrialId: trialId }, null, 2)}</pre></details>
        {!reviewsReady || ambiguous ? <p className="debug-quality-state">{ambiguous ? '场景标识重复，人工审阅归属不明确；保留报告证据，不提供审阅写入。' : '审阅尚未成功读取，不能判定未审阅或覆盖已有记录。'}</p> : <HumanReviewSection disabled={!reviewWritable} reportFileName={reportFileName} scenarioId={scenario.id} trialId={trialId} review={review} onSave={onSave} onDelete={onDelete} />}
      </details>
    })}
  </div>
}
