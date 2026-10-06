import { useMemo, useState } from 'react'
import { WorldCultureContent, type LivingAsset } from '../world/WorldLivingContent'
import { PlaygroundStateSwitcher } from './PlaygroundLayout'
import bookCover from '../../assets/playground/culture-book.png'
import filmPoster from '../../assets/playground/culture-film.png'
import musicCover from '../../assets/playground/culture-music.png'
import photoPortrait from '../../assets/playground/culture-photo.png'
import teaPhoto from '../../assets/playground/moment-tea-by-window.jpg'

export function CultureExperienceCandidate({ personaId }: { personaId: string }) {
  const [scenario, setScenario] = useState('default')
  const assets = useMemo<LivingAsset[]>(() => {
    if (scenario === 'empty') return []
    const records = [
      { id: 'reading', name: '《瓦尔登湖》', type: 'reading', author: '亨利·戴维·梭罗', readingStatus: 'reading', src: bookCover, summary: '慢一点，也许能看见生活本来的样子。', detail: '读到湖边生活的段落，想起那些没有安排的下午。', note: '有时候不是事情太多，而是没有给自己留下足够的空白。' },
      { id: 'book2', name: '《散步去》', type: 'reading', author: '谷口治郎', readingStatus: 'finished', src: bookCover, summary: '熟悉的街道，也值得再走一次。', detail: '喜欢它把平常的路写得很认真。', note: '下次出门，试试不先决定目的地。' },
      { id: 'film', name: '《海街日记》', type: 'film', watchStatus: 'finished', src: filmPoster, summary: '记住的是饭桌、风和四季。', detail: '让我想起那些不必说很多话，也能安心相处的时刻。' },
      { id: 'film2', name: '海边的下午', type: 'film', watchStatus: 'planned', src: filmPoster, summary: '', detail: '隔离样张中的虚构电影。' },
      { id: 'music', name: '旅行的意义', type: 'music', artist: '陈绮贞', listeningStatus: 'revisiting', src: musicCover, summary: '傍晚散步的时候想听。', detail: '有些歌不需要从头解释，熟悉的前奏就能让人慢下来。' },
      { id: 'music2', name: '雨后的小路', type: 'music', artist: '样张中的虚构艺人', listeningStatus: 'queued', src: musicCover, summary: '', detail: '隔离样张中的虚构专辑。' },
      { id: 'photo', name: '窗边的光', type: 'photography', workStatus: 'published', src: teaPhoto, imageWidth: 4, imageHeight: 3, locationName: '窗边', depictedAt: '2026/10/2', summary: '午后，茶还温着。', detail: '虚构生活里的一个安静下午。' },
      { id: 'photo2', name: '雨后的巷子', type: 'photography', workStatus: 'published', src: photoPortrait, imageWidth: 2, imageHeight: 3, locationName: '街角', depictedAt: '2026/10/3', summary: '雨停之后的反光。', detail: '虚构摄影创作，不是现实拍摄记录。' },
    ]
    return records.map(({ id, name, src, ...payload }) => ({ id: `${personaId}-${id}`, kind: 'culture', name: scenario === 'long' ? `${name}：在忙碌的日子里重新看见那些被忽略的微小瞬间` : name,
      payload: { ...payload, playgroundImageSrc: scenario === 'no-image' ? undefined : src,
        imageState: scenario === 'pending' ? 'pending' : scenario === 'image-failed' ? 'failed' : 'ready',
        ...(scenario === 'long' ? { detail: '这些是隔离样张中的感受，不是伙伴真实的阅读或观看经历。\n'.repeat(50), note: '留下一点空白，也给新的想法留一个位置。\n'.repeat(40) } : {}),
      } }))
  }, [personaId, scenario])
  return <div className="flex h-full min-h-0 flex-col" data-testid="world-culture-fixture" data-persona-id={personaId}>
    <div className="shrink-0 px-4 pt-3"><PlaygroundStateSwitcher ariaLabel="文化角状态样张" value={scenario} onChange={setScenario}
      items={[{ id: 'default', label: '文化清单' }, { id: 'long', label: '长名称与笔记' }, { id: 'empty', label: '空文化角' }, { id: 'error', label: '读取失败' }, { id: 'no-image', label: '无配图' }, { id: 'pending', label: '配图生成中' }, { id: 'image-failed', label: '配图失败' }]} /></div>
    <WorldCultureContent key={`${personaId}-${scenario}`} assets={assets} presentation="culture-gallery" showPreviewImages
      previewReadError={scenario === 'error' ? '记录暂时未能读取，请重新读取。' : undefined} onPreviewRetry={() => setScenario('default')} />
  </div>
}
