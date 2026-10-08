import { ArrowLeft, CalendarDays, Image, MapPin, Package, Users } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import type { CompanionLifeSlice } from '../../shared/types'

function textField(value: Record<string, unknown> | undefined, key: string): string {
  return value && typeof value[key] === 'string' ? value[key] as string : ''
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '时间未知'
}

function linkTitle(link: CompanionLifeSlice['links'][number], slice: CompanionLifeSlice): string {
  if (link.targetType === 'asset') {
    const asset = slice.assets.find((item) => item.id === link.targetId)
    const name = asset?.name || (typeof link.metadata.name === 'string' ? link.metadata.name : '一项生活资产')
    if (link.relation === 'wears') return `当时穿着 · ${name}`
    if (link.relation === 'references') return `当时提到 · ${name}`
    return name
  }
  if (link.targetType === 'cast' && link.relation === 'coframe') {
    return `一起出现 · ${typeof link.metadata.name === 'string' ? link.metadata.name : '一位熟悉的人'}`
  }
  if (link.targetType === 'image' && link.relation === 'depicts') return '这段生活的图片'
  return '相关生活线索'
}

/**
 * 背景：朋友圈是生活事件的投影，用户点开后需要看到可回放的上下文，而不是把事件表字段散落在卡片里。
 * 设计意图：正式页和 Playground 候选共享同一详情层级；容器局部滚动，避免长正文撑开整个工作区。
 * 关键约束：组件只消费已聚合的切片，不自行查询数据库、不推断缺失地点或资产；返回动作只回到朋友圈。
 */
export function WorldLifeSliceDetail({ personaName, slice, onBack }: { personaName: string; slice: CompanionLifeSlice; onBack: () => void }) {
  const moment = slice.moment
  const location = textField(moment?.meta, 'location') || textField(slice.event.payload, 'location')
  const companions = textField(moment?.meta, 'companions')
  const text = moment?.text || textField(slice.event.payload, 'description') || textField(slice.event.payload, 'activity')
  const timestamp = moment?.publishedAt ?? slice.event.scheduledAt

  return (
    <section className="min-w-0 space-y-4 p-5" data-testid="world-life-slice-detail">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>生活切片</div>
          <h2 className="mt-1 text-base font-medium" style={{ color: 'var(--text-primary)' }}>{personaName}的这段生活</h2>
        </div>
        <ActionButton variant="plain" onClick={onBack} className="shrink-0 gap-1.5">
          <ArrowLeft size={13} aria-hidden="true" />回到朋友圈
        </ActionButton>
      </div>

      <article className="min-w-0 rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden="true" />{formatDate(timestamp)}</span>
          {location && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{location}</span>}
          {companions && <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden="true" />{companions}</span>}
        </div>
        <p className="mt-4 max-h-60 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 scrollbar-thin" style={{ color: 'var(--text-primary)' }}>
          {text || '这段生活暂时还没有文字记录。'}
        </p>
      </article>

      {slice.links.length > 0 && (
        <section className="space-y-2" aria-label="相关生活线索">
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}><Image size={14} aria-hidden="true" />相关生活线索</div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {slice.links.map((link) => (
              <div key={link.id} data-testid="world-life-slice-link" className="min-w-0 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--card-border)', background: 'var(--bg-secondary)' }}>
                <div className="truncate text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{linkTitle(link, slice)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {slice.assets.length > 0 && (
        <section className="space-y-2" aria-label="关联生活资产">
          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}><Package size={14} aria-hidden="true" />关联生活资产</div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            {slice.assets.map((asset) => (
              <div key={asset.id} className="min-w-0 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--card-border)', background: 'var(--bg-secondary)' }}>
                <div className="truncate text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</div>
                <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.kind}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
