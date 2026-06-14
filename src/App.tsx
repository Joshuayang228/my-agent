import { useState } from 'react'

function App() {
  const [message, setMessage] = useState('')

  const handlePing = async () => {
    const response = await window.electronAPI.ping()
    setMessage(`IPC 响应: ${response}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            My Agent
          </h1>
          <p className="text-lg text-slate-400">
            有性格、有记忆、能成长的数字伙伴
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handlePing}
            className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/25 active:scale-95"
          >
            测试 IPC 通信
          </button>
          {message && (
            <p className="text-sm text-emerald-400 animate-pulse">{message}</p>
          )}
        </div>

        <p className="text-xs text-slate-600">
          Electron + React + TypeScript + TailwindCSS
        </p>
      </div>
    </div>
  )
}

export default App
