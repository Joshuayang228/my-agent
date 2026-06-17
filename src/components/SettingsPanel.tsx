import { useState, useEffect, useCallback } from 'react'
import { useToast } from './Toast'

interface SettingsForm {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
  personaId: string
}

interface McpServerEntry {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}

interface McpServerStatus {
  id: string
  name: string
  status: string
  toolCount: number
  error?: string
}

const DEFAULTS: SettingsForm = {
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-4o',
  llmTemperature: '0.7',
  llmTopP: '1',
  llmMaxTokens: '4096',
  systemPrompt: '',
  personaId: 'warm-partner',
}

interface PersonaInfo {
  id: string
  name: string
  description: string
}

const PRESETS: { label: string; baseUrl: string; model: string }[] = [
  { label: 'OpenAI GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { label: 'OpenAI GPT-4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { label: 'DeepSeek V4 Flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
]

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [personas, setPersonas] = useState<PersonaInfo[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([])
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([])
  const [mcpAdding, setMcpAdding] = useState(false)
  const [newMcp, setNewMcp] = useState({ name: '', command: '', args: '', env: '' })

  const refreshMcpStatus = useCallback(async () => {
    if (!window.electronAPI) return
    const statuses = await window.electronAPI.mcp.status()
    setMcpStatuses(statuses)
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.settings.get().then((s) => {
      setForm({
        llmApiKey: s.llmApiKey || '',
        llmBaseUrl: s.llmBaseUrl || DEFAULTS.llmBaseUrl,
        llmModel: s.llmModel || DEFAULTS.llmModel,
        llmTemperature: s.llmTemperature || DEFAULTS.llmTemperature,
        llmTopP: s.llmTopP || DEFAULTS.llmTopP,
        llmMaxTokens: s.llmMaxTokens || DEFAULTS.llmMaxTokens,
        systemPrompt: s.systemPrompt || '',
        personaId: s.personaId || DEFAULTS.personaId,
      })
      try {
        const servers = JSON.parse(s.mcpServers || '[]')
        setMcpServers(servers)
      } catch { /* ignore */ }
    })
    window.electronAPI.persona.list().then(setPersonas)
    refreshMcpStatus()
  }, [])

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        await window.electronAPI.settings.set(key, value)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [form])

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setForm((f) => ({ ...f, llmBaseUrl: preset.baseUrl, llmModel: preset.model }))
  }, [])

  const update = (key: keyof SettingsForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const saveMcpList = useCallback(async (servers: McpServerEntry[]) => {
    setMcpServers(servers)
    if (window.electronAPI) {
      await window.electronAPI.settings.set('mcpServers', JSON.stringify(servers))
    }
  }, [])

  const handleAddMcp = useCallback(async () => {
    if (!newMcp.name || !newMcp.command) return
    let env: Record<string, string> | undefined
    if (newMcp.env.trim()) {
      env = {}
      for (const line of newMcp.env.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
      }
    }
    const entry: McpServerEntry = {
      id: `mcp-${Date.now()}`,
      name: newMcp.name,
      command: newMcp.command,
      args: newMcp.args.split(/\s+/).filter(Boolean),
      env,
      enabled: true,
    }
    const updated = [...mcpServers, entry]
    await saveMcpList(updated)
    const result = await window.electronAPI?.mcp.connect(entry)
    if (result && !result.success) {
      toast(`MCP 连接失败: ${result.error}`, 'error')
    }
    await refreshMcpStatus()
    setNewMcp({ name: '', command: '', args: '', env: '' })
    setMcpAdding(false)
  }, [newMcp, mcpServers, saveMcpList, refreshMcpStatus, toast])

  const handleRemoveMcp = useCallback(async (id: string) => {
    await window.electronAPI?.mcp.disconnect(id)
    const updated = mcpServers.filter(s => s.id !== id)
    await saveMcpList(updated)
    await refreshMcpStatus()
  }, [mcpServers, saveMcpList, refreshMcpStatus])

  const handleToggleMcp = useCallback(async (id: string) => {
    const server = mcpServers.find(s => s.id === id)
    if (!server) return
    if (server.enabled) {
      await window.electronAPI?.mcp.disconnect(id)
      const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: false } : s)
      await saveMcpList(updated)
    } else {
      const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: true } : s)
      await saveMcpList(updated)
      await window.electronAPI?.mcp.connect({ ...server, enabled: true })
    }
    await refreshMcpStatus()
  }, [mcpServers, saveMcpList, refreshMcpStatus])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
        {/* 标题栏 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">设置</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* 人格选择 */}
        {personas.length > 0 && (
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium text-slate-400">人格模板</label>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => update('personaId', p.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    form.personaId === p.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className={`text-xs font-medium ${form.personaId === p.id ? 'text-violet-400' : 'text-slate-300'}`}>
                    {p.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{p.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 模型预设快选 */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-slate-400">快速选择模型</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  form.llmBaseUrl === p.baseUrl && form.llmModel === p.model
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">API Key</label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={form.llmApiKey}
              onChange={(e) => update('llmApiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-16 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-slate-500 transition hover:text-slate-300"
            >
              {showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        {/* Base URL */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">Base URL</label>
          <input
            type="text"
            value={form.llmBaseUrl}
            onChange={(e) => update('llmBaseUrl', e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
          />
        </div>

        {/* Model */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">模型</label>
          <input
            type="text"
            value={form.llmModel}
            onChange={(e) => update('llmModel', e.target.value)}
            placeholder="gpt-4o"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
          />
        </div>

        {/* LLM 参数 */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Temperature</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={form.llmTemperature}
              onChange={(e) => update('llmTemperature', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Top P</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={form.llmTopP}
              onChange={(e) => update('llmTopP', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Max Tokens</label>
            <input
              type="number"
              step="256"
              min="256"
              max="128000"
              value={form.llmMaxTokens}
              onChange={(e) => update('llmMaxTokens', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
            />
          </div>
        </div>

        {/* System Prompt */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">自定义补充指令（会注入到 System Prompt L3 层）</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => update('systemPrompt', e.target.value)}
            placeholder="例如：回答时多用比喻，保持简洁..."
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
          />
        </div>

        {/* MCP 服务器管理 */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">MCP 服务器</label>
            <button
              onClick={() => setMcpAdding(!mcpAdding)}
              className="rounded px-2 py-0.5 text-xs text-cyan-400 transition hover:bg-slate-800"
            >
              {mcpAdding ? '取消' : '+ 添加'}
            </button>
          </div>

          {mcpAdding && (
            <div className="mb-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <input
                type="text"
                value={newMcp.name}
                onChange={e => setNewMcp(m => ({ ...m, name: e.target.value }))}
                placeholder="名称（如 filesystem）"
                className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                value={newMcp.command}
                onChange={e => setNewMcp(m => ({ ...m, command: e.target.value }))}
                placeholder="命令（如 npx, node, python3）"
                className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                value={newMcp.args}
                onChange={e => setNewMcp(m => ({ ...m, args: e.target.value }))}
                placeholder="参数（空格分隔，如 -y @modelcontextprotocol/server-filesystem /tmp）"
                className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <textarea
                value={newMcp.env}
                onChange={e => setNewMcp(m => ({ ...m, env: e.target.value }))}
                placeholder="环境变量（每行一个，KEY=VALUE 格式，可选）"
                rows={2}
                className="mb-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleAddMcp}
                disabled={!newMcp.name || !newMcp.command}
                className="rounded bg-cyan-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40"
              >
                连接
              </button>
            </div>
          )}

          {mcpServers.length === 0 && !mcpAdding && (
            <div className="rounded-lg border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">
              暂无 MCP 服务器，点击"+ 添加"连接外部能力
            </div>
          )}

          {mcpServers.map(server => {
            const st = mcpStatuses.find(s => s.id === server.id)
            return (
              <div key={server.id} className="mb-2 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${
                      st?.status === 'connected' ? 'bg-green-400' :
                      st?.status === 'connecting' ? 'bg-yellow-400' :
                      st?.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                    }`} />
                    <span className="text-xs font-medium text-slate-200">{server.name}</span>
                    {st?.toolCount ? (
                      <span className="text-[10px] text-slate-500">{st.toolCount} tools</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    {server.command} {server.args.join(' ')}
                  </div>
                  {st?.error && (
                    <div className="mt-0.5 truncate text-[10px] text-red-400">{st.error}</div>
                  )}
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <button
                    onClick={() => handleToggleMcp(server.id)}
                    className={`rounded px-2 py-0.5 text-[10px] transition ${
                      server.enabled
                        ? 'text-yellow-400 hover:bg-slate-700'
                        : 'text-green-400 hover:bg-slate-700'
                    }`}
                  >
                    {server.enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleRemoveMcp(server.id)}
                    className="rounded px-2 py-0.5 text-[10px] text-red-400 transition hover:bg-slate-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 数据管理 */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium text-slate-400">数据管理</label>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!window.electronAPI) return
                const res = await window.electronAPI.data.export()
                if (res.success) toast(`导出成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆`, 'success')
                else if (res.error !== 'cancelled') toast(`导出失败: ${res.error}`, 'error')
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
            >
              📤 导出数据
            </button>
            <button
              onClick={async () => {
                if (!window.electronAPI) return
                const res = await window.electronAPI.data.import()
                if (res.success) toast(`导入成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆 + ${res.stats?.settings} 项设置`, 'success')
                else if (res.error !== 'cancelled') toast(`导入失败: ${res.error}`, 'error')
              }}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-500 hover:text-amber-400"
            >
              📥 导入数据
            </button>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="text-xs text-green-400">已保存</span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
