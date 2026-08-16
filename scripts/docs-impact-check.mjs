#!/usr/bin/env node
/**
 * 根据 staged 文件给出文档影响门禁。
 *
 * 背景：代码和测试变更往往需要同步模块卡、架构、质量和账本，但仅靠 Agent 记忆容易漏项。
 * 设计意图：对明确的目录边界做机械映射；产品语义和“是否真的完成”仍交给人工判断。
 * 关键约束：只读取 git index，不修改文件；使用 `--no-verify` 的显式绕过由 Git 本身记录。
 */

import { execFileSync } from 'node:child_process'

function stagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], { encoding: 'utf8' })
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

const files = stagedFiles()
const sourceFiles = files.filter((file) => /^(electron|src|__tests__|evals)\//.test(file))
if (!sourceFiles.length) {
  console.log('变更影响检查：本次没有 staged 产品代码、测试或 Eval 文件，跳过路径映射。')
  process.exit(0)
}

const required = new Map()
const recommended = new Map()
function requireDoc(file, reason) { required.set(file, reason) }
function recommendDoc(file, reason) { if (!required.has(file)) recommended.set(file, reason) }

const productCode = sourceFiles.some((file) => /^(electron|src)\//.test(file))
if (productCode) {
  requireDoc('docs/progress.md', '产品代码变更需要更新当前阶段或明确说明无需更新')
  requireDoc('docs/changelog.md', '产品代码变更需要检查用户 / 开发者可感知变化')
}

for (const file of sourceFiles) {
  if (/^electron\/main\/companion\//.test(file)) {
    requireDoc('docs/modules/companion.md', '伙伴运行时入口变化需要复核伙伴模块卡')
    recommendDoc('docs/quality.md', '伙伴行为变化需要复核 Persona / Eval 门禁')
  }
  if (/^electron\/main\/(storage|memory)\//.test(file) || /profile-extractor|memory-manage/.test(file)) {
    requireDoc('docs/modules/memory.md', '记忆存储、召回或画像入口变化需要复核记忆模块卡')
    recommendDoc('docs/quality.md', '记忆行为变化需要复核质量门禁')
  }
  if (/^electron\/main\/sandbox\//.test(file) || /tools\/builtins\/(shell-exec|file-(read|write|edit|delete)|apply-patch)/.test(file)) {
    requireDoc('docs/modules/permission.md', '权限、沙箱或文件工具变化需要复核权限模块卡')
    requireDoc('docs/quality.md', '安全边界变化需要复核质量门禁')
  }
  if (/^electron\/main\/(agent|llm|tools|mcp|ipc|services|scheduler)\//.test(file)) {
    requireDoc('docs/modules/agent-runtime.md', '运行时、LLM、工具、MCP、IPC 或任务服务变化需要复核运行时模块卡')
    requireDoc('docs/architecture.md', '跨层入口或数据流变化需要复核系统架构')
    recommendDoc('docs/quality.md', '运行时链路变化需要复核质量分层')
  }
  if (/^src\/components\/playground\//.test(file)) {
    recommendDoc('docs/requirements/playground-bilingual-ui-vocabulary.md', 'Playground 目录变化需要确认当前 UI 施工合同范围')
    recommendDoc('docs/quality.md', 'Playground 交互变化需要复核 UI E2E')
  }
  if (/^__tests__\//.test(file) || /^evals\//.test(file)) {
    requireDoc('docs/quality.md', '测试或 Eval 契约变化需要更新质量门禁或确认无需更新')
  }
}

const missing = [...required.keys()].filter((file) => !files.includes(file))
console.log('变更影响检查：')
for (const file of sourceFiles) console.log(`- ${file}`)
console.log('必须复核：')
for (const [file, reason] of required) console.log(`- ${file}：${reason}`)
if (recommended.size) {
  console.log('建议复核：')
  for (const [file, reason] of recommended) console.log(`- ${file}：${reason}`)
}
if (missing.length) {
  console.error('变更影响检查失败：以下必须复核文档没有 staged：')
  for (const file of missing) console.error(`ERROR ${file}`)
  process.exit(1)
}
console.log('变更影响检查通过：所有必须复核文档已 staged。')
