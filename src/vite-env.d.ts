/// <reference types="vite/client" />

interface ElectronAPI {
  ping: () => Promise<string>
  on: (channel: string, callback: (...args: unknown[]) => void) => void
  send: (channel: string, ...args: unknown[]) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

interface Window {
  electronAPI: ElectronAPI
}
