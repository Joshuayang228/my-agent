import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugSystemCandidate, type SystemPreviewState } from '../../src/components/playground/DebugSystemCandidate'
const render=(state:SystemPreviewState)=>renderToStaticMarkup(createElement(DebugSystemCandidate,{previewState:state,snapshotState:'ready',onRetry:()=>{}}))
describe('系统状态候选',()=>{it('摘要和分区保留脱敏边界',()=>{const html=render('ready');expect(html).toContain('运行环境');expect(html).toContain('模型与执行');expect(html).toContain('已配置 · 不展示凭据');expect(html).toContain('不发起模型调用')});it('失败和有界范围不补默认值',()=>{for(const state of ['unread','loading','unavailable','error'] as const)expect(render(state)).not.toContain('运行环境</span><strong>可读取');expect(render('truncated')).toContain('有界范围');expect(render('mcp-error')).toContain('工具数量未知');expect(render('missing')).toContain('系统信息未返回');expect(render('long')).toContain('长规则样张')})})
