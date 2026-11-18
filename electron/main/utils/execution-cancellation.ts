import { AsyncLocalStorage } from 'node:async_hooks'

const executionSignal = new AsyncLocalStorage<AbortSignal>()

export function runWithExecutionSignal<T>(signal: AbortSignal, run: () => T): T {
  return executionSignal.run(signal, run)
}

export function getExecutionSignal(signal?: AbortSignal): AbortSignal | undefined {
  const inherited = executionSignal.getStore()
  return signal && inherited && signal !== inherited ? AbortSignal.any([signal, inherited]) : signal ?? inherited
}
