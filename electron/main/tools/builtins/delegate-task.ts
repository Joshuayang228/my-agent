import { buildTool } from '../builder'
import { runSubAgent } from '../../agent/subagent'
import type { ToolRegistry } from '../registry'
import { loadAuxLLMConfig } from '../../llm/aux-config'

const MAX_ROLE_LENGTH = 500
const MAX_TASK_LENGTH = 100_000
const MAX_ALLOWED_TOOLS_LENGTH = 10_000
const MAX_ALLOWED_TOOLS = 100


/**
 * 根据委派参数判断这次调用是否可能产生副作用。
 *
 * 背景：delegate_task 的 researcher/analyst 通常只读，但 coder 或显式 read_only=false
 * 可以获得编辑、Shell 等工具；静态标成只读会绕过 auto 模式确认。
 * 设计意图：只在能够证明子 Agent 最终只读时标只读，其余情况 fail-closed。
 * 关键约束：显式 read_only=true 会在 buildChildRegistry 再过滤破坏性工具。
 */
export function resolveDelegateTaskMetadata(args: Record<string, unknown>) {
  const rawReadOnly = args.read_only
  let isReadOnly: boolean
  if (rawReadOnly !== undefined) {
    isReadOnly = typeof rawReadOnly === 'string' && rawReadOnly !== 'false'
  } else {
    const role = typeof args.role === 'string' ? args.role.trim().toLowerCase() : ''
    const hasExplicitTools = typeof args.allowed_tools === 'string' && args.allowed_tools.trim().length > 0
    isReadOnly = role === 'researcher' || role === 'analyst' || (role !== 'coder' && !hasExplicitTools)
  }
  return {
    isReadOnly,
    isDestructive: !isReadOnly,
    isConcurrencySafe: isReadOnly,
  }
}

export const delegateTaskTool = buildTool({
  name: 'delegate_task',
  description: "把任务委派给运行在隔离上下文、拥有独立工具集的专门子 Agent。\n\n适用场景（Alice Ch.6）：\n- 并发执行型任务：需要并行查询多个数据源或分析多个独立文件\n- Research 与 Implementation 拆分：先让子 Agent 研究，父 Agent 综合后再启动新的子 Agent 实现\n- 独立子任务：任务边界清晰，不依赖父 Agent 的对话上下文\n- 召唤子会话帮忙干活：可以委派查找或修改；子 Agent 是匿名任务工，不是另一个卡司，结果由父 Agent 用角色语气转述\n\n不适用场景：\n- 信息积累型任务：任务必须持续积累同一份上下文，应由单个 Agent 串行处理\n- 简单单次工具调用：直接调用工具，不需要子 Agent 包装\n- 需要多轮对话澄清：子 Agent 不能向用户提问\n- 把子 Agent 当成另一个朋友角色：卡司使用召唤会话，技术工作使用本工具\n\n典型场景：\n- 分析 docs/ 下所有 Markdown 文件并提取标题和摘要\n- 查询五个城市的天气并汇总对比\n- 研究 src/auth/ 的代码结构并找出所有 API 入口\n\n预设角色：\n- researcher：只读研究，默认使用 file_read、code_search、web_search、url_fetch、rag_search\n- coder：代码修改，默认使用 file_read、file_edit、file_write、apply_patch、code_search、shell_exec\n- analyst：只读分析，默认使用 file_read、code_search、rag_search\n其他 role 会作为自由角色描述处理，默认只提供只读工具。\n\n继续同一个子 Agent：返回结果包含 Agent ID。需要带着原上下文继续时，调用 continue_task(agent_id, message)，不要重新创建。",
  parameters: {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        description: "子 Agent 的角色或专长。优先使用 researcher、coder、analyst 预设，也可提供自由描述，例如“API 测试员”。",
      },
      task: {
        type: 'string',
        description: "要委派的具体任务。必须清晰且自包含，因为子 Agent 看不到当前用户对话。",
      },
      allowed_tools: {
        type: 'string',
        description: "子 Agent 可使用的工具名，以逗号分隔，例如 file_read,code_search。省略时使用角色预设工具。",
      },
      read_only: {
        type: 'string',
        description: "是否将子 Agent 限制为只读操作；true 为只读，false 为可写。",
      },
    },
    required: ['role', 'task'],
  },
  inputExamples: [
    { role: 'researcher', task: '查找所有导入已弃用 auth 模块的文件，并列出文件路径和行号。' },
    { role: 'coder', task: '为 src/auth.ts 中的登录处理器增加输入校验', allowed_tools: 'file_read,file_edit', read_only: 'false' },
  ],
  metadata: {
    // 参数未知时按可写处理；resolveMetadata 仅对可证明只读的委派降级风险。
    isReadOnly: false,
    isDestructive: true,
    isConcurrencySafe: false,
    longRunning: true,       // G7: 子 Agent 跑完整循环，跳过 30s 工具超时
  },
  resolveMetadata: resolveDelegateTaskMetadata,
  execute: async (args, toolContext) => {  // ← 修复：接收 toolContext 参数
    if (typeof args.role !== 'string' || !args.role.trim() || args.role.length > MAX_ROLE_LENGTH) return '[错误] role 为空或过长'
    if (typeof args.task !== 'string' || !args.task.trim() || args.task.length > MAX_TASK_LENGTH) return '[错误] task 为空或过长'
    if (args.allowed_tools !== undefined && (typeof args.allowed_tools !== 'string' || args.allowed_tools.length > MAX_ALLOWED_TOOLS_LENGTH)) return '[错误] allowed_tools 参数无效或过长'
    if (args.read_only !== undefined && args.read_only !== 'true' && args.read_only !== 'false') return '[错误] read_only 必须是 true 或 false'
    const role = args.role
    const task = args.task
    const allowedToolsStr = args.allowed_tools
    const readOnly = args.read_only !== 'false'

    const allowedTools = allowedToolsStr
      ? allowedToolsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    if (allowedTools && (allowedTools.length > MAX_ALLOWED_TOOLS || allowedTools.some((name) => !/^[A-Za-z0-9_.:-]{1,200}$/.test(name)))) {
      return '[错误] allowed_tools 包含无效名称或数量过多'
    }

    // G2: 子 Agent 走辅助配置工厂（auxModel + thinking 策略），禁止手拼密钥
    const llmConfig = await loadAuxLLMConfig()

    // G0 修复：从 toolContext 取 registry（runtime.ts 已带入）
    if (!toolContext?.registry) {
      return '[错误] 子 Agent 系统未初始化，toolContext 中没有工具注册表。'
    }

    // M26-G2：仅 main/summon（或未标记）可委派；避免 tools→companion 反向依赖
    const sk = toolContext.sessionKind
    if (sk != null && sk !== '' && sk !== 'main' && sk !== 'summon') {
      return '[错误] 当前会话类型不允许委派子 Agent。'
    }

    const registry = toolContext.registry as ToolRegistry

    const result = await runSubAgent(
      {
        role,
        task,
        allowedTools,
        readOnly: args.read_only !== undefined ? readOnly : undefined,  // 未显式传时交给角色预设决定
        parentSpanId: toolContext.parentSpanId,       // G1: 传入父 span ID
        toolContext,                                   // G5: 含 sessionKind → M26 任务工边界
        parentExecutionMode: toolContext.executionMode, // G4: 权限只降不升
      },
      llmConfig,
      registry,
      toolContext.signal,  // 传入取消信号
    )

    const header = result.success ? '✅ 子 Agent 已完成' : '❌ 子 Agent 失败'
    const meta = result.toolsUsed.length > 0
      ? `\n使用工具：${result.toolsUsed.join(', ')}（${result.iterations} 次迭代）`
      : ''
    // 带上 agent ID，供 LLM 后续用 continue_task 追加消息
    const idLine = result.agentId ? `\nAgent ID：${result.agentId}（使用 continue_task 发送后续消息）` : ''

    return `${header}${meta}${idLine}\n\n${result.content}`
  },
})
