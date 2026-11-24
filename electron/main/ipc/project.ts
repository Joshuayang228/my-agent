import { ipcMain, dialog, BrowserWindow } from 'electron'
import { registerSecureIpcHandler } from './ipc-security'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as settings from '../storage/settings-store'
import { setWorkspaceRoot } from '../workspace/workspace-root'
import { createLogger, hashForLog } from '../utils/logger'
import {
  parseDocxHtmlPreview,
  parsePdfPreview,
  parsePptxPreview,
  parseSpreadsheetPreview,
} from '../utils/document-parser'
import { convertOfficeFileToPdf, hasHostOfficeConverter } from '../utils/office-pdf-converter'
import type { SpreadsheetCellEditInput } from '../../../src/shared/types'

const log = createLogger('ProjectIPC')

const MAX_RECENT = 10
const MAX_TREE_DEPTH = 5
const MAX_PROJECT_HTML_BYTES = 10 * 1024 * 1024

const watchedFiles = new Map<string, { watcher: fs.FSWatcher; refCount: number }>()

function emitFileChanged(filePath: string, mtimeMs: number): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('project:file-changed', { filePath, mtimeMs })
  }
}

function watchProjectFile(filePath: string): void {
  const existing = watchedFiles.get(filePath)
  if (existing) { existing.refCount += 1; return }
  let timer: ReturnType<typeof setTimeout> | undefined
  const watcher = fs.watch(filePath, { persistent: false }, () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      try { emitFileChanged(filePath, fs.statSync(filePath).mtimeMs) } catch { /* 文件正在替换或已删除，下一次读取会给出友好错误 */ }
    }, 80)
  })
  watchedFiles.set(filePath, { watcher, refCount: 1 })
}

function unwatchProjectFile(filePath: string): void {
  const current = watchedFiles.get(filePath)
  if (!current) return
  current.refCount -= 1
  if (current.refCount > 0) return
  current.watcher.close()
  watchedFiles.delete(filePath)
}

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
      .filter((p) => {
        try { return fs.statSync(p).isDirectory() } catch { return false }
      })
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

export function isPathInsideRoot(candidate: string, root: string): boolean {
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
  if (!configured) return null
  try {
    if (!fs.existsSync(configured) || !fs.statSync(configured).isDirectory()) return null
    return resolveExistingPath(configured)
  } catch {
    return null
  }
}

function isPathAllowedInProject(filePath: string, projectRoot: string): boolean {
  const resolved = resolveExistingPath(filePath)
  return !!resolved && isPathInsideRoot(resolved, projectRoot)
}

/**
 * 将来自渲染进程的项目文件路径解析为已存在、且仍位于当前项目根内的真实路径。
 *
 * 背景：渲染进程是受信任边界内的客户端，但 IPC 参数仍然是不可信输入；只检查
 * `existsSync` 会让任意绝对路径读取或交给系统打开，路径穿越和项目内 symlink 都会绕过 UI。
 * 设计意图：所有项目文件 IPC 在执行前统一 realpath，再用当前项目根做边界判断，避免
 * `readFile` / `openExternal` 各自实现一套容易漏掉的守卫。
 * 关键约束：不存在、不是文件、没有当前项目或解析到项目外时统一拒绝；调用方必须使用返回的
 * realpath 继续 stat/read/open，不能回退到原始输入。
 */
async function resolveCurrentProjectFile(filePath: unknown): Promise<string | null> {
  if (typeof filePath !== 'string' || !filePath.trim()) return null
  const root = await getCurrentProjectRoot()
  if (!root) return null
  const resolved = resolveExistingPath(filePath)
  if (!resolved || !isPathInsideRoot(resolved, root)) return null
  try {
    const stat = fs.statSync(resolved)
    return stat.isFile() ? resolved : null
  } catch {
    return null
  }
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


/** Renderer 只能切换到已由系统目录选择器写入的当前/最近项目，不能凭 IPC 扩大工作区。 */
export function isAuthorizedProjectSelection(
  candidate: string,
  currentProject: string | null,
  recentProjects: ProjectInfo[],
): boolean {
  const resolved = path.resolve(candidate)
  return (currentProject ? path.resolve(currentProject) === resolved : false)
    || recentProjects.some((project) => path.resolve(project.path) === resolved)
}

export function registerProjectIPC(): void {
  registerSecureIpcHandler('project:browse', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择项目目录',
      properties: ['openDirectory'],
    })

    if (result.canceled || !result.filePaths.length) return null

    const dirPath = resolveExistingPath(result.filePaths[0])
    if (!dirPath || !fs.statSync(dirPath).isDirectory()) return null
    await addToRecent(dirPath)
    await settings.setSetting('currentProject', dirPath)
    applyProject(dirPath)

    return { path: dirPath, name: pathToName(dirPath) }
  })

  registerSecureIpcHandler('project:list', async () => {
    return getRecentProjects()
  })

  registerSecureIpcHandler('project:set', async (_e, dirPath: string | null) => {
    if (dirPath !== null && typeof dirPath !== 'string') return { success: false, error: 'Invalid directory' }
    if (dirPath) {
      try {
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return { success: false, error: 'Directory not found' }
      } catch {
        return { success: false, error: 'Directory not found' }
      }
      const resolvedDir = resolveExistingPath(dirPath)
      if (!resolvedDir) return { success: false, error: 'Directory not found' }
      dirPath = resolvedDir
      const currentProject = await getCurrentProjectRoot()
      const recentProjects = await getRecentProjects()
      if (!isAuthorizedProjectSelection(dirPath, currentProject, recentProjects)) {
        return { success: false, error: '该目录尚未通过系统项目选择器授权，请使用“打开项目”。' }
      }
      await settings.setSetting('currentProject', dirPath)
      applyProject(dirPath)
    } else {
      await settings.setSetting('currentProject', '')
      applyProject(null)
    }
    return { success: true }
  })

  registerSecureIpcHandler('project:get', async () => {
    const dirPath = await getCurrentProjectRoot()
    if (!dirPath) return null
    // 启动后仅读设置不会 set workspace；这里恢复真实工作区，避免 symlink / 相对路径漂移
    applyProject(dirPath)
    return { path: dirPath, name: pathToName(dirPath) }
  })

  registerSecureIpcHandler('project:listFiles', async (_e, dirPath: string, depth = 2) => {
    if (typeof dirPath !== 'string' || !dirPath) return []
    const root = await getCurrentProjectRoot()
    if (!root || !isPathAllowedInProject(dirPath, root)) return []
    const safeDepth = typeof depth === 'number' && Number.isFinite(depth)
      ? Math.min(MAX_TREE_DEPTH, Math.max(0, Math.floor(depth)))
      : 2
    return listDirTree(resolveExistingPath(dirPath) || dirPath, safeDepth)
  })

  registerSecureIpcHandler('project:readFile', async (_e, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return { error: 'Invalid path' }
      const resolvedFile = await resolveCurrentProjectFile(filePath)
      if (!resolvedFile) return { error: '文件不在当前项目内或不是普通文件' }
      const stat = fs.statSync(resolvedFile)

      const ext = path.extname(resolvedFile).toLowerCase()
      const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'])
      const spreadsheetExt = new Set(['.xlsx', '.xls', '.csv'])
      // 老旧二进制 Office / 压缩包 / 音视频 / 可执行文件仍交给系统应用打开
      const externalOnly = new Set([
        '.doc', '.ppt',
        '.zip', '.7z', '.rar', '.gz', '.tar',
        '.exe', '.dll', '.so', '.dylib', '.wasm',
        '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac',
      ])

      if (imageExt.has(ext)) {
        if (stat.size > 8 * 1024 * 1024) return { error: '图片过大（>8MB）', size: stat.size }
        const mime = mimeFromExt(ext)
        const dataUrl = `data:${mime};base64,${fs.readFileSync(resolvedFile).toString('base64')}`
        return { kind: 'image' as const, mimeType: mime, dataUrl, size: stat.size }
      }

      if (spreadsheetExt.has(ext)) {
        if (stat.size > 10 * 1024 * 1024) return { kind: 'unsupported' as const, size: stat.size, reason: '表格文件超过 10MB 预览上限，可用系统应用打开' }
        const parsed = await parseSpreadsheetPreview(fs.readFileSync(resolvedFile), path.basename(resolvedFile))
        if (!parsed.ok) return { error: parsed.error, size: stat.size }
        return { kind: 'spreadsheet' as const, sheets: parsed.sheets, size: stat.size, mtimeMs: stat.mtimeMs }
      }

      if (ext === '.docx') {
        if (stat.size > 10 * 1024 * 1024) return { kind: 'unsupported' as const, size: stat.size, reason: 'Word 文档超过 10MB 预览上限，可用系统应用打开' }
        const rawBuf = fs.readFileSync(resolvedFile)
        const parsed = await parseDocxHtmlPreview(rawBuf)
        if (!parsed.ok) return { error: parsed.error, size: stat.size }
        return {
          kind: 'docx' as const,
          html: parsed.html,
          docxBase64: rawBuf.toString('base64'),
          notices: parsed.notices,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          nativePdfAvailable: await hasHostOfficeConverter('.docx'),
        }
      }

      if (ext === '.pdf') {
        if (stat.size > 10 * 1024 * 1024) return { kind: 'unsupported' as const, size: stat.size, reason: 'PDF 文件超过 10MB 预览上限，可用系统应用打开' }
        const parsed = await parsePdfPreview(fs.readFileSync(resolvedFile))
        if (!parsed.ok) return { error: parsed.error, size: stat.size }
        return { kind: 'pdf' as const, pages: parsed.pages, pdfBase64: parsed.pdfBase64, size: stat.size, mtimeMs: stat.mtimeMs }
      }

      if (ext === '.pptx') {
        if (stat.size > 10 * 1024 * 1024) return { kind: 'unsupported' as const, size: stat.size, reason: 'PPT 文件超过 10MB 预览上限，可用系统应用打开' }
        const parsed = await parsePptxPreview(fs.readFileSync(resolvedFile))
        if (!parsed.ok) return { error: parsed.error, size: stat.size }
        return {
          kind: 'pptx' as const,
          slides: parsed.slides,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          nativePdfAvailable: await hasHostOfficeConverter('.pptx'),
        }
      }

      if (externalOnly.has(ext)) {
        return {
          kind: 'unsupported' as const,
          size: stat.size,
          reason: '该格式不适合内嵌预览，可用系统应用打开',
        }
      }

      if (ext === '.html' || ext === '.htm') {
        if (stat.size > MAX_PROJECT_HTML_BYTES) return { error: 'HTML 文件超过 10MB 预览上限，请用系统应用打开', size: stat.size }
        const content = fs.readFileSync(resolvedFile, 'utf-8')
        return {
          kind: 'text' as const,
          content,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          languageHint: 'html',
        }
      }

      if (stat.size > 512 * 1024) return { error: '文件过大（>512KB）', size: stat.size }

      const buf = fs.readFileSync(resolvedFile)
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
        mtimeMs: stat.mtimeMs,
        languageHint: languageHintFromExt(ext),
      }
    } catch (err) {
      log.warn('Project preview failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { error: '读取项目文件失败' }
    }
  })

  registerSecureIpcHandler('project:saveSpreadsheetCells', async (_event, input: {
    filePath?: unknown
    expectedMtimeMs?: unknown
    force?: unknown
    edits?: unknown
  }) => {
    try {
      const resolvedFile = await resolveCurrentProjectFile(input?.filePath)
      if (!resolvedFile) return { ok: false as const, code: 'INVALID' as const, error: '文件不在当前项目内或不是普通文件' }
      const ext = path.extname(resolvedFile).toLowerCase()
      if (ext === '.xls') return { ok: false as const, code: 'UNSUPPORTED' as const, error: '老式 .xls 文件暂不支持安全写回' }
      if (ext !== '.xlsx' && ext !== '.csv') return { ok: false as const, code: 'INVALID' as const, error: '仅支持写回 .xlsx 或 .csv 文件' }
      const edits = Array.isArray(input?.edits) ? input.edits as SpreadsheetCellEditInput[] : []
      if (edits.length === 0 || edits.length > 200) return { ok: false as const, code: 'INVALID' as const, error: '没有可保存的单元格修改' }
      if (edits.some((edit) => !edit || typeof edit.sheetIndex !== 'number' || !Number.isInteger(edit.row) || !Number.isInteger(edit.col) || edit.row < 0 || edit.col < 0 || edit.row >= 500 || edit.col >= 50 || typeof edit.value !== 'string' || edit.value.length > 10_000)) {
        return { ok: false as const, code: 'INVALID' as const, error: '单元格修改参数无效' }
      }
      const currentStat = fs.statSync(resolvedFile)
      if (!input.force && typeof input.expectedMtimeMs === 'number' && Math.abs(currentStat.mtimeMs - input.expectedMtimeMs) > 1) {
        return { ok: false as const, code: 'CONFLICT' as const, error: '文件已被外部修改，请先重新读取后再保存', currentMtimeMs: currentStat.mtimeMs }
      }
      const tempPath = `${resolvedFile}.${process.pid}.${Date.now()}.tmp`
      if (ext === '.xlsx') {
        // 使用 exceljs 原地按坐标改写，保留原工作簿样式、合并单元格、公式及 500 行之外的完整数据
        const mod = await import('exceljs')
        const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(fs.readFileSync(resolvedFile) as unknown as Parameters<typeof workbook.xlsx.load>[0])
        for (const edit of edits) {
          const worksheet = workbook.worksheets[edit.sheetIndex]
          if (!worksheet || (edit.sheetName && worksheet.name !== edit.sheetName)) {
            return { ok: false as const, code: 'INVALID' as const, error: '工作表已发生变化，请重新读取' }
          }
          const targetCell = worksheet.getCell(edit.row + 1, edit.col + 1)
          // 合并单元格始终写向左上角主格，防止拆分破坏合并结构
          const masterCell = targetCell.master ?? targetCell
          const rawVal = masterCell.value
          if (rawVal && typeof rawVal === 'object' && ('formula' in rawVal || 'sharedFormula' in rawVal)) {
            return { ok: false as const, code: 'INVALID' as const, error: `${worksheet.name}!${masterCell.address} 含公式，不能直接改写` }
          }
          const trimmed = edit.value.trim()
          const numVal = trimmed !== '' && /^[+-]?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : null
          masterCell.value = numVal !== null && Number.isFinite(numVal) ? numVal : edit.value
        }
        try {
          await workbook.xlsx.writeFile(tempPath)
          fs.renameSync(tempPath, resolvedFile)
        } finally {
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath) } catch { /* ignore cleanup failure */ }
        }
      } else {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(fs.readFileSync(resolvedFile).toString('utf-8'), { type: 'string' })
        for (const edit of edits) {
          const sheetName = workbook.SheetNames[edit.sheetIndex]
          if (!sheetName) return { ok: false as const, code: 'INVALID' as const, error: '工作表已发生变化，请重新读取' }
          const sheet = workbook.Sheets[sheetName]
          const address = XLSX.utils.encode_cell({ r: edit.row, c: edit.col })
          sheet[address] = { t: 's', v: edit.value }
        }
        try {
          XLSX.writeFile(workbook, tempPath, { bookType: 'csv', FS: ',' })
          fs.renameSync(tempPath, resolvedFile)
        } finally {
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath) } catch { /* ignore cleanup failure */ }
        }
      }
      const saved = fs.statSync(resolvedFile)
      const parsed = await parseSpreadsheetPreview(fs.readFileSync(resolvedFile), path.basename(resolvedFile))
      if (!parsed.ok) return { ok: false as const, code: 'ERROR' as const, error: parsed.error }
      return { ok: true as const, mtimeMs: saved.mtimeMs, sheets: parsed.sheets }
    } catch (err) {
      log.warn('Spreadsheet save failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false as const, code: 'LOCKED' as const, error: '文件保存失败，可能正被其他应用占用；请关闭 WPS/Excel 后重试' }
    }
  })

  registerSecureIpcHandler('project:convertOfficeToPdf', async (_event, filePath: string) => {
    const resolvedFile = await resolveCurrentProjectFile(filePath)
    if (!resolvedFile) return { ok: false as const, error: '文件不在当前项目内或不是普通文件' }
    return convertOfficeFileToPdf(resolvedFile)
  })

  registerSecureIpcHandler('project:watchFile', async (_event, filePath: string) => {
    const resolvedFile = await resolveCurrentProjectFile(filePath)
    if (!resolvedFile) return { ok: false as const }
    watchProjectFile(resolvedFile)
    return { ok: true as const }
  })

  registerSecureIpcHandler('project:unwatchFile', async (_event, filePath: string) => {
    const resolvedFile = await resolveCurrentProjectFile(filePath)
    if (resolvedFile) unwatchProjectFile(resolvedFile)
    return { ok: true as const }
  })

  registerSecureIpcHandler('project:openExternal', async (_e, filePath: string) => {
    try {
      if (!filePath || typeof filePath !== 'string') return { ok: false, error: 'Invalid path' }
      const resolvedFile = await resolveCurrentProjectFile(filePath)
      if (!resolvedFile) return { ok: false, error: '文件不在当前项目内或不是普通文件' }
      const { shell } = await import('electron')
      const err = await shell.openPath(resolvedFile)
      if (err) {
        log.warn('Open project file rejected by shell', { errorLength: err.length })
        return { ok: false, error: '系统应用无法打开该文件' }
      }
      return { ok: true }
    } catch (err) {
      log.warn('Open project file failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false, error: '打开项目文件失败' }
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
