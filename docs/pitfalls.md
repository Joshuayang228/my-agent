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
