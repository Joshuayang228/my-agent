import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPANION_PROJECTION_SURFACES,
  COMPANION_WORLD_READ_VIEWS,
  LIFE_FACTOR_CATALOG,
} from '../../electron/main/companion/core/projections/surface-registry'
import { PROMPT_KEYS } from '../../electron/main/prompts/keys'
import { builtinTools } from '../../electron/main/tools/builtins'
import { getCompanionAssetCatalog } from '../../electron/main/companion/asset-registry'

const ROOT = process.cwd()

describe('Companion Projection Surface Registry（12 切面 × 15 维因子统一注册表）', () => {
  it('覆盖全部 9 个世界切面与 3 个 Chat 切面，且 ID 唯一', () => {
    const ids = COMPANION_PROJECTION_SURFACES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(COMPANION_PROJECTION_SURFACES.filter((s) => s.domain === 'world')).toHaveLength(9)
    expect(COMPANION_PROJECTION_SURFACES.filter((s) => s.domain === 'chat')).toHaveLength(3)
    expect(LIFE_FACTOR_CATALOG).toHaveLength(15)
  })

  it('所有声明的 backendSources 与 frontendSources 路径均在仓库中真实存在', () => {
    for (const surface of COMPANION_PROJECTION_SURFACES) {
      expect(surface.backendSources.length, `${surface.id} 缺少 backendSources`).toBeGreaterThan(0)
      expect(surface.frontendSources.length, `${surface.id} 缺少 frontendSources`).toBeGreaterThan(0)
      for (const rel of [...surface.backendSources, ...surface.frontendSources]) {
        expect(fs.existsSync(path.join(ROOT, rel)), `${surface.id} 引用了不存在的文件: ${rel}`).toBe(true)
      }
    }
  })

  it('所有声明的 toolNames 均为真实内置工具，promptKeys 均为有效 PROMPT_KEYS', () => {
    const toolNameSet = new Set(builtinTools.map((t) => t.name))
    const promptKeySet = new Set<string>(Object.values(PROMPT_KEYS))
    for (const surface of COMPANION_PROJECTION_SURFACES) {
      for (const toolName of surface.toolNames) {
        expect(toolNameSet.has(toolName), `${surface.id} 引用了未知工具: ${toolName}`).toBe(true)
      }
      for (const key of surface.promptKeys) {
        expect(promptKeySet.has(key), `${surface.id} 引用了未知 Prompt key: ${key}`).toBe(true)
      }
    }
  })

  it('所有 active 状态的活人感因子均至少被一个切面真实消费，并已同步进入 Debug 资产目录', () => {
    const consumed = new Set(COMPANION_PROJECTION_SURFACES.flatMap((s) => s.factors))
    for (const factor of LIFE_FACTOR_CATALOG) {
      if (factor.status === 'active') {
        expect(consumed.has(factor.key), `活跃因子 ${factor.key} 未被任何切面消费`).toBe(true)
      }
    }
    const assets = getCompanionAssetCatalog()
    const registryAsset = assets.find((a) => a.key === 'companion:registry:projection-surfaces')
    expect(registryAsset).toBeDefined()
    expect(registryAsset?.source).toContain('surface-registry.ts')
  })

  it('所有人物世界切面均声明 readView 并与 companion_read_world 工具枚举单一事实源同步', () => {
    const worldSurfaces = COMPANION_PROJECTION_SURFACES.filter((s) => s.domain === 'world')
    for (const surface of worldSurfaces) {
      expect(surface.readView, `${surface.id} 缺少 readView 声明`).toBeTruthy()
      expect(surface.toolNames, `${surface.id} 缺少 companion_read_world 声明`).toContain('companion_read_world')
    }
    const readTool = builtinTools.find((t) => t.name === 'companion_read_world')
    expect(readTool).toBeDefined()
    const viewEnum = (readTool?.parameters as { properties?: { view?: { enum?: string[] } } })?.properties?.view?.enum
    expect(viewEnum).toEqual([...COMPANION_WORLD_READ_VIEWS])
  })
})
