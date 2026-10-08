import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ActionButton } from '../foundation/ActionButton'
import { ErrorState } from '../foundation/ErrorState'
import { LAYOUT_CLASSES } from '../../shared/content-layout'
import { WorldContactsGallery } from './WorldContactsGallery'
import { WorldTravelGallery } from './WorldTravelGallery'
import { WorldRecordImage } from './WorldRecordImage'
import { MomentImageGrid } from './MomentImageGrid'
import { travelRecordsForRole, type LivingAsset } from './WorldLivingContent'
import { worldRecordImageReference } from '../../shared/world-records'
import type { CompanionContactsData, MomentListResult } from '../../shared/types'

const relationLabels: Record<string, string> = { friend: '朋友', colleague: '同事', family: '家人', mentor: '前辈', rival: '对手', acquaintance: '熟人', crush: '暧昧' }
interface ContactsState { data: CompanionContactsData; assets: LivingAsset[]; moments: MomentListResult['items'] }

/**
 * 背景：正式通讯录须消费当前角色关系资料，不再为生活页加载召唤忙闲或会话历史。
 * 设计意图：独立只读加载层复用关系画廊，关联目标从同角色响应解析，底层召唤能力保留。
 * 关键约束：切换角色立即清空旧资料，过期响应不得落入新角色；失败可重试，不把 fixture 作为 fallback。
 */
export function WorldContactsPanel() {
  const [state, setState] = useState<ContactsState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const api = window.electronAPI?.companion
      if (!api?.getContacts) throw new Error('接口不可用')
      const [data, assets, moments] = await Promise.all([api.getContacts(), api.getAssets(), api.getMoments()])
      const active = await api.getActive()
      if (current !== generation.current) return
      if (!active || active.id !== data.roleId || assets.roleId !== data.roleId || moments.roleId !== data.roleId) throw new Error('人物已切换')
      setState({ data, assets: assets.items.filter(item => item.roleId === data.roleId), moments: moments.items.filter(item => item.roleId === data.roleId) })
    } catch { if (current === generation.current) setError('通讯录暂时未能读取，请重新读取。') }
    finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => {
    void load()
    const off = window.electronAPI?.companion.onRoleChanged?.(() => { generation.current++; setState(null); void load() })
    return () => { generation.current++; off?.() }
  }, [load])
  const readImage = useCallback((assetId: string, imageId: string) => window.electronAPI!.companion.readAssetImage(assetId, imageId), [])
  const revealImage = useCallback((assetId: string, imageId: string) => window.electronAPI!.companion.revealAssetImage(assetId, imageId), [])
  const data = state?.data
  const trips = state ? travelRecordsForRole(state.assets, state.data.roleId) : []
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-contacts-panel">
    {!error && <div className="flex shrink-0 items-center justify-end px-4 pt-3"><IconButton label="刷新通讯录" disabled={loading} onClick={() => void load()}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton></div>}
    {error && <div className={`${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`}><ErrorState title="通讯录未能读取" description={error} action={<ActionButton disabled={loading} onClick={() => void load()}>重新读取通讯录</ActionButton>} /></div>}
    {!data && loading && <p role="status" className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>正在读取通讯录…</p>}
    {data && <WorldContactsGallery key={data.roleId} ownerRoleId={data.roleId} people={data.people}
      relations={data.relations.map(item => ({ ...item, relationLabel: relationLabels[item.relationType] ?? item.relationType, interactionSummary: item.summary }))}
      experiences={data.experiences.map(item => ({ ...item, date: new Date(item.occurredAt).toLocaleDateString('zh-CN') }))}
      resolveReference={reference => {
        if (reference.kind === 'trip') {
          const trip = trips.find(item => item.id === reference.targetId)
          if (!trip) return null
          return <WorldTravelGallery key={trip.id} embedded initialSelectedId={trip.id} trips={[trip]} renderImage={item => {
            const asset = state!.assets.find(record => record.id === item.id)
            const image = asset && worldRecordImageReference(asset.payload)
            return asset && image ? <WorldRecordImage assetId={asset.id} image={image} alt={asset.name} readImage={readImage} revealImage={revealImage} /> : null
          }} />
        }
        const moment = state!.moments.find(item => item.id === reference.targetId)
        return moment ? <section data-testid="contact-linked-moment"><h2 className="text-lg font-semibold">生活动态</h2><time className="mt-2 block text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(moment.publishedAt).toLocaleString('zh-CN')}</time><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{moment.text}</p>{moment.imageIds?.length ? <div className="mt-4"><MomentImageGrid momentId={moment.id} imageIds={moment.imageIds} enabled={!loading} /></div> : null}</section> : null
      }} />}
  </div>
}
