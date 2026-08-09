/**
 * 体验夹具 — 空态 / 错误 / 权限确认（原 FixturesTab）。
 */

import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import { StoryBlock } from './StoryBlock'

function FixtureError({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border-color))', background: 'var(--bg-secondary)' }}
    >
      <div className="text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{title}</div>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <button
        type="button"
        className="mt-2 rounded border px-2 py-0.5 text-[11px]"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
      >
        {action}
      </button>
    </div>
  )
}

export function FixturesPanel() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" data-testid="fixtures-lab">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>体验夹具</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          P0 体验回归。改主题 / 文案时来扫一眼；不复制 Alice 错误卡博物馆。
        </p>
      </div>

      <StoryBlock title="对话空态" source="Playground fixture">
        <div
          className="flex flex-col items-center rounded-xl border px-6 py-10 text-center"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>还没有话题</p>
          <p className="mt-1 max-w-xs text-[12px]" style={{ color: 'var(--text-muted)' }}>
            打个招呼，或从侧栏开一个新会话。伙伴在这儿等你。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['今天怎么样？', '帮我理一下待办', '随便聊聊'].map((t) => (
              <span
                key={t}
                className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </StoryBlock>

      <StoryBlock title="错误卡（常用 3 态）" source="Playground fixture" edge>
        <div className="space-y-2">
          <FixtureError
            title="未配置 API Key"
            body="请在设置 → 模型里填写密钥后再试。"
            action="打开设置"
          />
          <FixtureError
            title="操作被权限策略拒绝"
            body="可以切换审批模式，或让 Agent 换更安全的替代方案。"
            action="查看权限"
          />
          <FixtureError
            title="请求暂时失败"
            body="可能是限流或上游抖动。稍后再试，或检查网络 / Base URL。"
            action="重试"
          />
        </div>
      </StoryBlock>

      <StoryBlock title="权限确认" source="src/components/chat/PermissionConfirmCard.tsx" adopted>
        <div className="mx-auto flex justify-center">
          <PermissionConfirmCard
            toolName="shell_exec"
            args={{ command: 'rm -rf ./tmp' }}
          />
        </div>
      </StoryBlock>
    </div>
  )
}
