import { useMemo, useState } from 'react'
import { CoDecisionCard } from '../world/CoDecisionCard'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'
import type { CompanionCoDecisionRecord } from '../../shared/types'

const CO_DECISION_SCENARIOS = [
  { id: 'pending', label: '待决事项' },
  { id: 'resolved', label: '已确定决策' },
  { id: 'two-options', label: '双选项轻量' },
  { id: 'long', label: '长标题与长困境' },
  { id: 'empty', label: '空待决态' },
] as const

type CoDecisionScenario = typeof CO_DECISION_SCENARIOS[number]['id']

const MOCK_CO_DECISION_3_OPTIONS: CompanionCoDecisionRecord = {
  id: 'fixture-co-decision-1',
  roleId: 'luffy',
  title: '明天的航向大抉择！',
  dilemma: '喂！明天阳光号就要靠岸了，罗宾说东边的岛上有古代图书馆遗迹，索隆想去北边的海港城镇找酒喝，而我听说西边的大陆正在举办超级大肉宴会！我们到底先去哪边？你来做决定吧！',
  options: [
    {
      id: 'opt-meat',
      label: '西边：超级大肉宴会！',
      desc: '肉才是航海的第一要义，必须先填饱肚子！',
      impactHint: '明天将前往大肉岛举行狂欢宴会',
    },
    {
      id: 'opt-ruins',
      label: '东边：古代遗迹与神秘图书馆',
      desc: '未知的古代历史和巨大石碑在等着我们探寻。',
      impactHint: '明天将探索神秘古迹并挖掘失落文献',
    },
    {
      id: 'opt-tavern',
      label: '北边：海港酒馆与水手集市',
      desc: '听听来自世界各地的海盗传闻与冒险八卦。',
      impactHint: '明天将停靠繁华港口打听新世界悬赏',
    },
  ],
  status: 'pending',
  createdAt: Date.UTC(2026, 10, 9, 10, 0),
}

const MOCK_CO_DECISION_RESOLVED: CompanionCoDecisionRecord = {
  ...MOCK_CO_DECISION_3_OPTIONS,
  id: 'fixture-co-decision-resolved',
  status: 'resolved',
  selectedOptionId: 'opt-meat',
  selectedOptionLabel: '西边：超级大肉宴会！',
  companionReaction: '哇哈哈哈哈！果然英雄所见略同！大肉才是最重要的！我现在就去告诉娜美改舵向西！明天准备大吃一顿啦！',
  resolvedAt: Date.UTC(2026, 10, 9, 10, 15),
}

const MOCK_CO_DECISION_2_OPTIONS: CompanionCoDecisionRecord = {
  id: 'fixture-co-decision-2',
  roleId: 'luffy',
  title: '山治的特制便当对决',
  dilemma: '山治今天做了两份超绝便当，一份是堆得像小山一样的巨型烤带骨肉，一份是铺满黄金脆虾的极品海鲜炒饭！两份都超级香，山治说我只能挑一份带去甲板放风，另一份要留给大家。你觉得我今天该吃哪一个？',
  options: [
    {
      id: 'opt-bone-meat',
      label: '巨型烤带骨肉便当',
      desc: '大块大块的大口撕咬，充满力量的纯粹肉香！',
      impactHint: '午间甲板将大快朵颐烤肉',
    },
    {
      id: 'opt-seafood-rice',
      label: '黄金脆虾海鲜炒饭',
      desc: '浓郁的海鲜鲜味与金黄米粒，回味无穷的美味！',
      impactHint: '午间甲板将品尝鲜美海鲜炒饭',
    },
  ],
  status: 'pending',
  createdAt: Date.UTC(2026, 10, 9, 11, 30),
}

export function CoDecisionExperienceCandidate({ personaId = 'luffy' }: { personaId?: string }) {
  const [scenario, setScenario] = useState<CoDecisionScenario>('pending')

  const decision = useMemo<CompanionCoDecisionRecord | null>(() => {
    if (scenario === 'empty') return null
    if (scenario === 'resolved') return MOCK_CO_DECISION_RESOLVED
    if (scenario === 'two-options') return MOCK_CO_DECISION_2_OPTIONS
    if (scenario === 'long') {
      return {
        ...MOCK_CO_DECISION_3_OPTIONS,
        title: '关于跨越无风带航向抉择、补给规划与伙伴心愿平衡的超长标题同伴决策样张',
        dilemma: `${MOCK_CO_DECISION_3_OPTIONS.dilemma}\n\n这是用于检验决策卡片在超长文字描写、多段落背景说明与多重情绪纠结时的排版自适应能力。伙伴详细陈述了每个人对航线分歧的想法，希望你能从大局出发给出最果断的指示！\n`.repeat(3),
        options: MOCK_CO_DECISION_3_OPTIONS.options.map((opt, index) => ({
          ...opt,
          label: `${opt.label}（包含长篇细致论证 ${index + 1}）`,
          desc: `${opt.desc} 这是用于检验选项卡片自适应高度并与相邻选项严格对齐的超长描述文字。`,
        })),
      }
    }
    return MOCK_CO_DECISION_3_OPTIONS
  }, [scenario])

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 p-4"
      data-testid="world-co-decision-fixture"
      data-persona-id={personaId}
    >
      <WorldCandidateControls>
        <PlaygroundStateSwitcher
          items={CO_DECISION_SCENARIOS}
          value={scenario}
          onChange={setScenario}
          ariaLabel="同伴共同决策状态样张"
        />
      </WorldCandidateControls>

      <div className="max-w-3xl">
        <CoDecisionCard
          key={`${personaId}-${scenario}`}
          roleId={personaId}
          previewDecision={decision}
          onDecisionResolved={(res) => {
            console.log('Candidate resolved decision in memory:', res)
          }}
          allowManualTrigger
        />
      </div>
    </div>
  )
}
