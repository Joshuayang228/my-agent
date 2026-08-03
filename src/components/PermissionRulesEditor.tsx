/**
 * 自定义权限规则可视化编辑器（替代裸 JSON textarea）
 */
import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  createEmptyPermissionRule,
  parsePermissionRulesJson,
  serializePermissionRules,
  type PermissionRuleAction,
  type PermissionRuleForm,
  type PermissionRuleType,
} from '../shared/permission-rules'

interface PermissionRulesEditorProps {
  value: string
  onChange: (json: string) => void
}

const TYPE_LABELS: Record<PermissionRuleType, string> = {
  command: '命令',
  tool: '工具',
  path: '路径',
}

const ACTION_LABELS: Record<PermissionRuleAction, string> = {
  allow: '允许',
  deny: '拒绝',
  ask: '询问',
}

export function PermissionRulesEditor({ value, onChange }: PermissionRulesEditorProps) {
  const parsed = useMemo(() => parsePermissionRulesJson(value), [value])
  const [showJson, setShowJson] = useState(false)
  const [jsonDraft, setJsonDraft] = useState(value)
  const [jsonError, setJsonError] = useState('')

  const rules: PermissionRuleForm[] = parsed.ok ? parsed.rules : []

  const commit = (next: PermissionRuleForm[]) => {
    onChange(serializePermissionRules(next))
  }

  const patchRule = (id: string, patch: Partial<PermissionRuleForm>) => {
    commit(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRule = (id: string) => {
    commit(rules.filter((r) => r.id !== id))
  }

  const addRule = () => {
    commit([...rules, createEmptyPermissionRule()])
  }

  const applyJsonDraft = () => {
    const r = parsePermissionRulesJson(jsonDraft)
    if (!r.ok) {
      setJsonError(r.error)
      return
    }
    setJsonError('')
    onChange(serializePermissionRules(r.rules))
    setShowJson(false)
  }

  return (
    <div className="space-y-3">
      {!parsed.ok && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          当前 JSON 无法解析：{parsed.error}。请用下方「高级 JSON」修复。
        </p>
      )}

      {parsed.ok && rules.length === 0 && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          暂无自定义规则。引擎仍走默认沙箱与审批链；需要时可添加「拒绝 npm publish」等硬规则。
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-lg border px-2.5 py-2"
            style={{ borderColor: 'var(--border-color)', opacity: rule.enabled ? 1 : 0.55 }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => patchRule(rule.id, { enabled: e.target.checked })}
                />
                启用
              </label>
              <select
                value={rule.type}
                onChange={(e) => patchRule(rule.id, { type: e.target.value as PermissionRuleType })}
                className="theme-input rounded border px-1.5 py-1 text-[11px] outline-none"
              >
                {(Object.keys(TYPE_LABELS) as PermissionRuleType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <select
                value={rule.action}
                onChange={(e) => patchRule(rule.id, { action: e.target.value as PermissionRuleAction })}
                className="theme-input rounded border px-1.5 py-1 text-[11px] outline-none"
              >
                {(Object.keys(ACTION_LABELS) as PermissionRuleAction[]).map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px]"
                style={{ color: 'var(--text-muted)' }}
                title="删除规则"
              >
                <Trash2 size={12} />
                删除
              </button>
            </div>
            <input
              value={rule.pattern}
              onChange={(e) => patchRule(rule.id, { pattern: e.target.value })}
              placeholder={
                rule.type === 'command'
                  ? '匹配命令，如 npm publish'
                  : rule.type === 'tool'
                    ? '匹配工具名，如 shell_exec 或 mcp:server:*'
                    : '匹配路径片段'
              }
              className="theme-input mb-1.5 w-full rounded border px-2 py-1.5 font-mono text-xs outline-none"
            />
            <input
              value={rule.description || ''}
              onChange={(e) => patchRule(rule.id, { description: e.target.value })}
              placeholder="说明（可选）"
              className="theme-input w-full rounded border px-2 py-1 text-[11px] outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRule}
          disabled={!parsed.ok}
          className="settings-option inline-flex items-center gap-1 px-3 py-1.5 text-xs"
        >
          <Plus size={12} />
          添加规则
        </button>
        <button
          type="button"
          onClick={() => {
            setJsonDraft(value)
            setJsonError('')
            setShowJson((v) => !v)
          }}
          className="text-[11px] underline-offset-2 hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          {showJson ? '收起高级 JSON' : '高级：编辑 JSON'}
        </button>
      </div>

      {showJson && (
        <div className="space-y-2">
          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={6}
            spellCheck={false}
            className="theme-input w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none transition"
          />
          {jsonError && (
            <p className="text-[11px]" style={{ color: 'var(--danger, #c44)' }}>{jsonError}</p>
          )}
          <button
            type="button"
            onClick={applyJsonDraft}
            className="settings-option px-3 py-1.5 text-xs"
          >
            应用 JSON
          </button>
        </div>
      )}
    </div>
  )
}
