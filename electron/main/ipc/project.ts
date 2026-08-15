import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as settings from '../storage/settings-store'
import { setWorkspaceRoot } from '../agent/project-memory'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('ProjectIPC')

const MAX_RECENT = 10
const MAX_TREE_DEPTH = 5

interface ProjectInfo {
  path: string
  name: string
}

function pathToName(dirPath: string): string {
  return path.basename(dirPath) || dirPath
}

async function getRecentProjects(): Promise<ProjectInfo[]> {
  const raw = await settings.getSetting('recentProjects')
  if (!raw || raw === '[]') return []
  try {
    const list = JSON.parse(raw) as string[]
    return list
      .filter((p) => fs.existsSync(p))
      .map((p) => ({ path: p, name: pathToName(p) }))
  } catch {
    return []
  }
}

async function addToRecent(dirPath: string): Promise<void> {
  const raw = await settings.getSetting('recentProjects')
  let list: string[] = []
  try { list = raw ? JSON.parse(raw) : [] } catch { /* ignore */ }

  list = list.filter((p) => p !== dirPath)
  list.unshift(dirPath)
  if (list.length > MAX_RECENT) list = list.slice(0, MAX_RECENT)

  await settings.setSetting('recentProjects', JSON.stringify(list))
}

function isPathInsideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveExistingPath(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath)
  } catch {
    return null
  }
}

async function getCurrentProjectRoot(): Promise<string | null> {
  const configured = await settings.getSetting('currentProject')
  if (!configured || !fs.existsSync(configured) || !fs.statSync(configured).isDirectory()) return null
  return resolveExistingPath(configured)
}

function isPathAllowedInProject(filePath: string, projectRoot: string): boolean {
  const resolved = resolveExistingPath(filePath)
  return !!resolved && isPathInsideRoot(resolved, projectRoot)
}

function applyProject(dirPath: string | null): void {
  setWorkspaceRoot(dirPath || '')
  if (dirPath) {
    process.chdir(dirPath)
    log.info('Workspace root set', { pathHash: hashForLog(dirPath) })
  } else {
    log.info('Workspace root cleared')
  }
}

export function registerProjectIPC(): void {
  ipcMain.handle('project:browse', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择项目目录',
      properties: ['openDirectory'],
    })

    if (result.canceled || !result.filePaths.length) return null

    const dirPath = result.filePaths[0]
    await addToRecent(dirPath)
    await settings.setSetting('currentProject', dirPath)
    applyProject(dirPath)

    return { path: dirPath, name: pathToName(dirPath) }
  })

  ipcMain.handle('project:list', async () => {
    return getRecentProjects()
  })

  ipcMain.handle('project:set', async (_e, dirPath: string | null) => {
    if (dirPath !== null && typeof dirPath !== 'string') return { success: false, error: 'Invalid directory' }
    if (dirPath) {
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return { success: false, error: 'Directory not found' }
      const resolvedDir = resolveExistingPath(dirPath)
      if (!resolvedDir) return { success: false, error: 'Directory not found' }
      dirPath = resolvedDir
      await addToRecent(dirPath)
      await settings.setSetting('currentProject', dirPath)
      applyProject(dirPath)
    } else {
      await settings.setSetting('currentProject', '')
      applyProject(null)
    }
    return { success: true }
  })

  ipcMain.handle('project:get', async () => {
    const dirPath = await settings.getSetting('currentProject')
    if (!dirPath) return null
    if (!fs.existsSync(dirPath)) return null
    // 启动后仅读设置不会 set workspace；这里恢复主进程工作区，避免沙箱/相对路径漂移
    applyProject(dirPath)
    return { path: dirPath, name: pathToName(dirPath) }
  })

  ipcMain.handle('project:listFiles', async (_e, dirPath: string, depth = 2) => {
    if (typeof dirPath !== 'string' || !dirPath) return []
    const root = await getCurrentProjectRoot()
    if (!root || !isPathAllowedInProject(dirPath, root)) return []
    const safeDepth = typeof depth === 'number' && Number.isFinite(depth)
      ? Math.min(MAX_TREE_DEPTH, Math.max(0, Math.floor(depth)))
      : 2
    return listDirTree(resolveExistingPath(dirPath) || dirPath, safeDepth)
  })

  ipcMain.handle('project:readFile', async (_e, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return { error: 'Invalid path' }
      if (!fs.existsSync(filePath)) return { error: 'File not found' }
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) return { error: 'Not a file' }

      const ext = path.extname(filePath).toLowerCase()
      const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'])
      // Office / 压缩等太重：不在内嵌预览里解，交给系统应用
      const externalOnly = new Set([
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.7z', '.rar', '.gz', '.tar',
        '.exe', '.dll', '.so', '.dylib', '.wasm',
        '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac',
      ])

      if (imageExt.has(ext)) {
        if (stat.size > 8 * 1024 * 1024) return { error: '图片过大（>8MB）', size: stat.size }
        const mime = mimeFromExt(ext)
        const dataUrl = `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
        return { kind: 'image' as const, mimeType: mime, dataUrl, size: stat.size }
      }

      if (externalOnly.has(ext)) {
        return {
          kind: 'unsupported' as const,
          size: stat.size,
          reason: '该格式不适合内嵌预览，可用系统应用打开',
        }
      }

      if (stat.size > 512 * 1024) return { error: '文件过大（>512KB）', size: stat.size }

      const buf = fs.readFileSync(filePath)
      if (looksBinary(buf)) {
        return {
          kind: 'unsupported' as const,
          size: stat.size,
          reason: '二进制文件，可用系统应用打开',
        }
      }

      const content = buf.toString('utf-8')
      return {
        kind: 'text' as const,
        content,
        size: stat.size,
        languageHint: languageHintFromExt(ext),
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('project:openExternal', async (_e, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return { ok: false, error: 'Invalid path' }
      if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' }
      const { shell } = await import('electron')
      const err = await shell.openPath(filePath)
      if (err) return { ok: false, error: err }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  log.info('Project IPC registered')
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    case '.bmp': return 'image/bmp'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    default: return 'application/octet-stream'
  }
}

function languageHintFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.json': 'json',
    '.jsonc': 'json',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.css': 'css',
    '.html': 'html',
    '.htm': 'html',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.csv': 'csv',
    '.sql': 'sql',
    '.sh': 'shell',
    '.ps1': 'powershell',
    '.txt': 'text',
    '.log': 'text',
  }
  return map[ext] || 'text'
}

/** 粗判二进制：前 8KB 含 NUL，或非 UTF-8 可解码占比过低 */
function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192))
  if (sample.includes(0)) return true
  let weird = 0
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i]
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32) weird++
  }
  return sample.length > 0 && weird / sample.length > 0.3
}

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', '.next', '__pycache__',
  '.cache', '.vscode', '.idea', 'coverage', '.turbo', '.output',
])

function listDirTree(dir: string, maxDepth: number, currentDepth = 0): FileEntry[] {
  if (currentDepth >= maxDepth) return []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const result: FileEntry[] = []

    const dirs: FileEntry[] = []
    const files: FileEntry[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') && currentDepth === 0 && entry.name !== '.env.example') continue
      if (IGNORE.has(entry.name)) continue

      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        dirs.push({
          name: entry.name,
          path: fullPath,
          isDir: true,
          children: listDirTree(fullPath, maxDepth, currentDepth + 1),
        })
      } else {
        files.push({ name: entry.name, path: fullPath, isDir: false })
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
    result.push(...dirs, ...files)
    return result
  } catch {
    return []
  }
}
