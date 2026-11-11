import { useMemo, useState } from 'react'
import { WorldKeepsakesPanel } from '../world/WorldKeepsakesPanel'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'
import type { CompanionKeepsakeRecord } from '../../shared/types'

const KEEPSAKE_SCENARIOS = [
  { id: 'default', label: '信物展架' },
  { id: 'long', label: '长名称与寄语' },
  { id: 'minimal', label: '精简卡片' },
  { id: 'empty', label: '空信物架' },
  { id: 'error', label: '读取失败' },
] as const

type KeepsakeScenario = typeof KEEPSAKE_SCENARIOS[number]['id']

const MOCK_KEEPSAKES: readonly CompanionKeepsakeRecord[] = [
  {
    id: 'fixture-keepsake-1',
    roleId: 'luffy',
    name: '生命卡的一角',
    description: '用特殊材质制成的神秘纸片，无论相隔多远，都会指向对方所在的方向。',
    lore: '「就算在大海的另一头走散了，顺着它飘动的方向，我也一定会找到你的！」',
    giftMessage: '这是我的生命卡！顺着它飘动的方向，无论多远都能找到彼此！',
    giftReason: '初识同伴誓约',
    iconName: 'gift',
    acquiredAt: Date.UTC(2026, 10, 1, 10, 0),
  },
  {
    id: 'fixture-keepsake-2',
    roleId: 'luffy',
    name: '梅利号的小羊金色铃铛',
    description: '从最初的黄金梅利号主桅杆上摘下的小小金色铃铛，摇动时仿佛能听见温柔的航海钟声。',
    lore: '「这是梅利号留给我们的心意！能和你一起把想看的故事和风景看完，真是太好了！」',
    giftMessage: '这是梅利号留给我们的铃铛！听见它的响声，就好像我们还在同一艘船上！',
    giftReason: '共同心愿兑现',
    iconName: 'bell',
    acquiredAt: Date.UTC(2026, 10, 5, 16, 20),
  },
  {
    id: 'fixture-keepsake-3',
    roleId: 'luffy',
    name: '风车村的麦穗编织绳',
    description: '玛琪诺亲手用风车村金黄麦穗搓制成的手绳，带着海风与故乡面包的温暖气息。',
    lore: '「每次看到它，我就会想起最初出海时的约定。现在，你也是我最重要的伙伴了！」',
    giftMessage: '这是风车村的编织绳！玛琪诺说戴着它出海就会平平安安！',
    giftReason: '深厚同伴羁绊',
    iconName: 'sparkles',
    acquiredAt: Date.UTC(2026, 10, 7, 19, 0),
  },
  {
    id: 'fixture-keepsake-4',
    roleId: 'luffy',
    name: '草帽冒险者的永恒指针',
    description: '由伙伴亲手打磨的水晶永恒指针，刻着你们共同经历过的所有冒险坐标。',
    lore: '「下一次冒险要去哪里？无论去哪，只要有你在船上，我就什么都不怕！」',
    giftMessage: '指针永远指向我们的下一站！无论你想去哪里，我都陪你一起去冒险！',
    giftReason: '长线相伴专属信物',
    iconName: 'compass',
    acquiredAt: Date.UTC(2026, 10, 8, 21, 30),
  },
]

export function KeepsakesExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState<KeepsakeScenario>('default')

  const keepsakes = useMemo<CompanionKeepsakeRecord[]>(() => {
    if (scenario === 'empty' || scenario === 'error') return []
    if (scenario === 'minimal') {
      return MOCK_KEEPSAKES.map((item) => ({
        ...item,
        lore: '',
      }))
    }
    if (scenario === 'long') {
      return MOCK_KEEPSAKES.map((item, index) => ({
        ...item,
        name: index === 0
          ? `${item.name}：跨越无风带与伟大航路的永不熄灭同伴誓约信物样张`
          : item.name,
        description: index === 0
          ? `${item.description} 这是用于检验卡片内容弹性自适应高度与网格对齐的超长描述排版样张。`.repeat(3)
          : item.description,
        lore: index === 0
          ? `「${item.lore} 无论遇到什么困难，只要回头看，我们永远都在同一艘船上，向着世界的尽头全速前进！」`
          : item.lore,
      }))
    }
    return [...MOCK_KEEPSAKES]
  }, [scenario])

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="world-keepsakes-fixture"
      data-persona-id={personaId}
    >
      <WorldCandidateControls>
        <PlaygroundStateSwitcher
          items={KEEPSAKE_SCENARIOS}
          value={scenario}
          onChange={setScenario}
          ariaLabel="信物状态样张"
        />
      </WorldCandidateControls>
      <WorldKeepsakesPanel
        key={`${personaId}-${scenario}`}
        roleId={personaId}
        previewKeepsakes={keepsakes}
        previewReadError={scenario === 'error' ? '信物展架暂时无法读取，请检查网络或点击重试。' : undefined}
        onPreviewRetry={() => setScenario('default')}
      />
    </div>
  )
}
