# 踩坑记录

> 开发过程中遇到的坑和解决方案，避免重复踩坑。

## 打包文件存在不代表打包完成

2026-09-19 本地 Windows 生图验收中，构建会话中断后已有 app.asar 和 Electron 可执行文件，但启动直接退出。用 @electron/asar 读取包内 package.json，内容实际为全零字节；文件名和大小不能作为成功证据。必须确认构建进程结束及退出码，再读取包内入口并从该产物运行正式流程。中断产物保留为失败证据，不反复拿半包排查应用代码。

同轮全量 Vitest 在打包并行时出现符号检查超时及 worker 退出；经 npm run 转发的并发参数未到达执行命令，直接 `npx vitest run --maxWorkers 2` 后 176 文件 / 1160 项通过。记录实际命令和输出，不通过修改断言或扩大超时掩盖未定位失败。

## Chat 调用回执不等于流事件已消费

**问题**：空模型配置在 Runtime 初始化阶段产生 error / done，但真实 Electron 中 invoke 的 finally 先执行并移除了订阅；另一个独立订阅能收到两个事件，正式聊天却只显示乐观用户消息。数据库此时没有该轮消息，即使收到 error，随后无条件回填历史也会擦掉提示。

**解决**：发送流程等待 invoke 回执与 done 都完成后再取消订阅和解除发送状态；invoke 拒绝直接展示安全错误并清理，不等待不存在的 done。失败轮保留当前错误，成功轮才同步历史。受控 UI 分别验证两种完成顺序、拒绝与重试，真实 Electron 验证删空配置重启后提示可见、无网络请求和重新配置恢复；临时日志不留在生产。

## Skills 样张成功不代表 Electron 加载成功

2026-09-16 的真实 Electron `skills:reload` 返回 `ReferenceError: __dirname is not defined`：加载器按 CommonJS 源文件层级拼目录，主进程却是 ESM 构建；Playground 的 `?raw` 样本导入绕过了该路径。修复为主入口统一的 `APP_ROOT` 资源定位，打包清单显式包含内置目录。Unit 检查资源与打包声明，Electron 必须读取真实内置全文并完整重启验证，不能用 Renderer 替身或元素存在断言代替。

## Effect 阶段切换提前取消成功测试

**问题**：MCP 表单以 `[phase, requestId]` 注册清理函数，`testing → ready` 触发旧 effect cleanup，导致成功测试在保存前被取消。Renderer 替身的 cancel 未清除 tested 标记，原测试未能发现问题。

**解决**：只在卸载时执行资源清理，显式取消使用 requestId 和响应版本隔离；重测前确认旧连接已清理。替身取消必须使保存失败，回归明确断言成功测试未触发取消，并分别测试迟到响应与取消失败。界面测试、真实 SDK 测试和 Electron 存储测试分开记录，不能互相冒充。

## 验收 HTML 产物触发 Vite 页面重载

**问题**：2026-09-15 开启 Playwright trace 后，验收页面被重载，耗时逐步增加。真实 Vite 日志连续报告 `page reload var/verification/.../traces/resources/*.html`。

**原因**：验证产物位于项目根目录下，进入开发服务器 watcher；生成的 HTML 被当作页面变更。页面因此回到默认视图，不能用放宽 locator 或超时来修复。

**解决**：`vite.config.ts` 排除 `var/verification` 和 `test-results`，验证目录同时进入 `.gitignore`；`dev-server-watch.test.ts` 读取实际配置启动真实 watcher，验证源码变更仍可见而 HTML 产物不可见。该问题有直接日志及修复前后回归证据；此前无 trace、无对应 HMR 的偶发退出仍归 WISH-042，不混为同一已修复原因。

## 符号归属测试意外解析全部依赖

**问题**：Foundation 的 JSX 符号归属测试在默认并发和串行运行均曾超过 5 秒；独立测量 7 个审计根文件带入 436 个文件，其中 401 个来自依赖。

**解决**：该测试使用 TypeChecker 判断真实导入和局部遮蔽，但设置 `noResolve`、`noLib` 与空 `types`，显式列出全部待核验定义 / 调用者；用根文件集合断言防止隐式扩张，保留所有正反例。完整项目类型诊断仍走独立 tsc 门禁，不增加测试时限。

## fire-and-forget 动态 import 跨过测试生命周期

**问题**：函数本身已经返回，但后台 Promise 仍在动态加载模块；GitHub Runner 的 Vitest 环境先 teardown，随后出现 `EnvironmentTeardownError`，本地因时序较慢不一定复现。

**原因**：仅写 `void promise` 只能表达“不等待”，不能表达测试或应用退出前的生命周期边界；动态 import 尤其容易在 teardown 后才完成。

**解决**：后台任务进入可追踪集合，生产调用保持非阻塞；提供 `drain...` 供测试 teardown / 应用退出等待，且任务入口统一记录失败。不要用固定 `setTimeout` 掩盖异步竞态。

## 第三方回收站二进制在 Electron bundle 中失去 file URL

**问题**：`trash@10.1.1` 在 Node 单测中可以删除文件，但打进 Electron 主进程后，Windows 回收站调用报 `The URL must be of scheme file`。

**原因**：该包用 `new URL('windows-trash.exe', import.meta.url)` 定位随包 helper，再调用 `fileURLToPath`；主进程 bundler 改写模块位置后，`import.meta.url` 不再保持该依赖预期的标准 `file:` URL。

**解决**：主进程直接使用 Electron 原生 `shell.trashItem(path.resolve(...))`；删除不再依赖额外二进制，跨平台生命周期也与 Electron 一致。此类携带 helper binary、WASM 或 worker 的 ESM 包，不能只凭 Node 单测判定 Electron 可用，必须补真实打包运行验收。

## Windows `localhost` 导致 Electron 开发白屏

**问题**：开发窗口显示空白，但 DevTools 只有 Electron 安全警告。

**原因**：Vite 实际绑定 `127.0.0.1`，旧进程占用 `[::1]` 同一端口并返回 404；`vite-plugin-electron` 将 loopback 统一输出为 `localhost`，Chromium 优先命中 IPv6 服务。

**解决**：Vite 开发服务固定绑定 `127.0.0.1`；主进程加载开发 URL 前将 `localhost` / `::1` 规范化为 `127.0.0.1`。排查时分别请求 `127.0.0.1:<port>`、`localhost:<port>` 和 `[::1]:<port>`，不要只看端口号。

## 宽泛 `skills/` 规则误伤生产源码

**问题**：`.gitignore` 写成 `skills/` 时，会匹配任意层级的同名目录，导致 `electron/main/skills/` 生产源码在本地可构建、却没有进入 Git。

**解决**：保留私有 Skill 的宽泛忽略规则时，为生产路径增加精确例外（`!electron/main/skills/` 与 `!electron/main/skills/**`）；新增生产目录后用 `git check-ignore -v <path>` 确认没有被宽泛规则误伤。

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

## Chat「完全访问」未联动文件沙箱 → 改为有效沙箱推导（2026-08-08）

**问题**：输入区选「完全访问权限」后，`file_write` 仍返回 `[SANDBOX BLOCKED]`；随后一度把 Chat 去改全局 `sandboxMode`，又与「沙箱应在对话页控」冲突。

**原因**：审批菜单只写 `executionMode`；写入工具却读独立的 `sandboxMode`。两套旋钮语义打架。

**修复**：
- `resolveEffectiveSandbox(executionMode)`：`full-access` → 放开路径；其余 → `workspace-write`
- 工具统一 `loadEffectiveSandbox()`，不再以 settings.sandboxMode 为真相
- 设置页删除沙箱区块；日常只改对话页审批菜单

> 教训：「完全访问」若暗示文件权限，必须让工具层从同一入口推导，不要维护第二套全局沙箱开关。

## file_write 未经沙箱策略检查（已修复）

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

## 权限责任链：ask 不能压在审批库前面

**问题**：自定义 `ask` 规则若在 `checkApproval` 之前就返回 `needs_approval`，用户点「允许」写入 session 审批后，下次仍永远命中 ask，确认无效。

**原因**：责任链「第一个非 null 即返回」——ask 抢先返回后，审批库永远到不了。

**解决**：顺序固定为 `allow/deny → approval-store → ask → sandbox`（见 `permission-engine.ts`）。

> 教训：ask 表示「尚未批过时要问」，不是「永远覆盖审批结果」。
