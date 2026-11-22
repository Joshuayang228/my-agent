import { useMemo, useState } from 'react'
import { WorldKeepsakesPanel } from '../world/WorldKeepsakesPanel'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'
import type {
  CompanionKeepsakeRecord,
  CompanionGiftRecord,
} from '../../shared/types'

const GIFTING_SCENARIOS = [
  { id: 'gifting-history', label: '收到的礼物' },
  { id: 'keepsakes', label: '送出的礼物' },
  { id: 'gifting-empty', label: '空礼物柜' },
] as const

type GiftingScenario = typeof GIFTING_SCENARIOS[number]['id']

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
]

const MOCK_RECEIVED_GIFTS: CompanionGiftRecord[] = [
  {
    id: 'mock-gift-1',
    roleId: 'luffy',
    giftKey: 'bone-meat',
    giftName: '特制带骨烤肉',
    category: 'food',
    userNote: '刚烤好的大肉，闻到香气就想到你啦，快趁热吃！',
    companionReaction: '哇啊啊啊！是大肉！大块带骨烤肉！太棒啦——！你怎么知道我正好肚子饿得咕咕叫了！我要开动啦——！嚼嚼嚼……超级好吃！你果然是最好的同伴！肉也分你一小口……不行，还是我全吃啦！嘻嘻嘻！',
    createdAt: Date.UTC(2026, 10, 8, 19, 30),
    vitalsBuff: { satiety: 30, mood: 25, energy: 15 },
  },
  {
    id: 'mock-gift-2',
    roleId: 'luffy',
    giftKey: 'treasure-map',
    giftName: '泛黄的神秘海图',
    category: 'collectible',
    userNote: '港口老海员那里淘到的藏宝图，听说上面有大冒险！',
    companionReaction: '喂喂喂！这难道是……藏宝图吗？！好厉害！上面画的小岛看起来好危险又好好玩！看这个骷髅标记，明天我们就向着这个岛全速前进！',
    createdAt: Date.UTC(2026, 10, 7, 14, 0),
    vitalsBuff: { mood: 20, energy: 10 },
  },
]

export function GiftingExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState<GiftingScenario>('gifting-history')

  const gifts = useMemo<CompanionGiftRecord[]>(() => {
    if (scenario === 'gifting-empty' || scenario === 'keepsakes') return []
    return [...MOCK_RECEIVED_GIFTS]
  }, [scenario])

  const keepsakes = useMemo<CompanionKeepsakeRecord[]>(() => {
    if (scenario === 'gifting-empty') return []
    return [...MOCK_KEEPSAKES]
  }, [scenario])

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-testid="world-gifting-fixture"
      data-persona-id={personaId}
    >
      <WorldCandidateControls>
        <PlaygroundStateSwitcher
          items={GIFTING_SCENARIOS}
          value={scenario}
          onChange={(val) => setScenario(val as GiftingScenario)}
          ariaLabel="礼物柜体验场景切换"
        />
      </WorldCandidateControls>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <WorldKeepsakesPanel
          roleId="luffy"
          initialSubTab={scenario === 'keepsakes' ? 'keepsakes' : 'gifts'}
          previewKeepsakes={keepsakes}
          previewGifts={gifts}
          onTakeToChat={(opts) => {
            console.log('[Playground Gifting Preview] Take to chat:', opts.text)
          }}
        />
      </div>
    </div>
  )
}
