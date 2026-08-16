const MAX_INLINE_MARKDOWN_IMAGE_LENGTH = 2 * 1024 * 1024

/**
 * Markdown 只允许内联位图，不自动加载远程图片。
 *
 * 背景：模型回复可控 Markdown；若直接渲染 https 图片，模型可以把对话或工具输出编码进
 * URL，让 Renderer 在无用户点击时向第三方发请求。设计意图：远程图片降级为显式链接，
 * 由用户决定是否在系统浏览器打开。关键约束：不允许 SVG data URL，避免扩大主动内容面。
 */
export function isSafeMarkdownImageSource(src: string | undefined): boolean {
  if (!src || src.length > MAX_INLINE_MARKDOWN_IMAGE_LENGTH) return false
  return /^data:image\/(?:png|jpeg|gif|webp|bmp|x-icon);base64,/i.test(src)
}
