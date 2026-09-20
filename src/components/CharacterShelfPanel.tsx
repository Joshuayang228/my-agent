import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from './Toast'
import { CharacterShelfContent, type ShelfCharacter } from './companion/CharacterShelfContent'

interface CharacterShelfPanelProps {
  onClose: () => void
  onSwitched?: (role: ShelfCharacter) => void
}

/**
 * 背景：正式角色架需要真实角色和切角门控，候选展示不能替代后端执行。
 * 设计意图：容器管理读取和切角，共享展示只接收数据；失败保留当前角色而不乐观切换。
 * 关键约束：requestSwitch 仍由主进程拒绝流式切角；同步锁限制单次请求，卸载或新读取后不接收迟到结果。
 */
export function CharacterShelfPanel({ onClose, onSwitched }: CharacterShelfPanelProps) {
  const { toast } = useToast()
  const [list, setList] = useState<ShelfCharacter[]>([])
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const generation = useRef(0)
  const mounted = useRef(false)
  const busy = useRef(false)

  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      if (!window.electronAPI?.companion) throw new Error('Companion unavailable')
      const [pros, active] = await Promise.all([
        window.electronAPI.companion.listProtagonists(),
        window.electronAPI.companion.getActive(),
      ])
      if (!mounted.current || current !== generation.current) return
      setList(pros)
      setActiveId(active.id)
    } catch {
      if (mounted.current && current === generation.current) setError('角色读取失败，请刷新重试。')
    } finally {
      if (mounted.current && current === generation.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void load()
    const unsubscribe = window.electronAPI?.companion?.onRoleChanged?.(() => { void load() })
    return () => { mounted.current = false; generation.current++; unsubscribe?.() }
  }, [load])

  const handleSwitch = async (id: string) => {
    const role = list.find(character => character.id === id)
    if (!role || id === activeId || busy.current || loading) return
    busy.current = true
    setSwitchingId(id)
    setError('')
    try {
      const result = await window.electronAPI?.companion.requestSwitch(id)
      if (!mounted.current) return
      if (result?.ok) {
        setActiveId(id)
        onSwitched?.(role)
        toast(result.reacquaint?.toast || '已切换到' + role.name, 'success')
      } else if (result?.code === 'ALREADY_ACTIVE') {
        setActiveId(id)
      } else {
        setError(result?.code === 'SESSION_ACTIVE' ? '对话进行中，请先结束或中断当前回复后再切换主角。' : '切换未完成，请重试。')
      }
    } catch {
      if (mounted.current) setError('切换未完成，请重试。')
    } finally {
      busy.current = false
      if (mounted.current) setSwitchingId(null)
    }
  }

  return <div className="h-full min-h-0 overflow-y-auto scrollbar-thin" data-testid="character-shelf-panel">
    <CharacterShelfContent characters={list} activeId={activeId} switchingId={switchingId} loading={loading} error={error}
      onSelect={id => { void handleSwitch(id) }} onRefresh={() => { void load() }} onClose={onClose} />
  </div>
}
