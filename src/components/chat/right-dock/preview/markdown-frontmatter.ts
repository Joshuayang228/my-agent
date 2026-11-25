/**
 * YAML Frontmatter 拆分与还原纯函数。
 *
 * 背景：ProseMirror / TipTap 所见即所得视图主要编辑 Markdown 正文，若直接把顶部 `---\n...\n---`
 * 喂给 Markdown 解析器会被转成水平线与普通段落，导致 Obsidian / 博客 / Skill 文档的元数据丢失。
 * 设计意图：进入所见即所得视图前剥离头部合法 YAML Frontmatter 块并单独保留，序列化保存时原样拼回；
 * 需要修改 Frontmatter 本身时用户可一键切到「源码」视图直接编辑完整原文。
 * 关键约束：仅识别文件首行以 `---` 开头且闭合 `---` 独占一行的标准 YAML Frontmatter，绝不误伤正文水平线。
 */

const FRONTMATTER_REGEX = /^(---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$))/

export function splitYamlFrontmatter(raw: string): { frontmatter: string; body: string } {
  if (!raw) return { frontmatter: '', body: '' }
  const match = FRONTMATTER_REGEX.exec(raw)
  if (!match) return { frontmatter: '', body: raw }
  const frontmatter = match[1]
  const body = raw.slice(frontmatter.length)
  return { frontmatter, body }
}

export function joinYamlFrontmatter(frontmatter: string, body: string): string {
  if (!frontmatter) return body
  const normalizedFm = frontmatter.endsWith('\n') ? frontmatter : `${frontmatter}\n`
  if (!body) return normalizedFm
  return `${normalizedFm}${body.startsWith('\n') ? '' : '\n'}${body}`
}
