import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import ts from 'typescript'
import { getPromptAssets } from '../../electron/main/prompts/registry'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'
import { auditCallBindings, inlinePromptMessages, promptDefinitions } from '../helpers/prompt-audit'

function files(root: string): string[] {
  return readdirSync(root).flatMap(name => {
    const file = `${root}/${name}`
    return statSync(file).isDirectory() ? files(file) : [file]
  })
}

describe('Prompt 生产定义防漏登记', () => {
  const assets = getPromptAssets()
  const definitions = new Set(assets.flatMap(asset => asset.definitions ?? []))
  const sources = files('electron/main').filter(file => file.endsWith('.ts'))

  it('全部生产正文函数与常量登记实际符号，同文件新增函数也必须登记', () => {
    const missing = sources.flatMap(file => promptDefinitions(file, readFileSync(file, 'utf8'))).filter(def => !definitions.has(def))
    expect(missing).toEqual([])
    expect(promptDefinitions('new.ts', 'export function buildNewPrompt(): string { return "新指令" }')).toEqual(['new.ts#buildNewPrompt'])
    expect(definitions.has('new.ts#buildNewPrompt')).toBe(false)
    expect(promptDefinitions('new.ts', 'export const buildNewPrompt = () => "新指令"')).toEqual(['new.ts#buildNewPrompt'])
  })

  it('登记符号真实存在，不用空目录项替代生产定义', () => {
    for (const definition of definitions) {
      const [file, symbol] = definition.split('#')
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const symbols: string[] = []
      const visit = (node: ts.Node) => {
        if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name)) symbols.push(node.name.text)
        ts.forEachChild(node, visit)
      }
      visit(source)
      expect(symbols, definition).toContain(symbol)
    }
  })

  it('模型消息不内联新的固定指令或包装模板', () => {
    // Provider 资产里的消息是协议能力投影夹具，不是实际模型请求。
    const errors = sources.filter(file => !file.endsWith('/llm/provider-asset-registry.ts'))
      .flatMap(file => inlinePromptMessages(file, readFileSync(file, 'utf8')))
    expect(errors).toEqual([])
    expect(inlinePromptMessages('new.ts', 'const messages = [{role:"system", content:"绕过目录的新指令"}]')).toHaveLength(1)
    expect(inlinePromptMessages('new.ts', 'const messages = [{role:"user", content: userInput}]')).toEqual([])
  })

  it('所有 Role Pack 文案和结构化人物来源都进入目录，新增文件不能静默遗漏', () => {
    const registered = new Set(assets.map(asset => asset.sourcePath.replace('role-pack://', 'electron/main/companion/universes/')))
    const roleFiles = files('electron/main/companion/universes/default/roles').filter(file => /\.(md|txt)$/.test(file) || /\/(manifest|profile|world\.default)\.json$/.test(file))
    expect(roleFiles.filter(file => !registered.has(file))).toEqual([])
  })

  it('实际模型消息引用的生产定义与声明资产匹配', () => {
    const names = new Map(Object.entries(PROMPT_KEYS).map(([name, key]) => [key as string, name]))
    const owners = new Map<string, string[]>()
    for (const asset of assets) for (const definition of asset.definitions ?? []) {
      owners.set(definition, [...owners.get(definition) ?? [], names.get(asset.key)!])
    }
    const errors = sources.filter(file => !file.endsWith('/llm/index.ts')).flatMap(file => auditCallBindings(file, readFileSync(file, 'utf8'), owners))
    expect(errors).toEqual([])
  })

  it('错误 key 和经变量传入的正文也能被门禁发现', () => {
    const owners = new Map([['electron/main/prompts/x.ts#buildNewPrompt', ['loopDefault']]])
    const body = 'import { buildNewPrompt } from "../prompts/x"; const prompt = buildNewPrompt(); chatComplete({messages: [{role:"system",content:prompt}], promptAssetKeys:[PROMPT_KEYS.sessionTitle]})'
    expect(auditCallBindings('electron/main/agent/x.ts', body, owners)).toHaveLength(1)
    expect(auditCallBindings('electron/main/agent/x.ts', body.replace('sessionTitle', 'loopDefault'), owners)).toEqual([])
    expect(auditCallBindings('new.ts', 'const hidden = "未登记正文"; chatComplete({messages:[{role:"system",content:hidden}],promptAssetKeys:[PROMPT_KEYS.loopDefault]})', owners)).toHaveLength(1)
    expect(auditCallBindings('electron/main/agent/x.ts', body.replace('const prompt = buildNewPrompt()', 'const { text: prompt } = buildNewPrompt()'), owners)).toHaveLength(1)
  })
})
