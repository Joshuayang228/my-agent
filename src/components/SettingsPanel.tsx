import { useState, useEffect, useCallback } from 'react'

interface SettingsForm {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  systemPrompt: string
  personaId: string
}

const DEFAULTS: SettingsForm = {
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-4o',
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
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [personas, setPersonas] = useState<PersonaInfo[]>([])

  useEffect(() => {
    window.electronAPI.settings.get().then((s) => {
      setForm({
        llmApiKey: s.llmApiKey || '',
        llmBaseUrl: s.llmBaseUrl || DEFAULTS.llmBaseUrl,
        llmModel: s.llmModel || DEFAULTS.llmModel,
        systemPrompt: s.systemPrompt || '',
        personaId: s.personaId || DEFAULTS.personaId,
      })
    })
    window.electronAPI.persona.list().then(setPersonas)
  }, [])

  const handleSave = useCallback(async () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
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

        {/* System Prompt */}
        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">自定义补充指令（会注入到 System Prompt L3 层）</label>
          <textarea
            value={form.systemPrompt}
            onChange={(e) => update('systemPrompt', e.target.value)}
            placeholder="例如：回答时多用比喻，保持简洁..."
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
          />
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
