import { Home, MapPin, Package } from 'lucide-react'

export interface LivingAsset {
  id: string
  kind: string
  name: string
  payload: Record<string, unknown>
}

export interface LivingMoment {
  text: string
  publishedAt: number
  meta: Record<string, unknown>
}

const cardStyle = { borderColor: 'var(--card-border)', background: 'var(--card-bg)' }
const headingStyle = { color: 'var(--companion-accent-warm)' }
const detailStyle = { color: 'var(--text-muted)' }
const textField = (payload: Record<string, unknown>, key: string): string => typeof payload[key] === 'string' ? payload[key] as string : ''

/**
 * 背景：家居候选的当前空间与物件曾在正式页重新手写，逐渐丢失结构与内容。
 * 设计意图：候选与正式共用纯展示组件，仅由外层提供隔离样张或真实资产。
 * 关键约束：不读取 IPC、不播种数据，不把在场活动冒充住所，也不把未设定空间填成样张。
 */
export function WorldHomeContent({ assets, presence }: { assets: readonly LivingAsset[]; presence: string }) {
  const homes = assets.filter((item) => item.kind === 'home')
  const objects = assets.filter((item) => !['home', 'footprint', 'wardrobe', 'bookshelf', 'culture'].includes(item.kind))
  return <div className="min-w-0 space-y-3" data-world-content="home">
    <section className="min-w-0 space-y-3" aria-label="当前空间">
      <div className="flex items-center gap-2 text-[11px]" style={headingStyle}><Home size={14} />当前空间</div>
      {presence && <p className="break-words text-[11px] leading-5" style={detailStyle}>{presence}</p>}
      {homes.map((item) => <article key={item.id} className="min-w-0 rounded-lg border p-4 [overflow-wrap:anywhere]" style={cardStyle}>
        <h3 className="text-[15px] font-medium">{item.name}</h3>
        {['residence', 'interior', 'layout', 'view', 'surroundings'].map((key) => textField(item.payload, key) && <p key={key} className="mt-1 whitespace-pre-wrap text-[11px] leading-5" style={detailStyle}>{textField(item.payload, key)}</p>)}
      </article>)}
      {!homes.length && <p className="text-[11px]" style={detailStyle}>还没有记录居住空间。</p>}
    </section>
    <section className="min-w-0 space-y-3" aria-label="生活物件">
      <div className="flex items-center gap-2 text-[11px]" style={headingStyle}><Package size={14} />生活物件</div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">{objects.map((item) => <article key={item.id} className="min-w-0 rounded-lg border p-3 [overflow-wrap:anywhere]" style={cardStyle}>
        <h3 className="text-[12px] font-medium">{item.name}</h3>
        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5" style={detailStyle}>{textField(item.payload, 'description') || textField(item.payload, 'detail') || textField(item.payload, 'note')}</p>
      </article>)}</div>
      {!objects.length && <p className="text-[11px]" style={detailStyle}>还没有记录生活物件。</p>}
    </section>
  </div>
}

/**
 * 背景：常去和想去是地点记录，动态足迹才是发生过的经历；去重成地名会丢掉日期和经历。
 * 设计意图：按显式状态分组地点，单独呈现真实动态，沿用候选的地点、正文与右侧日期布局。
 * 关键约束：不以播种时间制造访问日期；没有地点的动态不推断位置，长文本只在内容区换行。
 */
export function WorldFootprintsContent({ assets, moments }: { assets: readonly LivingAsset[]; moments: readonly LivingMoment[] }) {
  const places = assets.filter((item) => item.kind === 'footprint')
  const visits = moments.filter((item) => textField(item.meta, 'location').trim())
  return <div className="min-w-0 space-y-4" data-world-content="footprints">
    {(['favorite', 'wanted'] as const).map((status) => {
      const items = places.filter((item) => (item.payload.visitStatus === 'wanted' ? 'wanted' : 'favorite') === status)
      const label = status === 'wanted' ? '想去的地方' : '常去地点'
      return items.length > 0 && <section key={status} className="space-y-3" aria-label={label}>
        <div className="flex items-center gap-2 text-[11px]" style={headingStyle}><MapPin size={14} />{label}</div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.id} className="min-w-0 rounded-lg border p-3 [overflow-wrap:anywhere]" style={cardStyle}>
          <h3 className="text-[12px] font-medium">{item.name}</h3>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5" style={detailStyle}>{textField(item.payload, 'description')}</p>
          {textField(item.payload, 'city') && <p className="mt-1 text-[10px]" style={detailStyle}>{textField(item.payload, 'city')}</p>}
        </article>)}</div>
      </section>
    })}
    <section className="space-y-3" aria-label="生活足迹">
      <div className="flex items-center gap-2 text-[11px]" style={headingStyle}><MapPin size={14} />生活足迹</div>
      {visits.map((item, index) => {
        const date = new Date(item.publishedAt)
        const validDate = Number.isFinite(date.getTime())
        return <article key={`${item.publishedAt}-${index}`} className="min-w-0 rounded-lg border p-3" style={cardStyle}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-[12px] font-medium [overflow-wrap:anywhere]">{textField(item.meta, 'location')}</h3>
            <time className="shrink-0 text-[10px]" style={detailStyle} dateTime={validDate ? date.toISOString() : undefined}>{validDate ? date.toLocaleDateString('zh-CN') : '日期未知'}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 [overflow-wrap:anywhere]" style={detailStyle}>{item.text}</p>
        </article>
      })}
      {!visits.length && <p className="text-[11px]" style={detailStyle}>还没有记录到生活地点。</p>}
    </section>
  </div>
}
