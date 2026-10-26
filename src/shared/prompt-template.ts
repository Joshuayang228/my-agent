/** 仅提取模板占位名，不展开运行时资料，也不根据变量名编造解释。 */
export function extractTemplatePlaceholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g)].map(match => match[1]))]
}
