#!/usr/bin/env node
/**
 * 文档一致性门禁。
 *
 * 背景：项目文档按职责分层，但 Markdown 之间的链接、施工合同状态和 DEC 引用仍容易人工漂移。
 * 设计意图：只检查可以机械证明的结构事实，不判断自然语言是否“写得好”，也不把归档快照误当当前真相。
 * 关键约束：无第三方依赖；默认跳过 `_archive/`、`_reference/`、`.tmp/` 和依赖目录。
 */

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const ignoredSegments = new Set(['.git', 'node_modules', '_archive', '_reference', '.tmp'])
const errors = []
const warnings = []

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/') || '.'
}

function isIgnored(file) {
  const relative = rel(file)
  return relative.split('/').some((segment) => ignoredSegments.has(segment))
}

function markdownFiles() {
  const output = []
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (ignoredSegments.has(entry.name)) continue
      if (entry.isDirectory()) visit(full)
      else if (entry.isFile() && entry.name.endsWith('.md')) output.push(full)
    }
  }
  for (const start of ['docs', 'methodology', 'agent-skills']) {
    const full = path.join(root, start)
    if (fs.existsSync(full)) visit(full)
  }
  for (const name of ['AGENTS.md', 'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'CLAUDE.md']) {
    const full = path.join(root, name)
    if (fs.existsSync(full)) output.push(full)
  }
  return [...new Set(output)]
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

function checkLinks(files) {
  const pattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g
  for (const file of files) {
    const text = read(file)
    for (const match of text.matchAll(pattern)) {
      const raw = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, '')
      if (!raw || /^(?:https?:|mailto:|#|app:)/i.test(raw)) continue
      const target = raw.split('#', 1)[0]
      if (!target) continue
      const resolved = path.resolve(path.dirname(file), target)
      if (!fs.existsSync(resolved)) {
        errors.push(`${rel(file)}:${lineNumber(text, match.index)} 失效链接：${raw}`)
      }
    }
  }
}

function checkHeadings(files) {
  for (const file of files) {
    if (rel(file) === 'CLAUDE.md') continue
    const lines = read(file).split('\n')
    const first = lines.find((line) => line.trim().length > 0)?.trim() ?? ''
    if (!first.startsWith('# ')) {
      errors.push(`${rel(file)} 首个非空行必须是一级标题，实际为：${first}`)
    }
  }
}

function checkDecisions(files) {
  const decisionText = read(path.join(root, 'docs', 'decisions.md'))
  const known = new Set([...decisionText.matchAll(/DEC-(\d{3})/g)].map((match) => `DEC-${match[1]}`))
  for (const file of files) {
    const text = read(file)
    for (const match of text.matchAll(/DEC-\d{3}/g)) {
      if (!known.has(match[0])) errors.push(`${rel(file)} 引用了不存在的 ${match[0]}`)
    }
  }
}

function checkRequirements() {
  const dir = path.join(root, 'docs', 'requirements')
  const indexFile = path.join(dir, 'README.md')
  const index = read(indexFile)
  const sectionByFile = new Map()
  let section = ''
  for (const line of index.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim()
    const match = line.match(/\]\(\.\/([^\)]+\.md)\)/)
    if (match) {
      const name = match[1]
      if (sectionByFile.has(name)) errors.push(`docs/requirements/README.md 重复索引：${name}`)
      sectionByFile.set(name, section)
    }
  }
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md')
  for (const name of files) {
    if (!sectionByFile.has(name)) errors.push(`施工合同未被索引：docs/requirements/${name}`)
  }
  for (const name of sectionByFile.keys()) {
    if (!files.includes(name)) errors.push(`施工合同索引指向不存在文件：docs/requirements/${name}`)
  }
  for (const name of files) {
    const text = read(path.join(dir, name)).slice(0, 1800)
    const isInProgress = /状态[^\n]*进行中/.test(text)
    const indexedAsInProgress = sectionByFile.get(name) === '进行中'
    if (isInProgress !== indexedAsInProgress) {
      errors.push(`施工合同状态错位：${name} 文首=${isInProgress ? '进行中' : '冻结'}，索引=${sectionByFile.get(name)}`)
    }
  }
}

function checkWishlist() {
  const file = path.join(root, 'docs', 'wishlist.md')
  const text = read(file)
  const seen = new Map()
  for (const [index, line] of text.split('\n').entries()) {
    if (!/^- \[ \]/.test(line)) continue
    const match = line.match(/WISH-(\d{3})/)
    if (!match) {
      errors.push(`docs/wishlist.md:${index + 1} 未完成项缺少 WISH-xxx 稳定 ID`)
      continue
    }
    if (!/来源：/.test(line)) errors.push(`docs/wishlist.md:${index + 1} ${match[0]} 缺少来源字段`)
    const id = `WISH-${match[1]}`
    if (seen.has(id)) errors.push(`docs/wishlist.md 重复 WISH ID：${id}（第 ${seen.get(id)} 行和第 ${index + 1} 行）`)
    seen.set(id, index + 1)
  }
}

function checkModuleDecisionIndexes() {
  const decisions = read(path.join(root, 'docs', 'decisions.md'))
  const known = new Set([...decisions.matchAll(/DEC-(\d{3})/g)].map((match) => `DEC-${match[1]}`))
  const moduleDir = path.join(root, 'docs', 'modules')
  for (const name of fs.readdirSync(moduleDir).filter((item) => item.endsWith('.md') && item !== 'README.md')) {
    const file = path.join(moduleDir, name)
    const text = read(file)
    const sectionStart = text.indexOf('## 相关决策')
    if (sectionStart < 0) {
      errors.push(`docs/modules/${name} 缺少“相关决策”索引`)
      continue
    }
    const afterSection = text.slice(sectionStart + '## 相关决策'.length)
    const nextHeading = afterSection.search(/\n## /)
    const sectionBody = nextHeading >= 0 ? afterSection.slice(0, nextHeading) : afterSection
    const ids = [...sectionBody.matchAll(/DEC-\d{3}/g)].map((match) => match[0])
    if (!ids.length) errors.push(`docs/modules/${name} 的“相关决策”为空`)
    for (const id of ids) if (!known.has(id)) errors.push(`docs/modules/${name} 引用了不存在的 ${id}`)
  }
}

function checkContractCloseout() {
  const dir = path.join(root, 'docs', 'requirements')
  for (const name of fs.readdirSync(dir).filter((item) => item.endsWith('.md') && item !== 'README.md')) {
    const text = read(path.join(dir, name))
    const isInProgress = /状态[^\n]*进行中/.test(text)
    const isFrozen = /生命周期：已完成施工快照（冻结）/.test(text)
    if (isInProgress) {
      if (!/## .*实施步骤|## .*验收|## .*收工/.test(text)) errors.push(`施工合同 ${name} 进行中但缺少实施 / 验收结构`)
    } else if (!isFrozen) {
      errors.push(`施工合同 ${name} 不是进行中，但缺少冻结生命周期标记`)
    }
  }
}

function checkArchitecture() {
  const text = read(path.join(root, 'docs', 'architecture.md'))
  if (/\b\d+ 个内置工具\b/.test(text) || /\b\d+ 个独立模块\b/.test(text) || /IPC 处理器（\d+/.test(text)) {
    errors.push('docs/architecture.md 不应手写内置工具数或 IPC 模块数；请以代码注册表为准')
  }
  if (/用户消息 \+ 助手回复写入向量库/.test(text)) {
    errors.push('docs/architecture.md 使用了已废弃的 assistant 向量索引语义')
  }
}

function checkCurrentRuleRouting() {
  const files = [
    'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'agent-skills/README.md',
    'docs/docs-system.md', 'docs/wishlist.md', 'docs/requirements/README.md',
  ]
  for (const name of files) {
    const file = path.join(root, name)
    if (!fs.existsSync(file)) continue
    const text = read(file)
    if (/权威(?:规则)?[^\n]*CLAUDE\.md|canonical source[^\n]*CLAUDE\.md/i.test(text)) {
      errors.push(`${name} 不能把 CLAUDE.md 描述为规则 canonical source`)
    }
  }
}

function checkLedgerShape() {
  const changelog = read(path.join(root, 'docs', 'changelog.md'))
  if (!changelog.trimStart().startsWith('# 变更日志')) errors.push('docs/changelog.md 必须以一级标题开始')
  const progress = read(path.join(root, 'docs', 'progress.md'))
  if (!progress.includes('当前状态') || !progress.includes('下一步')) warnings.push('docs/progress.md 缺少当前状态或下一步入口')
  const wishlist = read(path.join(root, 'docs', 'wishlist.md'))
  if (/^- \[x\]/m.test(wishlist)) warnings.push('docs/wishlist.md 仍包含已完成项；完成项应迁入归档快照')
  const feedback = read(path.join(root, 'docs', 'rules-feedback.md'))
  if (/^### #\d+/m.test(feedback) && !/^## 待审视/m.test(feedback)) warnings.push('docs/rules-feedback.md 存在反馈条目但缺少待审视区')
}

const files = markdownFiles()
checkLinks(files)
checkHeadings(files)
checkDecisions(files)
checkRequirements()
checkWishlist()
checkModuleDecisionIndexes()
checkContractCloseout()
checkArchitecture()
checkCurrentRuleRouting()
checkLedgerShape()

for (const warning of warnings) console.warn(`WARN ${warning}`)
if (errors.length) {
  console.error(`文档检查失败：${errors.length} 个错误`)
  for (const error of errors) console.error(`ERROR ${error}`)
  process.exitCode = 1
} else {
  console.log(`文档检查通过：${files.length} 份活跃 Markdown，无结构错误${warnings.length ? `，${warnings.length} 个提醒` : ''}`)
}
