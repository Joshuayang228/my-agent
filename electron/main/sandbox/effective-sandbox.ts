/**
 * 由对话页审批模式推导「有效沙箱」。
 *
 * 背景：沙箱主入口是 Chat 输入区审批菜单（executionMode），不是设置页全局项。
 * 设计意图：confirm-all / auto → 工作区写入；full-access → 放开路径限制。
 * 关键约束：工具层必须用本函数结果，禁止再只读 settings.sandboxMode 当真相。
 */

import type { ExecutionMode } from '../../../src/shared/types'
import type { SandboxMode } from './policy'
import * as settings from '../storage/settings-store'

export const EFFECTIVE_SANDBOX_BY_EXECUTION_MODE: Readonly<Record<ExecutionMode, SandboxMode>> = {
  auto: 'workspace-write',
  'confirm-all': 'workspace-write',
  'plan-first': 'workspace-write',
  'full-access': 'full-access',
}

/**
 * @param executionMode 对话页审批模式（settings.executionMode / Loop 注入值）
 * @returns 工具真正用来拦写入 / 命令的沙箱档
 */
export function resolveEffectiveSandbox(executionMode: string | undefined): SandboxMode {
  if (executionMode && Object.prototype.hasOwnProperty.call(EFFECTIVE_SANDBOX_BY_EXECUTION_MODE, executionMode)) {
    return EFFECTIVE_SANDBOX_BY_EXECUTION_MODE[executionMode as ExecutionMode]
  }
  return 'workspace-write'
}

/** 工具执行时读取当前对话页模式并解析有效沙箱 */
export async function loadEffectiveSandbox(): Promise<SandboxMode> {
  const executionMode = await settings.getSetting('executionMode')
  return resolveEffectiveSandbox(executionMode)
}
