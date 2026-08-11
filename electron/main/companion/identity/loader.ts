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
  RoleProfile,
  RoleSummary,
  RoleWorldDefaults,
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

function assertSchemaVersion(assetName: string, schemaVersion: unknown): asserts schemaVersion is 1 {
  if (schemaVersion !== 1) {
    throw new Error(`${assetName} requires schemaVersion 1`)
  }
}

/**
 * 读取可选人物档案。
 *
 * 背景：角色团不应被迫同时补齐人物故事，当前只有进入结构化设计阶段的角色拥有该资产。
 * 设计意图：缺失返回 undefined，让旧 Role Pack 保持原有三槽结构；存在时拒绝未知 schema。
 * 关键约束：只验证版本边界，字段完整性由仓库资产测试负责，运行时不得自动脑补缺失故事。
 */
export function loadRoleProfile(
  roleId: string,
  universeId: string = DEFAULT_UNIVERSE,
): RoleProfile | undefined {
  const rel = `${universeId}/roles/${roleId}/profile.json`
  if (!assetExists(rel)) return undefined
  const profile = readJson<RoleProfile>(rel)
  assertSchemaVersion(rel, profile.schemaVersion)
  return profile
}

/**
 * 读取可选默认世界。
 *
 * 背景：默认世界与运行态 world_json 必须分层，且其他角色暂不扩写完整生活资产。
 * 设计意图：缺失返回 undefined；存在时只接受 schema v1，由调用方决定 Prompt、播种和初始态用途。
 * 关键约束：该资产只描述出厂事实，不能覆盖运行后的位置、活动或用户编辑资产。
 */
export function loadRoleWorldDefaults(
  roleId: string,
  universeId: string = DEFAULT_UNIVERSE,
): RoleWorldDefaults | undefined {
  const rel = `${universeId}/roles/${roleId}/world.default.json`
  if (!assetExists(rel)) return undefined
  const world = readJson<RoleWorldDefaults>(rel)
  assertSchemaVersion(rel, world.schemaVersion)
  return world
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
    profile: loadRoleProfile(roleId, universeId),
    worldDefaults: loadRoleWorldDefaults(roleId, universeId),
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

/**
 * 读取角色目录下可选文本资产；不存在返回 null。
 * 应用场景：scenes/*.md 等多场景 prompt（M26-G3）。
 */
export function tryReadRoleText(
  roleId: string,
  fileRelWithinRole: string,
  universeId: string = DEFAULT_UNIVERSE,
): string | null {
  const rel = `${universeId}/roles/${roleId}/${fileRelWithinRole.replace(/\\/g, '/')}`
  if (!assetExists(rel)) return null
  return readText(rel)
}
