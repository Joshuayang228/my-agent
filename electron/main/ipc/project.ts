import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as settings from '../storage/settings-store'
import { setWorkspaceRoot } from '../agent/project-memory'
import { createLogger } from '../utils/logger'

const log = createLogger('ProjectIPC')

const MAX_RECENT = 10

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

function applyProject(dirPath: string | null): void {
  setWorkspaceRoot(dirPath || '')
  if (dirPath) {
    process.chdir(dirPath)
    log.info('Workspace root set', { path: dirPath })
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
    if (dirPath) {
      if (!fs.existsSync(dirPath)) return { success: false, error: 'Directory not found' }
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
    return { path: dirPath, name: pathToName(dirPath) }
  })

  ipcMain.handle('project:listFiles', async (_e, dirPath: string, depth = 2) => {
    if (!dirPath || !fs.existsSync(dirPath)) return []
    return listDirTree(dirPath, depth)
  })

  ipcMain.handle('project:readFile', async (_e, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return { error: 'File not found' }
      const stat = fs.statSync(filePath)
      if (stat.size > 256 * 1024) return { error: 'File too large (>256KB)' }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { content, size: stat.size }
    } catch (err) {
      return { error: String(err) }
    }
  })

  log.info('Project IPC registered')
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
