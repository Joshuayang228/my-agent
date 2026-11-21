import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig(({ mode }) => {
  const isUiE2E = mode === 'ui-e2e'
  return {
    server: {
      // Electron 开发窗口统一走 IPv4，避免 Windows localhost 优先命中旧的 IPv6 服务。
      host: '127.0.0.1',
      strictPort: isUiE2E,
      // 文档与验收产物不是应用模块，HTML 变更会干扰正在验收的页面；按目录隔离，
      // 不全局忽略 Markdown / HTML，保留 src 与 electron 中真实资产的开发更新。
      watch: { ignored: [
        '**/var/verification/**', '**/test-results/**',
        '**/docs/**', '**/methodology/**', '**/agent-skills/**', '**/.agents/skills/**',
        '**/_reference/**', '**/_archive/**',
      ] },
    },
    optimizeDeps: {
      // 背景：未声明 entries 时 Vite 会递归扫描全仓 HTML，误入 _reference/framework-harness/repos/cc-switch 报缺无关依赖（WISH-028）。
      // 设计意图：将预构建扫描入口收敛到本应用真实 HTML 入口，避免参考仓库污染开发冷启动。
      // 关键约束：ui-e2e 模式需同步包含 markdown-theme 验收页入口，不得破坏 E2E 预构建。
      entries: isUiE2E
        ? ['index.html', '__tests__/fixtures/markdown-theme.html']
        : ['index.html'],
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
      },
    },
    build: {
      rollupOptions: {
        ...(isUiE2E ? { input: { app: path.resolve(__dirname, 'index.html'), markdownTheme: path.resolve(__dirname, '__tests__/fixtures/markdown-theme.html') } } : {}),
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
              return 'react-vendor'
            }
            if (id.includes('react-markdown') || id.includes('remark-gfm')) {
              return 'markdown'
            }
            if (id.includes('react-syntax-highlighter')) {
              return 'syntax-hl'
            }
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(isUiE2E ? [] : [electron({
        main: {
          entry: 'electron/main/index.ts',
          vite: {
            build: {
              commonjsOptions: { ignoreDynamicRequires: true },
              // Vite 8 的 Electron 插件预置 rolldownOptions；旧键会被预置项遮蔽，导致原生依赖误打包。
              rolldownOptions: {
                external: [
                  'sql.js', 'vectra', 'zod', 'sharp',
                  /^@modelcontextprotocol\//,
                  /^vectra\//,
                  /^zod\//,
                ],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              rollupOptions: {
                output: {
                  // Electron preload 需 CJS；ESM .mjs 会在 sandbox:false / Node 加载时炸 require
                  format: 'cjs',
                  entryFileNames: 'index.cjs',
                  inlineDynamicImports: true,
                },
              },
            },
          },
        },
      })]),
    ],
    clearScreen: false,
  }
})
