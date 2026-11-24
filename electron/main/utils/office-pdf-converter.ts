/**
 * 本机办公套件静默转 PDF 缓存服务（LibreOffice / Microsoft Office / WPS Office）。
 *
 * 背景：.pptx 含复杂母版与图形，.docx 简历含精确分栏分页；纯 JS 大纲解析或 HTML 转换无法 100% 复刻原生分页。
 * 设计意图：探测宿主机已安装的 LibreOffice 或 Windows COM 套件（Office / WPS），
 * 按 `真实路径 + mtimeMs + size` 哈希缓存导出 PDF（15MB / 15s 超时保护），供渲染层 pdfjs-dist 直接高保真呈现与划词批注。
 * 关键约束：严格使用 execFile + 环境变量传参，绝不把文件路径拼接到命令脚本中防注入；COM 脚本 try/finally 强制退出防残留进程。
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'
import type { ProjectConvertOfficePdfResult } from '../../../src/shared/types'

const execFileAsync = promisify(execFile)

const CONVERT_TIMEOUT_MS = 18_000
const MAX_CONVERTED_PDF_BYTES = 15 * 1024 * 1024
const CACHE_DIR_NAME = 'my-agent-office-pdf-cache'
const MAX_CACHE_FILES = 40

type OfficeConverterBackend =
  | { kind: 'libreoffice'; binPath: string }
  | { kind: 'office' }
  | { kind: 'wps' }

let detectedCapabilitiesPromise: Promise<{
  libreofficePath: string | null
  hasMsWord: boolean
  hasMsPpt: boolean
  hasWpsWord: boolean
  hasWpsPpt: boolean
}> | null = null

const inFlightConversions = new Map<string, Promise<ProjectConvertOfficePdfResult>>()

async function regKeyExists(key: string): Promise<boolean> {
  try {
    await execFileAsync('reg.exe', ['query', key], { timeout: 2500, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function findLibreOfficeBinary(): Promise<string | null> {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      ]
    : process.platform === 'darwin'
      ? ['/Applications/LibreOffice.app/Contents/MacOS/soffice', '/opt/homebrew/bin/soffice']
      : ['/usr/bin/soffice', '/usr/local/bin/soffice', '/usr/bin/libreoffice']

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    } catch { /* ignore */ }
  }

  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which'
    const { stdout } = await execFileAsync(cmd, ['soffice'], { timeout: 2500, windowsHide: true })
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
    if (first && fs.existsSync(first)) return first
  } catch { /* ignore */ }

  return null
}

async function detectHostConverters() {
  if (!detectedCapabilitiesPromise) {
    detectedCapabilitiesPromise = (async () => {
      const libreofficePath = await findLibreOfficeBinary()
      if (process.platform !== 'win32') {
        return {
          libreofficePath,
          hasMsWord: false,
          hasMsPpt: false,
          hasWpsWord: false,
          hasWpsPpt: false,
        }
      }
      const [hasMsWord, hasMsPpt, hasKwps, hasWpsAlt, hasKwpp, hasWppAlt] = await Promise.all([
        regKeyExists('HKCR\\Word.Application'),
        regKeyExists('HKCR\\PowerPoint.Application'),
        regKeyExists('HKCR\\KWPS.Application'),
        regKeyExists('HKCR\\Wps.Application'),
        regKeyExists('HKCR\\KWPP.Application'),
        regKeyExists('HKCR\\Wpp.Application'),
      ])
      return {
        libreofficePath,
        hasMsWord,
        hasMsPpt,
        hasWpsWord: hasKwps || hasWpsAlt,
        hasWpsPpt: hasKwpp || hasWppAlt,
      }
    })()
  }
  return detectedCapabilitiesPromise
}

/** 查询宿主是否具备可用于对应后缀（.docx / .pptx）的原版 PDF 转换器。 */
export async function hasHostOfficeConverter(ext: string): Promise<boolean> {
  const normalized = ext.toLowerCase()
  if (normalized !== '.docx' && normalized !== '.pptx') return false
  const caps = await detectHostConverters()
  if (caps.libreofficePath) return true
  if (normalized === '.docx') return caps.hasMsWord || caps.hasWpsWord
  return caps.hasMsPpt || caps.hasWpsPpt
}

function getCacheDir(): string {
  const dir = path.join(os.tmpdir(), CACHE_DIR_NAME)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function pruneOldCacheFiles(dir: string): void {
  try {
    const entries = fs.readdirSync(dir)
      .filter((name) => name.endsWith('.pdf'))
      .map((name) => {
        const fullPath = path.join(dir, name)
        const stat = fs.statSync(fullPath)
        return { fullPath, mtimeMs: stat.mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    for (const stale of entries.slice(MAX_CACHE_FILES)) {
      try { fs.unlinkSync(stale.fullPath) } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function buildWindowsComScript(ext: '.docx' | '.pptx', prefer: 'office' | 'wps'): string {
  if (ext === '.docx') {
    const progIds = prefer === 'wps'
      ? "@('KWPS.Application', 'wps.Application', 'Word.Application')"
      : "@('Word.Application', 'KWPS.Application', 'wps.Application')"
    return `
$ErrorActionPreference = 'Stop'
$src = $env:MY_AGENT_SRC
$dst = $env:MY_AGENT_DST
$app = $null
$doc = $null
foreach ($progId in ${progIds}) {
  try {
    $app = New-Object -ComObject $progId
    break
  } catch { }
}
if (-not $app) { throw 'NO_COM_WORD' }
try {
  try { $app.Visible = $false } catch { }
  try { $app.DisplayAlerts = 0 } catch { }
  $doc = $app.Documents.Open($src, $false, $true)
  try {
    $doc.ExportAsFixedFormat($dst, 17)
  } catch {
    $doc.SaveAs2($dst, 17)
  }
} finally {
  if ($doc) { try { $doc.Close($false) } catch { } }
  if ($app) { try { $app.Quit($false) } catch { try { $app.Quit() } catch { } } }
}
`.trim()
  }

  const progIds = prefer === 'wps'
    ? "@('KWPP.Application', 'wpp.Application', 'PowerPoint.Application')"
    : "@('PowerPoint.Application', 'KWPP.Application', 'wpp.Application')"
  return `
$ErrorActionPreference = 'Stop'
$src = $env:MY_AGENT_SRC
$dst = $env:MY_AGENT_DST
$app = $null
$pres = $null
foreach ($progId in ${progIds}) {
  try {
    $app = New-Object -ComObject $progId
    break
  } catch { }
}
if (-not $app) { throw 'NO_COM_PPT' }
try {
  try { $app.DisplayAlerts = 1 } catch { }
  $pres = $app.Presentations.Open($src, -1, 0, 0)
  try {
    $pres.ExportAsFixedFormat($dst, 2)
  } catch {
    $pres.SaveAs($dst, 32)
  }
} finally {
  if ($pres) { try { $pres.Close() } catch { } }
  if ($app) { try { $app.Quit() } catch { } }
}
`.trim()
}

async function convertViaLibreOffice(binPath: string, srcPath: string, dstPdfPath: string, cacheDir: string): Promise<boolean> {
  const workDir = fs.mkdtempSync(path.join(cacheDir, 'lo-'))
  try {
    await execFileAsync(
      binPath,
      ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', workDir, srcPath],
      { timeout: CONVERT_TIMEOUT_MS, windowsHide: true },
    )
    const expectedName = `${path.basename(srcPath, path.extname(srcPath))}.pdf`
    const produced = path.join(workDir, expectedName)
    const fallbackFile = fs.existsSync(produced)
      ? produced
      : fs.readdirSync(workDir).map((name) => path.join(workDir, name)).find((f) => f.toLowerCase().endsWith('.pdf'))
    if (!fallbackFile || !fs.existsSync(fallbackFile)) return false
    fs.copyFileSync(fallbackFile, dstPdfPath)
    return fs.existsSync(dstPdfPath)
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

async function convertViaWindowsCom(ext: '.docx' | '.pptx', prefer: 'office' | 'wps', srcPath: string, dstPdfPath: string): Promise<boolean> {
  const script = buildWindowsComScript(ext, prefer)
  const tmpDst = `${dstPdfPath}.${process.pid}.${Date.now()}.pdf`
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        timeout: CONVERT_TIMEOUT_MS,
        windowsHide: true,
        env: {
          ...process.env,
          MY_AGENT_SRC: srcPath,
          MY_AGENT_DST: tmpDst,
        },
      },
    )
    if (!fs.existsSync(tmpDst) || fs.statSync(tmpDst).size === 0) return false
    fs.renameSync(tmpDst, dstPdfPath)
    return true
  } finally {
    try { if (fs.existsSync(tmpDst)) fs.unlinkSync(tmpDst) } catch { /* ignore */ }
  }
}

/**
 * 将已通过项目路径校验的 `.docx` / `.pptx` 文件静默转换为 PDF 并缓存。
 * 并发打开同一文件（如 React StrictMode 双挂载）会自动复用同一次转换任务。
 */
export async function convertOfficeFileToPdf(resolvedFilePath: string): Promise<ProjectConvertOfficePdfResult> {
  const ext = path.extname(resolvedFilePath).toLowerCase()
  if (ext !== '.docx' && ext !== '.pptx') {
    return { ok: false, error: '仅支持将 .docx 与 .pptx 转为原版 PDF 视图' }
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(resolvedFilePath)
    if (!stat.isFile()) return { ok: false, error: '目标不是普通文件' }
    if (stat.size === 0) return { ok: false, error: '文档内容为空' }
  } catch {
    return { ok: false, error: '文件不存在或无法读取' }
  }

  const key = createHash('sha256')
    .update(`${resolvedFilePath}|${Math.round(stat.mtimeMs)}|${stat.size}`)
    .digest('hex')
    .slice(0, 24)

  const existingTask = inFlightConversions.get(key)
  if (existingTask) return existingTask

  const task = (async (): Promise<ProjectConvertOfficePdfResult> => {
    const caps = await detectHostConverters()
    const backends: OfficeConverterBackend[] = []
    if (caps.libreofficePath) backends.push({ kind: 'libreoffice', binPath: caps.libreofficePath })
    if (ext === '.docx') {
      if (caps.hasWpsWord) backends.push({ kind: 'wps' })
      if (caps.hasMsWord) backends.push({ kind: 'office' })
    } else {
      if (caps.hasWpsPpt) backends.push({ kind: 'wps' })
      if (caps.hasMsPpt) backends.push({ kind: 'office' })
    }

    if (backends.length === 0) {
      return { ok: false, error: '未检测到本地 WPS / Office / LibreOffice 转换能力' }
    }

    const cacheDir = getCacheDir()
    const cacheFile = path.join(cacheDir, `${key}.pdf`)
    const metaFile = path.join(cacheDir, `${key}.meta`)

    if (fs.existsSync(cacheFile)) {
      const pdfStat = fs.statSync(cacheFile)
      if (pdfStat.size > 0 && pdfStat.size <= MAX_CONVERTED_PDF_BYTES) {
        const converterRaw = fs.existsSync(metaFile) ? fs.readFileSync(metaFile, 'utf-8').trim() : 'wps'
        const converter = converterRaw === 'office' || converterRaw === 'libreoffice' ? converterRaw : 'wps'
        return {
          ok: true,
          pdfBase64: fs.readFileSync(cacheFile).toString('base64'),
          converter,
        }
      }
    }

    for (const backend of backends) {
      try {
        const converted = backend.kind === 'libreoffice'
          ? await convertViaLibreOffice(backend.binPath, resolvedFilePath, cacheFile, cacheDir)
          : await convertViaWindowsCom(ext, backend.kind, resolvedFilePath, cacheFile)

        if (converted && fs.existsSync(cacheFile)) {
          const pdfStat = fs.statSync(cacheFile)
          if (pdfStat.size === 0) continue
          if (pdfStat.size > MAX_CONVERTED_PDF_BYTES) {
            try { fs.unlinkSync(cacheFile) } catch { /* ignore */ }
            return { ok: false, error: '导出后的原版 PDF 超过 15MB 限制，建议使用系统应用直接打开' }
          }
          fs.writeFileSync(metaFile, backend.kind, 'utf-8')
          pruneOldCacheFiles(cacheDir)
          return {
            ok: true,
            pdfBase64: fs.readFileSync(cacheFile).toString('base64'),
            converter: backend.kind,
          }
        }
      } catch {
        // 当前后端失败则继续尝试下一个可用转换器
      }
    }

    return { ok: false, error: '原版转换超时或未成功导出，已保留内置阅读视图，也可点击右上角用系统应用打开' }
  })()

  inFlightConversions.set(key, task)
  try {
    return await task
  } finally {
    inFlightConversions.delete(key)
  }
}
