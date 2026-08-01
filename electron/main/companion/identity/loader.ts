/**
 * Role Pack 加载器（Identity）
 *
 * 背景：人设文案必须落在 universes/ 资产目录，禁止再硬编码进 prompt-builder。
 * 意图：按 universe manifest 的 protagonistIds 列出主角；按需读完整 Pack。
 * 约束：通过 Vite `import.meta.glob(?raw)` 打进主进程包，避免生产环境缺文件；
 *       若 glob 不可用则回退 fs（兼容部分测试环境）。
 * 调用方：IPC companion、runtime Assemble、单测 / Eval。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  RoleManifest,
  RolePack,
  RoleSummary,
  UniverseManifest,
  UniverseRelations,
} from '../types'

const DEFAULT_UNIVERSE = 'default'

/** Vite 将资产以 raw 字符串打入包；key 形如 `../universes/default/manifest.json` */
const bundledAssets = import.meta.glob('../universes/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function normalizeAssetKey(relUnixPath: string): string {
  return `../universes/${relUnixPath.replace(/\\/g, '/')}`
}

function readBundled(relUnixPath: string): string | null {
  const key = normalizeAssetKey(relUnixPath)
  const direct = bundledAssets[key]
  if (typeof direct === 'string') return direct.replace(/^\uFEFF/, '').trimEnd()

  // 兼容不同 bundler 的 key 形态
  const hit = Object.entries(bundledAssets).find(([k]) =>
    k.replace(/\\/g, '/').endsWith(`/universes/${relUnixPath.replace(/\\/g, '/')}`),
  )
  if (hit && typeof hit[1] === 'string') return hit[1].replace(/^\uFEFF/, '').trimEnd()
  return null
}

function resolveUniversesRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const candidates = [
    path.join(here, 'universes'),
    path.join(here, '..', 'universes'),
    path.join(process.cwd(), 'electron', 'main', 'companion', 'universes'),
  ]
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, DEFAULT_UNIVERSE, 'manifest.json'))) {
      return root
    }
  }
  throw new Error(
    `Companion universes not found on disk. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}`,
  )
}

function readText(relUnixPath: string): string {
  const bundled = readBundled(relUnixPath)
  if (bundled !== null) return bundled

  const abs = path.join(resolveUniversesRoot(), ...relUnixPath.split('/'))
  return fs.readFileSync(abs, 'utf-8').replace(/^\uFEFF/, '').trimEnd()
}

function readJson<T>(relUnixPath: string): T {
  return JSON.parse(readText(relUnixPath)) as T
}

function assetExists(relUnixPath: string): boolean {
  if (readBundled(relUnixPath) !== null) return true
  try {
    return fs.existsSync(path.join(resolveUniversesRoot(), ...relUnixPath.split('/')))
  } catch {
    return false
  }
}

export function getUniversesRoot(): string {
  return resolveUniversesRoot()
}

export function loadUniverseManifest(universeId: string = DEFAULT_UNIVERSE): UniverseManifest {
  const rel = `${universeId}/manifest.json`
  if (!assetExists(rel)) {
    throw new Error(`Universe not found: ${universeId}`)
  }
  return readJson<UniverseManifest>(rel)
}

export function loadRelations(universeId: string = DEFAULT_UNIVERSE): UniverseRelations {
  const rel = `${universeId}/relations.json`
  if (!assetExists(rel)) return { edges: [] }
  return readJson<UniverseRelations>(rel)
}

/**
 * 列出宇宙中已挂上的主角（仅 protagonistIds 中的包）。
 */
export function listProtagonists(universeId: string = DEFAULT_UNIVERSE): RoleSummary[] {
  const manifest = loadUniverseManifest(universeId)
  return manifest.protagonistIds.map((roleId) => {
    const pack = loadRolePack(roleId, universeId)
    return { id: pack.id, name: pack.name, description: pack.description }
  })
}

/**
 * 加载完整 Role Pack。roleId 必须存在于该宇宙 roles/ 目录。
 */
export function loadRolePack(roleId: string, universeId: string = DEFAULT_UNIVERSE): RolePack {
  const base = `${universeId}/roles/${roleId}`
  const manifestRel = `${base}/manifest.json`
  if (!assetExists(manifestRel)) {
    throw new Error(`Role pack not found: ${universeId}/${roleId}`)
  }

  const manifest = readJson<RoleManifest>(manifestRel)
  const protectedBody = readText(`${base}/protected.md`)
  const mutableDefault = readText(`${base}/mutable.default.md`)
  const summaryRel = `${base}/summary.txt`
  const voiceRel = `${base}/voice.md`

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    canBeProtagonist: manifest.canBeProtagonist,
    protected: protectedBody,
    mutableDefault,
    summary: assetExists(summaryRel) ? readText(summaryRel) : '',
    asideStyle: manifest.asideStyle,
    voice: assetExists(voiceRel) ? readText(voiceRel) : undefined,
  }
}

/** 默认主角 id（宇宙 manifest） */
export function getDefaultProtagonistId(universeId: string = DEFAULT_UNIVERSE): string {
  return loadUniverseManifest(universeId).defaultProtagonistId
}

/** 校验 roleId 是否为已挂主角 */
export function isKnownProtagonist(roleId: string, universeId: string = DEFAULT_UNIVERSE): boolean {
  const manifest = loadUniverseManifest(universeId)
  return manifest.protagonistIds.includes(roleId)
}
