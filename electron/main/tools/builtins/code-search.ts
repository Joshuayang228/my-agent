import { buildTool } from '../builder'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../utils/logger'

const log = createLogger('CodeSearch')

const MAX_RESULTS = 50
const MAX_RESULT_CHARS = 60_000
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
  description: `Search for text or regex patterns across code files in a directory. Returns matching lines with surrounding context.

When to use:
- Finding where a function, class, or variable is defined
- Locating all usages/references of a specific identifier
- Searching for import statements, API calls, or specific patterns
- Exploring unfamiliar codebases to understand structure
- Finding files that contain specific keywords or patterns
- Locating configuration values, error messages, or TODOs

When NOT to use:
- Reading complete file contents (use file_read instead)
- You already know the exact file and line number (just read that file directly)
- Searching through very large result sets (this tool returns max 50 matches - if you hit the limit, refine your query)

Features:
- Case-insensitive by default (set case_sensitive="true" if needed)
- Supports both literal text and regex patterns (set is_regex="true" for regex)
- Shows 2 lines of context before and after each match
- Automatically skips common ignore directories (node_modules, .git, dist, etc.)
- Searches code, config, and documentation files only

Returns: Up to 50 matches with file paths, line numbers, and context. Truncated at 60,000 characters.`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search pattern. Plain text or regex (set is_regex=true for regex).',
      },
      directory: {
        type: 'string',
        description: 'Root directory to search in. Defaults to current working directory.',
      },
      file_extension: {
        type: 'string',
        description: 'Optional file extension filter, e.g. ".ts" or ".py". Only searches files with this extension.',
      },
      is_regex: {
        type: 'string',
        description: 'Set to "true" to treat query as a regex pattern. Default: false (literal text search).',
      },
      case_sensitive: {
        type: 'string',
        description: 'Set to "true" for case-sensitive search. Default: false (case-insensitive).',
      },
    },
    required: ['query'],
  },
  metadata: {
    isReadOnly: true,
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const query = args.query as string
    if (!query?.trim()) return 'Error: search query is required'

    const dir = path.resolve((args.directory as string) || process.cwd())
    const fileExt = (args.file_extension as string) || undefined
    const isRegex = String(args.is_regex) === 'true'
    const caseSensitive = String(args.case_sensitive) === 'true'

    log.info('Code search', { query, dir, fileExt, isRegex, caseSensitive })

    let pattern: RegExp
    try {
      const flags = caseSensitive ? 'g' : 'gi'
      pattern = isRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags)
    } catch (err) {
      return `Error: invalid regex pattern — ${err instanceof Error ? err.message : String(err)}`
    }

    const files = await walkDir(dir, fileExt)
    log.info(`Scanning ${files.length} files`)

    const allMatches: SearchMatch[] = []
    for (const file of files) {
      if (allMatches.length >= MAX_RESULTS) break
      const remaining = MAX_RESULTS - allMatches.length
      const matches = await searchFile(file, pattern, remaining)
      allMatches.push(...matches)
    }

    if (allMatches.length === 0) {
      return `No matches found for "${query}" in ${files.length} files under ${dir}`
    }

    let output = `Found ${allMatches.length} match(es) across ${new Set(allMatches.map(m => m.file)).size} file(s):\n\n`

    for (const match of allMatches) {
      const relPath = path.relative(dir, match.file)
      output += `--- ${relPath}:${match.line} ---\n`
      output += match.context.join('\n') + '\n\n'
    }

    if (output.length > MAX_RESULT_CHARS) {
      output = output.slice(0, MAX_RESULT_CHARS) + `\n\n[... truncated, showing first ${MAX_RESULT_CHARS} chars]`
    }

    return output
  },
})

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
