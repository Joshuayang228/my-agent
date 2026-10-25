import { ChevronRight } from 'lucide-react'
import type { LLMCallDetail } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { TabStrip } from '../foundation/TabStrip'
import { savedMessages, messageScope } from './saved-context'

/** 背景：候选与生产曾各写一套上下文阅读，回流后仍展示完整调用管理台。
 * 意图：同一纯展示组件接收保存投影，按消息、工具和参数阅读。
 * 约束：不调用 IPC、不装配 Prompt；占位、长度、原始结构和未知数组分别解释，阅读状态由所属容器持有。
 */
export function SavedContextContent({ detail, view, onViewChange, allMessages, onShowAll, onRecord, truncated = false }: {
  detail: LLMCallDetail; view: string; onViewChange: (view: string) => void
  allMessages: boolean; onShowAll: () => void; onRecord: (id: string) => void; truncated?: boolean
}) {
  const messages = savedMessages(detail.requestMessages)
  const shown = allMessages || !messages || messages.length <= 8 ? messages : [messages[0], ...messages.slice(-7)]
  return <article aria-label="上下文保存范围" className="debug-context-detail">
          <div className="debug-context-heading"><code>{detail.id}</code><ActionButton variant="plain" onClick={() => onRecord(detail.id)}>查看这次调用</ActionButton></div>
          {truncated && <p className="debug-context-state">历史保留范围有界，不代表全部调用历史；不补齐未保存内容。</p>}
          <TabStrip label="上下文内容" variant="underline" items={[{ id: 'messages', label: '消息' }, { id: 'tools', label: '工具' }, { id: 'extra', label: '请求参数' }]} activeId={view} onSelect={onViewChange} />
          {view === 'messages' && <section aria-label="保存的消息">
            {messages === null ? <p className="debug-context-state">消息结构不是数组；原始值保留在来源中，不显示为零条消息。</p> : <>
              <p className="debug-context-caption">{messages.length} 条已保存消息结构{!messages.some(message => message.role === 'system') ? ' · 未返回独立 System 消息' : ''}</p>
              {messages.length > (shown?.length ?? 0) && <ActionButton variant="plain" onClick={onShowAll}>显示其余 {messages.length - (shown?.length ?? 0)} 条消息</ActionButton>}
              {shown?.map((message) => <details key={messages.indexOf(message)} className="debug-context-message"><summary><ChevronRight size={13} className="debug-context-chevron" /><span>{messages.indexOf(message) + 1} · {typeof message.role === 'string' ? message.role : 'unknown'}</span><span>{messageScope(message)}</span></summary>{typeof message.content === 'string' && message.content !== '（正文未持久化）' && <p className="debug-context-body">{message.content || '（已保存空字符串）'}</p>}<details><summary>完整消息结构</summary><pre>{JSON.stringify(message, null, 2)}</pre></details></details>)}
            </>}
          </section>}
          {view === 'tools' && <section aria-label="保存的工具"><p className="debug-context-caption">仅为当次日志保存的工具定义，不代表当前可执行权限。</p>{Array.isArray(detail.requestTools) && !detail.requestTools.length ? <p>已保存工具列表为空。</p> : <pre className="debug-context-json">{JSON.stringify(detail.requestTools, null, 2)}</pre>}</section>}
          {view === 'extra' && <section aria-label="保存的请求参数"><p className="debug-context-caption">仅为已保存参数，不用当前配置或当前资产正文补写历史。</p><pre className="debug-context-json">{JSON.stringify(detail.requestExtra, null, 2)}</pre></section>}
          <details className="debug-context-source"><summary>来源与完整保存结构</summary><p>来源为 llm_debug_logs 的保存投影。消息正文占位、长度和工具定义各有保存范围；空数组也可能来自读取回退，不能据此证明请求未携带输入。当前编译预览与历史请求不同。</p><p>调用者：{detail.caller} · 模型：{detail.model} · 会话：{detail.sessionId || '未记录'}</p><pre>{JSON.stringify({ id: detail.id, requestMessages: detail.requestMessages, requestTools: detail.requestTools, requestExtra: detail.requestExtra }, null, 2)}</pre></details>
        </article>
}
