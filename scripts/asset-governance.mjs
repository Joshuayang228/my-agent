/**
 * 资产家族治理清单。
 *
 * 这是门禁的治理元数据，不是资产正文真相源。每个家族必须能回到真实注册表、loader 或运行时发现入口。
 */
export const ASSET_GOVERNANCE = [
  {
    id: 'prompt', labelZh: 'Prompt', kind: 'static', modelContextTypes: ['prompt'],
    sourcePaths: ['electron/main/prompts/registry.ts', 'electron/main/prompts/keys.ts'],
    registryPaths: ['electron/main/prompts/registry.ts'], discovery: '显式注册表',
    keyRule: 'prompt:<稳定语义 key>', display: 'Debug / 提示词管理器', usageEvidence: 'llm-input',
  },
  {
    id: 'companion', labelZh: '伙伴资产', kind: 'static', modelContextTypes: ['companion-manifest', 'companion-profile', 'companion-world', 'companion-scene', 'companion-life'],
    sourcePaths: ['electron/main/companion/asset-registry.ts', 'electron/main/companion/identity', 'electron/main/companion/cast', 'electron/main/companion/life'],
    registryPaths: ['electron/main/companion/asset-registry.ts'], discovery: 'Role Pack manifest / loader',
    keyRule: 'companion:<universe>:<role>:<kind>', display: 'Debug / 伙伴世界', usageEvidence: 'llm-input / memory-operation',
  },
  {
    id: 'memory-strategy', labelZh: '记忆策略', kind: 'static', modelContextTypes: ['memory-strategy'],
    sourcePaths: ['electron/main/memory/strategy-registry.ts'], registryPaths: ['electron/main/memory/strategy-registry.ts'], discovery: '显式注册表',
    keyRule: 'memory-strategy:<稳定 key>', display: 'Debug / 资产目录', usageEvidence: 'memory-operation',
  },
  {
    id: 'permission-sandbox', labelZh: '权限与沙箱策略', kind: 'static', modelContextTypes: ['permission-policy', 'sandbox-policy'],
    sourcePaths: ['electron/main/sandbox/asset-registry.ts', 'electron/main/sandbox'], registryPaths: ['electron/main/sandbox/asset-registry.ts'], discovery: '显式注册表',
    keyRule: 'permission-policy:<key> / sandbox-policy:<key>', display: 'Debug / 权限与安全', usageEvidence: 'permission-decision',
  },
  {
    id: 'eval', labelZh: 'Eval 用例与评分器', kind: 'static', modelContextTypes: ['eval-case', 'eval-grader', 'eval-judge'],
    sourcePaths: ['evals/asset-registry.ts', 'evals/scenario-registry.ts', 'evals/graders'], registryPaths: ['evals/asset-registry.ts', 'evals/scenario-registry.ts'], discovery: 'scenario registry + grader registry',
    keyRule: 'eval-case:<key> / eval-grader:<key> / eval-judge:<key>', display: 'Debug / Eval', usageEvidence: 'llm-input',
  },
  {
    id: 'provider', labelZh: 'Provider 资产', kind: 'static', modelContextTypes: ['provider-capability', 'provider-policy', 'provider-preset'],
    sourcePaths: ['electron/main/llm/provider-asset-registry.ts', 'src/shared/provider-presets.ts'], registryPaths: ['electron/main/llm/provider-asset-registry.ts', 'src/shared/provider-presets.ts'], discovery: '共享预设 + 适配器派生',
    keyRule: 'provider-capability:<key> / provider-policy:<key> / provider-preset:<key>', display: 'Debug / Provider', usageEvidence: 'provider-route / provider-policy',
  },
  {
    id: 'subagent-role', labelZh: 'SubAgent 角色', kind: 'static', modelContextTypes: ['subagent-role'],
    sourcePaths: ['electron/main/agent/subagent-asset-registry.ts', 'electron/main/agent/subagent.ts'], registryPaths: ['electron/main/agent/subagent-asset-registry.ts'], discovery: '显式角色注册表',
    keyRule: 'subagent-role:<role id>', display: 'Debug / 资产目录', usageEvidence: 'subagent-role',
  },
  {
    id: 'tool', labelZh: '工具 schema', kind: 'runtime-auto-discovered', modelContextTypes: ['tool-schema'],
    sourcePaths: ['electron/main/tools/registry.ts', 'electron/main/tools/builtins', 'electron/main/mcp'], registryPaths: ['electron/main/tools/registry.ts'], discovery: 'ToolRegistry + MCP bridge 运行时聚合',
    keyRule: 'tool-schema:<tool name>', display: 'Debug / 工具', usageEvidence: 'tool-available / tool-execution',
  },
  {
    id: 'skill', labelZh: 'Skill', kind: 'runtime-auto-discovered', modelContextTypes: ['skill'],
    sourcePaths: ['electron/main/skills/registry.ts', 'electron/main/skills'], registryPaths: ['electron/main/skills/registry.ts'], discovery: 'Skill loader 运行时加载',
    keyRule: 'skill:<skill name>', display: 'Debug / Skill', usageEvidence: 'skill-activation',
  },
  {
    id: 'icon', labelZh: 'Lucide 图标', kind: 'static-renderer', modelContextTypes: [],
    sourcePaths: ['src/shared/icon-registry.ts'], registryPaths: ['src/shared/icon-registry.ts'], discovery: '显式语义注册表',
    keyRule: '<category>.<semantic-name>', display: 'Playground / 设计 / 图标', usageEvidence: '不记录 Agent 运行证据',
  },
  {
    id: 'ui-component', labelZh: 'UI 组件', kind: 'static-renderer', modelContextTypes: [],
    sourcePaths: ['src/shared/ui-component-registry.ts', 'src/shared/foundation-story-registry.ts', 'src/components'], registryPaths: ['src/shared/ui-component-registry.ts', 'src/shared/foundation-story-registry.ts'], discovery: '组件资产 + Foundation 故事注册表显式登记',
    keyRule: '<category>.<component-name>', display: 'Playground / 设计 / 组件目录', usageEvidence: '不记录 Agent 运行证据',
  },
  {
    id: 'product-experience', labelZh: '产品体验', kind: 'static-renderer', modelContextTypes: [],
    sourcePaths: ['src/shared/product-experience-registry.ts', 'src/assets/playground'], registryPaths: ['src/shared/product-experience-registry.ts'], discovery: '显式体验依赖注册表',
    keyRule: 'experience.<stable-key>', display: 'Playground / 产品体验', usageEvidence: '基础依赖关系',
  },
  {
    id: 'design', labelZh: '主题与设计 Token', kind: 'static-renderer', modelContextTypes: [],
    sourcePaths: ['src/shared/design-asset-registry.ts', 'src/index.css'], registryPaths: ['src/shared/design-asset-registry.ts'], discovery: '显式设计资产注册表',
    keyRule: 'theme id / font scale id', display: 'Settings / Playground / 正式页面', usageEvidence: '不记录 Agent 运行证据',
  },
]
