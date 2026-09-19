import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { imageGenerateTool } from '../../electron/main/tools/builtins/image-generate'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { loadRules } from '../../electron/main/sandbox/permission-engine'
import type { ToolContext } from '../../src/shared/types'

const state = vi.hoisted(() => ({ request: vi.fn(), config: vi.fn(), mode: 'workspace-write' }))
vi.mock('../../electron/main/llm/image-generation', async original => ({ ...await original<typeof import('../../electron/main/llm/image-generation')>(), requestGeneratedImage: state.request }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadImageGenerationConfig: state.config }))
vi.mock('../../electron/main/sandbox/effective-sandbox', () => ({ loadEffectiveSandbox: async () => state.mode }))

let root: string
let context: ToolContext
let registry: ToolRegistry
const args = { path: 'images/example.png', prompt: '测试图' }
const run = (input = args) => registry.executeAll([{ id: 'call-image', name: 'image_generate', arguments: JSON.stringify(input) }], context).then(results => results[0])
beforeEach(async () => {
  vi.clearAllMocks(); state.mode = 'workspace-write'; loadRules('[]')
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-generate-test-'))
  context = { sessionId: 'session', workdir: root, workspaceRoot: root }
  registry = new ToolRegistry(); registry.register(imageGenerateTool)
  state.config.mockResolvedValue({ model: 'fixture', baseUrl: 'https://example.test', apiKey: 'fixture' })
  state.request.mockResolvedValue({ bytes: await sharp({ create: { width: 16, height: 12, channels: 3, background: '#2c7755' } }).png().toBuffer(), mimeType: 'image/png' })
})
afterEach(() => { vi.restoreAllMocks(); loadRules('[]'); fs.rmSync(root, { recursive: true, force: true }) })

it('生成结果解码后真实保存，结构化引用与文件相符，不留下临时文件', async () => {
  const result = await run()
  expect(result.isError).not.toBe(true)
  expect(state.request).toHaveBeenCalledTimes(1)
  expect(result.generatedImages?.[0]).toMatchObject({ path: path.join(root, 'images', 'example.png'), width: 16, height: 12, mimeType: 'image/png' })
  expect(result.generatedImages?.[0].id).toMatch(/^[a-f0-9]{64}$/)
  expect((await sharp(fs.readFileSync(result.generatedImages![0].path)).metadata()).width).toBe(16)
  expect(fs.readdirSync(path.join(root, 'images'))).toEqual(['example.png'])
})
it.each(['deny', 'ask'])('文件规则 %s 在请求前阻止生成与文件副作用', async action => {
  loadRules(JSON.stringify([{ id: 'image-write', type: 'file-write', action, pattern: 'example[.]png$', enabled: true }]))
  expect((await run()).isError).toBe(true)
  expect(state.request).not.toHaveBeenCalled()
  expect(fs.existsSync(path.join(root, 'images'))).toBe(false)
})
it('只读、越界、已有文件及无配置在付费请求之前失败', async () => {
  state.mode = 'read-only'; expect((await run()).isError).toBe(true)
  state.mode = 'full-access'; expect((await run({ ...args, path: '../outside.png' })).isError).toBe(true)
  state.mode = 'workspace-write'; fs.mkdirSync(path.join(root, 'images')); fs.writeFileSync(path.join(root, args.path), 'original')
  expect((await run()).isError).toBe(true)
  expect(fs.readFileSync(path.join(root, args.path), 'utf8')).toBe('original')
  state.config.mockResolvedValue(null)
  expect((await run({ ...args, path: 'images/other.png' })).isError).toBe(true)
  expect(state.request).not.toHaveBeenCalled()
})
it('图片目录链接即便指向工作区内部也被拒绝', async () => {
  const other = path.join(root, 'other'); fs.mkdirSync(other)
  fs.symlinkSync(other, path.join(root, 'images'), 'junction')
  expect((await run()).isError).toBe(true)
  expect(state.request).not.toHaveBeenCalled()
  expect(fs.readdirSync(other)).toEqual([])
})
it('没有显式工作区时不能把进程回退目录当成生图目标', async () => {
  context = { sessionId: 'session', workdir: root }
  expect((await run()).isError).toBe(true)
  expect(state.request).not.toHaveBeenCalled()
})
it('配置读取期间权限改变，在付费请求前终止', async () => {
  state.config.mockImplementation(async () => {
    loadRules(JSON.stringify([{ id: 'new-deny', type: 'file-write', action: 'deny', pattern: '.', enabled: true }]))
    return { model: 'fixture', baseUrl: 'https://example.test', apiKey: 'fixture' }
  })
  expect((await run()).isError).toBe(true)
  expect(state.request).not.toHaveBeenCalled()
  expect(fs.existsSync(path.join(root, 'images'))).toBe(false)
})
it('上游等待期间权限改变或取消，迟到结果不能写盘', async () => {
  const bytes = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).png().toBuffer()
  state.request.mockImplementation(async () => { loadRules(JSON.stringify([{ id: 'new-deny', type: 'file-write', action: 'deny', pattern: '.', enabled: true }])); return { bytes } })
  expect((await run()).isError).toBe(true)
  expect(fs.existsSync(path.join(root, 'images'))).toBe(false)
  loadRules('[]')
  const controller = new AbortController(); context.signal = controller.signal
  state.request.mockImplementation(async () => { controller.abort(); return { bytes } })
  expect((await run()).isError).toBe(true)
  expect(fs.existsSync(path.join(root, 'images'))).toBe(false)
})
it('原子提交失败清理自己创建的临时文件，不能发布图片引用', async () => {
  vi.spyOn(fs, 'linkSync').mockImplementation(() => { throw new Error('fixture commit failure') })
  const result = await run()
  expect(result.isError).toBe(true)
  expect(result.generatedImages).toBeUndefined()
  expect(fs.readdirSync(path.join(root, 'images'))).toEqual([])
})

it('生成等待期间其他操作创建目标时，不覆盖、不发布引用也不留下临时文件', async () => {
  const response = await state.request()
  state.request.mockClear()
  state.request.mockImplementation(async () => {
    fs.mkdirSync(path.join(root, 'images'))
    fs.writeFileSync(path.join(root, args.path), 'new user file')
    return response
  })
  const result = await run()
  expect(result.isError).toBe(true)
  expect(result.generatedImages).toBeUndefined()
  expect(state.request).toHaveBeenCalledOnce()
  expect(fs.readFileSync(path.join(root, args.path), 'utf8')).toBe('new user file')
  expect(fs.readdirSync(path.join(root, 'images'))).toEqual(['example.png'])
})
