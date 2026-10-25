import { ProactiveEvidenceContent } from '../debug/ProactiveEvidenceContent'
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
  return <ProactiveEvidenceContent result={available ? { state: 'unsupported', records: [], total: null, hasMore: false, boundary } : null}
    loading={previewState === 'loading'} error={previewState === 'error' ? '投递查询状态读取失败' : previewState === 'unavailable' ? '诊断接口不可用；需要桌面诊断连接。' : previewState === 'refresh-error' ? '刷新失败' : ''}
    onRetry={onRetry} onMoments={() => onPage('moments')} retryLabel={available ? '重试读取样张' : '读取查询样张'} />
}
