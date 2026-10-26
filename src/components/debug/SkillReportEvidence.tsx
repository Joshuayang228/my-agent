import type { DebugSkillEvalReport, SkillEvalCaseReport } from '../../shared/types'
import { Badge } from '../foundation/Badge'

const GRADERS = [['SkillActivation', '触发'], ['SkillInjection', '指南注入'], ['SkillToolBoundary', '工具边界'], ['SkillResponse', '回复约束']]
export function skillReportNotices(report: DebugSkillEvalReport): string[] {
  const notices: string[] = []
  if (!Number.isInteger(report.totalCases) || !Number.isInteger(report.passedCases) || report.totalCases < 0 || report.passedCases < 0 || report.passedCases > report.totalCases || report.totalCases !== report.cases.length || report.passedCases !== report.cases.filter(item => item.pass).length) notices.push('报告保存计数与逐项内容不一致；保留原值，不重新判分。')
  if (new Set(report.cases.map(item => item.id)).size !== report.cases.length) notices.push('报告含重复场景标识，按保存顺序分别保留。')
  return notices
}

/** 背景：Skill 验收需要逐 grader 核对因果，回复和技术元信息不应同时铺满首屏。
 * 意图：先读判定与回复，再按需展开实际输入 / 运行字段，沿用生产报告值。
 * 约束：不运行 grader、不生成激活理由；场景 ID、零耗时、未知 grader 和所有原有证据字段均保留。
 */
export function SkillReportEvidence({ item }: { item: SkillEvalCaseReport }) {
  return <>
    {item.error && <p className="debug-quality-fail debug-quality-body">{item.error}</p>}
    <section aria-label="逐项判定证据"><h3>判定证据</h3>{item.graderResults.map((grader, index) => <details className="debug-quality-fields" key={`${index}:${grader.graderName}`} open={!grader.result.pass}><summary><Badge tone={grader.result.pass ? 'success' : 'danger'}>{grader.result.pass ? '通过' : '失败'}</Badge> {GRADERS.find(([name]) => name === grader.graderName)?.[1] ?? grader.graderName}</summary><p className="debug-quality-body">{grader.result.violations.join('；') || '无违规'}</p>{grader.result.evidence.map((text, position) => <p className="debug-quality-body" key={position}>{text}</p>)}</details>)}</section>
    <section><h3>Agent 回复</h3><p className="debug-quality-body">{item.evidence.agentText || '（空）'}</p></section>
    <details className="debug-quality-fields"><summary>实际输入</summary><p className="debug-quality-body"><strong>用户输入：</strong>{item.input.userPrompt}</p><dl><dt>Skill</dt><dd>{item.input.skill.name} · {item.input.skill.version} · {item.input.skill.source}</dd><dt>指纹</dt><dd><code>{item.input.skill.fingerprint}</code></dd><dt>预期触发</dt><dd>{item.input.expectedActivation ? '是' : '否'}</dd><dt>激活工具</dt><dd>{item.input.skill.toolName}</dd><dt>允许工具</dt><dd>{item.input.allowedTools.join('、') || '无'}</dd><dt>模型</dt><dd>{item.input.model}</dd></dl></details>
    <details className="debug-quality-fields"><summary>运行证据与字段</summary><dl><dt>场景标识</dt><dd><code>{item.id}</code></dd><dt>耗时</dt><dd>{item.durationMs} ms</dd><dt>指南注入</dt><dd>{item.evidence.injectionObserved ? '已观察到' : '未观察到'}</dd><dt>工具调用</dt><dd>{item.evidence.toolCalls.join('、') || '无'}</dd></dl><h3>激活 Trace</h3>{item.evidence.activations.length ? <pre>{JSON.stringify(item.evidence.activations, null, 2)}</pre> : <p>无</p>}</details>
  </>
}
