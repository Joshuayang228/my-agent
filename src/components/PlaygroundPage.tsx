/**
 * Playground 独立全页：与设置页一样占满应用窗口，只保留自身一级导航。
 */

import { PlaygroundShell } from './playground'

export function PlaygroundPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="h-full min-h-0 w-full min-w-0" data-testid="playground-page">
      <PlaygroundShell onClose={onClose} />
    </div>
  )
}
