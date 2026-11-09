import { useState } from 'react'
import { Bot, UserRound } from 'lucide-react'

export interface CompanionAvatarProps {
  src?: string | null
  name?: string
  role?: 'assistant' | 'user' | 'system'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'circle' | 'rounded'
  themeColor?: string | null
  className?: string
  alt?: string
  ariaHidden?: boolean
}

const SIZE_CLASSES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

const ICON_SIZES = {
  xs: 11,
  sm: 14,
  md: 18,
  lg: 26,
  xl: 36,
}

/**
 * 角色专属头像组件：
 *
 * 背景：先前对话与人物世界各处散落 <Bot /> 机器人图标或单字方块，缺乏真实伙伴的视觉活人感。
 * 设计意图：集中管理伙伴与用户头像；优先渲染专属配图（支持 base64 / 本地受控图片 / 外部链接），
 *          图片加载失败或未配置时自动平滑回退至角色首字艺术标或温和图标。
 * 关键约束：纯展示组件，不直接发起网络请求或绕过主进程安全策略；错误时静默回退，不阻断渲染。
 */
export function CompanionAvatar({
  src,
  name,
  role = 'assistant',
  size = 'sm',
  shape = 'circle',
  themeColor,
  className = '',
  alt,
  ariaHidden = true,
}: CompanionAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false)
  const isUser = role === 'user'
  const displayName = name?.trim() || (isUser ? '我' : '伙伴')
  const initial = Array.from(displayName)[0] || '?'
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl'
  const iconSize = ICON_SIZES[size] ?? 14

  const customBgStyle = themeColor && !isUser ? {
    background: `color-mix(in srgb, ${themeColor} 18%, var(--bg-secondary))`,
    color: themeColor,
    borderColor: `color-mix(in srgb, ${themeColor} 30%, transparent)`,
  } : undefined

  if (src && !loadFailed) {
    return (
      <span
        aria-hidden={ariaHidden}
        className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border shadow-sm transition-transform ${sizeClass} ${shapeClass} ${className}`}
        style={{
          borderColor: 'var(--card-bg)',
          background: 'var(--bg-secondary)',
        }}
      >
        <img
          src={src}
          alt={alt ?? displayName}
          className="h-full w-full object-cover object-center"
          onError={() => setLoadFailed(true)}
          loading="lazy"
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden={ariaHidden}
      className={`relative inline-flex shrink-0 items-center justify-center font-bold select-none border transition-colors ${sizeClass} ${shapeClass} ${className}`}
      style={customBgStyle ?? {
        background: isUser ? 'var(--accent-subtle)' : 'var(--accent-subtle)',
        color: isUser ? 'var(--accent-fg)' : 'var(--companion-accent-warm)',
        borderColor: 'var(--card-bg)',
      }}
    >
      {isUser ? (
        <UserRound size={iconSize} />
      ) : initial && initial !== '?' ? (
        <span>{initial}</span>
      ) : (
        <Bot size={iconSize} />
      )}
    </span>
  )
}
