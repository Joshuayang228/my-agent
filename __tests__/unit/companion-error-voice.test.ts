/**
 * 人格化错误承接（WISH-016）单元测试
 *
 * 背景：主会话遇到断网、限流、超时、权限拒绝或配置缺失时，需要以当前伙伴的自然语气承接，
 * 同时不能隐藏或篡改原始脱敏错误文案。
 * 设计意图：验证所有 AgentErrorCode 的路飞专属语气与通用伙伴兜底语气、原始错误原因完整保留，
 * 以及用户主动取消（ABORTED）不弹刺眼警告前缀。
 * 关键约束：纯函数测试，不依赖 Electron 或网络。
 */
import { describe, expect, it } from 'vitest'
import { AgentErrorCode } from '../../electron/main/errs/index'
import { formatCompanionErrorBubble } from '../../src/shared/companion-error-voice'

describe('Companion Error Voice（WISH-016 人格化错误承接）', () => {
  it('覆盖全部 AgentErrorCode，并完整保留原始错误原因供排查', () => {
    const allCodes = Object.values(AgentErrorCode)
    for (const code of allCodes) {
      const msg = `模拟错误详情:${code}`
      const res = formatCompanionErrorBubble({ code, message: msg, roleId: 'luffy' })
      expect(res.isPersonaVoiced).toBe(true)
      expect(res.displayMarkdown.length).toBeGreaterThan(4)
      if (code === AgentErrorCode.ABORTED) {
        expect(res.displayMarkdown).not.toContain('⚠️')
      } else {
        expect(res.displayMarkdown).toContain(`> ⚠️ ${msg}`)
      }
    }
  })

  it('路飞与自定义通用角色使用各自自然语气，且不向通用角色泄漏路飞专属台词', () => {
    const luffy = formatCompanionErrorBubble({
      code: AgentErrorCode.CONFIG_MISSING_API_KEY,
      message: '请先在设置中添加可用连接。',
      roleId: 'luffy',
    })
    const custom = formatCompanionErrorBubble({
      code: AgentErrorCode.CONFIG_MISSING_API_KEY,
      message: '请先在设置中添加可用连接。',
      roleId: 'custom-role',
    })

    expect(luffy.displayMarkdown).toContain('电话虫')
    expect(custom.displayMarkdown).not.toContain('电话虫')
    expect(luffy.displayMarkdown).toContain('请先在设置中添加可用连接。')
    expect(custom.displayMarkdown).toContain('请先在设置中添加可用连接。')
    expect(luffy.noticeText).toBeTruthy()
    expect(custom.noticeText).toBeTruthy()
  })

  it('未知或缺失错误码优雅降级到 UNKNOWN 承接且保留原始消息', () => {
    const res = formatCompanionErrorBubble({
      message: '上游返回 502 Bad Gateway',
      roleId: 'other',
    })
    expect(res.isPersonaVoiced).toBe(true)
    expect(res.displayMarkdown).toContain('> ⚠️ 上游返回 502 Bad Gateway')
  })
})
