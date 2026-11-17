/**
 * 工作区根目录管理
 *
 * 维护当前项目的工作区根路径，供沙箱策略、文件工具、Git 工具等模块读取。
 */

let workspaceRoot: string | undefined

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root
}

export function getWorkspaceRoot(): string | undefined {
  return workspaceRoot
}
