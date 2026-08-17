#!/usr/bin/env node
/**
 * 资产生产门禁与审计报告生成器。
 *
 * 背景：不同资产家族已经有自己的注册表，但新增静态资产若只改生产代码可能静默漏登。
 * 设计意图：用治理清单校验来源、类型覆盖和 staged 变更关系；动态家族明确采用运行时自动发现，
 *       不用脆弱正则猜测任意业务代码中的语义资产。
 * 关键约束：报告只写元信息；失败必须 fail-closed；不读取用户数据、凭据、Prompt 正文或运行日志。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_GOVERNANCE } from './asset-governance.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reportDir = join(root, 'var', 'asset-audit')
const modelTypesPath = join(root, 'src', 'shared', 'types.ts')
const modelTypesText = readFileSync(modelTypesPath, 'utf8')
const failures = []
const warnings = []

function rel(path) { return relative(root, path).replaceAll('\\', '/') }
function read(path) { return readFileSync(join(root, path), 'utf8') }
function sourceExists(sourcePath) { return existsSync(join(root, sourcePath)) }
function countMatches(text, pattern) { return [...text.matchAll(pattern)].length }
function gitStagedEntries() {
  try {
    return execFileSync('git', ['diff', '--cached', '--name-status', '--diff-filter=ACMR'], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [status, ...pathParts] = line.split(/\s+/)
        return { status: status[0], path: pathParts.at(-1) }
      })
      .filter((entry) => entry.path)
  } catch (error) {
    warnings.push(`无法读取 staged 文件：${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}
function pathMatches(path, pattern) {
  const normalized = path.replaceAll('\\', '/')
  if (pattern.endsWith('/')) return normalized.startsWith(pattern)
  return normalized === pattern || normalized.startsWith(`${pattern}/`)
}
function modelContextTypes() {
  const block = modelTypesText.match(/export type ModelContextAssetType =([\s\S]*?)\nexport type ModelContextOwnership/)
  if (!block) return []
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}
function declaredEntryCount(family) {
  const source = family.registryPaths[0]
  if (!sourceExists(source)) return 0
  const text = read(source)
  const patterns = {
    prompt: /\n\s*key:\s*[^,\n]+/g,
    'icon': /\n\s*icon\(/g,
    'ui-component': /\n\s*component\(/g,
    design: /\n\s*\{ id: '/g,
    'subagent-role': /\n\s{2,}[a-z][a-z0-9-]*:\s*\{/g,
  }
  return patterns[family.id] ? countMatches(text, patterns[family.id]) : null
}
function assertThemeSingleSource() {
  const consumers = ['src/components/SettingsPanel.tsx', 'src/components/playground/DesignSystemPanel.tsx', 'src/components/MarkdownRenderer.tsx']
  for (const consumer of consumers) {
    const text = read(consumer)
    if (/const\s+(?:THEMES|LIGHT_THEMES)\s*=\s*(?:\[|new Set\s*\(\s*\[)/.test(text)) {
      failures.push(`${consumer} 仍然声明主题集合；主题必须只从 src/shared/design-asset-registry.ts 消费`)
    }
  }
}
function assertStagedRegistration(stagedEntries) {
  const productionRoots = ['electron/main/', 'src/', 'evals/']
  const candidatePattern = /(?:asset|registry|prompt|skill|tool|theme|icon|component|provider|eval|subagent|role-pack|policy)/i
  for (const entry of stagedEntries) {
    if (entry.status !== 'A' || !productionRoots.some((rootPath) => entry.path.startsWith(rootPath)) || !candidatePattern.test(entry.path)) continue
    const governed = ASSET_GOVERNANCE.some((family) => family.sourcePaths.some((source) => pathMatches(entry.path, source)))
    if (!governed) failures.push(`发现未归属治理清单的资产候选文件：${entry.path}`)
  }

  const staticFamilies = ASSET_GOVERNANCE.filter((family) => family.kind === 'static' || family.kind === 'static-renderer')
  for (const family of staticFamilies) {
    // 修改现有组件不代表新增资产；只有新增生产文件才需要证明它被自动发现或同步进显式注册表。
    const addedSource = stagedEntries.some((entry) => entry.status === 'A' && family.sourcePaths.some((source) => pathMatches(entry.path, source)))
    if (!addedSource) continue
    const changedRegistry = stagedEntries.some((entry) => family.registryPaths.includes(entry.path))
    const addedRegistryItself = stagedEntries.some((entry) => entry.status === 'A' && family.registryPaths.includes(entry.path))
    if (!changedRegistry && !addedRegistryItself) failures.push(`staged 新文件属于「${family.labelZh}」生产来源，但没有同步注册表：${family.registryPaths.join('、')}`)
  }
}
function makeReport(stagedEntries) {
  const types = modelContextTypes()
  const covered = new Set(ASSET_GOVERNANCE.flatMap((family) => family.modelContextTypes))
  for (const type of types) if (!covered.has(type)) failures.push(`ModelContextAssetType「${type}」没有治理清单来源`)
  for (const family of ASSET_GOVERNANCE) {
    for (const source of family.sourcePaths) if (!sourceExists(source)) warnings.push(`治理清单来源当前不存在（可能是可选目录）：${source}`)
    for (const registry of family.registryPaths) if (!sourceExists(registry)) failures.push(`注册表入口不存在：${registry}`)
    for (const key of family.modelContextTypes) if (!types.includes(key)) failures.push(`治理清单声明的资产类型未出现在共享契约：${key}`)
  }
  assertThemeSingleSource()
  assertStagedRegistration(stagedEntries)

  const families = ASSET_GOVERNANCE.map((family) => ({
    id: family.id,
    labelZh: family.labelZh,
    kind: family.kind,
    discovery: family.discovery,
    registryPaths: family.registryPaths,
    keyRule: family.keyRule,
    display: family.display,
    usageEvidence: family.usageEvidence,
    declaredEntryCount: declaredEntryCount(family),
  }))
  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: '生产注册表、loader、ToolRegistry 与共享类型；本报告仅为审计快照',
    stagedFiles: stagedEntries.map((entry) => entry.path),
    stagedEntries,
    modelContextAssetTypes: types,
    families,
    failures,
    warnings,
  }
}

const stagedEntries = gitStagedEntries()
const report = makeReport(stagedEntries)
mkdirSync(reportDir, { recursive: true })
writeFileSync(join(reportDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
const markdown = [
  '# 资产注册审计报告',
  '',
  `生成时间：${report.generatedAt}`,
  '',
  `> 本文件是机器生成的 dated snapshot，不是产品事实源。事实以生产注册表、loader、ToolRegistry 和共享类型为准。`,
  '',
  '## 资产家族',
  '',
  '| 家族 | 类型 | 登记入口 | 发现方式 | 条目线索 | 展示面 |',
  '|---|---|---|---|---:|---|',
  ...report.families.map((family) => `| ${family.labelZh} | ${family.kind} | ${family.registryPaths.join('<br>')} | ${family.discovery} | ${family.declaredEntryCount ?? '运行时'} | ${family.display} |`),
  '',
  '## ModelContextAssetType 覆盖',
  '',
  ...report.modelContextAssetTypes.map((type) => '- `' + type + '`'),
  '',
  '## 门禁结果',
  '',
  report.failures.length === 0 ? '✅ 没有失败项。' : `❌ ${report.failures.length} 个失败项：\n${report.failures.map((item) => `- ${item}`).join('\n')}`,
  report.warnings.length === 0 ? '✅ 没有警告。' : `\n⚠️ ${report.warnings.length} 个警告：\n${report.warnings.map((item) => `- ${item}`).join('\n')}`,
  '',
].join('\n')
writeFileSync(join(reportDir, 'latest.md'), `${markdown}\n`, 'utf8')

console.log(`资产审计报告：${rel(join(reportDir, 'latest.md'))}`)
console.log(`资产家族：${report.families.length}；ModelContextAssetType：${report.modelContextAssetTypes.length}`)
if (report.warnings.length) console.warn(report.warnings.map((item) => `警告：${item}`).join('\n'))
if (report.failures.length) {
  console.error(report.failures.map((item) => `失败：${item}`).join('\n'))
  process.exitCode = 1
} else {
  console.log('assets:check 通过')
}
