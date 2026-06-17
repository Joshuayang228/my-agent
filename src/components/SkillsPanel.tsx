import { useState, useEffect, useCallback } from 'react'
import { useToast } from './Toast'

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
  当用户说"xxx"、"yyy"时使用。
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

export function SkillsPanel({ visible, onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const loadSkills = useCallback(async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.skills.list()
    setSkills(list)
  }, [])

  useEffect(() => {
    if (visible) loadSkills()
  }, [visible, loadSkills])

  const handleView = async (name: string) => {
    if (!window.electronAPI) return
    setSelectedSkill(name)
    const content = await window.electronAPI.skills.get(name)
    setEditContent(content || '')
    setEditing(false)
  }

  const handleSave = async () => {
    if (!window.electronAPI || !editContent.trim()) return
    const nameMatch = editContent.match(/^name:\s*(.+)$/m)
    const name = nameMatch ? nameMatch[1].trim() : selectedSkill || 'unnamed'
    const result = await window.electronAPI.skills.save(name, editContent)
    if (result.success) {
      toast(`Skill「${name}」已保存`, 'success')
      setEditing(false)
      setCreating(false)
      setSelectedSkill(name)
      await loadSkills()
    }
  }

  const handleDelete = async (name: string) => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.skills.delete(name)
    if (result.success) {
      toast(`Skill「${name}」已删除`, 'success')
      if (selectedSkill === name) {
        setSelectedSkill(null)
        setEditContent('')
      }
      await loadSkills()
    }
  }

  const handleCreate = () => {
    setCreating(true)
    setSelectedSkill(null)
    setEditContent(SKILL_TEMPLATE)
    setEditing(true)
  }

  const handleReload = async () => {
    if (!window.electronAPI) return
    const result = await window.electronAPI.skills.reload()
    toast(`已重新加载 ${result.count} 个 Skill`, 'success')
    await loadSkills()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex h-[80vh] w-[900px] max-w-[90vw] flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Skill 管理</h2>
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">{skills.length} 个</span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReload} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white">
              刷新
            </button>
            <button onClick={handleCreate} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500">
              + 新建 Skill
            </button>
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white">
              关闭
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧列表 */}
          <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-slate-700/50 p-3">
            {skills.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                暂无 Skill<br />点击「+ 新建」创建你的第一个 Skill
              </div>
            ) : (
              skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleView(s.name)}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition ${
                    selectedSkill === s.name
                      ? 'bg-cyan-600/10 text-cyan-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{s.name}</span>
                    <span className={`rounded px-1 py-0.5 text-[9px] ${
                      s.source === 'builtin'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {s.source === 'builtin' ? '内置' : '用户'}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{s.description}</p>
                </button>
              ))
            )}
          </div>

          {/* 右侧详情/编辑 */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {(selectedSkill || creating) ? (
              <>
                {/* 工具栏 */}
                <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2">
                  <span className="text-sm font-medium text-slate-300">
                    {creating ? '新建 Skill' : selectedSkill}
                  </span>
                  <div className="flex gap-2">
                    {!creating && !editing && (
                      <>
                        <button
                          onClick={() => setEditing(true)}
                          className="rounded px-2 py-1 text-xs text-cyan-400 transition hover:bg-slate-800"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => selectedSkill && handleDelete(selectedSkill)}
                          className="rounded px-2 py-1 text-xs text-red-400 transition hover:bg-slate-800"
                        >
                          删除
                        </button>
                      </>
                    )}
                    {(editing || creating) && (
                      <>
                        <button
                          onClick={() => { setEditing(false); setCreating(false) }}
                          className="rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSave}
                          className="rounded bg-cyan-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-cyan-500"
                        >
                          保存
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 内容区 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {(editing || creating) ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="h-full w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-4 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-cyan-500"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="space-y-3">
                      {skills.filter(s => s.name === selectedSkill).map(s => (
                        <div key={s.name}>
                          <div className="mb-4 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {s.version && <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">v{s.version}</span>}
                              {s.disable_model_invocation && <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">仅手动</span>}
                              {s.allowed_tools.length > 0 && (
                                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">
                                  限定工具: {s.allowed_tools.join(', ')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-300">{s.description}</p>
                            {s.when_to_use && (
                              <div className="rounded-lg bg-slate-800/80 p-3 text-xs text-slate-400">
                                <span className="font-medium text-slate-300">触发条件：</span>
                                {s.when_to_use}
                              </div>
                            )}
                          </div>
                          <pre className="whitespace-pre-wrap rounded-lg bg-slate-800/60 p-4 font-mono text-xs leading-relaxed text-slate-300">
                            {editContent}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-slate-500">
                <div className="text-center">
                  <p className="mb-2 text-lg">选择或新建一个 Skill</p>
                  <p className="text-xs">Skill 是给 AI 的操作手册，用 Markdown 描述工作流程</p>
                  <p className="mt-1 text-xs">AI 会根据触发条件自动激活对应 Skill</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
