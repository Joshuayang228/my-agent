import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { SkillInfo, SkillValidationIssue } from '../shared/types'
import { ActionButton } from './foundation/ActionButton'
import { ConfirmPanel } from './foundation/ConfirmPanel'
import { IconButton } from './foundation/IconButton'
import { TextField } from './foundation/TextField'
import { SettingsPageHeader } from './settings/SettingsFields'
import { SkillDetail, SkillFilePreview, SkillListCard } from './settings/SkillViews'

/**
 * 背景：正式 Skills 曾保留旧双栏和不可见的历史逻辑，与候选脱节。
 * 设计意图：共享列表 / 详情展示，控制器只负责真实 IPC、草稿和失败恢复。
 * 关键约束：单次操作同步加锁；页面生命周期令牌屏蔽迟到结果，保存失败不清草稿。
 */
export function SkillsPanel({ visible }: { visible: boolean }) {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<SkillInfo | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [issues, setIssues] = useState<SkillValidationIssue[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const lock = useRef(false)
  const generation = useRef(0)

  const run = useCallback(async (action: (current: () => boolean) => Promise<void>, failure: string) => {
    if (lock.current) return
    lock.current = true
    const token = generation.current
    const current = () => generation.current === token
    setBusy(true)
    setError('')
    try {
      if (!window.electronAPI?.skills) throw new Error('unavailable')
      await action(current)
    } catch {
      if (current()) setError(failure)
    } finally {
      if (current()) { lock.current = false; setBusy(false) }
    }
  }, [])

  const load = useCallback((reload = false) => run(async (current) => {
    if (reload && !(await window.electronAPI.skills.reload()).success) throw new Error('reload')
    const list = await window.electronAPI.skills.list()
    if (current()) { setSkills(list); setLoaded(true) }
  }, '未能读取 Skills，请重试。'), [run])

  useEffect(() => {
    generation.current += 1
    lock.current = false
    setBusy(false)
    if (visible) void load()
    return () => { generation.current += 1; lock.current = false }
  }, [visible, load])

  const open = (skill: SkillInfo) => {
    if (lock.current) return
    setSelected(skill)
    setContent(null)
    setEditing(false)
    setPendingDelete(false)
    setIssues([])
    void run(async (current) => {
      const text = await window.electronAPI.skills.get(skill.name)
      if (text === null) throw new Error('missing')
      if (current()) { setContent(text); setDraft(text) }
    }, '未能读取 Skill 正文，请重试。')
  }

  const back = () => {
    if (lock.current) return
    setSelected(null)
    setPendingDelete(false)
    setEditing(false)
    setIssues([])
    setError('')
  }

  const toggle = (skill: SkillInfo, enabled: boolean) => void run(async (current) => {
    const result = await window.electronAPI.skills.setEnabled(skill.name, enabled)
    if (!result.success) throw new Error('toggle')
    if (current()) {
      setSkills((list) => list.map((item) => item.name === skill.name ? { ...item, enabled: result.enabled } : item))
      setSelected((item) => item?.name === skill.name ? { ...item, enabled: result.enabled } : item)
    }
  }, '未能更新 Skill 状态，请重试。')

  const save = () => {
    if (!selected || selected.source !== 'user') return
    const target = selected
    const text = draft
    void run(async (current) => {
      const validation = await window.electronAPI.skills.validate(text)
      if (!current()) return
      setIssues(validation.issues)
      if (!validation.valid) return
      if (validation.name !== target.name) {
        setIssues([{ severity: 'error', code: 'name.mismatch', message: '编辑时不能更改 Skill 名称。' }])
        return
      }
      const result = await window.electronAPI.skills.save(target.name, text)
      if (!current()) return
      setIssues(result.issues)
      if (!result.success) { setError('未能保存 Skill，草稿已保留，请重试。'); return }
      const updated: SkillInfo = { ...validation.meta, name: target.name, description: validation.meta?.description ?? target.description, source: target.source, enabled: target.enabled }
      setSkills((list) => list.map((item) => item.name === target.name ? updated : item))
      setSelected(updated)
      setContent(text)
      setEditing(false)
    }, '未能保存 Skill，草稿已保留，请重试。')
  }

  const remove = () => {
    if (!selected || !pendingDelete || selected.source !== 'user') return
    const name = selected.name
    void run(async (current) => {
      if (!(await window.electronAPI.skills.delete(name)).success) throw new Error('delete')
      if (current()) {
        setSelected(null)
        setPendingDelete(false)
        setSkills((list) => list.filter((item) => item.name !== name))
        setLoaded(false)
      }
      // 删除可能露出同名内置 Skill；只重读列表，不重复删除。
      const list = await window.electronAPI.skills.list()
      if (current()) { setSkills(list); setLoaded(true) }
    }, '操作未能完成，请重试；若已返回列表，请刷新列表。')
  }

  if (!visible) return null
  return <div className="min-w-0 space-y-4" data-testid="skills-panel" aria-busy={busy}>
    <div className="flex items-start justify-between gap-3">
      <SettingsPageHeader title="Skills" description="管理伙伴可以按需使用的工作方法。" />
      {!selected && <IconButton label="刷新 Skills" disabled={busy} onClick={() => void load(true)}><RefreshCw size={16} /></IconButton>}
    </div>
    {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-[12px]" style={{ color: 'var(--danger)' }}>
      <span>{error}</span>
      {!selected && <ActionButton disabled={busy} onClick={() => void load()}>重试读取</ActionButton>}
      {selected && content === null && <ActionButton disabled={busy} onClick={() => open(selected)}>重试读取</ActionButton>}
    </div>}
    {!selected && <>
      {busy && !loaded && <p role="status" className="text-[12px]">正在读取 Skills…</p>}
      {loaded && skills.length === 0 && <p className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>尚未安装 Skill。</p>}
      <div className="grid gap-3 sm:grid-cols-2">{skills.map((skill) => <SkillListCard key={skill.name} skill={skill} disabled={busy} testId={`skill-card-${skill.name}`} onOpen={() => open(skill)} onEnabledChange={(enabled) => toggle(skill, enabled)} />)}</div>
    </>}
    {selected && <SkillDetail skill={selected} disabled={busy || editing || pendingDelete} onBack={back} onEnabledChange={(enabled) => toggle(selected, enabled)} testId="skill-detail"
      actions={selected.source === 'user' && content !== null && !pendingDelete ? editing ? <>
        <ActionButton disabled={busy || !draft.trim()} tone="accent" onClick={save}>校验并保存</ActionButton>
        <ActionButton disabled={busy} onClick={() => { setDraft(content); setEditing(false); setIssues([]); setError('') }}>取消编辑</ActionButton>
        <span role="status" className="text-[11px]">{busy ? '正在保存…' : ''}</span>
      </> : <>
        <IconButton label="编辑 Skill" disabled={busy} onClick={() => { setDraft(content); setEditing(true); setError('') }}><Pencil size={14} /></IconButton>
        <IconButton label="删除 Skill" disabled={busy} onClick={() => { setPendingDelete(true); setError(''); setIssues([]) }}><Trash2 size={14} /></IconButton>
      </> : undefined}
      notice={<>
        {pendingDelete && <div className="mb-3"><ConfirmPanel title={`删除 Skill「${selected.name}」？`} description="将删除当前 Skill 文件，已保存的对话和 Debug 记录不受影响。" confirmLabel="删除 Skill" busy={busy} onConfirm={remove} onCancel={() => { setPendingDelete(false); setError('') }} /></div>}
        {issues.length > 0 && <ul role="status" className="mb-3 space-y-1 text-[11px]" style={{ color: 'var(--danger)' }}>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}
      </>}
      content={content === null ? <p role="status" className="text-[12px]">{busy ? '正在读取正文…' : '正文不可用'}</p> : editing ? <TextField multiline aria-label="编辑 SKILL.md" value={draft} disabled={busy} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)} className="h-[48vh] min-h-40 w-full resize-none overflow-auto rounded border p-3 font-mono text-[11px] leading-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} spellCheck={false} /> : <SkillFilePreview content={content} testId="skill-file-preview" />} />}
  </div>
}
