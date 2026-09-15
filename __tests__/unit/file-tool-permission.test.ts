import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { fileWriteTool } from '../../electron/main/tools/builtins/file-write'
import { fileReadTool } from '../../electron/main/tools/builtins/file-read'
import { fileEditTool } from '../../electron/main/tools/builtins/file-edit'
import { applyPatchTool } from '../../electron/main/tools/builtins/apply-patch'
import { fileDeleteTool } from '../../electron/main/tools/builtins/file-delete'
import { loadRules, getRules } from '../../electron/main/sandbox/permission-engine'
import { checkFileToolPermission, consumeFilePermissionApproval, createFilePermissionApproval, MAX_FILE_RULE_TARGETS } from '../../electron/main/sandbox/file-tool-permission'
import { runDebugTool } from '../../electron/main/agent/debug-tool-run'
import { agentLoop } from '../../electron/main/agent/loop'
import type { AgentStreamEvent, ToolContext } from '../../src/shared/types'
import { parsePermissionRulesJson, serializePermissionRules } from '../../src/shared/permission-rules'

const state = vi.hoisted(() => ({ root: '', mode: 'auto' }))
vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: async () => state.mode, getAllSettings: async () => ({ executionMode: state.mode }),
}))
vi.mock('../../electron/main/agent/project-memory', () => ({ getWorkspaceRoot: () => state.root }))
vi.mock('electron', () => ({ shell: { trashItem: vi.fn() }, BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }), hashForLog: () => 'redacted',
}))
let registry: ToolRegistry
let context: ToolContext
const args = { path: 'notes.txt', content: 'changed' }
const rule = (action: 'allow' | 'deny' | 'ask', type = 'file-write', pattern = 'notes[.]txt$') => ({ id: 'file-rule', type, action, pattern, enabled: true })
const setRule = (action: 'allow' | 'deny' | 'ask', type = 'file-write', pattern?: string) => loadRules(JSON.stringify([rule(action, type, pattern)]))
const run = (name = 'file_write', input: Record<string, unknown> = args, ctx = context) => registry.executeAll([{ id: 'call', name, arguments: JSON.stringify(input) }], ctx).then(items => items[0])

beforeEach(async () => {
  state.root = await mkdtemp(path.join(os.tmpdir(), 'my-file-rules-'))
  state.mode = 'auto'
  await writeFile(path.join(state.root, 'notes.txt'), 'original')
  context = { workdir: state.root, sessionId: 'file-rule-unit' }
  registry = new ToolRegistry()
  registry.register({ ...fileWriteTool, aliases: ['write_alias'] })
  registry.register(fileReadTool)
  registry.register(fileEditTool)
  registry.register(applyPatchTool)
  registry.register(fileDeleteTool)
  loadRules('[]')
})
afterEach(async () => { loadRules('[]'); await rm(state.root, { recursive: true, force: true }) })

describe('文件规则真实执行', () => {
  it('新类型经过共享 JSON 与生产加载器往返', () => {
    for (const type of ['file-write', 'file-delete'] as const) {
      const parsed = parsePermissionRulesJson(JSON.stringify([rule('deny', type)]))
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) throw Error('parse')
      loadRules(serializePermissionRules(parsed.rules))
      expect(getRules()[0].type).toBe(type)
    }
  })
  it.each(['file_write', 'write_alias', 'file_edit', 'apply_patch'])('deny 阻止 %s，文件不发生变化', async name => {
    setRule('deny')
    const input = name === 'file_edit' ? { path: 'notes.txt', old_str: 'original', new_str: 'changed' }
      : name === 'apply_patch' ? { patch: '--- a/notes.txt\n+++ b/notes.txt\n@@ -1 +1 @@\n-original\n+changed' } : args
    expect((await run(name, input)).isError).toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('original')
  })
  it('删除规则不阻止修改，但阻止真实删除；旧 path 规则同时保护修改与删除', async () => {
    setRule('deny', 'file-delete')
    expect((await run()).isError).not.toBe(true)
    expect((await run('file_delete', { path: 'notes.txt' })).isError).toBe(true)
    setRule('deny', 'path')
    expect((await run()).isError).toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('changed')
  })
  it('allow 可执行真实写入，disabled 不匹配，deny 不可靠授权对象绕过', async () => {
    setRule('allow')
    expect((await run()).isError).not.toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('changed')
    setRule('deny')
    expect((await run('file_write', args, { ...context, filePermissionApprovals: { call: {} } })).isError).toBe(true)
    loadRules(JSON.stringify([{ ...rule('deny'), enabled: false }]))
    expect((await run()).isError).not.toBe(true)
  })
  it('ask 在无确认及伪造凭据时拒绝，真实凭据仅能执行一次', async () => {
    setRule('ask')
    expect((await run()).isError).toBe(true)
    expect((await run('file_write', args, { ...context, filePermissionApprovals: { call: {} } })).isError).toBe(true)
    const check = checkFileToolPermission('file_write', args, context, 'workspace-write', 'call')!
    const approved = { ...context, filePermissionApprovals: { call: createFilePermissionApproval(check) } }
    expect((await run('file_write', args, approved)).isError).not.toBe(true)
    expect((await run('file_write', args, approved)).isError).toBe(true)
  })
  it.each(['参数', '会话', '规则'])('%s 变化使旧确认失效', async change => {
    setRule('ask')
    const check = checkFileToolPermission('file_write', args, context, 'workspace-write', 'call')!
    const token = createFilePermissionApproval(check)
    if (change === '规则') loadRules(JSON.stringify([{ ...rule('ask'), description: 'updated' }]))
    const input = change === '参数' ? { ...args, content: 'different' } : args
    const ctx = { ...context, sessionId: change === '会话' ? 'other' : context.sessionId, filePermissionApprovals: { call: token } }
    expect((await run('file_write', input, ctx)).isError).toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('original')
  })
  it('任何 deny 优先，允许规则不越过工作区和受保护路径', async () => {
    setRule('ask')
    const checked = checkFileToolPermission('file_write', args, context, 'workspace-write', 'call')!
    const token = createFilePermissionApproval(checked)
    const [reused] = await registry.executeAll([{ id: 'other-call', name: 'file_write', arguments: JSON.stringify(args) }], { ...context, filePermissionApprovals: { 'other-call': token } })
    expect(reused.isError).toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('original')
    loadRules(JSON.stringify([{ ...rule('allow'), id: 'allow' }, rule('deny', 'path')]))
    expect((await run()).isError).toBe(true)
    setRule('allow', 'file-write', '.*')
    expect((await run('file_write', { path: '../outside.txt', content: 'no' })).isError).toBe(true)
    expect((await run('file_write', { path: '.git/config', content: 'no' })).isError).toBe(true)
  })
  it('真实 symlink 目标拒绝，目标变化使确认失效', async () => {
    await mkdir(path.join(state.root, 'protected'))
    await writeFile(path.join(state.root, 'protected', 'notes.txt'), 'secret')
    await symlink(path.join(state.root, 'protected'), path.join(state.root, 'link'), 'junction')
    setRule('deny', 'file-write', 'protected')
    expect((await run('file_write', { ...args, path: 'link/notes.txt' })).isError).toBe(true)
    setRule('ask', 'file-write', '.*')
    const input = { ...args, path: 'link/notes.txt' }
    const check = checkFileToolPermission('file_write', input, context, 'workspace-write')!
    const token = createFilePermissionApproval(check)
    await rm(path.join(state.root, 'link'))
    await symlink(state.root, path.join(state.root, 'link'), 'junction')
    const changed = checkFileToolPermission('file_write', input, context, 'workspace-write')!
    expect(consumeFilePermissionApproval(token, changed)).toBe(false)
    expect(await readFile(path.join(state.root, 'protected', 'notes.txt'), 'utf8')).toBe('secret')
  })
  it('Debug 与真实 Registry 共用 ask/deny，确认后才能写入', async () => {
    await mkdir(path.join(state.root, 'protected'))
    await writeFile(path.join(state.root, 'protected', 'notes.txt'), 'keep')
    setRule('deny', 'file-delete')
    expect((await run('file_delete', { path: 'protected' })).isError).toBe(true)
    expect(await readFile(path.join(state.root, 'protected', 'notes.txt'), 'utf8')).toBe('keep')
    setRule('ask')
    const pre = await runDebugTool(registry, { name: 'file_write', args })
    expect(pre.ok).toBe(false)
    if (!pre.ok) expect(pre.needsConfirmation).toBe(true)
    const saved = await runDebugTool(registry, { name: 'file_write', args, confirmRisk: true })
    expect(saved.ok).toBe(true)
    if (saved.ok) expect(saved.isError).not.toBe(true)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe('changed')
    setRule('deny')
    expect((await runDebugTool(registry, { name: 'file_write', args, confirmRisk: true })).ok).toBe(false)
  })
  it('旧 path 规则保护真实读取，目录删除超出扫描上限时拒绝', async () => {
    setRule('deny', 'path')
    expect((await run('file_read', { path: 'notes.txt' })).isError).toBe(true)
    await mkdir(path.join(state.root, 'large'))
    for (let index = 0; index < MAX_FILE_RULE_TARGETS; index++) await writeFile(path.join(state.root, 'large', String(index)), '')
    setRule('allow', 'file-delete', '.*')
    expect(checkFileToolPermission('file_delete', { path: 'large' }, context, 'workspace-write')?.allowed).toBe(false)
  })
  it.each(['deny', 'ask', 'allow', 'ask-denied', 'ask-headless', 'ask-changed'] as const)('Loop 实际消费 %s 并由 Registry 复核', async scenario => {
    const action = scenario.startsWith('ask') ? 'ask' : scenario as 'deny' | 'allow'
    setRule(action)
    const confirmTool = vi.fn(async () => {
      if (scenario === 'ask-changed') setRule('deny')
      return scenario !== 'ask-denied'
    })
    let turn = 0
    const stream = async function* (): AsyncGenerator<AgentStreamEvent, any> {
      return { content: '', toolCalls: turn++ === 0 ? [{ id: 'call', name: 'write_alias', arguments: JSON.stringify(args) }] : [], usage: { promptTokens: 1, completionTokens: 1 } }
    }
    const events: AgentStreamEvent[] = []
    for await (const event of agentLoop({
      config: { apiKey: 'test', baseUrl: 'http://localhost', model: 'fixture' }, messages: [{ id: 'user', role: 'user', content: 'test', timestamp: 1 }],
      tools: registry.getAll(), toolContext: context, executionMode: 'auto', confirmTool: scenario === 'ask-headless' ? undefined : confirmTool, _streamChatOverride: stream,
    }, registry)) events.push(event)
    expect(confirmTool).toHaveBeenCalledTimes(action === 'ask' && scenario !== 'ask-headless' ? 1 : 0)
    expect(await readFile(path.join(state.root, 'notes.txt'), 'utf8')).toBe(scenario === 'ask' || scenario === 'allow' ? 'changed' : 'original')
    expect(events.some(event => event.type === 'tool_end')).toBe(true)
  })
})
