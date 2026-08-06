/**
 * Playground 独立全页 — 左栏顶「返回」+ 分区 tab，右侧内容。
 */

import { PlaygroundShell } from './playground'

export function PlaygroundPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full min-h-0" data-testid="playground-page">
      <PlaygroundShell onClose={onClose} />
    </div>
  )
}
