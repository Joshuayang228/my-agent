import ts from 'typescript'

/** 背景：新函数可借私有签发器套用已有 key；意图：签发调用必须归属真实登记的函数；约束：签发器不能被导出、赋值成别名或作为回调暴露。 */
export function auditSigningDefinitions(file: string, text: string, registered: Set<string>): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const errors: string[] = []
  const signers = new Set(['signSystem', 'signRequest'])
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && signers.has(node.text)) {
      const parent = node.parent
      const declaration = ts.isFunctionDeclaration(parent) && parent.name === node
      const call = ts.isCallExpression(parent) && parent.expression === node
      if (declaration) {
        if (parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) errors.push(`${file} 签发器不能公开`)
      } else if (call) {
        let owner: ts.Node | undefined = parent.parent
        while (owner && !ts.isFunctionDeclaration(owner) && !ts.isArrowFunction(owner) && !ts.isFunctionExpression(owner)) owner = owner.parent
        const name = owner && ts.isFunctionDeclaration(owner) ? owner.name?.text
          : owner && ts.isVariableDeclaration(owner.parent) && ts.isIdentifier(owner.parent.name) ? owner.parent.name.text : undefined
        if (!name || !registered.has(`${file}#${name}`)) errors.push(`${file}#${name ?? 'anonymous'} 签发函数未登记`)
      } else errors.push(`${file} 签发器只能由登记配方直接调用`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}

/**
 * 背景：字符串搜索漏掉重命名 import、namespace 调用与 options 变量。
 * 意图：沿本文件绑定回溯真正的模型函数和请求来源，而不是只认函数拼写。
 * 约束：这是一道静态防遗漏门；最终真实性仍由模型入口私有身份表校验。
 */
export function auditRegisteredCalls(file: string, text: string, recipes: Set<string>): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const bindings = new Map<string, string>()
  const namespaces = new Map<string, string>()
  const variables = new Map<string, ts.Expression>()
  const errors: string[] = []
  const line = (node: ts.Node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`
  const definitions = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const from = node.moduleSpecifier.text
      const imported = node.importClause?.namedBindings
      if (imported && ts.isNamedImports(imported)) for (const entry of imported.elements) {
        const name = entry.propertyName?.text ?? entry.name.text
        bindings.set(entry.name.text, `${from}#${name}`)
        if (file.startsWith('electron/main/') && /registered-request$/.test(from) && /^compileEval/.test(name)) errors.push(`${line(entry)} 生产模块不能使用 Eval 签发入口`)
        if (file.startsWith('electron/main/') && /registered-request$/.test(from) && name === 'compileContextMessage' && file !== 'electron/main/agent/context-manager.ts') errors.push(`${line(entry)} 压缩恢复系统消息只能由上下文管理器签发`)
      }
      if (imported && ts.isNamespaceImport(imported)) {
        namespaces.set(imported.name.text, from)
        if (file.startsWith('electron/main/') && /registered-request$/.test(from)) errors.push(`${line(imported)} 生产模块必须显式选择注册编译入口`)
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer)
    ts.forEachChild(node, definitions)
  }
  definitions(source)

  const reference = (expr: ts.Expression, seen = new Set<string>()): string | undefined => {
    if (ts.isIdentifier(expr)) {
      if (bindings.has(expr.text)) return bindings.get(expr.text)
      if (seen.has(expr.text)) return undefined
      seen.add(expr.text)
      const value = variables.get(expr.text)
      if (value) return reference(value, seen)
      if (['streamChat', 'chatComplete'].includes(expr.text)) return `model#${expr.text}`
    }
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
      const from = namespaces.get(expr.expression.text)
      if (from) return `${from}#${expr.name.text}`
    }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return reference(expr.right, seen)
    return undefined
  }
  const isRecipe = (expr: ts.Expression, seen = new Set<string>()): boolean => {
    if (ts.isIdentifier(expr)) {
      if (seen.has(expr.text)) return false
      seen.add(expr.text)
      const value = variables.get(expr.text)
      return value ? isRecipe(value, seen) : false
    }
    if (ts.isCallExpression(expr)) {
      const ref = reference(expr.expression)
      return Boolean(ref && /registered-request#/.test(ref) && recipes.has(ref.split('#')[1]))
    }
    return false
  }
  const options = (expr: ts.Expression | undefined, seen = new Set<string>()): ts.ObjectLiteralElementLike[] | undefined => {
    if (!expr) return undefined
    if (ts.isObjectLiteralExpression(expr)) {
      const result: ts.ObjectLiteralElementLike[] = []
      for (const property of expr.properties) {
        if (ts.isSpreadAssignment(property)) {
          const nested = options(property.expression, seen)
          if (!nested) return undefined
          result.push(...nested)
        } else result.push(property)
      }
      return result
    }
    if (ts.isIdentifier(expr) && !seen.has(expr.text)) {
      seen.add(expr.text)
      return options(variables.get(expr.text), seen)
    }
    return undefined
  }
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /#(?:streamChat|chatComplete)$/.test(reference(node.expression) ?? '')) {
      const props = options(node.arguments[0])
      const request = props?.find(p => p.name?.getText(source) === 'request')
      const legacy = props?.some(p => /^(messages|promptAssetKeys|promptlessReason)$/.test(p.name?.getText(source) ?? ''))
      const value = request && (ts.isPropertyAssignment(request) ? request.initializer : ts.isShorthandPropertyAssignment(request) ? request.name : undefined)
      if (legacy || !value || !isRecipe(value)) errors.push(`${line(node)} 模型调用必须使用登记配方生成的 request，禁止原始消息与手填来源`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return errors
}
