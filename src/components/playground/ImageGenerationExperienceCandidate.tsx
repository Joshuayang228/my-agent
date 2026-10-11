import { useMemo, useState, type ChangeEvent } from 'react'
import { Check, ImagePlus, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'

type CandidateState = 'empty' | 'generating' | 'success' | 'error'
type AssetTarget = '对话' | '家居' | '衣柜' | '文化角' | '足迹'

const fixtureImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"%3E%3Crect width="640" height="400" fill="%23dfe8e6"/%3E%3Ccircle cx="500" cy="110" r="74" fill="%23f2c8a5" opacity=".72"/%3E%3Cpath d="M0 320c110-95 205-65 292-8 102 66 189-72 348-35v123H0z" fill="%2392aaa2"/%3E%3Cpath d="M90 290h235v-98H90z" fill="%23f7f2e8"/%3E%3Cpath d="M90 192l118-88 117 88" fill="%23b16f55"/%3E%3Crect x="185" y="230" width="48" height="60" fill="%23b16f55"/%3E%3C/svg%3E'

export function ImageGenerationExperienceCandidate() {
  const [state, setState] = useState<CandidateState>('empty')
  const [target, setTarget] = useState<AssetTarget>('对话')
  const [prompt, setPrompt] = useState('窗边的茶、木桌、午后的自然光')
  const statusLabel = useMemo(() => ({ empty: '等待生成', generating: '正在生成', success: '已生成', error: '读取失败' }[state]), [state])

  const run = () => {
    setState('generating')
    window.setTimeout(() => setState('success'), 850)
  }

  return <div className="min-w-0 space-y-5" data-testid="image-generation-candidate">
    <section className="min-w-0 rounded-lg border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><Sparkles size={15} aria-hidden="true" />生图实验</div>
          <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>这里验证 Agent 如何调用生图模型、读取结果，并把图片绑定到对话或人物世界资产。</p>
        </div>
        <span className="shrink-0 text-[10px]" style={{ color: state === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>{statusLabel}</span>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
        <div className="min-w-0 space-y-3">
          <label className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            生成意图
            <TextField multiline rows={3} value={prompt} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)} className="mt-1 min-h-20 w-full rounded border p-2" />
          </label>
          <div>
            <div className="mb-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>结果归属</div>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {(['对话', '家居', '衣柜', '文化角', '足迹'] as const).map((item) => <ActionButton key={item} type="button" aria-pressed={target === item} onClick={() => setTarget(item)} className="min-h-7 px-2.5 text-[11px]" style={{ color: target === item ? 'var(--text-primary)' : 'var(--text-muted)', borderColor: target === item ? 'var(--accent-emphasis)' : 'var(--border-subtle)', background: target === item ? 'var(--accent-subtle)' : 'transparent' }}>{item}</ActionButton>)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionButton tone="accent" onClick={run} disabled={state === 'generating' || !prompt.trim()}><ImagePlus size={14} aria-hidden="true" />生成图片</ActionButton>
            {state !== 'empty' && <ActionButton variant="plain" onClick={() => setState('empty')}><X size={14} aria-hidden="true" />清空</ActionButton>}
          </div>
        </div>

        <div className="min-w-0 rounded border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}>
          <div className="mb-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}><span>{target}的视觉结果</span><span className="shrink-0">固定预览区</span></div>
          <div className="relative aspect-[8/5] overflow-hidden rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            {state === 'empty' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}><ImagePlus size={18} aria-hidden="true" />生成后显示在这里</div>}
            {state === 'generating' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />正在生成图片</div>}
            {state === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px]" style={{ color: 'var(--danger)' }}><span>图片暂时无法读取</span><ActionButton variant="plain" onClick={() => setState('success')}><RefreshCw size={13} aria-hidden="true" />重新读取</ActionButton></div>}
            {state === 'success' && <img src={fixtureImage} alt="生成的窗边茶室样张" className="h-full w-full object-cover" />}
          </div>
          {state === 'success' && <div className="mt-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}><span className="min-w-0 truncate">{target === '对话' ? '图片会挂在当前 assistant 回合内' : `图片会绑定到${target}资产`}</span><span className="flex shrink-0 items-center gap-1" style={{ color: 'var(--accent-emphasis)' }}><Check size={12} aria-hidden="true" />已保存引用</span></div>}
        </div>
      </div>
    </section>
  </div>
}
