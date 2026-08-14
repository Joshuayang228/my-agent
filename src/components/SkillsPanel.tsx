/**
 * Skill 管理器。
 *
 * 背景：Skill 会影响 Agent 的工具选择和执行方式，不能只提供一个 Markdown 文本框。
 * 设计意图：在设置侧提供编辑、校验、版本回滚和隔离试跑；Debug 继续只读展示真实模型上下文。
 * 关键约束：保存前必须通过主进程校验；历史版本只读；隔离试跑不写设置、不写真实会话。
 */

import { useCallback, useEffect, useState } from 'react'
import { useToast } from './Toast'
import type { SkillValidationIssue, SkillVersionInfo } from '../shared/types'

interface SkillInfo {
  name: string
  description: string
  when_to_use: string
  allowed_tools: string[]
  disable_model_invocation: boolean
  version: string
  source: 'builtin' | 'user'
  filePath: string
}

interface SkillsPanelProps {
  visible: boolean
  onClose: () => void
}

const SKILL_TEMPLATE = `---
name: my-skill
description: 一句话描述这个 Skill 的功能和触发时机
when_to_use: |
  当用户说“xxx”“yyy”时使用。
  不适用于：zzz
allowed_tools: []
disable_model_invocation: false
version: "1.0"
---

# Skill 操作指南

## 步骤

1. 第一步：...
2. 第二步：...
3. 第三步：...

## 注意事项

- 注意点 A
- 注意点 B
`

function issueLabel(issue: SkillValidationIssue): string {
  return `${issue.severity === 'error' ? '错误' : '提醒'} · ${issue.message}`
}

function formatVersionDate(timestamp: number): string {
  if (!timestamp) return '未知时间'
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

export function SkillsPanel({ visible, onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [versions, setVersions] = useState<SkillVersionInfo[]>([])
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [versionContent, setVersionContent] = useState('')
  const [issues, setIssues] = useState<SkillValidationIssue[]>([])
  const [experimentInput, setExperimentInput] = useState('请说明这个 Skill 会如何处理当前任务。')
  const [experimentResult, setExperimentResult] = useState('')
  const [experimentMeta, setExperimentMeta] = useState('')
  const [experimentRunning, setExperimentRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()

  const loadSkills = useCallback(async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.skills.list()
    setSkills(list)
  }, [])

  const loadVersions = useCallback(async (name: string) => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.skills.versions(name)
    setVersions(list)
    setSelectedVersion(null)
    setVersionContent('')
  }, [])

  useEffect(() => {
    if (visible) void loadSkills()
  }, [visible, loadSkills])

  const handleView = async (name: string) => {
    if (!window.electronAPI) return
    setBusy(true)
    setSelectedSkill(name)
    setCreating(false)
    setEditing(false)
    setIssues([])
    setExperimentResult('')
    try {
      const [content] = await Promise.all([
        window.electronAPI.skills.get(name),
        loadVersions(name),
      ])
      setEditContent(content || '')
    } finally {
      setBusy(false)
    }
  }

  const validateCurrent = async (): Promise<boolean> => {
    if (!window.electronAPI) return false
    const result = await window.electronAPI.skills.validate(editContent)
    setIssues(result.issues)
    return result.valid
  }

  const handleSave = async () => {
    if (!window.electronAPI || !editContent.trim()) return
    setBusy(true)
    try {
      const validation = await window.electronAPI.skills.validate(editContent)
      setIssues(validation.issues)
      if (!validation.valid) return
      const name = validation.name || selectedSkill || 'unnamed'
      const result = await window.electronAPI.skills.save(name, editContent)
      if (!result.success) {
        setIssues(result.issues)
        return
      }
      toast(`Skill「${name}」已保存`, 'success')
      setEditing(false)
      setCreating(false)
      setSelectedSkill(name)
      await Promise.all([loadSkills(), loadVersions(name)])
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.electronAPI || !window.confirm(`确定删除 Skill「${name}」吗？此操作会删除当前文件，但不会影响已保存的历史 Debug 记录。`)) return
    setBusy(true)
    try {
      const result = await window.electronAPI.skills.delete(name)
      if (result.success) {
        toast(`Skill「${name}」已删除`, 'success')
        if (selectedSkill === name) {
          setSelectedSkill(null)
          setEditContent('')
          setVersions([])
          setVersionContent('')
        }
        await loadSkills()
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = () => {
    setCreating(true)
    setSelectedSkill(null)
    setVersions([])
    setVersionContent('')
    setIssues([])
    setExperimentResult('')
    setEditContent(SKILL_TEMPLATE)
    setEditing(true)
  }

  const handleReload = async () => {
    if (!window.electronAPI) return
    setBusy(true)
    try {
      const result = await window.electronAPI.skills.reload()
      toast(`已重新加载 ${result.count} 个 Skill`, 'success')
      await loadSkills()
      if (selectedSkill) await handleView(selectedSkill)
    } finally {
      setBusy(false)
    }
  }

  const handleSelectVersion = async (version: number) => {
    if (!window.electronAPI || !selectedSkill) return
    setSelectedVersion(version)
    setVersionContent((await window.electronAPI.skills.versionContent(selectedSkill, version)) || '')
  }

  const handleRollback = async (version: number) => {
    if (!window.electronAPI || !selectedSkill || !window.confirm(`确定回滚到历史版本 v${version} 吗？当前内容会先自动备份。`)) return
    setBusy(true)
    try {
      const result = await window.electronAPI.skills.rollback(selectedSkill, version)
      if (!result.success) {
        toast(`Skill「${selectedSkill}」回滚失败`, 'error')
        return
      }
      toast(`已回滚到 Skill「${selectedSkill}」的 v${version}`, 'success')
      await handleView(selectedSkill)
    } finally {
      setBusy(false)
    }
  }

  const handleExperiment = async () => {
    if (!window.electronAPI || !editContent.trim() || !experimentInput.trim()) return
    setExperimentRunning(true)
    setExperimentResult('')
    setExperimentMeta('')
    const valid = await validateCurrent()
    if (!valid) {
      setExperimentRunning(false)
      return
    }
    try {
      const result = await window.electronAPI.skills.playgroundRun({ content: editContent, userPrompt: experimentInput.trim() })
      if (result.ok) {
        setExperimentResult(result.text)
        setExperimentMeta(`隔离试跑 · ${result.model} · ${result.ms} ms · 不写设置 / 不写真实会话`)
      } else {
        setExperimentResult(result.error)
        setExperimentMeta('隔离试跑失败')
      }
    } finally {
      setExperimentRunning(false)
    }
  }

  if (!visible) return null

  const selectedInfo = skills.find((skill) => skill.name === selectedSkill)

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="skills-panel">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Skills</h2>
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{skills.length}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>创建、校验、回滚和隔离试跑 Skill；真实模型上下文请去 Debug 查看。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleReload()} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-40" style={{ color: 'var(--text-muted)' }}>刷新</button>
          <button type="button" onClick={handleCreate} disabled={busy} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40">+ 新建 Skill</button>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs transition" style={{ color: 'var(--text-muted)' }}>关闭</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r p-3" style={{ borderColor: 'var(--border-color)' }}>
          {skills.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>暂无 Skill<br />点击「+ 新建 Skill」创建你的第一个 Skill</div>
          ) : skills.map((skill) => (
            <button key={skill.name} type="button" onClick={() => void handleView(skill.name)} className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition ${selectedSkill === skill.name ? 'bg-cyan-600/10 text-cyan-500' : ''}`} style={{ color: selectedSkill === skill.name ? 'var(--accent)' : 'var(--text-secondary)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{skill.name}</span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>v{skill.version || '—'}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{skill.description}</p>
              <div className="mt-1 flex gap-1 text-[9px]" style={{ color: 'var(--text-muted)' }}><span>{skill.source === 'builtin' ? '内置' : '用户'}</span>{skill.disable_model_invocation && <span>· 仅手动</span>}</div>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {selectedSkill || creating ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{creating ? '新建 Skill' : selectedSkill}</h3>
                  {selectedInfo && <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{selectedInfo.source === 'builtin' ? '内置 Skill' : '用户 Skill'} · {selectedInfo.filePath}</p>}
                </div>
                {selectedSkill && selectedInfo?.source === 'user' && <button type="button" onClick={() => void handleDelete(selectedSkill)} disabled={busy} className="rounded border px-2 py-1 text-[10px] disabled:opacity-40" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>删除</button>}
              </div>

              {selectedInfo && !editing && (
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><span>版本：{selectedInfo.version || '未声明'}</span><span>来源：{selectedInfo.source === 'builtin' ? '内置' : '用户'}</span><span>工具：{selectedInfo.allowed_tools.length ? selectedInfo.allowed_tools.join(', ') : '未限制'}</span></div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedInfo.description}</p>
                  {selectedInfo.when_to_use && <p className="mt-2 whitespace-pre-wrap text-[11px]" style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>触发条件：</strong>{selectedInfo.when_to_use}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!editing && selectedInfo?.source === 'user' && <button type="button" onClick={() => setEditing(true)} className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white">编辑</button>}
                {editing && <><button type="button" onClick={() => void handleSave()} disabled={busy} className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">{busy ? '处理中…' : '校验并保存'}</button><button type="button" onClick={() => { setEditing(false); setIssues([]) }} className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>取消</button></>}
                <button type="button" onClick={() => void validateCurrent()} disabled={busy} className="rounded border px-3 py-1.5 text-xs disabled:opacity-40" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>校验</button>
              </div>

              {issues.length > 0 && <div className="space-y-1 rounded-lg border p-3" style={{ borderColor: issues.some((issue) => issue.severity === 'error') ? 'var(--danger)' : 'var(--warning)', background: 'var(--card-bg)' }}><div className="text-[11px] font-semibold" style={{ color: issues.some((issue) => issue.severity === 'error') ? 'var(--danger)' : 'var(--warning)' }}>Skill 校验结果</div>{issues.map((issue, index) => <div key={`${issue.code}-${index}`} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{issueLabel(issue)}</div>)}</div>}

              {editing ? <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} className="min-h-[360px] w-full resize-y rounded-lg border p-3 font-mono text-xs leading-relaxed outline-none" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }} spellCheck={false} /> : <pre className="max-h-[48vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{editContent || '（暂无正文）'}</pre>}

              {selectedSkill && selectedInfo?.source === 'user' && <VersionHistory versions={versions} selectedVersion={selectedVersion} content={versionContent} onSelect={(version) => void handleSelectVersion(version)} onRollback={(version) => void handleRollback(version)} busy={busy} />}

              <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}>
                <div className="flex items-center justify-between gap-2"><div><h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>隔离试跑</h4><p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>只把当前草稿作为 system Prompt 发送一次，不写设置、不写真实会话。</p></div><button type="button" onClick={() => void handleExperiment()} disabled={experimentRunning || !editContent.trim() || !experimentInput.trim()} className="rounded bg-cyan-600 px-2.5 py-1.5 text-[10px] font-medium text-white disabled:opacity-40">{experimentRunning ? '试跑中…' : '运行'}</button></div>
                <textarea value={experimentInput} onChange={(event) => setExperimentInput(event.target.value)} className="mt-3 min-h-16 w-full resize-y rounded border p-2 text-xs outline-none" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }} />
                {experimentMeta && <div className="mt-2 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{experimentMeta}</div>}
                {experimentResult && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border p-2 text-xs leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{experimentResult}</pre>}
              </section>
            </div>
          ) : <div className="flex h-full items-center justify-center text-center" style={{ color: 'var(--text-muted)' }}><div><p className="mb-2 text-lg">选择或新建一个 Skill</p><p className="text-xs">Skill 是给 Agent 的操作手册，用 Markdown 描述工作流程。</p><p className="mt-1 text-xs">结构校验、版本回滚和隔离试跑都不会直接覆盖真实会话。</p></div></div>}
        </div>
      </div>
    </div>
  )
}

function VersionHistory({ versions, selectedVersion, content, onSelect, onRollback, busy }: { versions: SkillVersionInfo[]; selectedVersion: number | null; content: string; onSelect: (version: number) => void; onRollback: (version: number) => void; busy: boolean }) {
  return <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}><div className="flex items-center justify-between"><div><h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>版本历史</h4><p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>保存前自动备份，最多保留最近 10 个历史版本。</p></div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{versions.length} 个历史版本</span></div>{versions.length === 0 ? <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>还没有历史版本。</p> : <div className="mt-2 space-y-1.5">{versions.map((item) => <div key={item.version} className="flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}><button type="button" onClick={() => onSelect(item.version)} className="text-left text-[10px]" style={{ color: selectedVersion === item.version ? 'var(--accent)' : 'var(--text-secondary)' }}><span className="font-mono font-semibold">v{item.version}</span><span className="ml-2" style={{ color: 'var(--text-muted)' }}>{formatVersionDate(item.createdAt)}</span></button><button type="button" onClick={() => onRollback(item.version)} disabled={busy} className="rounded border px-2 py-1 text-[10px] disabled:opacity-40" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>回滚</button></div>)}</div>}{selectedVersion !== null && <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border p-2 font-mono text-[10px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{content || '正在读取历史正文…'}</pre>}</section>
}
