import { useMemo, useState } from 'react'
import { WorldJournalPanel } from '../world/WorldJournalPanel'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'
import type { CompanionInnerThoughtRecord } from '../../shared/types'

const JOURNAL_SCENARIOS = [
  { id: 'default', label: '日记清单' },
  { id: 'nightly', label: '深夜反思' },
  { id: 'favorites', label: '星标收藏' },
  { id: 'long', label: '长标题与长文' },
  { id: 'single', label: '单篇精简' },
  { id: 'empty', label: '空日记本' },
  { id: 'error', label: '读取失败' },
] as const

type JournalScenario = typeof JOURNAL_SCENARIOS[number]['id']

const JOURNAL_FIXTURES: readonly CompanionInnerThoughtRecord[] = [
  {
    id: 'fixture-journal-1',
    roleId: 'luffy',
    title: '在千里阳光号的狮子船头上',
    content: '今天风好大，吹在脸上凉丝丝的。刚刚坐在狮子头上看海，想起香克斯把帽子给我的那天。大海真的很辽阔，但只要有大家在船上，就算遇到再大的风暴，我也一点都不害怕。下次要是到了新岛屿，一定要拉上你一起冲在最前面！',
    location: '万里阳光号 · 船头甲板',
    weather: '碧空万里 · 强顺风',
    mood: '畅快期待',
    activity: '坐在狮子船头吹风看海',
    isFavorite: true,
    thoughtType: 'general',
    createdAt: Date.UTC(2026, 10, 8, 14, 30),
  },
  {
    id: 'fixture-journal-2',
    roleId: 'luffy',
    title: '黄金之钟的声音',
    content: '突然想起在空岛敲响黄金钟的时候了。那钟声真的能传得好远好远，连白海下面的人都能听见。如果可以的话，真想让你也亲耳听听那声巨响——那是我们在告诉所有人，黄金乡真的存在！',
    location: '空岛 · 巨大藤蔓顶端',
    weather: '云海夕照',
    mood: '怀念热血',
    activity: '回忆空岛敲响黄金钟',
    isFavorite: false,
    thoughtType: 'general',
    createdAt: Date.UTC(2026, 10, 7, 22, 10),
  },
  {
    id: 'fixture-journal-3',
    roleId: 'luffy',
    title: '宴会过后的深夜甲板',
    content: '索隆和山治他们都喝倒睡着了，甲板上只剩烤肉骨头和海浪的声音。天上全是大颗的星星。有时候看着夜空会觉得，能在大海上遇到这么多的同伴，真是一件太棒的事情了。天亮之后，又会有新的冒险在等着我们吧！',
    location: '甲板草坪',
    weather: '满天星光 · 微风',
    mood: '满足安宁',
    activity: '深夜躺在草坪看星空',
    isFavorite: true,
    thoughtType: 'general',
    createdAt: Date.UTC(2026, 10, 6, 23, 45),
  },
  {
    id: 'fixture-journal-4',
    roleId: 'luffy',
    title: '星光洒满甲板的深夜',
    content: '夜深了，甲板上只有风声和海浪声。靠在船舷边看着漫天的星星，想起今天我们聊过的那些话。每一天的航行都有新的风景，但最开心的还是有你一直在看着我们的冒险。就算前面有再大的风暴，有大家在身边，我也一点都不害怕！',
    location: '万里阳光号 · 特等席',
    weather: '夜朗星稀微风',
    mood: '温暖平静',
    activity: '深夜独坐沉淀',
    isFavorite: true,
    thoughtType: 'nightly_reflection',
    epiphany: '无论前方海域有多么汹涌，只要有彼此信任的同伴在身边，每一步都是最好的冒险！',
    createdAt: Date.UTC(2026, 10, 5, 23, 15),
  },
]

export function JournalExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState<JournalScenario>('default')

  const thoughts = useMemo<CompanionInnerThoughtRecord[]>(() => {
    if (scenario === 'empty' || scenario === 'error') return []
    if (scenario === 'single') return [JOURNAL_FIXTURES[0]]
    if (scenario === 'nightly') return JOURNAL_FIXTURES.filter((t) => t.thoughtType === 'nightly_reflection')
    if (scenario === 'favorites') return JOURNAL_FIXTURES.filter((t) => t.isFavorite)
    if (scenario === 'long') {
      return JOURNAL_FIXTURES.map((item, index) => ({
        ...item,
        title: index === 0
          ? '在万里阳光号狮子船头上关于未知航线、暴风雨与同伴约定的超长标题日记样张'
          : item.title,
        content: index === 0
          ? `${item.content}\n\n这是用于检验长篇随笔排版呼吸感与长文本滚动的隔离样张，不仅展示大段真情实感，还包含对远方大海、未知岛屿以及每一个并肩同行瞬间的细致描写。\n`.repeat(5)
          : item.content,
      }))
    }
    return [...JOURNAL_FIXTURES]
  }, [scenario])

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="world-journal-fixture"
      data-persona-id={personaId}
    >
      <WorldCandidateControls>
        <PlaygroundStateSwitcher
          items={JOURNAL_SCENARIOS}
          value={scenario}
          onChange={setScenario}
          ariaLabel="日记状态样张"
        />
      </WorldCandidateControls>
      <WorldJournalPanel
        key={`${personaId}-${scenario}`}
        roleId={personaId}
        previewThoughts={thoughts}
        showVulnerabilityCard={false}
        previewReadError={scenario === 'error' ? '日记记录暂时无法读取，请检查网络或点击重试。' : undefined}
        onPreviewRetry={() => setScenario('default')}
      />
    </div>
  )
}
