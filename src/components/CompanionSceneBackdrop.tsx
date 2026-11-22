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
  bannerSrc?: string | null
  /** 壁纸透明度百分比（0~35，默认 12，接近轻雾感不干扰正文阅读） */
  opacity?: number
}

export function CompanionSceneBackdrop({ roleId, bannerSrc, opacity = 12 }: CompanionSceneBackdropProps) {
  const [scene, setScene] = useState<CompanionSceneId>('default')
  const clampedOpacity = Math.min(0.35, Math.max(0, (Number.isFinite(opacity) ? opacity : 12) / 100))

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
      {/* 背景：wash 渐变末端是不透明的 bg-primary，若盖在壁纸之上会把图片完全遮住（用户反馈 Chat 底图不可见的根因）。
          设计意图：wash 作为底色垫在壁纸之下；关键约束：wash 必须先于壁纸渲染，调换顺序会让底图再次消失。 */}
      <div className="companion-scene-wash absolute inset-0" />
      {bannerSrc && (
        <div className="companion-scene-wallpaper pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <img
            src={bannerSrc}
            alt=""
            className="h-full w-full object-cover object-center transition-opacity duration-500 select-none"
            style={{ opacity: clampedOpacity }}
          />
        </div>
      )}
      <div className="companion-scene-glow absolute" />
      <div className="companion-scene-vignette absolute inset-0" />
    </div>
  )
}
