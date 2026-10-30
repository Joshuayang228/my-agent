import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { companionCreateAssetTool, companionPostMomentTool } from '../../electron/main/tools/builtins/companion-life'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { listEventLinks, listMoments } from '../../electron/main/companion/life/store'
import { listAssets } from '../../electron/main/companion/life/assets'
import { builtinTools, getBuiltinToolSource } from '../../electron/main/tools/builtins'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(async () => db), persist: vi.fn() }))
vi.mock('../../electron/main/storage/session-store', () => ({ getSession: vi.fn(async () => ({ messages: [] })) }))

function registry() {
  const value = new ToolRegistry()
  value.register(companionPostMomentTool)
  value.register(companionCreateAssetTool)
  return value
}

beforeEach(() => { db = new SQL.Database() })
afterEach(() => db.close())

it('朋友圈与生活资产工具进入 Chat 的统一内置注册链', () => {
  expect(builtinTools.map(tool => tool.name)).toEqual(expect.arrayContaining(['companion_post_moment', 'companion_create_asset']))
  expect(getBuiltinToolSource('companion_post_moment')).toBe('electron/main/tools/builtins/companion-life.ts')
  expect(getBuiltinToolSource('companion_create_asset')).toBe('electron/main/tools/builtins/companion-life.ts')
})

it('Chat 发布路飞朋友圈后走真实事件与动态投影', async () => {
  const result = await registry().executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '甲板上的风把航线图吹得哗啦响。', location: '千里阳光号甲板' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(result[0].isError).not.toBe(true)
  expect(result[0].content).toContain('已发布朋友圈')
  expect(await listMoments('luffy')).toHaveLength(1)
  expect((await listMoments('luffy'))[0].meta.location).toBe('千里阳光号甲板')
})

it('Chat 记录路飞关系修复事件时写入已验证参与者与关系阶段', async () => {
  const result = await registry().executeAll([{ id: 'repair', name: 'companion_post_moment', arguments: JSON.stringify({
    text: '我先听完索隆的提醒，再一起决定下一步。', participantIds: ['zoro'], relationshipPhase: 'repair', relationshipNote: '把提醒听完后重新确认出发方式。',
  }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(result[0].content).toContain('已发布朋友圈')
  const moment = (await listMoments('luffy'))[0]
  const links = await listEventLinks('luffy', moment.eventId)
  expect(links).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetType: 'cast', targetId: 'zoro', relation: 'coframe', metadata: expect.objectContaining({ relationshipPhase: 'repair', relationshipNote: expect.stringContaining('提醒听完') }) }),
  ]))
})

it('Chat 可为路飞创建家居资料，并保留角色隔离', async () => {
  const result = await registry().executeAll([{ id: 'asset', name: 'companion_create_asset', arguments: JSON.stringify({ kind: 'furniture', name: '甲板望远镜架', payload: { description: '方便观察远处航线。' } }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(result[0].content).toContain('已添加甲板望远镜架')
  expect((await listAssets('luffy', { kind: 'furniture' })).some(asset => asset.name === '甲板望远镜架')).toBe(true)
})

it('没有人物绑定时拒绝写入生活世界', async () => {
  const result = await registry().executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '不应发布' }) }], { sessionId: 's', workdir: process.cwd() })
  expect(result[0].content).toContain('没有绑定人物')
})
