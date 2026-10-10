import { useState } from 'react'
import { MomentsPanel, type MomentsPreviewData } from '../MomentsPanel'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import { WorldCandidateControls } from './WorldCandidateControls'

const scenarios = [
  { id: 'mixed', label: '综合' }, { id: 'text', label: '纯文字' },
  { id: 'single', label: '单图' }, { id: 'two', label: '两图' },
  { id: 'three', label: '三图' }, { id: 'nine', label: '九宫格' },
  { id: 'long', label: '长正文' }, { id: 'comments', label: '多条评论' },
  { id: 'empty', label: '空朋友圈' },
] as const
type Scenario = typeof scenarios[number]['id']

function projectPreview(preview: MomentsPreviewData, scenario: Scenario): MomentsPreviewData {
  if (scenario === 'mixed') return preview
  if (scenario === 'empty') return { ...preview, items: [] }
  const counts: Partial<Record<Scenario, number>> = { text: 0, single: 1, two: 2, three: 3, nine: 9 }
  const count = counts[scenario]
  if (count !== undefined) return { ...preview, items: preview.items.filter((item) => (item.media?.length ?? 0) === count) }
  const first = preview.items[0]
  if (!first) return { ...preview, items: [] }
  return { ...preview, items: [{
    ...first, id: `${first.id}-${scenario}`,
    ...(scenario === 'long' ? {
      text: Array.from({ length: 8 }, (_, index) => `今天散步时记下的第${index + 1}个片段：河边的风比昨天轻，路过的小店还没有开门。我原本想赶紧回去把清单上的事情做完，后来决定坐一会儿，看光线慢慢移到树梢。并不是每一天都要有一个漂亮的结尾，把眼前的小事认真过完，也是一种很踏实的进展。`).join('\n'),
    } : {
      meta: { ...first.meta, interactions: [
        { kind: 'comment', castName: '小航', text: '这次先别把自己排得太满。' },
        { kind: 'comment', castName: '阿禾', text: '我也想给今天留一点空白，等忙完一起去河边走走。' },
        { kind: 'comment', castName: '小雨', text: '看着这杯茶就觉得舒服。最近一直在赶进度，看到你慢下来才想起来，休息不一定要等所有事情都做完才开始。明天我也准备整理一下桌面，再挑一件最重要的事情认真完成。' },
      ] },
    }),
  }] }
}

export function MomentsExperienceCandidate({ previewData }: { previewData: MomentsPreviewData }) {
  const [scenario, setScenario] = useState<Scenario>('mixed')
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-moments-fixture" data-persona-id={previewData.roleId}>
    <WorldCandidateControls>
      <PlaygroundStateSwitcher items={scenarios} value={scenario} onChange={setScenario} ariaLabel="朋友圈状态样张" />
    </WorldCandidateControls>
    <MomentsPanel key={`${previewData.roleId}-${scenario}`} onClose={() => {}}
      previewData={projectPreview(previewData, scenario)} appearance="alice-feed"
      showSocialActions compactClosedComposer enableImagePreview previewChrome="minimal" />
  </div>
}
