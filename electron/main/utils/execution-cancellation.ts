import { AsyncLocalStorage } from 'node:async_hooks'

const executionSignal = new AsyncLocalStorage<AbortSignal>()

export function runWithExecutionSignal<T>(signal: AbortSignal, run: () => T): T {
  return executionSignal.run(signal, run)
}

export function getExecutionSignal(signal?: AbortSignal): AbortSignal | undefined {
  const inherited = executionSignal.getStore()
  return signal && inherited && signal !== inherited ? AbortSignal.any([signal, inherited]) : signal ?? inherited
}

/** 持久任务重新领取时建立自己的取消范围，唤醒计时器不继承登记任务的调用信号。 */
export function runWithoutExecutionSignal<T>(run: () => T): T {
  return executionSignal.exit(run)
}
