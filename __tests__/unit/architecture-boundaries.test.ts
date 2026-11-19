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

it('禁止除数据库事务管理器与同步诊断缓冲之外的生产文件手写裸 BEGIN/COMMIT/ROLLBACK（C04）', () => {
  const allowed = new Set([
    path.join(root, 'storage', 'database.ts'),
    path.join(root, 'storage', 'diagnostic-history-store.ts'),
  ])
  const violations = files(root).filter(file => {
    if (allowed.has(file)) return false
    const content = fs.readFileSync(file, 'utf8')
    return /\.run\(\s*['"`]\s*(?:BEGIN(?:\s+TRANSACTION)?|COMMIT|ROLLBACK)\s*['"`]\s*\)/i.test(content)
  }).map(file => path.relative(root, file))
  expect(violations).toEqual([])
})

it('companion/life 与 companion/growth 业务层禁止散落 CREATE TABLE / ALTER TABLE DDL（C02/C04）', () => {
  const businessFiles = ['companion/life', 'companion/growth'].flatMap(dir => files(path.join(root, dir)))
  const violations = businessFiles.filter(file => {
    const content = fs.readFileSync(file, 'utf8')
    return /\b(?:CREATE\s+TABLE|ALTER\s+TABLE)\b/i.test(content)
  }).map(file => path.relative(root, file))
  expect(violations).toEqual([])
})

it('ipc/companion.ts 统一通过 Application 门面与适配器调用伙伴领域，不直接跨层导入底层实现（C03/C04）', () => {
  const ipcFile = path.join(root, 'ipc', 'companion.ts')
  const imports = ts.preProcessFile(fs.readFileSync(ipcFile, 'utf8'), true, true).importedFiles
  const violations = imports.flatMap(({ fileName }) => {
    if (!fileName.startsWith('.')) return []
    const target = path.relative(root, path.resolve(path.dirname(ipcFile), fileName)).replaceAll(path.sep, '/')
    if (!target.startsWith('companion/')) return []
    const allowed = target.startsWith('companion/application/') || target.startsWith('companion/adapters/')
    return allowed ? [] : [target]
  })
  expect(violations).toEqual([])
})

it('所有内置伙伴/记忆/知识库领域工具必须全部纳入 Agent Host Manifest 权限管控（C01/C04）', () => {
  const builtinFiles = files(path.join(root, 'tools', 'builtins'))
  const domainTools = new Set<string>()
  for (const file of builtinFiles) {
    const content = fs.readFileSync(file, 'utf8')
    for (const match of content.matchAll(/\bname\s*:\s*['"]([a-z0-9_]+)['"]/g)) {
      const name = match[1]
      if (name.startsWith('companion_') || ['remember', 'recall', 'forget', 'rag_search'].includes(name)) {
        domainTools.add(name)
      }
    }
  }
  const hostSource = fs.readFileSync(path.join(root, 'agent-host', 'host.ts'), 'utf8')
  const domainsSource = fs.readFileSync(path.join(root, 'agent-host', 'builtin-domains.ts'), 'utf8')
  const unmanaged = [...domainTools].filter(name => {
    const inPolicy = new RegExp(`\\b${name}\\s*:`).test(hostSource)
    const inCapability = new RegExp(`toolName\\s*:\\s*['"]${name}['"]`).test(domainsSource)
    return !inPolicy && !inCapability
  })
  expect(domainTools.size).toBeGreaterThanOrEqual(10)
  expect(unmanaged).toEqual([])
})
