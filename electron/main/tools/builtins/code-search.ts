import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger, hashForLog } from '../../utils/logger'
import { checkFileReadSandbox, isPathInsideRoot, resolveToolFilePath, resolveToolReadPath } from '../../sandbox/file-path-guard'
import { loadEffectiveSandbox } from '../../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../../agent/project-memory'
import type { ToolContext } from '../../../../src/shared/types'

const log = createLogger('CodeSearch')

const MAX_RESULTS = 50
const MAX_RESULT_CHARS = 60_000
const MAX_QUERY_LENGTH = 2_000
const MAX_REGEX_QUERY_LENGTH = 512
const CONTEXT_LINES = 2

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', 'build',
  '.next', '.nuxt', '__pycache__', '.venv', 'venv',
  'coverage', '.cache', '.turbo', '.output',
])

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.vue', '.svelte', '.astro',
  '.html', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.md', '.mdx', '.txt',
  '.sql', '.graphql', '.gql',
  '.sh', '.bash', '.zsh', '.ps1',
  '.env', '.env.example', '.gitignore', '.dockerignore',
  'Dockerfile', 'Makefile',
])

interface SearchMatch {
  file: string
  line: number
  text: string
  context: string[]
}

async function walkDir(dir: string, fileExt?: string): Promise<string[]> {
  const files: string[] = []

  async function recurse(current: string, depth: number) {
    if (depth > 10) return
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && IGNORE_DIRS.has(entry.name)) continue
      if (IGNORE_DIRS.has(entry.name)) continue

      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await recurse(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        const nameMatch = CODE_EXTENSIONS.has(entry.name)
        const extMatch = CODE_EXTENSIONS.has(ext)
        if (!nameMatch && !extMatch) continue
        if (fileExt && ext !== fileExt && entry.name !== fileExt) continue
        files.push(fullPath)
      }
    }
  }

  await recurse(dir, 0)
  return files
}

async function searchFile(
  filePath: string,
  pattern: RegExp,
  maxResults: number,
): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = []
  try {
    const stat = await fs.stat(filePath)
    if (stat.size > 512 * 1024) return matches

    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
      if (pattern.test(lines[i])) {
        const start = Math.max(0, i - CONTEXT_LINES)
        const end = Math.min(lines.length, i + CONTEXT_LINES + 1)
        const context = lines.slice(start, end).map((l, idx) => {
          const lineNum = start + idx + 1
          const marker = lineNum === i + 1 ? '>' : ' '
          return `${marker} ${lineNum}: ${l}`
        })

        matches.push({
          file: filePath,
          line: i + 1,
          text: lines[i].trim(),
          context,
        })
      }
    }
  } catch {
    /* skip unreadable files */
  }
  return matches
}

export const codeSearchTool = buildTool({
  name: 'code_search',
  description: "在当前工作区内的目录中搜索代码文件；非“完全访问”模式不能搜索工作区外或受保护目录。\n\n适用场景：\n- 查找函数、类或变量的定义位置\n- 定位某个标识符的所有用法和引用\n- 搜索 import 语句、API 调用或特定模式\n- 探索不熟悉的代码库并理解其结构\n- 查找包含特定关键词或模式的文件\n- 定位配置值、错误消息或 TODO\n\n不适用场景：\n- 读取完整文件内容（请使用 file_read）\n- 已知准确文件和行号（直接读取该文件）\n- 搜索非常大的结果集（本工具最多返回 50 个匹配；达到上限时请细化查询）\n\n特性：\n- 默认不区分大小写（需要区分时设置 case_sensitive=\"true\"）\n- 同时支持普通文本和正则表达式（正则模式设置 is_regex=\"true\"）\n- 每个匹配项显示前后各 2 行上下文\n- 自动跳过常见忽略目录（node_modules、.git、dist 等）\n- 只搜索代码、配置和文档文件\n\n返回：最多 50 个匹配项，包含文件路径、行号和上下文；超过 60,000 个字符时截断。",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "搜索模式，可以是普通文本；设置 is_regex=true 后可使用正则表达式。",
      },
      directory: {
        type: 'string',
        description: "要搜索的根目录，默认为当前工作目录。",
      },
      file_extension: {
        type: 'string',
        description: "可选文件扩展名过滤器，例如 .ts 或 .py；只搜索该扩展名。",
      },
      is_regex: {
        type: 'string',
        description: "设为 true 时将 query 作为正则表达式；默认 false，按普通文本搜索。",
      },
      case_sensitive: {
        type: 'string',
        description: "设为 true 时区分大小写；默认 false，不区分大小写。",
      },
    },
    required: ['query'],
  },
  inputExamples: [
    { query: 'buildSystemPrompt' },
    { query: 'export function \\w+', file_extension: '.ts', is_regex: 'true' },
  ],
  metadata: {
    isReadOnly: true,
    isConcurrencySafe: true,
  },
  execute: async (args, ctx?: ToolContext) => {
    const query = args.query as string
    if (!query?.trim()) return '错误：必须提供搜索查询'
    const isRegex = String(args.is_regex) === 'true'
    if (query.length > (isRegex ? MAX_REGEX_QUERY_LENGTH : MAX_QUERY_LENGTH)) {
      return `错误：搜索查询过长（正则最多 ${MAX_REGEX_QUERY_LENGTH} 个字符，普通查询最多 ${MAX_QUERY_LENGTH} 个字符）`
    }
    if (isRegex && hasUnsafeRegexShape(query)) {
      return '错误：正则表达式包含可能导致主进程长时间阻塞的嵌套量词或反向引用'
    }

    const workspaceRoot = ctx?.workdir?.trim() || getWorkspaceRoot()
    const dir = resolveToolFilePath((args.directory as string) || '.', workspaceRoot)
    const realDir = resolveToolReadPath(dir)
    if (!realDir) return '错误：搜索目录不存在或无法解析'
    const mode = await loadEffectiveSandbox()
    const blocked = checkFileReadSandbox(realDir, mode, workspaceRoot)
    if (blocked) {
      log.warn('Code search blocked by sandbox', { directoryHash: hashForLog(realDir), mode })
      return blocked
    }
    const fileExt = (args.file_extension as string) || undefined
    const caseSensitive = String(args.case_sensitive) === 'true'

    log.info('Code search', { queryHash: hashForLog(query), queryLength: query.length, directoryHash: hashForLog(realDir), fileExt, isRegex, caseSensitive })

    let pattern: RegExp
    try {
      const flags = caseSensitive ? '' : 'i'
      pattern = isRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags)
    } catch (err) {
      return `错误：正则表达式无效—— ${err instanceof Error ? err.message : String(err)}`
    }

    const files = (await walkDir(realDir, fileExt)).map(file => resolveToolReadPath(file))
      .filter((file): file is string => Boolean(file) && isPathInsideRoot(file, realDir))
      .filter(file => checkFileReadSandbox(file, mode, realDir) === null)
    log.info(`Scanning ${files.length} files`)

    const allMatches: SearchMatch[] = []
    for (const file of files) {
      if (allMatches.length >= MAX_RESULTS) break
      const remaining = MAX_RESULTS - allMatches.length
      const matches = await searchFile(file, pattern, remaining)
      allMatches.push(...matches)
    }

    if (allMatches.length === 0) {
      return `未找到匹配项： "${query}"；已搜索 ${realDir} 下的 ${files.length} 个文件`
    }

    let output = `在 ${new Set(allMatches.map(m => m.file)).size} 个文件中找到 ${allMatches.length} 个匹配项：\n\n`

    for (const match of allMatches) {
      const relPath = path.relative(realDir, match.file)
      output += `--- ${relPath}:${match.line} ---\n`
      output += match.context.join('\n') + '\n\n'
    }

    if (output.length > MAX_RESULT_CHARS) {
      output = output.slice(0, MAX_RESULT_CHARS) + `\n\n[... 已截断，仅显示前 ${MAX_RESULT_CHARS} 个字符]`
    }

    return output
  },
})

export function hasUnsafeRegexShape(pattern: string): boolean {
  // JS RegExp 在主进程同步执行；限制最常见的灾难性回溯形状，避免模型生成的查询
  // 长时间占住 Electron 主线程。复杂正则应拆成多次普通搜索。
  return /(?:\([^)]*[+*][^)]*\))[+*?]|(?:\.\*|\.\+).*?(?:\.\*|\.\+)|\\[1-9]/.test(pattern)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
