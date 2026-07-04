import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

import {
  loadRules,
  getRules,
  checkCommandPermission,
  checkToolPermission,
} from '../../electron/main/sandbox/permission-engine'

describe('Permission Engine', () => {
  beforeEach(() => {
    loadRules('[]')
  })

  describe('自定义规则', () => {
    it('加载合法 JSON 规则', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'command', pattern: 'rm -rf', action: 'deny', enabled: true },
        { id: 'r2', type: 'tool', pattern: 'shell_exec', action: 'ask', enabled: true },
      ]))
      expect(getRules()).toHaveLength(2)
    })

    it('非法 JSON 不报错，规则清空', () => {
      loadRules('broken json')
      expect(getRules()).toHaveLength(0)
    })

    it('deny 规则拦截匹配命令', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'command', pattern: 'npm publish', action: 'deny', enabled: true },
      ]))
      const result = checkCommandPermission('npm publish --registry x', undefined, 'workspace-write')
      expect(result.allowed).toBe(false)
      expect(result.chain).toBe('custom-rule')
    })

    it('allow 规则放行匹配命令', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'command', pattern: '^ls', action: 'allow', enabled: true },
      ]))
      const result = checkCommandPermission('ls -la', undefined, 'read-only')
      expect(result.allowed).toBe(true)
      expect(result.chain).toBe('custom-rule')
    })

    it('ask 规则要求审批', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'command', pattern: 'docker', action: 'ask', enabled: true },
      ]))
      const result = checkCommandPermission('docker run x', undefined, 'workspace-write')
      expect(result.allowed).toBe('needs_approval')
    })

    it('disabled 规则不生效', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'command', pattern: '.*', action: 'deny', enabled: false },
      ]))
      const result = checkCommandPermission('ls', undefined, 'full-access')
      expect(result.allowed).toBe(true)
    })
  })

  describe('checkToolPermission', () => {
    it('无规则时默认允许', () => {
      const result = checkToolPermission('echo')
      expect(result.allowed).toBe(true)
      expect(result.chain).toBe('fallback')
    })

    it('tool 类型规则匹配', () => {
      loadRules(JSON.stringify([
        { id: 'r1', type: 'tool', pattern: 'shell_exec', action: 'deny', enabled: true },
      ]))
      const result = checkToolPermission('shell_exec')
      expect(result.allowed).toBe(false)
    })
  })

  describe('沙箱策略集成', () => {
    it('危险命令 bypass-immune — full-access 模式也拦截（G1）', () => {
      const result = checkCommandPermission('rm -rf /', undefined, 'full-access')
      expect(result.allowed).toBe(false)
      expect(result.decisionType).toBe('dangerous')
      expect(result.reason).toContain('危险命令被拦截')
    })

    it('危险命令在所有模式下被拦截', () => {
      const result1 = checkCommandPermission('rm -rf /', undefined, 'workspace-write')
      expect(result1.allowed).toBe(false)
      expect(result1.decisionType).toBe('dangerous')

      const result2 = checkCommandPermission('format C:', undefined, 'read-only')
      expect(result2.allowed).toBe(false)
      expect(result2.decisionType).toBe('dangerous')
    })

    it('safe 命令在 full-access 模式下放行', () => {
      const result = checkCommandPermission('ls -la', undefined, 'full-access')
      expect(result.allowed).toBe(true)
    })
  })
})
