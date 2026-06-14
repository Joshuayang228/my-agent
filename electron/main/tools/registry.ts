import type { ToolDefinition, ToolCall, ToolResult } from '../../../src/shared/types'

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 执行一组工具调用。
   * 按 isConcurrencySafe 分批：安全的并发执行，不安全的串行。
   */
  async executeAll(calls: ToolCall[]): Promise<ToolResult[]> {
    const concurrent: ToolCall[] = []
    const sequential: ToolCall[] = []

    for (const call of calls) {
      const tool = this.tools.get(call.name)
      if (!tool) {
        sequential.push(call)
        continue
      }
      if (tool.metadata.isConcurrencySafe) {
        concurrent.push(call)
      } else {
        sequential.push(call)
      }
    }

    const results: ToolResult[] = []

    if (concurrent.length > 0) {
      const concurrentResults = await Promise.all(
        concurrent.map((call) => this.executeSingle(call)),
      )
      results.push(...concurrentResults)
    }

    for (const call of sequential) {
      results.push(await this.executeSingle(call))
    }

    return results
  }

  private async executeSingle(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return {
        callId: call.id,
        name: call.name,
        content: `Error: Unknown tool "${call.name}"`,
        isError: true,
      }
    }

    let args: Record<string, unknown>
    try {
      args = JSON.parse(call.arguments || '{}')
    } catch {
      return {
        callId: call.id,
        name: call.name,
        content: `Error: Invalid JSON arguments: ${call.arguments}`,
        isError: true,
      }
    }

    try {
      const content = await tool.execute(args)
      return { callId: call.id, name: call.name, content }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { callId: call.id, name: call.name, content: `Error: ${message}`, isError: true }
    }
  }
}
