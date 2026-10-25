import { useEffect, useState } from 'react'
import type { ModelContextAsset } from '../../shared/types'

/** 背景：档案与位置分别关联静态来源，局部目录失败不应吞掉领域正文。
 * 意图：展开后查询真实统一目录，按明确人物归属和类型筛选，提供独立重试。
 * 约束：不拼造 key、不把注册当作历史使用；类型列表由调用方稳定定义，关闭 / 切换时丢弃迟到响应。
 */
export function useRoleDefinitionAssets(roleId: string, types: readonly ModelContextAsset['assetType'][], enabled: boolean, revision: number) {
  const [assets, setAssets] = useState<ModelContextAsset[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let current = true
    setLoading(true); setError('')
    const read = async () => {
      if (!window.electronAPI?.debug?.modelContextAssets) throw new Error('目录接口不可用')
      return window.electronAPI.debug.modelContextAssets()
    }
    read().then(next => { if (current) setAssets(next.filter(asset => asset.roleIds?.includes(roleId) && types.includes(asset.assetType))) }).catch(() => { if (current) setError('注册定义关联读取失败；已有目录关联保留。') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [enabled, roleId, types, revision, reload])
  return { assets, error, loading, retry: () => setReload(value => value + 1) }
}
