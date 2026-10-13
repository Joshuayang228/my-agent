import ts from 'typescript'

export function inlinePromptMessages(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const errors: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = node.properties.filter(ts.isPropertyAssignment)
      const role = properties.find(p => p.name.getText(source) === 'role')?.initializer
      const content = properties.find(p => p.name.getText(source) === 'content')?.initializer
      // 注册模板的占位样本只用于展开构造器，没有固定指令正文。
      if (content && ts.isStringLiteral(content) && /^\{\{\w+\}\}$/.test(content.text)) return
      if (role && ts.isStringLiteral(role) && ['system', 'user'].includes(role.text) && content
        && (ts.isStringLiteral(content) || ts.isNoSubstitutionTemplateLiteral(content) || ts.isTemplateExpression(content))) {
        errors.push(`${file}:${source.getLineAndCharacterOfPosition(content.getStart()).line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}

/**
 * 背景：只检查 key 是否出现，无法发现新正文或误登记其他资产。
 * 意图：按 AST 找到生产定义，并沿消息变量回溯到它的实际资产所有者。
 * 约束：不执行被扫描代码；输入数据不要求登记，正文生产者必须用 Prompt 命名并登记符号。
 */
export function promptDefinitions(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const found: string[] = []
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body
      && /Prompt|SystemAddon/.test(node.name.text)
      && (/^(string|Promise<string)/.test(node.type?.getText(source) ?? '') || /^(build|compile|format|default|load)/.test(node.name.text))) {
      found.push(`${file}#${node.name.text}`)
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && /_PROMPT$|^DEFAULT_PLAYGROUND_SYSTEM$/.test(declaration.name.text)
          && declaration.initializer && !ts.isNumericLiteral(declaration.initializer)) {
          found.push(`${file}#${declaration.name.text}`)
        }
        if (ts.isIdentifier(declaration.name) && /Prompt|SystemAddon/.test(declaration.name.text)
          && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
          const functionNode = declaration.initializer
          if (/^(string|Promise<string)/.test(functionNode.type?.getText(source) ?? '')
            || /^(build|compile|format|default|load)/.test(declaration.name.text)
            || ts.isStringLiteral(functionNode.body) || ts.isTemplateExpression(functionNode.body)) found.push(`${file}#${declaration.name.text}`)
        }
      }
    }
  }
  return found
}

export function auditCallBindings(file: string, text: string, owners: Map<string, string[]>): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const imports = new Map<string, string>()
  const variables = new Map<string, ts.Expression>()
  const visitDeclarations = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const segments = file.split('/'); segments.pop()
      for (const part of node.moduleSpecifier.text.split('/')) {
        if (part === '..') segments.pop()
        else if (part !== '.') segments.push(part)
      }
      const from = segments.join('/') + '.ts'
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        imports.set(item.name.text, `${from}#${item.propertyName?.text ?? item.name.text}`)
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer)
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      for (const element of node.name.elements) if (ts.isIdentifier(element.name)) variables.set(element.name.text, node.initializer)
    }
    ts.forEachChild(node, visitDeclarations)
  }
  visitDeclarations(source)
  const errors: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /^(streamChat|chatComplete)$/.test(node.expression.getText(source))) {
      const options = node.arguments[0]
      if (options && ts.isObjectLiteralExpression(options)) {
        const keyExpressions: string[] = []
        const findKeys = (child: ts.Node) => {
          if (ts.isPropertyAssignment(child) && child.name.getText(source) === 'promptAssetKeys') keyExpressions.push(child.initializer.getText(source))
          else ts.forEachChild(child, findKeys)
        }
        findKeys(options)
        const declared = keyExpressions.join('\n')
        const seen = new Set<string>()
        const collect = (child: ts.Node, inContent = false) => {
          if (ts.isPropertyAssignment(child) && /^(promptAssetKeys|promptlessReason)$/.test(child.name.getText(source))) return
          if (ts.isPropertyAssignment(child)) {
            collect(child.initializer, /^(content|systemPrompt)$/.test(child.name.getText(source)))
            return
          }
          if (ts.isAsExpression(child)) { collect(child.expression, inContent); return }
          if (ts.isConditionalExpression(child)) { collect(child.whenTrue, inContent); collect(child.whenFalse, inContent); return }
          if (inContent && (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child) || ts.isTemplateExpression(child))) {
            if (child.getText(source).slice(1, -1).trim()) errors.push(`${file}:${source.getLineAndCharacterOfPosition(child.getStart()).line + 1} unregistered literal`)
            return
          }
          if (ts.isCallExpression(child) && ts.isIdentifier(child.expression)) {
            const reference = imports.get(child.expression.text) ?? `${file}#${child.expression.text}`
            const required = owners.get(reference)
            if (required) {
              if (!required.some(key => declared.includes(`PROMPT_KEYS.${key}`))) errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${reference}`)
              return
            }
          }
          if (ts.isIdentifier(child) && !seen.has(child.text)) {
            seen.add(child.text)
            const reference = imports.get(child.text) ?? `${file}#${child.text}`
            const required = owners.get(reference)
            if (required && !required.some(key => declared.includes(`PROMPT_KEYS.${key}`))) errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${reference}`)
            const variable = variables.get(child.text)
            if (variable) collect(variable, inContent)
          }
          ts.forEachChild(child, item => collect(item, inContent))
        }
        collect(options)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}
