/**
 * Prompt 资产目录 — 摊开路径；试跑跳转对话试验。
 */

import { useState } from 'react'
import { PROMPT_ASSETS } from './prompt-assets'

export function PromptCatalogPanel({ onOpenChatLab }: { onOpenChatLab: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="prompt-catalog-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          提示词资产
        </h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          项目用到的 Prompt 摊开在此（对齐 Alice prompts）。
          修改试跑请用「对话试验」——<strong style={{ color: 'var(--text-secondary)' }}>仅当前试验有效，不写全局 settings</strong>。
        </p>
        <button
          type="button"
          className="settings-option mt-2 px-3 py-1.5 text-xs"
          onClick={onOpenChatLab}
        >
          打开对话试验
        </button>
      </div>

      <div className="space-y-2">
        {PROMPT_ASSETS.map((a) => {
          const open = openId === a.id
          return (
            <div
              key={a.id}
              className="rounded-lg border"
              style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
            >
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left"
                onClick={() => setOpenId(open ? null : a.id)}
              >
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{a.name}</span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{a.desc}</span>
                <code className="mt-0.5 font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.sourcePath}</code>
              </button>
              {open && a.preview && (
                <pre
                  className="max-h-40 overflow-auto border-t px-3 py-2 font-mono text-[11px] whitespace-pre-wrap"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                >
                  {a.preview}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
