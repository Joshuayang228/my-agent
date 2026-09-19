export const BACKUP_IMAGE_ERRORS = {
  missing: '备份包含无法读取的生成图片，请恢复图片文件后重试。',
  changed: '生成图片引用已变化，未导出备份。',
  limit: '备份图片超过 32 张或 16MB，未导出文件。',
  corrupt: '备份图片内容损坏或超出限制，未导入。',
  reference: '备份图片引用无效，未导入。',
  incomplete: '备份缺少图片内容，未导入。',
  directory: '恢复目录已变化，未自动清理。',
  export: '当前数据无法组成完整备份，未导出文件。',
  size: '备份超过 25MB，未写入文件。',
} as const

const publicErrors = new Set<string>(Object.values(BACKUP_IMAGE_ERRORS))

/** IPC 仅放行同源安全文案；未知错误仍不能把路径或底层异常带到设置页。 */
export function backupFailureMessage(action: 'export' | 'import', error: string | undefined): string {
  if (error && publicErrors.has(error)) return error
  return action === 'export' ? '导出失败，请检查保存位置后重试。' : '导入失败，请检查备份文件后重试。'
}
