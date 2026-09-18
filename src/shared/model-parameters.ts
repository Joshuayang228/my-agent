export const MODEL_PARAMETER_LIMITS = {
  llmTemperature: { min: 0, max: 2, step: 0.1, label: 'Temperature' },
  sessionTokenBudget: { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, label: '会话预算（Token）' },
  dailyTokenBudget: { min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, label: '每日预算（Token）' },
} as const

export type ModelParameterKey = keyof typeof MODEL_PARAMETER_LIMITS

/** 参数草稿与 IPC 共用边界，空串不是零；零预算表示不限，零 Temperature 则是有效生成参数。 */
export function modelParameterError(key: string, raw: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(MODEL_PARAMETER_LIMITS, key)) return null
  const limits = MODEL_PARAMETER_LIMITS[key as ModelParameterKey]
  const value = Number(raw)
  if (!raw.trim() || !Number.isFinite(value) || value < limits.min || value > limits.max
    || (key !== 'llmTemperature' && !Number.isSafeInteger(value))) {
    return key === 'llmTemperature' ? 'Temperature 请输入 0 到 2 之间的数字。' : `${limits.label}请输入非负整数，0 表示不限制。`
  }
  return null
}

export function readModelParameter(key: ModelParameterKey, raw: string | undefined): number | undefined {
  return raw === undefined || modelParameterError(key, raw) ? undefined : Number(raw)
}
