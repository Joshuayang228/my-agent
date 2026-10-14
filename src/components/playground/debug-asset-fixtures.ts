import type { ModelContextAssetType } from '../../shared/types'

export interface DebugAssetFixture {
  uses?: Readonly<Partial<Record<'lin' | 'yu', '身份' | '成长与关系' | '行为' | '生活情境' | '工具环境' | '输出协议'>>>
  key: string
  label: string
  assetType: ModelContextAssetType
  group: string
  kind: '常量' | '模板' | '结构'
  roles: readonly string[]
  version: string
  fingerprint: string
  source: string
  ownership: string
  summary: string
  preview: string
  slots: readonly string[]
}

/**
 * 背景：提示词工作台必须验收分组、正文搜索和插槽，不可用真实人物资料制作样张。
 * 设计意图：使用明确标为演示的短正文与结构，每个资产类型都有独立例子，不导入生产定义。
 * 关键约束：demo key / 指纹不是生产身份；source 仅说明正式接线来源，preview 绝不发送给模型。
 */
function sample(key: string, label: string, assetType: ModelContextAssetType, group: string, source: string, preview: string, options: Partial<DebugAssetFixture> = {}): DebugAssetFixture {
  return { key: `demo.${key}`, label, assetType, group, source, kind: '结构', roles: [], version: '样张 v1', fingerprint: `demo:${key}`, ownership: '平台', summary: '仅用于诊断展示验收；不代表当前生产定义。', preview, slots: [], ...options }
}

export const DEBUG_ASSET_FIXTURES: readonly DebugAssetFixture[] = [
  sample('prompt.main', '主对话语义编译', 'prompt', '平台 / 行为', 'electron/main/prompts/compiler.ts', '【隔离模板演示】\n用途：和用户共同整理一份虚构旅行计划。\n人物表达：{{role_voice}}\n当前生活：{{life_context}}\n工具环境：{{tool_environment}}\n以上变量分别注入，不改写稳定身份。', { uses: { lin: '行为' }, kind: '模板', slots: ['role_voice', 'life_context', 'tool_environment'], version: '样张 v3' }),
  sample('prompt.identity', '稳定身份 · 林', 'prompt', '人物定义', 'Role Pack protected.md', '【隔离正文演示】\n你是样张人物林，喜欢把旅行照片整理成小册子。\n与用户交流时温和直接；未确认的经历保留为未知。', { kind: '常量', uses: { lin: '身份' }, roles: ['lin'], ownership: '角色包' }),
  sample('prompt.growth', '成长覆盖 · 林', 'prompt', '人物定义', 'growth/mutable-store.ts', '【隔离正文演示】\n用户最近希望先听简短结论，再展开依据。\n此偏好是成长内容，不替换人物身份。', { kind: '常量', uses: { lin: '成长与关系' }, roles: ['lin'], ownership: '运行时覆盖' }),
  sample('role.lin', '人物定义 · 林', 'companion-profile', '人物定义', 'identity/loader.ts · profile.json', '【隔离结构演示】\n表达：温暖、直接\n稳定兴趣：摄影、散步\n故事来源：尚未补充', { uses: { lin: '身份' }, roles: ['lin'], ownership: '角色包', version: '样张 v2' }),
  sample('role.yu', '人物清单 · 予', 'companion-manifest', '人物定义', 'identity/loader.ts · manifest.json', '【隔离结构演示】\n角色：予\n状态：候选\n关系资料：未确认', { uses: { yu: '身份' }, roles: ['yu'], ownership: '角色包' }),
  sample('world.lin', '默认世界 · 林', 'companion-world', '世界与生活', 'identity/loader.ts · world.default.json', '【隔离结构演示】\n居所：样张书房\n时区：Asia/Shanghai\n默认地点来源：角色包', { uses: { lin: '生活情境' }, roles: ['lin'], ownership: '角色包' }),
  sample('scene.lin', '交流场景 · 林', 'companion-scene', '世界与生活', 'cast/scene-prompts.ts', '【隔离模板演示】\n交流场景：{{scene_context}}\n场景只改变当前表达，不切换主角。', { uses: { lin: '生活情境' }, kind: '模板', roles: ['lin'], slots: ['scene_context'], ownership: '角色包' }),
  sample('life.lin', '生活资产定义 · 林', 'companion-life', '世界与生活', 'companion/asset-registry.ts', '【隔离结构演示】\n资产类型：书架\n初始来源：角色包\n真实资产存储与定义分开。', { uses: { lin: '生活情境' }, roles: ['lin'], ownership: '角色包' }),
  sample('tool.read', '读取工具', 'tool-schema', '工具与技能', 'ToolRegistry', '【隔离结构演示】\n工具：read\n能力：读取\n参数：path\n这里只读展示，不执行工具。'),
  sample('skill.travel', '旅行整理技能', 'skill', '工具与技能', 'Skills loader', '【隔离正文演示】\n整理用户提供的旅行资料；缺少地点和日期时先确认。\n仅使用已获授权的读取能力。', { kind: '常量', ownership: '用户' }),
  sample('memory.extract', '记忆提取策略', 'memory-strategy', '记忆策略', 'memory/strategy-registry.ts', '【隔离结构演示】\n对象：用户明确表达的偏好\n范围：人物分桶与共享范围分别记录\n不把推测当作事实。'),
  sample('permission.read', '工具权限策略', 'permission-policy', '权限与沙箱', 'permission production definitions', '【隔离结构演示】\n读取规则示例\n当前定义与当次权限命中分别追踪。'),
  sample('sandbox.scope', '沙箱范围策略', 'sandbox-policy', '权限与沙箱', 'sandbox production definitions', '【隔离结构演示】\n范围：样张工作区\n此值不改变真实沙箱。'),
  sample('eval.case', '人物验收输入', 'eval-case', '验收定义', 'Persona Eval cases', '【隔离结构演示】\n场景：用户提出模糊的旅行要求\n观察：是否询问缺失材料'),
  sample('eval.grader', '验收判定规则', 'eval-grader', '验收定义', 'Eval grader definitions', '【隔离结构演示】\n规则：检查工具边界\n失败：调用未允许的工具'),
  sample('eval.judge', '模型裁判模板', 'eval-judge', '验收定义', 'Eval judge definitions', '【隔离模板演示】\n评估样张回复：{{candidate_reply}}\n输出判定与可引用证据。', { kind: '模板', slots: ['candidate_reply'] }),
  sample('provider.capability', '模型适配器能力', 'provider-capability', '模型与调度', 'llm/provider-asset-registry.ts', '【隔离结构演示】\n适配器已支持字段与实时厂商规格分开。'),
  sample('provider.policy', '模型调用策略', 'provider-policy', '模型与调度', 'llm/provider-asset-registry.ts', '【隔离结构演示】\n策略：统一装配\n不包含用户端点、密钥或回退配置。'),
  sample('provider.preset', '连接入口预设', 'provider-preset', '模型与调度', 'src/shared/provider-presets.ts', '【隔离结构演示】\n预设名称与模型 ID 分开\n模型由实际账户配置。'),
  sample('subagent.role', '子任务角色定义', 'subagent-role', '模型与调度', 'agent/subagent-asset-registry.ts', '【隔离正文演示】\n仅处理获分配的资料整理任务，记录来源与结论。', { kind: '常量' }),
]

/** 背景：人物目录需要区分明确用途和平台共用；意图：消费登记关系，不靠正文猜注入。
 * 关键约束：没有用途关联的角色资产显示未登记关联；平台共用不证明任何一次请求实际使用。
 */
export function debugAssetGroup(asset: DebugAssetFixture, role: string): string {
  if (role === 'all') return asset.group
  const purpose = role === 'lin' || role === 'yu' ? asset.uses?.[role] : undefined
  return purpose ?? (asset.roles.includes(role) ? '未登记关联' : '平台共用')
}
