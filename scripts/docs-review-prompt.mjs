#!/usr/bin/env node
/**
 * 把静态复盘报告包装成给 AI 的只读语义复盘提示词。
 *
 * 背景：静态脚本只能发现候选，双真相源和规则演进需要结合上下文判断。
 * 设计意图：让 AI 只输出分类、证据和建议路由；用户批准后才修改 canonical 文档。
 * 关键约束：本脚本只读取复盘 JSON 并写入 ignored 的 `var/docs-self-review/`，不调用模型、不写产品文档。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outputDir = path.join(root, 'var', 'docs-self-review')
const reportPath = path.join(outputDir, 'latest.json')
const promptPath = path.join(outputDir, 'latest-prompt.md')

if (!fs.existsSync(reportPath)) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npm, ['run', 'docs:self-review'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const prompt = `# My Agent 文档自进化语义复盘任务

你是本项目的文档治理审阅 Agent。请基于下面的只读静态复盘报告，并主动读取项目中的当前 canonical source，完成一次语义复盘。

## 强制安全边界

1. 这是只读复盘：不要修改、删除或自动提交任何文件。
2. 不要把 \`_archive/\` 历史快照当作当前事实；当前事实优先看代码、模块卡、Architecture、Quality 和 Decisions。
3. 不要把重复长句直接判定为双真相源；先判断它们是否属于不同职责、不同受众或历史记录。
4. 不要自行修改 \`AGENTS.md\`、模块卡、施工合同、\`docs/decisions.md\`、生产 Prompt、产品代码或测试。
5. 只提出建议路由：规则问题进 \`docs/rules-feedback.md\`，未排期缺口进 \`docs/wishlist.md\`，已接受取舍进 \`docs/decisions.md\`，当前能力进模块卡，历史材料进 \`_archive/audits/\`。
6. 任何可能改变产品方向、安全边界、规则或真相源的建议都标记“需要用户确认”。

## 复盘任务

1. 检查最近变更是否遗漏了对应模块卡、Architecture、Quality、Progress 或 Changelog。
2. 检查静态候选是否真的构成两个真相源，还是职责不同的合理引用。
3. 检查“当前 / 已落地 / 进行中 / 暂缓 / 不做”是否有冲突。
4. 检查施工合同是否有长期未收口项，Wishlist 是否出现重复或来源不明。
5. 检查规则是否在最近变更中被反复绕过；如果是，提出最小规则改进。
6. 对每条建议给出证据、严重度、canonical source 和是否需要用户确认。

## 固定输出格式

### 1. 复盘结论

- 结论：稳定 / 有候选问题 / 必须修复
- 需要用户确认：是 / 否
- 最大风险：

### 2. 真相源候选冲突

| 编号 | 严重度 | 事实 | 证据文件 | 判断 | 建议路由 | 需要确认 |
|---|---|---|---|---|---|---|

### 3. 变更同步缺口

| 编号 | 代码 / 文档变更 | 缺失同步项 | 证据 | 建议 |
|---|---|---|---|---|

### 4. 规则与流程改进

| 编号 | 当前规则 | 失败表现 | 最小改进 | 写入位置 | 需要确认 |
|---|---|---|---|---|---|

### 5. 不建议修改的候选

列出看似重复但职责不同、或属于明确接受风险的内容，并说明原因。

### 6. 待用户确认清单

只列会改变产品方向、规则、技术取舍、权限边界或 canonical source 的动作。

## 静态复盘报告

\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\`
`

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(promptPath, prompt, 'utf8')
console.log(`AI 复盘提示词已生成：${path.relative(root, promptPath).replaceAll(path.sep, '/')}`)
