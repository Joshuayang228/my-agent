/**
 * Role Pack 加载器（Identity）
 *
 * 背景：人设文案必须落在 universes/ 资产目录，禁止再硬编码进会话组装入口。
 * 意图：按 universe manifest 的 protagonistIds 列出主角；按需读完整 Pack。
 * 约束：通过 Vite `import.meta.glob(?raw)` 打进主进程包，避免生产环境缺文件；
 *       若 glob 不可用则回退 fs（兼容部分测试环境）。
 * 调用方：IPC companion、runtime Assemble、单测 / Eval。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
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
const TEST_FIXTURE_ROOT = path.join(process.cwd(), 'tests-fixtures')

function isVitestFixtureMode(): boolean {
  return process.env.VITEST === 'true'
}

function fixturePath(relUnixPath: string): string {
  return path.join(TEST_FIXTURE_ROOT, ...relUnixPath.split('/').slice(1))
}

/**
 * Vite 只把 Role Pack 文本资产以 raw 字符串打入包；视觉参考图留在项目文件中，不能被当成文本塞进主进程 bundle。
 *
 * 背景：人物视觉参考属于人工审阅资产，不参与 loader 的 JSON / Markdown 解析；通配所有文件会让每张 PNG 膨胀 Electron 主包。
 * 设计意图：按扩展名限制内嵌来源，放弃“所有文件都由同一 glob 兜底”的便利写法。
 * 关键约束：新增可加载文本只能使用 json / md / txt；图片仍可通过 profile 的相对路径追踪，但不进入生产 Prompt 或主进程代码。
 */
const bundledAssets = import.meta.glob('../universes/**/*.{json,md,txt}', {
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

function resolveUserUniversesRoot(): string {
  try { return path.join(app.getPath('userData'), 'universes') } catch { return path.join(process.cwd(), '.agent-data', 'universes') }
}

function resolveAssetPath(relUnixPath: string): string {
  const userPath = path.join(resolveUserUniversesRoot(), ...relUnixPath.split('/'))
  if (fs.existsSync(userPath)) return userPath
  return path.join(resolveUniversesRoot(), ...relUnixPath.split('/'))
}

function readText(relUnixPath: string): string {
  const bundled = readBundled(relUnixPath)
  if (bundled !== null) return bundled

  const abs = resolveAssetPath(relUnixPath)
  if (isVitestFixtureMode() && !fs.existsSync(abs) && fs.existsSync(fixturePath(relUnixPath))) {
    return fs.readFileSync(fixturePath(relUnixPath), 'utf-8').replace(/^\uFEFF/, '').trimEnd()
  }
  return fs.readFileSync(abs, 'utf-8').replace(/^\uFEFF/, '').trimEnd()
}

function readJson<T>(relUnixPath: string): T {
  return JSON.parse(readText(relUnixPath)) as T
}

function assetExists(relUnixPath: string): boolean {
  if (readBundled(relUnixPath) !== null) return true
  try {
    const abs = resolveAssetPath(relUnixPath)
    return fs.existsSync(abs) || (isVitestFixtureMode() && fs.existsSync(fixturePath(relUnixPath)))
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
  if (isVitestFixtureMode()) {
    const fixture = path.join(TEST_FIXTURE_ROOT, universeId, 'relations.json')
    if (fs.existsSync(fixture)) return JSON.parse(fs.readFileSync(fixture, 'utf-8')) as UniverseRelations
  }
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
 * 列出宇宙目录中所有可加载 Role Pack，而不只返回已挂为主角的角色。
 *
 * 背景：Prompt 注册表和召唤会话需要追踪 NPC / 备用角色资产，protagonistIds 只代表主角入口，
 *       不能作为完整资产目录。
 * 设计意图：优先从 Vite 已打包资产键提取角色目录；测试 / 开发环境再回退文件系统扫描。
 * 关键约束：只有存在 manifest.json 的目录才算 Role Pack，返回稳定排序且自动去重。
 */
export function listAvailableRoleIds(universeId: string = DEFAULT_UNIVERSE): string[] {
  const bundledPrefix = `/universes/${universeId}/roles/`
  const roleIds = Object.keys(bundledAssets).flatMap((key) => {
    const normalized = key.replace(/\\/g, '/')
    const markerIndex = normalized.indexOf(bundledPrefix)
    if (markerIndex < 0 || !normalized.endsWith('/manifest.json')) return []
    const relative = normalized.slice(markerIndex + bundledPrefix.length)
    const roleId = relative.slice(0, -'/manifest.json'.length)
    return roleId && !roleId.includes('/') ? [roleId] : []
  })

  try {
    const rolesRoot = path.join(resolveUniversesRoot(), universeId, 'roles')
    for (const entry of fs.readdirSync(rolesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(rolesRoot, entry.name, 'manifest.json'))) {
        roleIds.push(entry.name)
      }
    }
  } catch {
    // 打包环境可能没有可扫描目录；bundledAssets 已覆盖正常生产路径。
  }

  try {
    const rolesRoot = path.join(resolveUserUniversesRoot(), universeId, 'roles')
    for (const entry of fs.readdirSync(rolesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && fs.existsSync(path.join(rolesRoot, entry.name, 'manifest.json'))) roleIds.push(entry.name)
    }
  } catch {
    // 用户世界不存在或尚未发布时，只保留内置 / 打包资产。
  }

  if (isVitestFixtureMode()) {
    try {
      const fixtureRoot = path.join(TEST_FIXTURE_ROOT, 'roles')
      for (const entry of fs.readdirSync(fixtureRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && fs.existsSync(path.join(fixtureRoot, entry.name, 'manifest.json'))) roleIds.push(entry.name)
      }
    } catch {
      // 测试夹具缺失时仍以生产目录为准。
    }
  }

  return [...new Set(roleIds)].sort()
}

/** 列出可切换的内置与用户世界观套装；用户世界的 manifest 仍由同一 loader 校验。 */
export function listAvailableUniverseIds(): string[] {
  const ids = new Set<string>()
  try {
    for (const key of Object.keys(bundledAssets)) {
      const normalized = key.replace(/\\/g, '/')
      const marker = normalized.indexOf('/universes/')
      if (marker < 0) continue
      const rest = normalized.slice(marker + '/universes/'.length)
      const id = rest.split('/')[0]
      if (id && rest.endsWith('/manifest.json')) ids.add(id)
    }
  } catch { /* bundled assets unavailable in a narrow test harness */ }
  for (const root of [resolveUniversesRoot(), resolveUserUniversesRoot()]) {
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'manifest.json'))) ids.add(entry.name)
      }
    } catch { /* root may not exist */ }
  }
  return [...ids].sort()
}

/**
 * 列出宇宙中已挂上的主角（仅 protagonistIds 中的包）。
 */
const roleVisualDataUrlCache = new Map<string, string | null>()

/**
 * 读取角色相对路径的视觉文件并转换为 base64 dataUrl 供前端渲染。
 * 内存缓存避免重复读取磁盘。
 */
export function getRoleVisualDataUrl(
  roleId: string,
  visualRelPath?: string,
  universeId: string = DEFAULT_UNIVERSE,
): string | null {
  if (!visualRelPath || typeof visualRelPath !== 'string') return null
  const cacheKey = `${universeId}:${roleId}:${visualRelPath}`
  if (roleVisualDataUrlCache.has(cacheKey)) {
    return roleVisualDataUrlCache.get(cacheKey) ?? null
  }
  const absPath = resolveRoleAssetFilePath(roleId, visualRelPath, universeId)
  if (!absPath || !fs.existsSync(absPath)) {
    roleVisualDataUrlCache.set(cacheKey, null)
    return null
  }
  try {
    const bytes = fs.readFileSync(absPath)
    if (bytes.byteLength < 8 || bytes.byteLength > 15 * 1024 * 1024) {
      roleVisualDataUrlCache.set(cacheKey, null)
      return null
    }
    const ext = path.extname(absPath).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
    roleVisualDataUrlCache.set(cacheKey, dataUrl)
    return dataUrl
  } catch {
    roleVisualDataUrlCache.set(cacheKey, null)
    return null
  }
}

export function getRoleVisuals(roleId: string, universeId: string = DEFAULT_UNIVERSE) {
  const pack = loadRolePack(roleId, universeId)
  const avatarPath = pack.avatarVisualPath || 'visual/avatar-v1.png'
  const bannerPath = pack.bannerVisualPath || (pack.worldDefaults?.home?.visualPath ? pack.worldDefaults.home.visualPath : 'visual/banner-v1.png')
  return {
    roleId: pack.id,
    roleName: pack.name,
    avatarDataUrl: getRoleVisualDataUrl(roleId, avatarPath, universeId),
    bannerDataUrl: getRoleVisualDataUrl(roleId, bannerPath, universeId),
    themeColor: pack.themeColor ?? null,
  }
}

export function listProtagonists(universeId: string = DEFAULT_UNIVERSE): RoleSummary[] {
  const manifest = loadUniverseManifest(universeId)
  return manifest.protagonistIds.map((roleId) => {
    const pack = loadRolePack(roleId, universeId)
    const visuals = getRoleVisuals(roleId, universeId)
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      firstContact: pack.firstContact,
      avatarVisualPath: pack.avatarVisualPath,
      bannerVisualPath: pack.bannerVisualPath,
      themeColor: pack.themeColor,
      avatarDataUrl: visuals.avatarDataUrl,
      bannerDataUrl: visuals.bannerDataUrl,
    } as RoleSummary
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
  const behaviorPrompts: Record<string, string> = {}
  for (const behavior of ['moment-polish', 'day-script', 'catchup', 'reflection']) {
    const rel = `${base}/behaviors/${behavior}.md`
    if (assetExists(rel)) behaviorPrompts[behavior] = readText(rel)
  }

  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    canBeProtagonist: manifest.canBeProtagonist,
    protected: protectedBody,
    mutableDefault,
    summary: assetExists(summaryRel) ? readText(summaryRel) : '',
    asideStyle: manifest.asideStyle,
    characterKind: manifest.characterKind,
    firstContact: manifest.firstContact,
    avatarVisualPath: manifest.avatarVisualPath,
    bannerVisualPath: manifest.bannerVisualPath,
    themeColor: manifest.themeColor,
    voice: assetExists(voiceRel) ? readText(voiceRel) : undefined,
    profile: loadRoleProfile(roleId, universeId),
    worldDefaults: loadRoleWorldDefaults(roleId, universeId),
    behaviorPrompts,
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

export type UniverseRoleKind = 'protagonist' | 'cast' | 'unlisted'

/**
 * 返回人物在世界观套装中的入口类型。
 *
 * 背景：一个世界可以同时拥有主角与朋友角色；Debug 和切换入口不能把所有 Role Pack 都当成主角。
 * 设计意图：主角以 manifest.protagonistIds 为唯一事实，朋友优先读取显式 castIds，旧套装再把其余已登记角色视为卡司。
 * 关键约束：只有 protagonist 才能成为 activeRoleId；cast 只能参与名册、关系和召唤，不能绕过主角切换门闸。
 */
export function getUniverseRoleKind(roleId: string, universeId: string = DEFAULT_UNIVERSE): UniverseRoleKind {
  const manifest = loadUniverseManifest(universeId)
  if (manifest.protagonistIds.includes(roleId)) return 'protagonist'
  if (manifest.castIds?.includes(roleId) || listAvailableRoleIds(universeId).includes(roleId)) return 'cast'
  return 'unlisted'
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

/** 读取世界观公共经历资产；缺失返回 null，不把外部搜索结果伪装成本地事实。 */
export function tryReadUniverseText(
  universeId: string,
  fileRelWithinUniverse: string,
): string | null {
  const rel = `${universeId}/${fileRelWithinUniverse.replace(/\\/g, '/')}`
  if (!assetExists(rel)) return null
  return readText(rel)
}


/**
 * 解析角色目录下二进制/视觉资产的真实磁盘路径。
 *
 * 背景：Role Pack 的 visual/*.png 不能走 ?raw 文本 glob 打入主包，但出厂生活资产播种时需要读取真实 PNG 并落入受控图片目录。
 * 设计意图：复用用户世界优先、内置 universes 次之、测试夹具兜底的同一寻址顺序，同时拦截路径穿越。
 * 关键约束：仅接受角色目录内的相对路径，不允许 .. 或绝对路径；文件不存在时返回 null，调用方负责降级为无图。
 */
export function resolveRoleAssetFilePath(
  roleId: string,
  fileRelWithinRole: string,
  universeId: string = DEFAULT_UNIVERSE,
): string | null {
  const normalized = fileRelWithinRole.replace(/\\/g, '/').trim()
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    return null
  }
  const rel = `${universeId}/roles/${roleId}/${normalized}`
  try {
    const abs = resolveAssetPath(rel)
    if (fs.existsSync(abs)) return abs
    if (isVitestFixtureMode() && fs.existsSync(fixturePath(rel))) return fixturePath(rel)
    return null
  } catch {
    return null
  }
}
