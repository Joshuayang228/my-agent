#!/usr/bin/env node
/**
 * 安装仓库自带 Git hooks。
 *
 * 背景：Git 默认不提交 `.git/hooks`，团队成员和 CI 无法共享本地 hook。
 * 设计意图：把 hooks 放在版本库的 `.githooks/`，通过 core.hooksPath 让 npm prepare 自动启用。
 * 关键约束：没有 Git 元数据时安全跳过；只修改当前仓库的本地 Git 配置，不写用户全局配置。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
if (!fs.existsSync(path.join(root, '.git'))) {
  console.log('Git hooks：当前目录没有 .git，跳过安装。')
  process.exit(0)
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'inherit' })
console.log('Git hooks：已启用 .githooks/。')
