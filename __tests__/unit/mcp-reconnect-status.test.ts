import { afterEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { setTimeout as delay } from 'node:timers/promises'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createMcpClient, mcpManager, MCP_UNEXPECTED_DISCONNECT } from '../../electron/main/mcp/client'
import type { McpServerStatus } from '../../src/shared/types'

const temps: string[] = []

function stdioConfig(id: string, env?: Record<string, string>) {
  const script = `
    import { writeFileSync, existsSync } from 'node:fs';
    import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
    import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
    const failFile = process.env.MCP_FAIL_FILE;
    if (failFile && existsSync(failFile)) process.exit(1);
    if (process.env.MCP_PID_FILE) writeFileSync(process.env.MCP_PID_FILE, String(process.pid));
    const server = new McpServer({name:'reconnect-fixture',version:'1.0.0'});
    server.registerTool('pid', {inputSchema:{}}, async () => ({content:[{type:'text',text:String(process.pid)}]}));
    await server.connect(new StdioServerTransport());
  `
  return {
    id,
    name: 'reconnect-fixture',
    enabled: true,
    command: process.execPath,
    args: ['--input-type=module', '-e', script],
    env,
  }
}

async function waitForStatus(id: string, predicate: (row: McpServerStatus) => boolean, timeout = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const row = mcpManager.getStatus().find((item) => item.id === id)
    if (row && predicate(row)) return row
    await delay(50)
  }
  throw new Error('MCP status timeout: ' + JSON.stringify(mcpManager.getStatus()))
}

afterEach(async () => {
  mcpManager.setStatusListener(undefined)
  await mcpManager.disconnectAll()
  vi.restoreAllMocks()
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('MCP unexpected disconnect status', () => {
  it('manual stop during replacement close cannot resurrect the replacement', async () => {
    let release!: () => void
    const closed = new Promise<void>((resolve) => { release = resolve })
    const started = vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined)
    const oldClient = createMcpClient()
    vi.spyOn(oldClient, 'close').mockImplementation(() => closed)
    mcpManager.adoptTestedConnection({ config: stdioConfig('replace-stop'), client: oldClient, transport: {} as Transport, tools: [], resources: [] })
    const connecting = mcpManager.connect(stdioConfig('replace-stop'))
    const stopping = mcpManager.disconnect('replace-stop')
    release()
    await Promise.allSettled([connecting, stopping])
    expect(started.mock.calls.length).toBe(0)
    expect(mcpManager.getStatus()).toEqual([])
  }, 20000)

  it('a late manual close cannot delete a newly adopted connection', async () => {
    let release!: () => void
    const oldClient = createMcpClient()
    vi.spyOn(oldClient, 'close').mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    const config = stdioConfig('late-close')
    mcpManager.adoptTestedConnection({ config, client: oldClient, transport: {} as Transport, tools: [], resources: [] })
    const stopping = mcpManager.disconnect(config.id)
    const freshClient = createMcpClient()
    try {
      mcpManager.adoptTestedConnection({ config, client: freshClient, transport: {} as Transport, tools: [], resources: [] })
    } finally {
      release()
      await stopping
    }
    expect(mcpManager.isConnected(config.id)).toBe(true)
  })

  it('a failed replaced handshake cannot overwrite a successful newer connection', async () => {
    let reject!: (reason: Error) => void
    vi.spyOn(Client.prototype, 'connect').mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail }))
    const config = stdioConfig('late-handshake')
    const connecting = mcpManager.connect(config, { preserveReconnect: true })
    const failed = expect(connecting).rejects.toThrow('fixture late handshake')
    await mcpManager.disconnect(config.id)
    mcpManager.adoptTestedConnection({ config, client: createMcpClient(), transport: {} as Transport, tools: [], resources: [] })
    reject(new Error('fixture late handshake'))
    await failed
    expect(mcpManager.getStatus()).toMatchObject([{ id: config.id, status: 'connected', reconnecting: false }])
  })

  it('keeps the snapshot row after transport close and marks reconnecting', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-reconnect-'))
    temps.push(dir)
    const pidFile = path.join(dir, 'pid')
    const snapshots: McpServerStatus[][] = []
    mcpManager.setStatusListener((snapshot) => { snapshots.push(snapshot) })
    await mcpManager.connect(stdioConfig('alive', { MCP_PID_FILE: pidFile }))
    expect(mcpManager.getStatus()).toMatchObject([{ id: 'alive', status: 'connected', reconnecting: false }])
    const pid = Number(await mcpManager.callTool('alive', 'pid', {}))
    process.kill(pid)
    const row = await waitForStatus('alive', (item) => item.status === 'error' && item.reconnecting === true)
    expect(row.error).toBe(MCP_UNEXPECTED_DISCONNECT)
    expect(mcpManager.getStatus().map((item) => item.id)).toEqual(['alive'])
    expect(snapshots.some((snapshot) => snapshot.some((item) => item.id === 'alive' && item.status === 'error' && item.reconnecting))).toBe(true)
    await waitForStatus('alive', (item) => item.status === 'connected' && item.reconnecting === false)
  }, 20000)

  it('manual disconnect removes the snapshot instead of unexpected-error', async () => {
    const snapshots: McpServerStatus[][] = []
    mcpManager.setStatusListener((snapshot) => { snapshots.push(snapshot) })
    await mcpManager.connect(stdioConfig('manual'))
    await mcpManager.disconnect('manual')
    expect(mcpManager.getStatus()).toEqual([])
    expect(snapshots.at(-1)).toEqual([])
    expect(JSON.stringify(snapshots)).not.toContain(MCP_UNEXPECTED_DISCONNECT)
  }, 20000)

  it('failed reconnect keeps a retryable error row instead of a missing snapshot', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-reconnect-fail-'))
    temps.push(dir)
    const pidFile = path.join(dir, 'pid')
    const failFile = path.join(dir, 'fail')
    await mcpManager.connect(stdioConfig('flaky', { MCP_PID_FILE: pidFile, MCP_FAIL_FILE: failFile }))
    await writeFile(failFile, '1')
    process.kill(Number((await readFile(pidFile, 'utf8')).trim()))
    const row = await waitForStatus('flaky', (item) => item.status === 'error' && item.reconnecting === true)
    expect(row.error).toBe(MCP_UNEXPECTED_DISCONNECT)
    await delay(1500)
    expect(mcpManager.getStatus()).toMatchObject([{
      id: 'flaky',
      status: 'error',
      reconnecting: true,
      error: MCP_UNEXPECTED_DISCONNECT,
    }])
  }, 20000)
})
