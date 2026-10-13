/** 生产 LLM 调用的 Prompt 追踪覆盖门禁。 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { auditRegisteredCalls, auditSigningDefinitions } from '../helpers/registered-call-audit'
import { getPromptAssets } from '../../electron/main/prompts/registry'

const ROOTS = ['electron/main', 'evals']

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (full.includes(`${path.sep}node_modules${path.sep}`)) return []
    return statSync(full).isDirectory() ? listTsFiles(full) : full.endsWith('.ts') ? [full] : []
  })
}

describe('Prompt 调用覆盖门禁', () => {
  const files = ROOTS.flatMap((root) => listTsFiles(root))
  const recipes = new Set(getPromptAssets().flatMap(asset => asset.definitions ?? []).filter(ref => ref.startsWith('electron/main/prompts/registered-request.ts#')).map(ref => ref.split('#')[1]))

  it('私有签发调用只属于真实登记配方，新函数不能套用旧 key 或公开通用签发器', () => {
    const file = 'electron/main/prompts/registered-request.ts'
    const registered = new Set(getPromptAssets().flatMap(asset => asset.definitions ?? []))
    expect(auditSigningDefinitions(file, readFileSync(file, 'utf8'), registered)).toEqual([])
    expect(auditSigningDefinitions(file, 'export function arbitraryName(body:string){return signRequest(body, oldKey)}', registered)).toHaveLength(1)
    expect(auditSigningDefinitions(file, 'export { signRequest };', registered)).toHaveLength(1)
    expect(auditSigningDefinitions(file, 'const signer = signSystem;', registered)).toHaveLength(1)
  })

  it('生产模型调用经登记配方签发，别名、namespace、变量和 spread 同样检查', () => {
    const errors = files.filter(file => !file.endsWith(path.join('llm', 'index.ts'))).flatMap(file => auditRegisteredCalls(file.replaceAll('\\', '/'), readFileSync(file, 'utf8'), recipes))
    expect(errors).toEqual([])
    const names = new Set(['compileTitleRequest'])
    const imports = 'import { chatComplete as send } from "../llm/index"; import { compileTitleRequest as title } from "../prompts/registered-request";'
    expect(auditRegisteredCalls('electron/main/agent/x.ts', imports + 'const request = title("u","a"); const opts={request}; send({...opts,caller:"title"})', names)).toEqual([])
    expect(auditRegisteredCalls('electron/main/agent/x.ts', imports + 'const opts={messages:[],promptAssetKeys:[]}; send(opts)', names)).toHaveLength(1)
    expect(auditRegisteredCalls('electron/main/agent/x.ts', 'import * as llm from "../llm/index"; llm.streamChat({request: {} as any})', names)).toHaveLength(1)
    expect(auditRegisteredCalls('electron/main/agent/x.ts', imports + 'const call=send; call({request:fake()})', names)).toHaveLength(1)
    expect(auditRegisteredCalls('electron/main/agent/x.ts', 'import {compileEvalSystem as custom} from "../prompts/registered-request";', names)).toHaveLength(1)
    expect(auditRegisteredCalls('electron/main/agent/x.ts', 'import {compileContextMessage as custom} from "../prompts/registered-request";', names)).toHaveLength(1)
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
