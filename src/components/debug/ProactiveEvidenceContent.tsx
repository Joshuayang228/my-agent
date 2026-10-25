import { ArrowUpRight } from 'lucide-react'
import type { DebugEvidenceResult } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'

type ProactiveReadResult = Pick<DebugEvidenceResult, 'state' | 'boundary' | 'records' | 'total' | 'hasMore'>

/** 背景：当前只有应用内问候广播，没有独立投递索引，普通消息不能充当回执。
 * 意图：正式与候选共用简洁能力边界，保留真实失败、重试和只读原始响应。
 * 约束：不查询设置或触发问候；unsupported 不能显示为空列表，异常 ready 也不能伪装成投递成功。
 */
export function ProactiveEvidenceContent({ result, loading, error, onRetry, onMoments, retryLabel = '重试' }: {
  result: ProactiveReadResult | null; loading: boolean; error: string; onRetry: () => void; onMoments: () => void; retryLabel?: string
}) {
  const supportedBoundary = result?.state === 'unsupported'
  return <section className="debug-proactive-workbench" data-testid="debug-evidence-proactive">
    {!supportedBoundary ? <>
      <div className="debug-proactive-state" role={error || result ? 'alert' : 'status'}><p>{error || (loading ? '正在读取投递查询状态…' : !result ? '投递查询尚未读取' : result.state === 'unavailable' ? '当前诊断源不可用。' : '投递查询返回了与当前契约不一致的结果；未将其解释为投递记录。')}</p>{!loading && <ActionButton onClick={onRetry}>{retryLabel}</ActionButton>}</div>
      {result && <details className="debug-prompt-provenance"><summary>来源与边界</summary><p>{result.boundary}</p><pre>{JSON.stringify(result, null, 2)}</pre></details>}
    </> : <>
      {error && <div className="debug-proactive-state" role="alert"><p>刷新失败，保留上次查询边界；下方不是最新结果。</p><ActionButton onClick={onRetry}>{retryLabel}</ActionButton></div>}
      {loading && <p className="debug-proactive-state" role="status">正在读取投递查询状态…</p>}
      <div className="debug-proactive-boundary" role="status"><h3>尚无独立投递记录源</h3><p>主动问候以应用内提醒呈现；当前诊断无法确认某条提醒是否送达。</p></div>
      <ActionButton variant="plain" onClick={onMoments}>查看朋友圈<ArrowUpRight size={14} /></ActionButton>
      <details className="debug-prompt-provenance"><summary>来源与边界</summary><p>{result.boundary}</p><dl className="debug-candidate-facts"><div><dt>读取结果</dt><dd>不支持独立投递查询</dd></div><div><dt>现有链路</dt><dd>定时器检查后通过 IPC 广播，界面显示应用内提示。</dd></div><div><dt>不能据此判断</dt><dd>当前开关、勿扰状态、上次送达时间或完整交付历史。</dd></div></dl><p>朋友圈是相关生活上下文，不是问候回执；本页不会触发问候或写入会话。</p><pre>{JSON.stringify(result, null, 2)}</pre><code>debug:companion-evidence-query · proactive</code></details>
    </>}
  </section>
}
