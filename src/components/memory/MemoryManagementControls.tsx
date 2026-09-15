import { Check, LoaderCircle, Plus, Search, ShieldAlert, X } from 'lucide-react'
import { useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TabStrip } from '../foundation/TabStrip'
import { TextField } from '../foundation/TextField'
import { MEMORY_GROUPS, type MemoryGroup } from '../../shared/memory-groups'

export function MemoryToolbar({ group, counts, onGroupChange, query, onQueryChange, searchOpen, onSearchOpen }: {
  group: MemoryGroup
  counts: Record<MemoryGroup, number>
  onGroupChange: (group: MemoryGroup) => void
  query: string
  onQueryChange: (query: string) => void
  searchOpen: boolean
  onSearchOpen: (open: boolean) => void
}) {
  const searchButton = useRef<HTMLButtonElement>(null)
  const closeSearch = () => {
    onQueryChange('')
    onSearchOpen(false)
    requestAnimationFrame(() => searchButton.current?.focus())
  }
  return <div className="flex min-w-0 items-center gap-2 pb-3" data-testid="memory-surface-toolbar">
    <div className="min-w-0 flex-1" data-testid="memory-group-tabs">
      <TabStrip label="记忆分类" activeId={group} onSelect={(id) => onGroupChange(id as MemoryGroup)}
        items={MEMORY_GROUPS.map((item) => ({ id: item.id, label: `${item.label} ${counts[item.id]}`, testId: `memory-group-${item.id}` }))} />
    </div>
    <div className="flex h-8 w-52 max-w-[42%] shrink-0 justify-end" data-testid="memory-actions">
      {searchOpen ? <div className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-md)] border px-2" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}>
        <Search size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <TextField autoFocus aria-label="搜索记忆" placeholder="搜索记忆" value={query} className="w-full flex-1"
          onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSearch() }
          }} />
        <IconButton size={24} label="清除搜索" onClick={closeSearch}><X size={12} /></IconButton>
      </div> : <IconButton ref={searchButton} size={32} label="搜索记忆" onClick={() => onSearchOpen(true)}><Search size={14} /></IconButton>}
    </div>
  </div>
}

export function MemoryAddRow({ open, content, onContentChange, onOpen, onCancel, onSave, busy, sensitiveHint }: {
  open: boolean
  content: string
  onContentChange: (content: string) => void
  onOpen: () => void
  onCancel: () => void
  onSave: () => void
  busy: boolean
  sensitiveHint: string
}) {
  return <div className="mt-3" data-testid="memory-add-row">
    {open ? <div className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
      <div className="flex items-start gap-2">
        <TextField multiline autoFocus aria-label="新记忆内容" placeholder="输入希望伙伴记住的内容…" value={content} rows={3} maxLength={20_000}
          className="theme-input min-h-20 w-full flex-1 resize-y rounded-[var(--radius-md)] border px-3 py-1.5 text-[13px]"
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onContentChange(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); onSave() }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel() }
          }} />
        <div className="flex h-8 w-[68px] shrink-0 gap-1">
          <IconButton size={32} label="保存新记忆" disabled={busy || content.trim().length < 2} onClick={onSave} style={{ color: 'var(--accent-fg)' }}>
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
          </IconButton>
          <IconButton size={32} label="取消新增记忆" disabled={busy} onClick={onCancel}><X size={14} /></IconButton>
        </div>
      </div>
      {sensitiveHint && <div className="mt-2 flex items-start gap-2 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}>
        <ShieldAlert size={14} className="shrink-0" /><span>{sensitiveHint}</span>
      </div>}
    </div> : <ActionButton onClick={onOpen} className="gap-1.5 px-1 text-[12px]"><Plus size={14} />添加一条记忆</ActionButton>}
  </div>
}
