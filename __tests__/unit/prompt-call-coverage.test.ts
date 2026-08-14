/** 生产 LLM 调用的 Prompt 追踪覆盖门禁。 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOTS = ['electron/main', 'evals']

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (full.includes(`${path.sep}node_modules${path.sep}`)) return []
    return statSync(full).isDirectory() ? listTsFiles(full) : full.endsWith('.ts') ? [full] : []
  })
}

function findProductionCalls(filePath: string): Array<{ text: string; line: number }> {
  if (filePath.endsWith(path.join('electron', 'main', 'llm', 'index.ts'))) return []
  const sourceText = readFileSync(filePath, 'utf-8')
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true)
  const calls: Array<{ text: string; line: number }> = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && (node.expression.text === 'streamChat' || node.expression.text === 'chatComplete')) {
      const argument = node.arguments[0]
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      calls.push({ text: argument?.getText(source) ?? '', line })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return calls
}

describe('Prompt 调用覆盖门禁', () => {
  const files = ROOTS.flatMap((root) => listTsFiles(root))
  const calls = files.flatMap((file) => findProductionCalls(file).map((call) => ({ file, ...call })))

  it('每个生产 LLM 调用都声明资产或显式 promptless 原因', () => {
    const missing = calls.filter((call) => !call.text.includes('promptAssetKeys') && !call.text.includes('promptlessReason'))
    expect(missing.map((item) => `${item.file}:${item.line}`)).toEqual([])
  })

  it('生产 promptAssetKeys 不再出现裸字符串 key', () => {
    const violations: string[] = []
    for (const file of files) {
      const sourceText = readFileSync(file, 'utf-8')
      const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node) => {
        if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'promptAssetKeys') {
          const literals: string[] = []
          const collect = (child: ts.Node) => {
            if ((ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) && child.text.trim()) literals.push(child.text)
            ts.forEachChild(child, collect)
          }
          collect(node.initializer)
          if (literals.length > 0) {
            const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
            violations.push(`${file}:${line} -> ${literals.join(', ')}`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(violations).toEqual([])
  })
})
