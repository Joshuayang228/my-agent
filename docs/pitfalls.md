# 踩坑记录

> 开发过程中遇到的坑和解决方案，避免重复踩坑。

## Git 推送代理

**问题**：`git push` 报 `Failed to connect to 127.0.0.1 port 7897`

**原因**：Git 全局代理端口配置错误，实际代理端口为 `7892`

**解决**：
```bash
git config --global http.proxy http://127.0.0.1:7892
```

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
