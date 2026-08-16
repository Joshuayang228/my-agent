#!/usr/bin/env node
/**
 * 只读文档自进化复盘扫描器。
 *
 * 背景：docs:check 能阻止结构错误，但不能定期发现重复真相源、代码变更漏同步和长期维护债务。
 * 设计意图：采集证据并生成报告，供 AI 做语义复盘；不修改任何 canonical 文档、规则、决策或产品代码。
 * 关键约束：不读取 `.tmp/`、`.env`、运行报告或用户数据；产物只写入 ignored 的 `var/docs-self-review/`。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outputDir = path.join(root, 'var', 'docs-self-review')
const now = new Date().toISOString()
const args = process.argv.slice(2)
const sinceArg = args.find((arg) => arg.startsWith('--since='))?.slice('--since='.length)

function runGit(gitArgs, fallback = '') {
  try {
    return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }).trim()
  } catch {
    return fallback
  }
}

function runNpm(args) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  try {
    const stdout = execFileSync(npm, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? ''
    const stderr = error?.stderr?.toString?.() ?? ''
    return { ok: false, output: `${stdout}\n${stderr}`.trim() }
  }
}

function activeMarkdownFiles() {
  const result = []
  const ignored = new Set(['.git', 'node_modules', '_archive', '_reference', '.tmp', 'var'])
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile() && entry.name.endsWith('.md')) result.push(file)
    }
  }
  for (const dir of ['docs', 'methodology', 'agent-skills']) {
    const full = path.join(root, dir)
    if (fs.existsSync(full)) visit(full)
  }
  for (const file of ['AGENTS.md', 'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md']) {
    const full = path.join(root, file)
    if (fs.existsSync(full)) result.push(full)
  }
  return [...new Set(result)]
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
}

function defaultSince() {
  const candidate = runGit(['rev-parse', '--verify', 'HEAD~10'])
  if (candidate) return candidate
  return runGit(['rev-parse', '--verify', 'HEAD~1'], runGit(['rev-parse', 'HEAD']))
}

function changedFiles(since, head) {
  if (!since || !head || since === head) return []
  const output = runGit(['diff', '--name-status', `${since}..${head}`])
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const [status, ...names] = line.split(/\s+/)
    return { status, path: names.at(-1) }
  })
}

function addFinding(findings, type, severity, title, evidence, route) {
  findings.push({ type, severity, title, evidence, route })
}

function collectImpactFindings(files, findings) {
  const paths = files.map((file) => file.path)
  const source = paths.filter((file) => /^(electron|src|__tests__|evals)\//.test(file))
  if (!source.length) return
  const requireDoc = (doc, reason) => {
    if (!paths.includes(doc)) addFinding(findings, 'missing-sync', 'P1', `代码变更未同步 ${doc}`, reason, doc)
  }
  if (source.some((file) => /^(electron|src)\//.test(file))) {
    requireDoc('docs/progress.md', '产品代码变更需要确认当前阶段是否变化')
    requireDoc('docs/changelog.md', '产品代码变更需要确认用户 / 开发者可感知变化')
  }
  for (const file of source) {
    if (/^electron\/main\/companion\//.test(file)) requireDoc('docs/modules/companion.md', '伙伴入口变化需要复核伙伴模块卡')
    if (/^electron\/main\/(storage|memory)\//.test(file) || /profile-extractor|memory-manage/.test(file)) requireDoc('docs/modules/memory.md', '记忆入口变化需要复核记忆模块卡')
    if (/^electron\/main\/sandbox\//.test(file) || /tools\/builtins\/(shell-exec|file-(read|write|edit|delete)|apply-patch)/.test(file)) requireDoc('docs/modules/permission.md', '权限 / 沙箱入口变化需要复核权限模块卡')
    if (/^electron\/main\/(agent|llm|tools|mcp|ipc|services|scheduler)\//.test(file)) {
      requireDoc('docs/modules/agent-runtime.md', '运行时链路变化需要复核运行时模块卡')
      requireDoc('docs/architecture.md', '跨层入口变化需要复核 Architecture')
    }
    if (/^__tests__\//.test(file) || /^evals\//.test(file)) requireDoc('docs/quality.md', '测试 / Eval 契约变化需要复核 Quality')
  }
}

function collectDuplicateCandidates(files, findings) {
  const occurrences = new Map()
  for (const file of files) {
    const lines = read(file).split(/\r?\n/)
    let inCode = false
    for (const [index, raw] of lines.entries()) {
      if (raw.trim().startsWith('```')) { inCode = !inCode; continue }
      const line = raw.trim()
      if (inCode || line.length < 80 || line.startsWith('#') || line.startsWith('|') || line.startsWith('>')) continue
      const normalized = line.replace(/\s+/g, ' ')
      if (!occurrences.has(normalized)) occurrences.set(normalized, [])
      occurrences.get(normalized).push(`${relative(file)}:${index + 1}`)
    }
  }
  for (const [line, locations] of occurrences) {
    const uniqueFiles = new Set(locations.map((location) => location.split(':')[0]))
    if (uniqueFiles.size >= 2) {
      addFinding(findings, 'duplicate-candidate', 'P2', '发现跨文档重复长句候选', `${line}；位置：${locations.join('、')}`, '人工判断后回流对应 canonical source')
    }
  }
}

function collectLargeDocuments(findings) {
  const docsDir = path.join(root, 'docs')
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '_archive') continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        const lines = read(file).split(/\r?\n/).length
        if (lines > 500) addFinding(findings, 'large-document', 'P3', '活跃文档超过 500 行', `${relative(file)}：${lines} 行`, '评估是否应拆分、归档或改为索引')
      }
    }
  }
  if (fs.existsSync(docsDir)) visit(docsDir)
}

function collectLifecycleMetrics() {
  const requirements = fs.readdirSync(path.join(root, 'docs', 'requirements')).filter((file) => file.endsWith('.md') && file !== 'README.md')
  const inProgress = []
  const frozen = []
  for (const name of requirements) {
    const text = read(path.join(root, 'docs', 'requirements', name))
    if (/状态[^\n]*进行中/.test(text)) inProgress.push(name)
    else if (/生命周期：已完成施工快照（冻结）/.test(text)) frozen.push(name)
  }
  const wishlist = read(path.join(root, 'docs', 'wishlist.md'))
  const wishlistOpen = [...wishlist.matchAll(/^- \[ \]/gm)].length
  const feedback = read(path.join(root, 'docs', 'rules-feedback.md'))
  const pendingFeedback = [...feedback.matchAll(/^### #/gm)].length
  return { requirements: { inProgress, frozen }, wishlistOpen, pendingFeedback }
}

const head = runGit(['rev-parse', 'HEAD'])
const since = sinceArg || defaultSince()
const files = changedFiles(since, head)
const findings = []
const docsCheck = runNpm(['run', 'docs:check'])
if (!docsCheck.ok) addFinding(findings, 'docs-check', 'P1', 'docs:check 未通过', docsCheck.output.slice(-3000), '先修复 docs:check 报告中的结构问题')
collectImpactFindings(files, findings)
collectDuplicateCandidates(activeMarkdownFiles(), findings)
collectLargeDocuments(findings)

const report = {
  schemaVersion: 1,
  generatedAt: now,
  head,
  since,
  commitCount: runGit(['rev-list', '--count', `${since}..${head}`], '0'),
  changedFiles: files,
  docsCheck: { ok: docsCheck.ok, output: docsCheck.output },
  lifecycle: collectLifecycleMetrics(),
  findings,
  safety: {
    readOnly: true,
    canonicalDocumentsModified: false,
    userDataRead: false,
    credentialsRead: false,
    outputDirectory: 'var/docs-self-review',
  },
}

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
const markdown = [
  '# 文档自进化复盘报告',
  '',
  `- 生成时间：${now}`,
  `- 当前提交：${head || '[未知]'}`,
  `- 对比起点：${since || '[未知]'}`,
  `- 提交数量：${report.commitCount}`,
  `- 活跃 Wishlist：${report.lifecycle.wishlistOpen} 项`,
  `- 待审视规则反馈：${report.lifecycle.pendingFeedback} 项`,
  `- 施工合同：进行中 ${report.lifecycle.requirements.inProgress.length}，冻结 ${report.lifecycle.requirements.frozen.length}`,
  `- docs:check：${docsCheck.ok ? '通过' : '失败'}`,
  '',
  '## 变更范围',
  ...(files.length ? files.map((file) => `- ${file.status} ${file.path}`) : ['- 本次范围内没有新提交变更']),
  '',
  '## 发现候选',
  ...(findings.length ? findings.map((finding, index) => `### ${index + 1}. [${finding.severity}] ${finding.title}\n\n- 类型：${finding.type}\n- 证据：${finding.evidence}\n- 建议去向：${finding.route}`) : ['暂无静态发现候选。']),
  '',
  '## 安全边界',
  '- 本报告由只读脚本生成，不修改 canonical 文档。',
  '- 未读取 `.tmp/`、`.env`、用户记忆、运行报告或隐藏 reasoning。',
  '- 重复长句只是候选，必须由 AI / 人工判断是否真的存在双真相源。',
  '',
].join('\n')
fs.writeFileSync(path.join(outputDir, 'latest.md'), `${markdown}\n`, 'utf8')
console.log(`文档自进化复盘完成：${path.relative(root, path.join(outputDir, 'latest.md')).replaceAll(path.sep, '/')}`)
console.log(`候选数：${findings.length}；对比 ${since || '[未知]'}..${head || '[未知]'}`)
