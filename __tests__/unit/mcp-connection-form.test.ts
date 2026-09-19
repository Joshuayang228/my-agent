import { describe, expect, it } from 'vitest'
import { parseMcpConnectionDraft, type McpConnectionDraft } from '../../src/components/settings/McpConnectionForm'

const draft: McpConnectionDraft = { kind: 'remote', name: '文档服务', url: 'https://example.com/mcp', auth: 'none', token: '', command: '', args: '', env: '' }

describe('MCP 共享表单草稿解析', () => {
  it('浏览器登录只提交 OAuth 公共配置，不混入令牌和环境变量', () => {
    const input = parseMcpConnectionDraft({ ...draft, auth: 'oauth', clientId: ' public ', token: 'must-not-leak', env: 'SECRET=value' })
    expect(input.oauth).toEqual({ clientId: 'public' })
    expect(input).not.toHaveProperty('bearerToken')
    expect(input).not.toHaveProperty('env')
    expect(parseMcpConnectionDraft({ ...draft, auth: 'oauth' }).oauth).toEqual({})
  })
  it('远程只输出当前模式字段，不带本地环境或未选择的令牌', () => {
    expect(parseMcpConnectionDraft({ ...draft, token: 'fixture-only', env: 'LOCAL=value' })).toEqual({
      name: '文档服务', transport: 'streamable-http', command: '', args: [], url: 'https://example.com/mcp',
    })
  })
  it.each(['file:///tmp', 'https://user:pass@example.com', 'not a url'])('拒绝非 HTTP 或凭据 URL %s', (url) => {
    expect(() => parseMcpConnectionDraft({ ...draft, url })).toThrow('不含账号密码的 HTTP 或 HTTPS 地址')
  })
  it('认证与名称的必填校验', () => {
    expect(() => parseMcpConnectionDraft({ ...draft, name: ' ' })).toThrow('连接名称')
    expect(() => parseMcpConnectionDraft({ ...draft, auth: 'bearer' })).toThrow('访问令牌')
  })
  it('本地参数每行一个，环境值保留空格及等号，不输出远程凭据', () => {
    expect(parseMcpConnectionDraft({ ...draft, kind: 'local', command: ' npx ', args: '-y\r\nC:/My Files\n', env: 'TEXT=  value=other  \r\nEMPTY=', auth: 'bearer', token: 'fixture-only' })).toEqual({
      name: '文档服务', transport: 'stdio', command: 'npx', args: ['-y', 'C:/My Files'], env: { TEXT: '  value=other  ', EMPTY: '' },
    })
  })
  it.each(['A=one\nA=two', 'INVALID KEY=value', 'NO_EQUALS', '=value'])('无效或重复环境变量不能静默丢失 %s', (env) => {
    expect(() => parseMcpConnectionDraft({ ...draft, kind: 'local', command: 'npx', env })).toThrow('NAME=value')
  })
})
