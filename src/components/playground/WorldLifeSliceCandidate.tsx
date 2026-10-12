import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Camera, Home, MapPin, Shirt, Users } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { MomentsPanel, type MomentItem, type MomentsPreviewData } from '../MomentsPanel'
import { parseCastInteractions } from '../../shared/moment-user-interactions'
import type { WorldAssetRecord } from '../world/WorldAssetEditor'

interface WorldLifeSliceCandidateProps {
  personaName: string
  moments: MomentsPreviewData
  assets: readonly WorldAssetRecord[]
}

const assetKinds = new Map<string, { label: string; icon: typeof Shirt }>([
  ['wardrobe', { label: '衣柜', icon: Shirt }],
  ['culture', { label: '文化角', icon: BookOpen }],
  ['bookshelf', { label: '文化角', icon: BookOpen }],
  ['home', { label: '家居', icon: Home }],
  ['furniture', { label: '家居', icon: Home }],
  ['footprint', { label: '足迹', icon: MapPin }],
])

function formatSliceDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return '日期未知'
  return date.toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relatedAssetNames(moment: MomentItem, assets: readonly WorldAssetRecord[]): WorldAssetRecord[] {
  const names = new Set<string>()
  const assetId = typeof moment.meta.assetId === 'string' ? moment.meta.assetId : ''
  if (assetId) names.add(assetId)
  if (moment.eventId === 'fixture-walk') {
    for (const name of ['书桌', '乌龙茶']) names.add(name)
  }
  if (moment.eventId === 'fixture-notes') {
    for (const name of ['河边步道', '旅行的意义']) names.add(name)
  }
  if (moment.eventId === 'fixture-tea') {
    for (const name of ['乌龙茶', '《瓦尔登湖》']) names.add(name)
  }
  return assets.filter((asset) => names.has(asset.id) || names.has(asset.name)).slice(0, 4)
}

/**
 * 背景：朋友圈卡片已经能表达“最近发生了什么”，但人物世界还缺少从动态进入完整生活上下文的用户路径。
 * 设计意图：在 Playground 先把事件详情作为朋友圈的渐进展开候选，复用正式 MomentsPanel 和 Foundation 控件；不新增事件日志 Tab，也不让 fixture 进入生产。
 * 关键约束：详情只消费传入的 Moment、资产和关系数据；长内容在局部容器滚动，返回动作不改变六个生活面入口。
 */
export function WorldLifeSliceCandidate({ personaName, moments, assets }: WorldLifeSliceCandidateProps) {
  const [selected, setSelected] = useState<MomentItem | null>(null)
  const relatedAssets = useMemo(() => selected ? relatedAssetNames(selected, assets) : [], [assets, selected])
  const selectedLocation = selected && typeof selected.meta.location === 'string' ? selected.meta.location : ''
  const selectedRelations = selected ? parseCastInteractions(selected.meta).filter((item) => item.kind === 'coframe' || item.kind === 'comment') : []

  return (
    <div className="min-w-0 space-y-4 p-5" data-testid="world-life-slice-candidate">
      {selected ? (
        <section className="min-w-0 space-y-4" data-testid="world-life-slice-detail">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>生活切片</div>
              <h2 className="mt-1 text-base font-medium" style={{ color: 'var(--text-primary)' }}>{personaName}的这段生活</h2>
            </div>
            <ActionButton variant="plain" onClick={() => setSelected(null)} className="gap-1.5">
              <ArrowLeft size={13} aria-hidden="true" />回到朋友圈
            </ActionButton>
          </div>

          <article className="min-w-0 rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{formatSliceDate(selected.publishedAt)}</div>
                {selectedLocation && <div className="mt-1 inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}><MapPin size={12} aria-hidden="true" />{selectedLocation}</div>}
              </div>
              <span className="shrink-0 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}>最近生活</span>
            </div>
            <p className="mt-4 max-h-52 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 scrollbar-thin" style={{ color: 'var(--text-primary)' }}>{selected.text}</p>
            {selected.media?.length ? (
              <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {selected.media.map((media, index) => <img key={`${media.src}-${index}`} src={media.src} alt={media.alt} className="block max-h-64 w-full rounded object-cover" />)}
              </div>
            ) : null}
          </article>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <section className="min-w-0 rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}><BookOpen size={14} aria-hidden="true" />这件事留下的生活线索</div>
              <div className="mt-3 space-y-2">
                {relatedAssets.length ? relatedAssets.map((asset) => {
                  const kind = assetKinds.get(asset.kind) ?? { label: '生活资产', icon: Camera }
                  const Icon = kind.icon
                  return <div key={asset.id} className="flex min-w-0 items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}><Icon size={13} aria-hidden="true" /><span className="min-w-0 truncate">{asset.name}</span><span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>{kind.label}</span></div>
                }) : <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>这段生活还没有关联的长期资产。</p>}
              </div>
            </section>
            <section className="min-w-0 rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--companion-accent-warm)' }}><Users size={14} aria-hidden="true" />一起出现的人</div>
              <div className="mt-3 space-y-2">
                {selectedRelations.length ? selectedRelations.map((item, index) => <div key={`${item.castName}-${index}`} className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item.kind === 'coframe' ? `与${item.castName}一起` : `${item.castName}留下了一句话`}</div>) : <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>这段生活没有记录同行关系。</p>}
              </div>
            </section>
          </div>
        </section>
      ) : (
        <MomentsPanel
          onClose={() => undefined}
          previewData={moments}
          appearance="alice-feed"
          hideHeader
          showSocialActions
          compactClosedComposer
          onMomentSelect={setSelected}
        />
      )}
    </div>
  )
}
