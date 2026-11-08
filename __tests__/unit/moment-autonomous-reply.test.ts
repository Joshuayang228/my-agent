/**
 * 朋友圈回复互动与人物/NPC 自主回复决策门禁测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import initSqlJs from 'sql.js'
import React from 'react'
import { renderToString } from 'react-dom/server'
import {
  describeMomentSocial,
  mergeMomentComments,
  type MomentUserCommentView,
  type MomentCastInteractionView,
} from '../../src/shared/moment-user-interactions'
import { MomentsPanel } from '../../src/components/MomentsPanel'

const sendMock = vi.fn()
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: {
    getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: sendMock } }],
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>
let activeRoleId = 'luffy'

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === 'universeId') return 'default'
    if (key === 'activeRoleId') return activeRoleId
    return ''
  }),
  setSetting: vi.fn(async (key: string, value: string) => {
    if (key === 'activeRoleId') activeRoleId = value
  }),
}))

const llmState = vi.hoisted(() => ({
  config: null as unknown,
  response: '{"shouldReply":true,"responderId":"luffy","responderName":"路飞","actorType":"protagonist","reply":"收到！我们立刻出发！","delaySeconds":0}',
}))

vi.mock('../../electron/main/llm/aux-config', () => ({
  loadAuxLLMConfig: vi.fn(async () => llmState.config),
}))

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async () => llmState.response),
}))

const {
  addMomentCommentForRole,
  listMomentUserInteractionsForRole,
} = await import('../../electron/main/companion/life/moments')
const store = await import('../../electron/main/companion/life/store')

async function seedMoment(roleId: string, eventId: string, text = '在千里阳光号甲板上钓鱼。') {
  const moment = await store.insertMoment({
    roleId,
    eventId,
    publishedAt: 1_720_000_000_000,
    text,
    meta: {
      location: '千里阳光号',
      interactions: [
        { kind: 'comment', castId: 'zoro', castName: '索隆', text: '别把鱼竿也甩出去了。' },
      ],
    },
  })
  if (!moment) throw new Error('seed moment failed')
  return moment
}

describe('朋友圈回复互动与 NPC 自主决策', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    activeRoleId = 'luffy'
    llmState.config = { apiKey: 'fixture', baseUrl: 'https://example.test', model: 'fixture' }
    sendMock.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    memDb.close()
  })

  it('mergeMomentComments 正确合并并展示 replyToActorName', () => {
    const cast: MomentCastInteractionView[] = [
      { kind: 'comment', castId: 'zoro', castName: '索隆', text: '别把鱼竿甩出去了' },
    ]
    const user: MomentUserCommentView[] = [
      { id: 'u1', actorName: '我', text: '才不会呢！', createdAt: 1, source: 'user', replyToActorName: '索隆' },
      { id: 'u2', actorName: '路飞', text: '我抓到大鱼了！', createdAt: 2, source: 'protagonist', parentInteractionId: 'u1', replyToActorName: '我' },
    ]
    const merged = mergeMomentComments(cast, user)
    expect(merged).toHaveLength(3)
    expect(merged[0]).toMatchObject({ actorName: '索隆', text: '别把鱼竿甩出去了', source: 'cast' })
    expect(merged[1]).toMatchObject({ actorName: '我', text: '才不会呢！', replyToActorName: '索隆', source: 'user' })
    expect(merged[2]).toMatchObject({ actorName: '路飞', text: '我抓到大鱼了！', replyToActorName: '我', source: 'protagonist' })
  })

  it('用户回复 NPC 评论时保存 parentInteractionId 和 replyToActorName', async () => {
    const moment = await seedMoment('luffy', 'ev-1')
    llmState.response = '{"shouldReply":false,"reason":"用户只是和索隆斗嘴，路飞正忙着吃肉"}'

    const saved = await addMomentCommentForRole('luffy', moment.id, '索隆你闭嘴！', {
      parentInteractionId: 'cast-zoro-0',
      replyToActorName: '索隆',
    })
    expect(saved.ok).toBe(true)
    const interactions = await listMomentUserInteractionsForRole('luffy')
    const userComment = interactions.find(item => item.actorId === 'user')
    expect(userComment).toMatchObject({
      text: '索隆你闭嘴！',
      parentInteractionId: 'cast-zoro-0',
      replyToActorName: '索隆',
    })
    // shouldReply 为 false 时，不新增人物回复
    const reply = interactions.find(item => item.actorId !== 'user')
    expect(reply).toBeUndefined()
  })

  it('NPC 自主决定由索隆（cast）回复，且包含自定义延迟', async () => {
    const moment = await seedMoment('luffy', 'ev-2')
    llmState.response = JSON.stringify({
      shouldReply: true,
      responderId: 'zoro',
      responderName: '索隆',
      actorType: 'cast',
      reply: '喂，你说谁闭嘴啊混蛋！',
      delaySeconds: 15,
      reason: '索隆被用户直接挑衅，性格要强，延迟15秒反击',
    })

    const saved = await addMomentCommentForRole('luffy', moment.id, '索隆你闭嘴！', {
      replyToActorName: '索隆',
    })
    expect(saved.ok).toBe(true)

    // 尚未经过 15 秒，数据库中仅有用户评论
    let interactions = await listMomentUserInteractionsForRole('luffy')
    expect(interactions).toHaveLength(1)
    expect(interactions[0].actorId).toBe('user')

    // 推进时间 15 秒
    await vi.advanceTimersByTimeAsync(15_000)

    // 延迟到达后，索隆的回复成功落库，并向渲染窗口广播 moment-updated
    interactions = await listMomentUserInteractionsForRole('luffy')
    expect(interactions).toHaveLength(2)
    const zoroReply = interactions.find(item => item.actorId === 'zoro')
    expect(zoroReply).toMatchObject({
      actorName: '索隆',
      actorType: 'cast',
      replyToActorName: '我',
      text: '喂，你说谁闭嘴啊混蛋！',
    })
    expect(sendMock).toHaveBeenCalledWith('companion:moment-updated', {
      momentId: moment.id,
      roleId: 'luffy',
      reply: { actorName: '索隆', text: '喂，你说谁闭嘴啊混蛋！' },
    })
  })

  it('MomentsPanel 静态渲染支持对评论进行回复及展示回复对象', () => {
    const previewData = {
      roleId: 'luffy',
      roleName: '路飞',
      items: [
        {
          id: 'm-1',
          roleId: 'luffy',
          eventId: 'e-1',
          publishedAt: Date.now(),
          text: '今天天气真好！',
          meta: {
            interactions: [
              { kind: 'comment', castId: 'zoro', castName: '索隆', text: '甲板上风挺大' },
            ],
          },
        },
      ],
    }

    const html = renderToString(
      React.createElement(MomentsPanel, {
        onClose: () => {},
        previewData,
        showSocialActions: true,
        appearance: 'social-feed',
      })
    )

    // 验证索隆评论在列表中渲染
    expect(html).toContain('索隆')
    expect(html).toContain('甲板上风挺大')
    // 微信式交互：点击评论行本身直接触发回复，无额外独立回复按钮
    expect(html).toContain('aria-label="回复 索隆"')
    expect(html).toContain('role="button"')
    expect(html).not.toContain('>回复</button>')
  })
})
