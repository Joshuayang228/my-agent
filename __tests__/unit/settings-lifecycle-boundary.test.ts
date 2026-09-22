import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

describe('正式设置生命周期边界', () => {
  it('所有正式设置草稿都接入统一离页闸门', () => {
    const panel = read('src/components/SettingsPanel.tsx')
    const model = read('src/components/settings/ModelRoutingSettings.tsx')
    const mcp = read('src/components/settings/McpConnectionForm.tsx')

    expect(panel).toContain("window.addEventListener('beforeunload', preventPendingLoss)")
    expect(panel).toContain('const prepareToLeave = useCallback')
    expect(panel).toContain('pendingSettingsRef.current.size')
    expect(panel).toContain('permissionSavesRef.current')
    expect(panel).toContain('modelBeforeLeaveRef.current')
    expect(panel).toContain('mcpFormBeforeLeaveRef.current')
    expect(panel).toContain('prepareToLeave().then((allowed) =>')
    expect(model).toContain('beforeLeaveRef?: Ref<() => boolean>')
    expect(model).toContain('useImperativeHandle(beforeLeaveRef')
    expect(mcp).toContain('beforeLeaveRef?: Ref<() => boolean>')
    expect(mcp).toContain('useImperativeHandle(beforeLeaveRef')
  })
})
