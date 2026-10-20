import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { DEBUG_EVIDENCE_PAGES, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type ProactivePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error'
interface Props {
  previewState: ProactivePreviewState
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
}
/** 背景：当前诊断明确不支持独立投递查询，普通会话夹具曾被误当成主动消息证据。
 * 意图：展示真实读取边界及相关上下文，来源按需展开，不给没有数据源的列表制造空态。
 * 约束：不读取设置、不触发问候、不补统计或回执；刷新只能保留已读 unsupported 响应。
 */
export function DebugProactiveCandidate({ previewState, onRetry, onPage }: Props) {
  const available = previewState === 'ready' || previewState === 'refresh-error'
  const boundary = DEBUG_EVIDENCE_PAGES.proactive.boundary
  return <section className="debug-proactive-workbench" data-testid="debug-evidence-proactive">
    {!available ? <div className="debug-proactive-state" role={previewState === 'unavailable' || previewState === 'error' ? 'alert' : 'status'}><p>{previewState === 'unread' ? '投递查询尚未读取' : previewState === 'loading' ? '正在读取投递查询状态…' : previewState === 'unavailable' ? '诊断接口不可用；需要桌面诊断连接。' : '投递查询状态读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取查询样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-proactive-state" role="alert"><p>刷新失败，保留上次查询边界；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      <div className="debug-proactive-boundary" role="status"><h3>尚无独立投递记录源</h3><p>主动问候以应用内提醒呈现；当前诊断无法确认某条提醒是否送达。</p></div>
      <ActionButton variant="plain" onClick={() => onPage('moments')}>查看朋友圈<ArrowUpRight size={14} /></ActionButton>
      <details className="debug-prompt-provenance"><summary>来源与边界</summary><p>{boundary}</p><dl className="debug-candidate-facts"><div><dt>读取结果</dt><dd>不支持独立投递查询</dd></div><div><dt>现有链路</dt><dd>定时器检查后通过 IPC 广播，界面显示应用内提示。</dd></div><div><dt>不能据此判断</dt><dd>当前开关、勿扰状态、上次送达时间或完整交付历史。</dd></div></dl><p>朋友圈是相关生活上下文，不是问候回执；本页不会触发问候或写入会话。</p><pre>{JSON.stringify({ state: 'unsupported', records: [], total: null, hasMore: false, boundary }, null, 2)}</pre><code>debug:companion-evidence-query · proactive</code></details>
    </>}
  </section>
}
