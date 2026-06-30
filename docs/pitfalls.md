# 踩坑记录

> 开发过程中遇到的坑和解决方案，避免重复踩坑。

## Git 推送代理

**问题**：`git push` 报 `Failed to connect to 127.0.0.1 port XXXX`

**原因**：Git 全局代理端口与实际代理软件端口不一致（端口会变化）

**解决**：确认当前代理端口后更新配置
```bash
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

> 历史变化：7897 → 7892 → 7897

## sql.js WASM 路径

**问题**：`ENOENT: no such file or directory, open '...dist/dist/sql-wasm.wasm'`

**原因**：`sql-wasm.wasm` 文件路径解析时多嵌套了一层 `dist`

**解决**：在 `database.ts` 中使用 `createRequire` 加载 sql.js，`locateFile` 回调中正确拼接 WASM 路径

## better-sqlite3 → sql.js

**问题**：`better-sqlite3` 是 native 模块，在 Electron ESM 环境中 `__filename` 未定义 + 编译版本不匹配

**解决**：放弃 `better-sqlite3`，改用 `sql.js`（WASM 方案，无需编译）

## react-markdown v9 className

**问题**：`react-markdown` v9 移除了 `className` prop

**解决**：用 `<div className="markdown-body">` 包裹 `<ReactMarkdown>` 组件

## 模型选择器点不动

**问题**：顶栏模型选择器下拉菜单打开后立即关闭

**原因**：`document` 上的 `click` 监听器触发冒泡关闭了菜单

**解决**：在 button 和 menu item 的 `onClick` 中加 `e.stopPropagation()`

## PowerShell heredoc 不兼容

**问题**：`git commit -m "$(cat <<'EOF' ... EOF)"` 在 PowerShell 中报语法错误

**解决**：使用简短单行 `-m` 格式

## .env 变量不加载到设置默认值

**问题**：settings-store.ts 的 `DEFAULTS` 对象在模块加载时初始化，而 `dotenv.config()` 在 `index.ts` 中后执行，导致 `process.env.LLM_API_KEY` 为 `undefined`

**解决**：将 `DEFAULTS` 从静态对象改为惰性函数 `getDefaults()`，每次读取时动态获取 `process.env`

## SQLite 空字符串覆盖 .env 默认值

**问题**：用户没手动设置 API Key 时，SQLite 里存了空字符串 `""`，`getSetting` 返回空字符串而不是 fallback 到 `.env` 默认值

**解决**：`getSetting` 和 `getAllSettings` 中对空字符串值执行 fallback，与"无记录"逻辑一致

## Embedding API 404 不停重试

**问题**：DeepSeek 等不提供 /v1/embeddings 端点的 Provider，每次对话都打 warn 日志

**解决**：首次 404 后设置 `embeddingUnavailable` 标记，后续直接跳过 embedding 调用

## Windows shell_exec 中文乱码

**问题**：`shell_exec` 工具在 Windows 上执行 `dir` 等命令，输出中文显示为 `◆◆◆◆` 乱码

**原因**：Windows `cmd.exe` 默认使用 GBK/CP936 编码，而 Node.js `child_process.exec` 默认 UTF-8 解码，编码不匹配

**解决**：在命令前加 `chcp 65001 >nul &&` 强制 cmd 切换到 UTF-8，同时 exec options 设 `encoding: 'utf-8'`

## 浅色模式代码块样式异常

**问题**：浅色主题下，代码块仍使用暗色背景（`oneDark`），行内代码也使用硬编码暗色

**原因**：`SyntaxHighlighter` 主题和行内代码颜色是静态写死的，没有跟随 `data-theme` 切换

**解决**：
1. 用 `MutationObserver` + `useSyncExternalStore` 监听 `data-theme` 属性变化
2. 代码块动态切换 `oneDark` / `oneLight`
3. Mermaid 也根据主题切换 `dark` / `default`
4. 行内代码颜色从硬编码改为 CSS 变量（`--accent-fg` / `--bg-inset`）

## Electron IPC invoke/send 竞态导致流式状态不结束

**问题**：AI 完成回复后，输入框仍显示红色停止按钮，无法输入新消息

**原因**：`ipcMain.handle` 的 `invoke` 响应与 `event.sender.send` 的异步事件通过不同 IPC 通道传输。`invoke` 响应可能先到达渲染进程，导致 `finally` 块先执行 `cleanup()`（移除事件监听器），随后到达的 `done` 事件无人接收

**解决**：在 `sendMessage` 的 `finally` 块中加入安全兜底：
```typescript
finally {
  cleanup()
  cleanupConfirm()
  setIsStreaming(false) // 安全兜底
  streamingSessionRef.current = null
  setBgStreamingSessionId(null)
}
```

> 教训：Electron 的 `invoke/handle` 和 `send/on` 是独立的消息通道，不能假设它们的到达顺序

## overflow-hidden 截断下拉菜单

**问题**：输入区卡片容器设了 `overflow-hidden`，导致内部的下拉菜单（审批模式选择器等）底部被截断

**解决**：移除容器的 `overflow-hidden`，改用 `relative` 定位，让下拉菜单可以溢出显示

## Cursor Glob/Grep 工具搜索不到 _reference 目录

**问题**：使用 Cursor IDE 内置的 Glob/Grep 工具搜索 `_reference/**/*.md` 返回 0 结果，但目录实际存在且包含大量文件（Alice 方法论 20 章 + harness 工程指南 + wps-cowork 项目等）

**原因**：Cursor 的 Glob/Grep 工具可能受 `.gitignore` 或工具自身搜索范围限制，跳过了 `_reference` 目录（该目录可能被 gitignore 或被视为外部依赖）

**解决**：使用 Shell 工具的 `Get-ChildItem`（PowerShell）或 `ls -R`（Bash）直接列出目录内容
```powershell
Get-ChildItem "d:\projects\my-agent\_reference" -Force -Recurse -Depth 3
```

> 教训：不要完全依赖 IDE 搜索工具，对于 gitignore 排除的目录或特殊路径，改用 Shell 直接访问

## file_write 未经沙箱策略检查（待修复）

**问题**：设置沙箱为"只读"模式后，AI 调用 `file_write` 工具仍可写入文件（用户审批后）

**原因**：
- `CommandGuard`（沙箱策略执行层）仅在 `shell_exec` 调用路径中工作
- `file_write` 工具走的是另一条路径：仅通过 `isDestructive` 标记 + 执行模式（auto/confirm-all）来触发审批
- 沙箱的 `writableRoots`、`protectedPaths` 等策略对 `file_write` 完全无效

**影响**：
- "只读"模式下用户批准 `file_write` 后，Agent 可以写入任意路径（桌面、系统文件等）
- 沙箱策略名存实亡，用户以为安全但实际不安全

**修复**（2026-06-19）：
- `file_write` 执行前增加 `checkFileSandbox` 检查
- read-only 模式：直接拦截所有写操作（不弹审批，直接返回错误）
- workspace-write 模式：检查目标路径必须在 `workspaceRoot` 内 + 受保护路径（.git/.env 等）不可写
- full-access 模式：不限制
- 新增 `getWorkspaceRoot()` 导出（`project-memory.ts`），供工具层读取当前工作区

> 教训：沙箱策略必须在每个写操作工具中单独检查，不能只在 shell_exec 一处做守卫

## 禁止硬编码模型能力白名单

**问题**：最初 Vision 支持检测使用 `checkVisionSupport(config)` 函数，内部硬编码模型名白名单（如 `gpt-4o`、`claude-3`），但这些模型很快过时，新模型也需要手动添加

**正确做法**：运行时动态检测 — 乐观发送 → API 返回相关错误 → 标记 + 缓存 → 后续跳过。代码在 `electron/main/llm/index.ts` 的 `visionDenyCache` + `isVisionRelatedError()`

> 教训：任何依赖"模型名 → 能力"映射的白名单都会迅速过时。优先采用 try → fallback → cache 的运行时探测模式

## electron-builder EPERM rename 失败（Windows）

**问题**：`npx electron-builder --win` 在 packaging 阶段报 `EPERM: operation not permitted, rename '...win-unpacked.tmp' -> '...win-unpacked'`

**原因**：Windows 下项目目录内的 `release/` 目录可能被杀毒软件实时扫描锁定，或文件管理器打开了该目录，导致 rename 操作被拒

**解决**：将 `electron-builder.json` 的 `directories.output` 临时改为项目外路径（如 `D:/temp/my-agent-release/${version}`），打包完成后再改回

> 教训：Windows 上构建 Electron 安装包时，输出目录避免在被实时监控的路径下
