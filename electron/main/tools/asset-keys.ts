/** Tool / Skill 生产资产稳定 key 工厂。 */
export function toolAssetKey(toolName: string): string {
  return `tool:${toolName}`
}

export function skillAssetKey(skillName: string): string {
  return `skill:${skillName}`
}
