import { useLayoutEffect, useRef } from 'react'
import type { DebugEvalRunPlan, DebugEvalRunStatus } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'

/** 背景：受控 Eval 是显式诊断，不应占据报告首屏或把进程成功当人格结论。
 * 意图：保留白名单、完整进度、输出和停止能力，交由父级维护真实状态。
 * 约束：未知状态 / 请求中不可重复启动；费用确认留在独立模态，不能绕过主进程检查。
 */
export function EvalRunnerCard({ plans, status, known, error, busy, onRun, onCancel }: { plans: DebugEvalRunPlan[]; status: DebugEvalRunStatus; known: boolean; error: string; busy: boolean; onRun: (plan: DebugEvalRunPlan) => void; onCancel: () => void }) {
  const running = status.state === 'running'
  const elapsed = status.startedAt ? Math.max(0, Math.round(((status.endedAt ?? Date.now()) - status.startedAt) / 1000)) : undefined
  const labels = { idle: '未运行', running: '运行中', succeeded: '进程成功结束', failed: '失败', cancelled: '已停止' }
  return <section className="debug-persona-controls" aria-label="受控 Eval 运行">
    <p className="debug-quality-body">固定白名单套件，不接受任意命令；真实验收会消耗模型调用。</p>
    <div className="debug-quality-toolbar">{plans.map(plan => <ActionButton key={plan.suite} onClick={() => onRun(plan)} disabled={busy || running || !plan.available} title={plan.unavailableReason}>{plan.label}</ActionButton>)}{running && <ActionButton tone="danger" onClick={onCancel} disabled={busy || status.cancelRequested}>停止</ActionButton>}</div>
    <p className="debug-quality-state">状态：{known ? labels[status.state] : '未读取'}{status.suite && ` · ${status.suite === 'mock' ? '模拟 Eval' : status.suite === 'skill' ? 'Skill Eval' : '真实 Persona Eval'}`}{elapsed !== undefined && ` · ${elapsed}s`}{typeof status.completedTrials === 'number' && typeof status.totalTrials === 'number' && ` · ${status.completedTrials}/${status.totalTrials}`}{status.cancelRequested && ' · 正在停止进程树…'}</p>
    {status.scenarios?.length ? <details className="debug-quality-fields"><summary>场景运行进度</summary>{status.scenarios.map((scenario, i) => <p className="debug-quality-body" key={i}>{scenario.id} · {scenario.completedTrials}/{scenario.totalTrials} · 通过 {scenario.passedTrials} · {scenario.state}</p>)}</details> : null}
    {(error || status.error) && <p className="debug-quality-body debug-quality-fail" role="alert">{error || status.error}</p>}
    {status.output && <details className="debug-quality-fields" open={running}><summary>运行输出</summary><pre>{status.output}</pre></details>}
  </section>
}

/** 背景：真实验收有模型费用，确认时仍需核对当前固定计划。
 * 意图：沿用确认内容，使用浏览器模态焦点边界与 Foundation 操作。
 * 约束：遮罩不提交，Esc 取消，卸载前关闭并恢复触发焦点；执行始终由主进程重新校验。
 */
export function EvalRunConfirmDialog({ plan, onCancel, onConfirm }: { plan: DebugEvalRunPlan; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => { const node = dialog.current, previous = document.activeElement; node?.showModal(); return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus() } }, [])
  return <dialog ref={dialog} className="debug-persona-confirm" aria-label="确认真实 Persona Eval" onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onCancel() }}>
    <h3>开始真实 Persona Eval？</h3><p className="debug-quality-body">这会调用真实模型并产生 API 消耗，运行期间可停止。</p>
    <dl>{[['模型', plan.model ?? '未提供'], ['端点', plan.baseUrl ?? '未提供'], ['场景数', plan.scenarioCount ?? '未知'], ['稳定性', plan.passK === undefined ? '未知' : `pass^${plan.passK}`], ['预计 Agent 调用', plan.estimatedAgentCalls ?? '未知'], ['预计 Judge 调用', plan.estimatedJudgeCalls ?? '未知']].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
    <div className="debug-quality-toolbar"><ActionButton onClick={onCancel}>取消</ActionButton><ActionButton tone="accent" onClick={onConfirm}>开始真实验收</ActionButton></div>
  </dialog>
}
