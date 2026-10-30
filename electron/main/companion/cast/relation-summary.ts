import type { UniverseRelations } from '../types'

/**
 * 把关系静态资料压成各入口共用的短摘要。
 *
 * 背景：名册、通讯录和 Debug 都需要看到关系方向，但不能各自解释 Role Pack。
 * 设计意图：保留 note 的简短人物差异，再按需补相处方向、摩擦与修复信号；不把 NPC 全文注入主对话。
 * 关键约束：缺少 arc 的旧关系保持原摘要；每个字段都限制为单行，避免关系资料撑爆 Prompt。
 */
export function formatRelationSummary(edge: UniverseRelations['edges'][number]): string {
  const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 160) : ''
  const note = clean(edge.note)
  const arc = edge.arc
  const arcText = arc
    ? [
        clean(arc.bond) ? `相处方向：${clean(arc.bond)}` : '',
        clean(arc.friction) ? `摩擦点：${clean(arc.friction)}` : '',
        clean(arc.repair) ? `修复方式：${clean(arc.repair)}` : '',
        clean(arc.growthSignal) ? `成长信号：${clean(arc.growthSignal)}` : '',
      ].filter(Boolean).join('；')
    : ''
  return [note, arcText].filter(Boolean).join('；')
}
