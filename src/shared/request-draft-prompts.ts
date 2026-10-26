/** 用户可编辑的请求预填；主进程目录与 Renderer 读取同一生产正文，不等于自动发送或 System 指令。 */
export function buildImageDraftPrompt(): string {
  return '请生成一张图片：'
}

export function buildWorldAssetImageDraftPrompt(asset: { name: string; id: string }): string {
  return `请为人物世界资产“${asset.name}”生成一张图片。资产 ID：${asset.id}。生成后请使用 image_generate 的 targetAssetId 绑定到这个资产。`
}
