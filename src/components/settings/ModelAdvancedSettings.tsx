import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { ChevronRight, LoaderCircle } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { SettingCard, ScopeBadge } from './SettingsFields'
import { MODEL_PARAMETER_LIMITS, modelParameterError, type ModelParameterKey } from '../../shared/model-parameters'
import type { LLMConnectionTestResult } from '../../shared/types'

interface Props {
  values: Record<ModelParameterKey, string>
  onChange: (key: ModelParameterKey, value: string) => void
  testIdentity: string
  testTarget?: string
  onTest: () => Promise<LLMConnectionTestResult>
  saveFailed?: boolean
  onRetrySave?: () => void
  testIdPrefix?: string
}

/**
 * 候选与正式高级区共用控件和请求状态，但数据保存与测试实现由调用方注入。
 * 用配置身份及请求代际丢弃迟到结果，不把旧连接测试成功显示到新连接；卸载同样失效。
 * 按钮始终保留同一操作槽，候选回调不得触达真实配置或网络。
 */
export function ModelAdvancedSettings({ values, onChange, testIdentity, testTarget, onTest, saveFailed, onRetrySave, testIdPrefix = 'settings-' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const request = useRef(0)
  const pending = useRef(false)
  const panelId = useId()
  useEffect(() => { if (saveFailed) setExpanded(true) }, [saveFailed])
  useEffect(() => {
    request.current++
    pending.current = false
    setState('idle')
    setMessage('')
    return () => { request.current++; pending.current = false }
  }, [testIdentity])
  const test = async () => {
    if (pending.current || !testTarget) return
    pending.current = true
    const token = ++request.current
    setState('loading')
    setMessage('')
    try {
      const result = await onTest()
      if (token !== request.current) return
      setState(result.ok ? 'success' : 'error')
      setMessage(result.ok ? `连接测试通过：${result.model}` : result.error)
    } catch {
      if (token !== request.current) return
      setState('error')
      setMessage('连接测试未完成，请重试。')
    } finally {
      if (token === request.current) pending.current = false
    }
  }
  const field = (key: ModelParameterKey) => {
    const limits = MODEL_PARAMETER_LIMITS[key]
    const error = modelParameterError(key, values[key])
    const errorId = `${panelId}-${key}-error`
    return <label className="block min-w-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
      {limits.label}
      <TextField type="number" min={limits.min} max={limits.max} step={limits.step} aria-label={limits.label}
        value={values[key]} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(key, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2" />
      {error && <span id={errorId} className="mt-1 block" style={{ color: 'var(--danger)' }}>{error}</span>}
    </label>
  }
  return <SettingCard testId={`${testIdPrefix}model-advanced`}>
    <ActionButton onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={panelId}
      className="w-full gap-3 border-0 p-0 text-left" style={{ justifyContent: 'space-between' }} data-testid={`${testIdPrefix}model-advanced-toggle`}>
      <span className="min-w-0"><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>高级设置</span>
        <span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>连接测试、预算和生成参数只在需要时查看。</span></span>
      <ChevronRight size={14} className={`shrink-0 transition ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
    </ActionButton>
    {expanded && <div id={panelId} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <div data-testid={`${testIdPrefix}model-budget`}>
        <div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>运行预算 <ScopeBadge label="全局" /></div>
        <div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>输入与输出 Token 合计；0 表示不限制。</div>
        <div className="grid gap-2 sm:grid-cols-2">{field('sessionTokenBudget')}{field('dailyTokenBudget')}</div>
        <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>当前：{modelParameterError('sessionTokenBudget', values.sessionTokenBudget) ? '待填写有效预算' : Number(values.sessionTokenBudget) === 0 ? '不限制' : `${values.sessionTokenBudget} Token`}</div>
      </div>
      {field('llmTemperature')}
      {saveFailed && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--danger)' }}>设置未保存，修改仍保留。<ActionButton onClick={onRetrySave}>重试保存</ActionButton></div>}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ActionButton onClick={() => { void test() }} disabled={!testTarget || state === 'loading'} aria-busy={state === 'loading'}
          className="h-8 w-28 gap-1" data-testid={`${testIdPrefix}model-test`}>
          <span className="inline-flex h-3 w-3 shrink-0">{state === 'loading' && <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />}</span>
          测试连接
        </ActionButton>
        <span className="min-w-0 break-all text-[10px]" style={{ color: 'var(--text-muted)' }}>{testTarget ? `主对话 · ${testTarget}` : '请先为主对话安排模型。'}</span>
      </div>
      {message && <div role="status" className="break-words rounded-[var(--radius-md)] px-3 py-2 text-[11px]" style={{ background: state === 'success' ? 'var(--accent-subtle)' : 'color-mix(in srgb, var(--danger) 10%, transparent)', color: state === 'success' ? 'var(--accent-fg)' : 'var(--danger)' }} data-testid={`${testIdPrefix}model-status`}>{message}</div>}
    </div>}
  </SettingCard>
}
