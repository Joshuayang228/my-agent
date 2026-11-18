import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve('electron/main')

function files(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? files(target) : target.endsWith('.ts') ? [target] : []
  })
}

it('主进程的 IPC 注册统一经过来源校验', () => {
  const bypasses = files(root).filter(file => {
    if (file === path.join(root, 'ipc', 'ipc-security.ts')) return false
    return /\bipcMain\s*\.\s*(?:handle|handleOnce|on|once)\s*\(/.test(fs.readFileSync(file, 'utf8'))
  })
  expect(bypasses).toEqual([])
})

it('主进程分层依赖保持单向，工具内置实现通过端口使用子任务运行时', () => {
  const rules = [
    { source: 'storage', forbidden: ['agent', 'ipc', 'llm'] },
    { source: 'llm', forbidden: ['agent', 'ipc'] },
    { source: 'agent', forbidden: ['ipc'] },
    { source: 'tools/builtins', forbidden: ['agent', 'ipc'] },
  ]
  const violations: string[] = []
  for (const rule of rules) {
    for (const file of files(path.join(root, rule.source))) {
      const imports = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true).importedFiles
      for (const imported of imports) {
        if (!imported.fileName.startsWith('.')) continue
        const target = path.resolve(path.dirname(file), imported.fileName)
        const layer = path.relative(root, target).split(path.sep)[0]
        if (rule.forbidden.includes(layer)) violations.push(`${path.relative(root, file)} -> ${imported.fileName}`)
      }
    }
  }
  expect(violations).toEqual([])
})

it('Companion Core 独立拥有运行态和生活存储，过渡文件保持移除', () => {
  for (const removed of [
    'companion/life/store.ts',
    'companion/core/read-models/legacy-companion-read-model.ts',
    'companion/core/projections/legacy-life-projection.ts',
  ]) expect(fs.existsSync(path.join(root, removed))).toBe(false)
  const state = fs.readFileSync(path.join(root, 'companion/core/state/runtime-state.ts'), 'utf8')
  expect(state).not.toMatch(/getRoleState|setWorldState|projectLegacyWorldState|world_json/)
})

it('人物世界规则和应用用例通过适配边界使用宿主能力', () => {
  const sources = ['companion/core', 'companion/life', 'companion/application', 'companion/growth', 'companion/cast']
    .flatMap(directory => files(path.join(root, directory)))
  sources.push(path.join(root, 'agent-host/builtin-domains.ts'))
  const violations = sources.flatMap(file => {
    const imports = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true).importedFiles
    return imports.flatMap(({ fileName }) => {
      const target = path.relative(root, path.resolve(path.dirname(file), fileName)).replaceAll(path.sep, '/')
      const forbidden = fileName === 'electron' || target.startsWith('ipc/') || target.startsWith('agent/') || target.startsWith('tools/') || target.startsWith('agent-host/')
      return forbidden ? [`${path.relative(root, file)} -> ${fileName}`] : []
    })
  })
  expect(violations).toEqual([])
})

it('Skill 与任务计划不再使用模块级全局激活或默认会话状态', () => {
  const skillRegistry = fs.readFileSync(path.join(root, 'skills/registry.ts'), 'utf8')
  const taskPlanService = fs.readFileSync(path.join(root, 'services/task-plan-service.ts'), 'utf8')
  const scopedCatalog = fs.readFileSync(path.join(root, 'agent-host/scoped-catalog.ts'), 'utf8')
  expect(skillRegistry).not.toMatch(/lets+activeSkill/)
  expect(taskPlanService).not.toMatch(/lets+currentSessionId/)
  expect(scopedCatalog).not.toMatch(/getAgentHostToolNamesForRole/)
})
