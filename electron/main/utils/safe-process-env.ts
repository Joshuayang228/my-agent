/**
 * 子进程环境变量安全边界。
 *
 * 背景：Electron 主进程可能持有 LLM/API 凭据；Terminal、shell 工具和 MCP
 * 子进程不应无意继承这些凭据，否则普通命令或第三方 MCP Server 就能读取它们。
 * 设计意图：默认继承常规运行环境（PATH、HOME 等），过滤明显的凭据键；
 * 调用方若确实需要额外凭据，必须通过显式 overrides 传入。
 * 关键约束：只过滤继承环境，不修改 process.env；显式 overrides 代表用户主动配置。
 */

const SECRET_ENV_KEY_PATTERN = /(?:API[_-]?KEY|ACCESS[_-]?TOKEN|AUTH(?:ORIZATION)?|CLIENT[_-]?SECRET|PRIVATE[_-]?KEY|PASSWORD|CREDENTIAL|^SECRET$|^TOKEN$)/i

export function buildSafeChildProcessEnv(
  overrides?: Record<string, string>,
): NodeJS.ProcessEnv {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !SECRET_ENV_KEY_PATTERN.test(key)),
  )
  return { ...inherited, ...overrides }
}
