import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SurfaceTheme } from '../../src/components/foundation/useSurfaceTheme'

const library = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn(), mermaidAPI: { defaultConfig: { secure: ['securityLevel', 'maxTextSize'] } } }))
vi.mock('mermaid', () => ({ default: library }))

const theme: SurfaceTheme = { mode: 'dark', background: '#111318', surface: '#1a1d24', text: '#f1eee8', muted: '#9b9da5', border: '#343946', accent: '#c6a878', fontFamily: 'sans-serif' }
let renderMermaid: typeof import('../../src/components/foundation/mermaid-renderer').renderMermaid
let nodes: Array<{ dataset: Record<string, string>; style: Record<string, string>; remove: ReturnType<typeof vi.fn> }>

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  nodes = []
  vi.stubGlobal('document', {
    createElement: () => { const node = { dataset: {}, style: {}, remove: vi.fn() }; nodes.push(node); return node },
    body: { append: vi.fn() },
  })
  renderMermaid = (await import('../../src/components/foundation/mermaid-renderer')).renderMermaid
})
afterEach(() => vi.unstubAllGlobals())

describe('Mermaid 共享渲染任务', () => {
  it('initialize 和 render 同时串行，不让下一实例抢写配置', async () => {
    let finish!: (value: { svg: string }) => void
    library.render.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValueOnce({ svg: '<svg>second</svg>' })
    const first = renderMermaid('first', theme, new AbortController().signal, 400)
    const second = renderMermaid('second', { ...theme, mode: 'light', surface: '#dfe9ee' }, new AbortController().signal, 300)
    await vi.waitFor(() => expect(library.render).toHaveBeenCalledTimes(1))
    expect(library.initialize).toHaveBeenCalledTimes(1)
    finish({ svg: '<svg>first</svg>' })
    expect(await first).toBe('<svg>first</svg>')
    expect(await second).toBe('<svg>second</svg>')
    expect(library.initialize.mock.calls.map(([config]) => config.themeVariables.primaryColor)).toEqual(['#1a1d24', '#dfe9ee'])
    expect(new Set(library.render.mock.calls.map(([id]) => id)).size).toBe(2)
    expect(nodes.every((node) => node.remove.mock.calls.length === 1)).toBe(true)
  })

  it('错误传给所属实例、清理节点且后续图表继续绘制', async () => {
    library.render.mockRejectedValueOnce(new Error('invalid')).mockResolvedValueOnce({ svg: '<svg />' })
    const bad = renderMermaid('bad', theme, new AbortController().signal, 200)
    const good = renderMermaid('good', theme, new AbortController().signal, 200)
    await expect(bad).rejects.toThrow('invalid')
    await expect(good).resolves.toBe('<svg />')
    expect(nodes.every((node) => node.remove.mock.calls.length === 1)).toBe(true)
    expect(library.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', suppressErrorRendering: true, secure: expect.arrayContaining(['securityLevel', 'maxTextSize', 'theme', 'themeVariables']) }))
  })

  it('已经取消的排队任务不创建节点或调用库', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await renderMermaid('unused', theme, controller.signal, 200)).toBeNull()
    expect(library.initialize).not.toHaveBeenCalled()
    expect(library.render).not.toHaveBeenCalled()
    expect(nodes).toHaveLength(0)
  })

  it('绘制过程中取消只丢弃本次结果，仍清理测量节点', async () => {
    const controller = new AbortController()
    library.render.mockImplementationOnce(async () => { controller.abort(); return { svg: '<svg>stale</svg>' } })
    expect(await renderMermaid('old', theme, controller.signal, 200)).toBeNull()
    expect(nodes[0].remove).toHaveBeenCalledOnce()
  })
})
