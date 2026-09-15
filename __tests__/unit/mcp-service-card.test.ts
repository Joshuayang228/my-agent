import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { McpServiceCard, type McpServiceState, type McpServiceTool } from '../../src/components/settings/McpServiceCard'

const render = (status: McpServiceState, tools: McpServiceTool[] | null = null) => renderToStaticMarkup(createElement(McpServiceCard, {
  id: 'server', name: '<script>service</script>', transport: '本地 · stdio', status, tools,
  enabled: status !== 'disabled', testId: 'card', onEnabledChange: () => {},
}))

describe('McpServiceCard', () => {
  it('未知清单和确认为零的清单分开，不用连接中冒充已发现工具', () => {
    expect(render('connected')).toContain('工具清单尚未获取')
    expect(render('connected')).not.toContain('0 个工具')
    expect(render('connected', [])).toContain('已连接，服务未提供工具。')
    expect(render('connecting', [])).not.toContain('0 个工具')
    expect(render('disconnected')).toContain('未连接')
  })
  it('不执行服务文本，工具清单有内部滚动，未允许状态不丢失', () => {
    const html = render('connected', [{ id: 'read', name: '读取', description: '<img onerror=alert(1)>', allowed: false }])
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('未允许')
    expect(html).toContain('max-h-80')
    expect(html).toContain('overflow-y-auto')
  })
  it('只展示有真实回调的操作，不虚构认证与取消能力', () => {
    expect(render('auth')).not.toContain('>登录</button>')
    expect(render('connecting')).not.toContain('>取消</button>')
    expect(render('error')).not.toContain('>重试</button>')
  })
})
