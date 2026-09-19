import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { McpServerConfig } from '../../../src/shared/types'
import { isValidMcpConfig, MCP_REDACTED_ENV_VALUE } from './config-security'
import { buildSafeChildProcessEnv } from '../utils/safe-process-env'
import { McpLoginRequiredError, mcpOAuthSessions } from './oauth'

/**
 * 背景：已保存服务与添加向导需要同一套协议及凭据发送边界。
 * 设计意图：复用 SDK 传输而不自写协议；工厂只创建对象，不确认、保存或注册工具。
 * 关键约束：凭据必须已在主进程恢复；远程请求不跟随重定向，不降级为其他协议。
 */
export function createMcpTransport(config: McpServerConfig): Transport {
  if (!isValidMcpConfig(config) || config.bearerToken === MCP_REDACTED_ENV_VALUE
    || Object.values(config.env ?? {}).includes(MCP_REDACTED_ENV_VALUE)) {
    throw new Error('MCP 配置无效或凭据尚未恢复')
  }
  if (config.transport === 'streamable-http') {
    const session = config.oauth ? mcpOAuthSessions.get(config) : undefined
    return new StreamableHTTPClientTransport(new URL(config.url!), {
      authProvider: session?.provider,
      fetch: config.oauth ? (session?.fetch ?? (async () => { throw new McpLoginRequiredError() })) : undefined,
      requestInit: {
        redirect: 'error',
        headers: config.bearerToken ? { Authorization: `Bearer ${config.bearerToken}` } : undefined,
      },
    })
  }
  if (config.transport === 'sse') {
    return new SSEClientTransport(new URL(config.url!))
  }
  return new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: Object.fromEntries(Object.entries(buildSafeChildProcessEnv(config.env))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  })
}
