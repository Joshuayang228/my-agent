import { describe, it, expect } from 'vitest'
import { groupVisibleMessages, buildProcessSummaryText } from '../../src/components/chat/callbacks/resolve-tools-for-message'
import type { ChatMessage } from '../../src/shared/types'

function msg(id: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return { id, role, content, timestamp: 1 }
}

describe('groupVisibleMessages', () => {
  it('单轮问答保持原样（intermediate 为空）', () => {
    const entries = groupVisibleMessages([
      msg('u1', 'user', '你好'),
      msg('a1', 'assistant', '你好呀'),
    ])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ kind: 'user', visibleIndex: 0 })
    expect(entries[1]).toMatchObject({ kind: 'assistant-run', intermediate: [], lastVisibleIndex: 1 })
  })

  it('连续多轮助手步骤折叠进同一 assistant-run，只留最后一轮作 finalMsg', () => {
    const entries = groupVisibleMessages([
      msg('u1', 'user', '帮我查并改一下'),
      msg('a1', 'assistant', '先读文件'),
      msg('a2', 'assistant', '再跑测试'),
      msg('a3', 'assistant', '全部改好并通过了'),
      msg('u2', 'user', '谢谢'),
      msg('a4', 'assistant', '不客气'),
    ])
    expect(entries).toHaveLength(4)
    const run = entries[1]
    expect(run.kind).toBe('assistant-run')
    if (run.kind === 'assistant-run') {
      expect(run.intermediate.map((m) => m.id)).toEqual(['a1', 'a2'])
      expect(run.finalMsg.id).toBe('a3')
      expect(run.lastVisibleIndex).toBe(3)
    }
    const secondRun = entries[3]
    expect(secondRun.kind).toBe('assistant-run')
    if (secondRun.kind === 'assistant-run') {
      expect(secondRun.intermediate).toEqual([])
      expect(secondRun.finalMsg.id).toBe('a4')
    }
  })

  it('buildProcessSummaryText 去重中文工具标签并截断超长列表', () => {
    expect(
      buildProcessSummaryText(['file_read', 'file_read', 'companion_post_moment', 'image_generate', 'shell_exec'], 2, true),
    ).toBe('已思考并完成 5 步处理 · 读取文件、发布朋友圈、生成图片…')

    expect(
      buildProcessSummaryText(['file_read'], 1, false),
    ).toBe('已完成 1 步处理 · 读取文件')

    expect(
      buildProcessSummaryText(['file_read', 'shell_exec'], 2, true, 1),
    ).toBe('已思考并完成 2 步处理（1 项失败） · 读取文件、执行命令')
  })
})
