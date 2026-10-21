import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugQualityCandidate, type QualityPreviewState } from '../../src/components/playground/DebugQualityCandidate'
const render=(kind:'quality'|'persona',state:QualityPreviewState)=>renderToStaticMarkup(createElement(DebugQualityCandidate,{kind,previewState:state,snapshotState:'ready',onRetry:()=>{}}))
describe('质量候选',()=>{it('Skill 与 Persona 证据责任分开',()=>{expect(render('quality','ready')).toContain('Skill Eval');expect(render('quality','ready')).toContain('自动 Grader');expect(render('persona','ready')).toContain('Persona Eval');expect(render('persona','ready')).toContain('自动 + 人工');expect(render('persona','ready')).toContain('人工审阅')});it('报告边界不自动补结论',()=>{for(const state of ['unread','loading','unavailable','error'] as const)expect(render('quality',state)).not.toContain('通过');expect(render('quality','no-report')).toContain('还没有可读取');expect(render('persona','running')).toContain('完成前不显示通过结论');expect(render('persona','unreviewed')).toContain('人工审阅尚未完成');expect(render('quality','long')).toContain('长场景样张')})})
