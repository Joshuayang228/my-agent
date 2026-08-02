/**
 * Chat 消息区弱场景背景：随 location/presence 切换氛围，不抢气泡可读性。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  COMPANION_SCENE_LABEL,
  resolveCompanionScene,
  type CompanionSceneId,
} from '../shared/companion-scene'

interface CompanionSceneBackdropProps {
  roleId: string
}

export function CompanionSceneBackdrop({ roleId }: CompanionSceneBackdropProps) {
  const [scene, setScene] = useState<CompanionSceneId>('default')

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion) return
    try {
      const [status, moments] = await Promise.all([
        window.electronAPI.companion.catchupStatus(),
        window.electronAPI.companion.getMoments({ limit: 5 }),
      ])
      let location = ''
      for (const m of moments.items) {
        if (typeof m.meta?.location === 'string' && m.meta.location.trim()) {
          location = m.meta.location.trim()
          break
        }
      }
      setScene(
        resolveCompanionScene({
          presence: status.presence || '',
          location,
        }),
      )
    } catch {
      setScene('default')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, roleId])

  useEffect(() => {
    if (!window.electronAPI?.companion?.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load])

  // 整点附近刷新一次，便于家→夜色切换
  useEffect(() => {
    const id = window.setInterval(() => {
      void load()
    }, 5 * 60_000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <div
      className="companion-scene-backdrop pointer-events-none absolute inset-0 overflow-hidden"
      data-companion-scene={scene}
      aria-hidden
      title={`场景氛围 · ${COMPANION_SCENE_LABEL[scene]}`}
    >
      <div className="companion-scene-wash absolute inset-0" />
      <div className="companion-scene-glow absolute" />
      <div className="companion-scene-vignette absolute inset-0" />
    </div>
  )
}
