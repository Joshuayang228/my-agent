import { RefreshCw, X } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'

export interface ShelfCharacter { id: string; name: string; description: string }

/**
 * 背景：角色架候选与正式页曾分别维护卡片，已确认的排列和身份标记没有进入产品。
 * 设计意图：仅共享卡片与状态，真实读取 / 切角由容器负责，样张只提供隔离角色。
 * 关键约束：标记始终占位，hover 不改变卡片几何；长名称换行，操作按钮复用 Foundation，不读取 IPC。
 */
export function CharacterShelfContent({ characters, activeId, switchingId, loading = false, error, onSelect, onRefresh, onClose, optionTestIdPrefix = 'character-option' }: {
  characters: readonly ShelfCharacter[]
  activeId: string
  switchingId?: string | null
  loading?: boolean
  error?: string
  onSelect: (id: string) => void
  onRefresh?: () => void
  onClose?: () => void
  optionTestIdPrefix?: string
}) {
  return <section data-testid="character-shelf-content" className="min-w-0 space-y-4">
    <header className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="min-w-0"><h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>角色架</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>管理同一生活世界中的主角，切换后朋友圈与对话一起跟随。</p>
      </div>
      {(onRefresh || onClose) && <div className="flex shrink-0 gap-1">
        {onRefresh && <IconButton label="刷新角色架" disabled={loading || !!switchingId} onClick={onRefresh}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></IconButton>}
        {onClose && <IconButton label="关闭角色架" onClick={onClose}><X size={14} /></IconButton>}
      </div>}
    </header>
    {error && <ErrorState title="角色读取失败" description={error} action={onRefresh && <ActionButton onClick={onRefresh} disabled={loading || !!switchingId}>重新读取</ActionButton>} />}
    {loading && <p role="status" className="text-xs" style={{ color: 'var(--text-muted)' }}>正在读取角色…</p>}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {characters.map(character => {
        const active = character.id === activeId
        const switching = switchingId === character.id
        return <ActionButton key={character.id} onClick={() => onSelect(character.id)} aria-pressed={active}
          disabled={loading || !!switchingId} data-testid={optionTestIdPrefix + '-' + character.id}
          className="min-w-0 !items-start !justify-start !rounded-xl !p-4 text-left"
          style={{ borderColor: active ? 'var(--companion-accent-warm)' : 'var(--border-subtle)', background: active ? 'var(--accent-subtle)' : 'var(--card-bg)' }}>
          <span className="flex min-w-0 w-full items-start justify-between gap-3">
            <span className="min-w-0 [overflow-wrap:anywhere]"><span className="block text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{character.name}</span>
              <span className="mt-1 block text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{character.description || '暂无简介'}</span>
            </span>
            <span className={'w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-[9px] ' + (!active && !switching ? 'invisible' : '')}
              style={{ background: 'var(--card-bg)', color: 'var(--accent-fg)' }}>{switching ? '切换中…' : '当前主角'}</span>
          </span>
        </ActionButton>
      })}
    </div>
    {!characters.length && !loading && !error && <EmptyState title="暂无可用主角" description="创建或连接一个角色后，这里会显示可切换的生活世界。" />}
  </section>
}
