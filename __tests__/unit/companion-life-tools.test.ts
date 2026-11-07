import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import { companionAddReadingNoteTool, companionCommentMomentTool, companionCreateAssetTool, companionObserveMaterialTool, companionPostMomentTool, companionReadWorldTool } from '../../electron/main/tools/builtins/companion-life'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { listEventLinks, listMomentUserInteractions, listMoments } from '../../electron/main/companion/life/store'
import { listAssets } from '../../electron/main/companion/life/assets'
import { queryCompanionEvidence } from '../../electron/main/debug/companion-evidence'
import type { DebugEvidenceScope } from '../../src/shared/debug-evidence'
import { builtinTools, getBuiltinToolSource } from '../../electron/main/tools/builtins'

const SQL = await initSqlJs()
let db: InstanceType<typeof SQL.Database>
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: vi.fn(async () => db), persist: vi.fn() }))
vi.mock('../../electron/main/storage/session-store', () => ({ getSession: vi.fn(async () => ({ messages: [] })) }))

function registry() {
  const value = new ToolRegistry()
  value.register(companionPostMomentTool)
  value.register(companionCreateAssetTool)
  value.register(companionCommentMomentTool)
  value.register(companionReadWorldTool)
  value.register(companionAddReadingNoteTool)
  value.register(companionObserveMaterialTool)
  return value
}

beforeEach(() => { db = new SQL.Database() })
afterEach(() => db.close())

it('Chat 查询真实动态 ID 后可评论，其他人物读不到该动态', async () => {
  const tools = registry()
  const context = { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' }
  await tools.executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '读写闭环动态' }) }], context)
  const [read] = await tools.executeAll([{ id: 'read', name: 'companion_read_world', arguments: '{"view":"moments"}' }], context)
  const data = JSON.parse(read.content)
  expect(data.items[0].text).toBe('读写闭环动态')
  const [comment] = await tools.executeAll([{ id: 'comment', name: 'companion_comment_moment', arguments: JSON.stringify({ momentId: data.items[0].id, text: '收到' }) }], context)
  expect(comment.content).toContain('已评论朋友圈')
  const [other] = await tools.executeAll([{ id: 'other', name: 'companion_read_world', arguments: '{"view":"moments"}' }], { ...context, roleId: 'nami' })
  expect(JSON.parse(other.content).items).toEqual([])
})

it('生活查询返回资产 ID，拒绝非法分页且无绑定时不查询', async () => {
  const tools = registry()
  const context = { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' }
  await tools.executeAll([{ id: 'create', name: 'companion_create_asset', arguments: '{"kind":"furniture","name":"观察架"}' }], context)
  const [result] = await tools.executeAll([{ id: 'read', name: 'companion_read_world', arguments: '{"view":"assets","kind":"furniture"}' }], context)
  expect(JSON.parse(result.content).items[0]).toMatchObject({ id: expect.any(String), name: '观察架' })
  const [invalid] = await tools.executeAll([{ id: 'invalid', name: 'companion_read_world', arguments: '{"view":"assets","offset":-1}' }], context)
  expect(invalid.content).toContain('分页起点')
  const [unbound] = await tools.executeAll([{ id: 'unbound', name: 'companion_read_world', arguments: '{"view":"assets"}' }], { workdir: process.cwd() })
  expect(unbound.content).toContain('没有绑定人物')
})

it('用户明确选择书架条目后可保存阅读笔记并拒绝跨人物资产', async () => {
  const tools = registry()
  const context = { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' }
  await tools.executeAll([{ id: 'create', name: 'companion_create_asset', arguments: JSON.stringify({ kind: 'bookshelf', name: '航海日志' }) }], context)
  const book = (await listAssets('luffy', { kind: 'bookshelf' }))[0]
  const [saved] = await tools.executeAll([{ id: 'note', name: 'companion_add_reading_note', arguments: JSON.stringify({ assetId: book.id, note: '读到选择路线时停下来记了一句。', source: '用户提供的第 12 页摘录', author: 'user', page: 12, chapter: '选择路线' }) }], context)
  expect(saved.content).toContain('已保存')
  expect((await listAssets('luffy', { kind: 'bookshelf' }))[0].payload.readingNotes).toEqual([expect.objectContaining({ text: expect.stringContaining('选择路线'), source: expect.stringContaining('第 12 页'), author: 'user', page: 12, chapter: '选择路线' })])
  const [characterSaved] = await tools.executeAll([{ id: 'note', name: 'companion_add_reading_note', arguments: JSON.stringify({ assetId: book.id, note: '这一章让人物重新想起航线选择。', source: '人物读取的第 13 章材料', author: 'companion', observation: '第 13 章明确写到航线选择需要重新核对。', inference: '人物因此重新想起此前的航线选择。', chapter: '第 13 章' }) }], context)
  expect(characterSaved.content).toContain('记录者：人物')
  expect((await listAssets('luffy', { kind: 'bookshelf' }))[0].payload.readingNotes).toEqual(expect.arrayContaining([expect.objectContaining({ grounding: { observation: expect.stringContaining('重新核对'), inference: expect.stringContaining('重新想起') } })]))
  const [ungrounded] = await tools.executeAll([{ id: 'note', name: 'companion_add_reading_note', arguments: JSON.stringify({ assetId: book.id, note: '只凭书名猜出来的感想。', source: '书名', author: 'companion' }) }], context)
  expect(ungrounded.content).toContain('必须提供材料观察')
  const [rejected] = await tools.executeAll([{ id: 'note', name: 'companion_add_reading_note', arguments: JSON.stringify({ assetId: book.id, note: '跨人物', source: '不存在的来源', author: 'user' }) }], { ...context, roleId: 'nami' })
  expect(rejected.content).toContain('只能为当前人物')
})

it('图片材料观察只接受当前会话附件，缺图时不触发模型也不写回', async () => {
  const tools = registry()
  const [result] = await tools.executeAll([{ id: 'observe', name: 'companion_observe_material', arguments: JSON.stringify({ messageId: 'missing', source: '用户提供的书页照片，第 12 页' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(result.content).toContain('只能观察当前会话中可读取的图片附件')
  expect((await listAssets('luffy', { kind: 'bookshelf' }))).toEqual([])
  const scope: DebugEvidenceScope = { roles: [{ id: 'luffy', name: '路飞', kind: 'protagonist' }], activeRoleId: 'luffy', universeId: 'default', ready: true }
  const evidence = queryCompanionEvidence({ view: 'growth', roleId: 'luffy', limit: 10 }, db, scope)
  expect(evidence.records.some(record => record.source === 'companion_material_observation_attempts' && record.status === 'failed')).toBe(true)
})

it('朋友圈与生活资产工具进入 Chat 的统一内置注册链', () => {
  expect(builtinTools.map(tool => tool.name)).toEqual(expect.arrayContaining(['companion_post_moment', 'companion_create_asset', 'companion_comment_moment', 'companion_add_reading_note']))
  expect(getBuiltinToolSource('companion_post_moment')).toBe('electron/main/tools/builtins/companion-life.ts')
  expect(getBuiltinToolSource('companion_create_asset')).toBe('electron/main/tools/builtins/companion-life.ts')
  expect(getBuiltinToolSource('companion_comment_moment')).toBe('electron/main/tools/builtins/companion-life.ts')
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

it('Chat 评论路飞朋友圈时复用真实互动与主角回复链', async () => {
  const posted = await registry().executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '千里阳光号甲板上的风很大。' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(posted[0].isError).not.toBe(true)
  const moment = (await listMoments('luffy'))[0]
  const result = await registry().executeAll([{ id: 'comment', name: 'companion_comment_moment', arguments: JSON.stringify({ momentId: moment.id, text: '下一站也带我看看。' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  expect(result[0].isError).not.toBe(true)
  expect(result[0].content).toContain('已评论朋友圈')
  expect((await listMomentUserInteractions('luffy')).some(item => item.momentId === moment.id && item.actorType === 'user' && item.text === '下一站也带我看看。')).toBe(true)
})

it('Chat 评论工具拒绝跨人物动态，且不写入互动记录', async () => {
  await registry().executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '只属于路飞的动态。' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'luffy' })
  const moment = (await listMoments('luffy'))[0]
  const result = await registry().executeAll([{ id: 'comment', name: 'companion_comment_moment', arguments: JSON.stringify({ momentId: moment.id, text: '不应写入。' }) }], { sessionId: 's', workdir: process.cwd(), roleId: 'lin' })
  expect(result[0].content).toContain('朋友圈评论未保存')
  expect(await listMomentUserInteractions('luffy')).toEqual([])
})

it('没有人物绑定时拒绝写入生活世界', async () => {
  const result = await registry().executeAll([{ id: 'post', name: 'companion_post_moment', arguments: JSON.stringify({ text: '不应发布' }) }], { sessionId: 's', workdir: process.cwd() })
  expect(result[0].content).toContain('没有绑定人物')
})
