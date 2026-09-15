import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { IconButton } from './foundation/IconButton'
import { TextField } from './foundation/TextField'
import { SelectField } from './foundation/SelectField'
import { SettingCard, SettingSwitch } from './settings/SettingsFields'
import { createEmptyPermissionRule, parsePermissionRulesJson, serializePermissionRules,
  type PermissionRuleAction, type PermissionRuleForm, type PermissionRuleType } from '../shared/permission-rules'

const TYPE_LABELS: Record<PermissionRuleType, string> = {
  command: '命令', 'file-write': '修改文件', 'file-delete': '删除文件', tool: '工具', path: '路径',
}
const ACTION_LABELS: Record<PermissionRuleAction, string> = { allow: '允许', ask: '需要确认', deny: '拒绝' }
const NEW_TYPES: PermissionRuleType[] = ['command', 'file-write', 'file-delete']

export function PermissionRulesEditor({ value, onChange, prefix = 'settings' }: {
  value: string
  onChange: (json: string) => Promise<void> | void
  prefix?: string
}) {
  const parsed = useMemo(() => parsePermissionRulesJson(value), [value])
  const rules = parsed.ok ? parsed.rules : []
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<PermissionRuleForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const active = useRef(true)
  const baseValue = useRef(value)
  const addButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const beginDraft = (rule?: PermissionRuleForm) => {
    baseValue.current = value
    setEditingId(rule?.id ?? null)
    setDraft(rule ? { ...rule } : createEmptyPermissionRule())
    setDeletingId(null)
    setError('')
  }
  const cancelDraft = () => { setDraft(null); setEditingId(null); setError(''); addButton.current?.focus() }
  const save = async (next: PermissionRuleForm[], closesDraft = false) => {
    if (pending.current) return
    if (closesDraft && value !== baseValue.current) {
      setError('规则已在其他位置更改，请取消后重新编辑。')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await onChange(serializePermissionRules(next))
      if (!active.current) return
      if (closesDraft) { setDraft(null); setEditingId(null); addButton.current?.focus() }
      setDeletingId(null)
    } catch {
      if (active.current) setError('规则未保存。请检查匹配表达式后重试，草稿已保留。')
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }
  const submitDraft = () => {
    if (!draft || !draft.pattern.trim()) return
    void save(editingId ? rules.map(rule => rule.id === editingId ? draft : rule) : [...rules, draft], true)
  }
  const updateDraft = (patch: Partial<PermissionRuleForm>) => setDraft(current => current && { ...current, ...patch })
  const toggleId = prefix === 'settings' ? 'settings-permission-rules-toggle' : prefix + '-rules-existing-toggle'

  return <section className="py-4 sm:py-5" data-testid={prefix + '-rules-existing'}>
    <ActionButton aria-expanded={expanded} aria-controls={prefix + '-rules-content'} disabled={busy}
      onClick={() => setExpanded(current => !current)} data-testid={toggleId}
      className="w-full justify-between gap-3 border-0 p-0 text-left">
      <span className="min-w-0"><span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}><SlidersHorizontal size={15} />自定义规则</span>
        <span className="mt-1 block text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>已保存的例外规则，优先于默认审批方式生效。</span></span>
      <span className="flex shrink-0 items-center gap-2 text-[10px]"><span>{rules.length} 条</span><ChevronRight size={14} className={expanded ? 'rotate-90' : ''} /></span>
    </ActionButton>
    {expanded && <div id={prefix + '-rules-content'} className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
      {!parsed.ok && <p role="alert" className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>规则数据无法读取：{parsed.error}。原数据未更改。</p>}
      <ul className="space-y-3" aria-label="自定义规则列表">{rules.map(rule => <li key={rule.id}>
        <SettingCard testId={prefix + '-rule-card'}>
          <div className="group flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1" style={{ opacity: rule.enabled ? 1 : 0.55 }}>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{ACTION_LABELS[rule.action]} · {TYPE_LABELS[rule.type]}</div>
              <div className="mt-1 break-all font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{rule.pattern}</div>
              {rule.description && <p className="mt-1 break-words text-[11px]" style={{ color: 'var(--text-muted)' }}>{rule.description}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: rule.action === 'deny' ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--accent-subtle)', color: rule.action === 'deny' ? 'var(--danger)' : 'var(--accent-fg)' }}>{rule.enabled ? ACTION_LABELS[rule.action] : '已停用'}</span>
              <div className="flex h-7 items-center gap-1">
                <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <IconButton label={'编辑规则 ' + rule.pattern} disabled={busy || !!draft} onClick={() => beginDraft(rule)}><Pencil size={13} /></IconButton>
                  <IconButton label={'删除规则 ' + rule.pattern} disabled={busy || !!draft} onClick={() => { setDeletingId(rule.id); setError('') }}><Trash2 size={13} /></IconButton>
                </div>
                <SettingSwitch checked={rule.enabled} compact label={'启用规则 ' + rule.pattern} description="" testId={prefix + '-rule-enabled-' + rule.id}
                  disabled={busy || !!draft} onChange={enabled => { void save(rules.map(current => current.id === rule.id ? { ...current, enabled } : current)) }} />
              </div>
            </div>
          </div>
          {deletingId === rule.id && <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="mr-auto text-[11px]" style={{ color: 'var(--text-muted)' }}>删除后，此操作将重新使用其他规则或默认审批方式。</span>
            <ActionButton disabled={busy} onClick={() => setDeletingId(null)}>取消</ActionButton>
            <ActionButton tone="danger" disabled={busy} onClick={() => { void save(rules.filter(current => current.id !== rule.id)) }}>确认删除规则</ActionButton>
          </div>}
        </SettingCard>
      </li>)}</ul>
      {parsed.ok && rules.length === 0 && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无自定义规则。</p>}
      <div className="mt-3 flex">
        <ActionButton ref={addButton} aria-expanded={!!draft} disabled={busy || !parsed.ok || (!draft && rules.length >= 100)}
          className="h-8 w-24 gap-1 whitespace-nowrap" tone="accent" data-testid={prefix + '-add-rule'}
          onClick={() => { if (draft) cancelDraft(); else beginDraft() }}>
          {draft ? <X size={12} /> : <Plus size={12} />}{draft ? editingId ? '取消编辑' : '取消添加' : '添加'}
        </ActionButton>
      </div>
      {draft && <form className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}
        onSubmit={event => { event.preventDefault(); submitDraft() }} onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing && !busy) { event.stopPropagation(); cancelDraft() } }}>
        <p className="text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>匹配内容使用正则表达式，不区分大小写；文件规则用于内置文件操作，不控制 Shell 或 MCP 的文件访问。允许规则不能越过安全边界。</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-[11px]">操作类型<SelectField aria-label="规则操作类型" className="mt-1" value={draft.type} disabled={busy} onChange={event => updateDraft({ type: event.target.value as PermissionRuleType })}>
            {(NEW_TYPES.includes(draft.type) ? NEW_TYPES : [...NEW_TYPES, draft.type]).map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
          </SelectField></label>
          <label className="text-[11px]">处理方式<SelectField aria-label="规则处理方式" className="mt-1" value={draft.action} disabled={busy} onChange={event => updateDraft({ action: event.target.value as PermissionRuleAction })}>
            {Object.entries(ACTION_LABELS).map(([action, label]) => <option key={action} value={action}>{label}</option>)}
          </SelectField></label>
          <label className="text-[11px]">匹配内容<TextField aria-label="规则匹配内容" className="theme-input mt-1 h-9 w-full rounded-md border px-2" autoFocus value={draft.pattern} maxLength={512} required disabled={busy} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateDraft({ pattern: event.target.value })} placeholder="例如：npm publish" /></label>
        </div>
        <label className="block text-[11px]">说明（可选）<TextField aria-label="规则说明" className="theme-input mt-1 h-9 w-full rounded-md border px-2" value={draft.description ?? ''} maxLength={500} disabled={busy} onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateDraft({ description: event.target.value })} /></label>
        <div className="flex justify-end gap-2">
          <ActionButton disabled={busy} onClick={cancelDraft}>取消</ActionButton>
          <ActionButton type="submit" tone="accent" className="w-28" disabled={busy || !draft.pattern.trim()} data-testid={prefix + '-save-rule'}>{busy ? '正在保存' : '保存这条规则'}</ActionButton>
        </div>
      </form>}
      {error && <p role="alert" className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>}
  </section>
}
