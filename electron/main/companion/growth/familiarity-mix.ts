/**
 * 熟悉度交心/干活混合信号（M28-G2）
 *
 * 背景：仅靠消息条数会把「刷代码」当成「交心密度」，默契口吻易误判。
 * 意图：对近窗用户消息做启发式 bond/task 分类，产出 lean 供关系阶段与 Prompt。
 * 约束：不调 LLM；不改反思硬门闸阈值；companion 不 import agent/；偏保守（不够样本 → mixed）。
 * 调用方：relationship-stage；单测直接打纯函数。
 */

export type FamiliarityLabel = 'bond' | 'task' | 'neutral'

export type FamiliarityLean =
  | 'bond-leaning'
  | 'task-leaning'
  | 'mixed'
  | 'sparse'

export interface FamiliarityMixResult {
  bond: number
  task: number
  neutral: number
  sampled: number
  lean: FamiliarityLean
  signals: string[]
}

/** 交心：情绪/相处/生活分享（非审讯式问卷） */
const RE_BOND =
  /好累|崩溃|难受|焦虑|想哭|孤独|心情|想你|陪陪|聊聊|今天好难|心里|委屈|压力|失眠|想找人说|谢谢你在|有点丧|好想|陪我|谈心|夜深了|睡不着/i

/** 干活：工程/排障/提交类（刷消息不等于交心） */
const RE_TASK =
  /\b(npm|git|pr|tsc|vite|eslint|bug|stack\s*trace|TypeError|Cannot find|EACCES)\b|报错|修\s*bug|改代码|提交|commit|实现|重构|单测|类型错误|编译|部署|文件路径|shell_exec|file_write|怎么写|帮我改|直接执行/i

/**
 * 单条用户消息标签。
 * 同时命中时：bond 优先于 task（情绪+催办仍算有交心成分）。
 */
export function classifyFamiliarityLabel(text: string): FamiliarityLabel {
  const t = (text || '').trim()
  if (!t) return 'neutral'
  const bond = RE_BOND.test(t)
  const task = RE_TASK.test(t)
  if (bond) return 'bond'
  if (task) return 'task'
  return 'neutral'
}

/**
 * 聚合近窗消息 → lean。
 * 有效分类样本（bond+task）<2 → sparse；否则按占比 ≥0.55 判倾斜。
 */
export function resolveFamiliarityMix(
  texts: string[],
  opts?: { minClassified?: number; leanThreshold?: number },
): FamiliarityMixResult {
  const minClassified = opts?.minClassified ?? 2
  const thr = opts?.leanThreshold ?? 0.55
  let bond = 0
  let task = 0
  let neutral = 0
  for (const raw of texts) {
    const label = classifyFamiliarityLabel(raw)
    if (label === 'bond') bond++
    else if (label === 'task') task++
    else neutral++
  }
  const sampled = bond + task + neutral
  const classified = bond + task
  const signals: string[] = [`sampled:${sampled}`, `bond:${bond}`, `task:${task}`]

  if (classified < minClassified) {
    signals.push('sparse-classified')
    return { bond, task, neutral, sampled, lean: 'sparse', signals }
  }

  const bondRatio = bond / classified
  const taskRatio = task / classified
  let lean: FamiliarityLean = 'mixed'
  if (bondRatio >= thr) {
    lean = 'bond-leaning'
    signals.push(`bond-ratio:${bondRatio.toFixed(2)}`)
  } else if (taskRatio >= thr) {
    lean = 'task-leaning'
    signals.push(`task-ratio:${taskRatio.toFixed(2)}`)
  } else {
    signals.push('balanced-mix')
  }

  return { bond, task, neutral, sampled, lean, signals }
}

const LEAN_GUIDANCE: Record<FamiliarityLean, string> = {
  'bond-leaning':
    '近窗偏交心：可更软地接住，但仍尊重边界；勿把分享当成审讯入口。',
  'task-leaning':
    '近窗偏干活：相处密度主要是协作/排障，勿用「多年老友」口吻套近乎；默契不等于交心。',
  mixed: '近窗交心与干活混杂：按本轮立场切换，勿一刀切亲热或一刀切机械。',
  sparse: '近窗可分类样本少：勿从条数推断亲密度。',
}

export function formatFamiliarityMixForPrompt(mix: FamiliarityMixResult): string {
  return [
    `熟悉度构成：${mix.lean}（交心=${mix.bond}，任务=${mix.task}，中性=${mix.neutral}）`,
    `行动指引：${LEAN_GUIDANCE[mix.lean]}`,
  ].join('\n')
}

export const __test = { RE_BOND, RE_TASK, LEAN_GUIDANCE }
