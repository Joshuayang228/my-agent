/**
 * 敏感记忆类别启发式（M29-G3）
 *
 * 背景：健康/财务/凭据等入库后难察觉，面板需高亮；采集侧要有克制提示。
 * 意图：对正文做轻量关键词匹配，产出种类标签 + 中文提示；不调用 LLM。
 * 约束：偏召回宁可误标（可忽略），不作硬拦；主进程与渲染进程共用。
 */

export type SensitiveKind =
  | 'health'
  | 'finance'
  | 'credentials'
  | 'privacy_path'
  | 'workplace'

const PATTERNS: { kind: SensitiveKind; re: RegExp }[] = [
  {
    kind: 'health',
    re: /病历|诊断|处方|抑郁症|抗抑|血糖|血压|怀孕|流产|HIV|癌症|心理咨询|就医|处方药/i,
  },
  {
    kind: 'finance',
    re: /银行卡|工资|年薪|收入|贷款|欠债|信用卡|支付宝密码|理财|股票账户|税号|社保号/i,
  },
  {
    kind: 'credentials',
    re: /api[_ ]?key|secret[_ ]?key|password|passwd|token|私钥|密码是|口令|access[_ ]?key|sk-[a-z0-9]/i,
  },
  {
    kind: 'privacy_path',
    re: /身份证|护照号|家庭住址|门牌|手机号|电话是\s*\d|微信号是|私人邮箱/i,
  },
  {
    kind: 'workplace',
    re: /公司机密|未公开|内部财报|竞品情报|客户名单|保密协议|NDA|商业机密/i,
  },
]

const LABELS: Record<SensitiveKind, string> = {
  health: '健康',
  finance: '财务',
  credentials: '凭据',
  privacy_path: '隐私标识',
  workplace: '职场机密',
}

/** 检测正文命中的敏感种类（去重保序） */
export function detectSensitiveKinds(text: string): SensitiveKind[] {
  const t = (text || '').trim()
  if (!t) return []
  const hit: SensitiveKind[] = []
  for (const { kind, re } of PATTERNS) {
    if (re.test(t) && !hit.includes(kind)) hit.push(kind)
  }
  return hit
}

export function labelSensitiveKinds(kinds: SensitiveKind[]): string {
  return kinds.map((k) => LABELS[k]).join('·')
}

/** 面板/入库短提示 */
export function formatSensitiveCollectionHint(kinds: SensitiveKind[]): string {
  if (!kinds.length) return ''
  return `可能含敏感信息（${labelSensitiveKinds(kinds)}）。确认需要长期记住吗？可删可改；勿记密码/密钥原文。`
}

/** 写入工具返回时的附注 */
export function formatSensitiveRememberNote(kinds: SensitiveKind[]): string {
  if (!kinds.length) return ''
  return ` ⚠ Sensitive (${kinds.join(', ')}): prefer not storing secrets/credentials; user can delete in Memory panel.`
}

export const __test = { PATTERNS, LABELS }
