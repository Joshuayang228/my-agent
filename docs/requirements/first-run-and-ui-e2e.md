# 施工合同：首次配置旅程与 UI E2E 稳定门禁

> 状态：**已落地**
> 生命周期：已完成施工快照（冻结）；当前能力与行为以代码、模块卡、Architecture、Quality 和 Decisions 为准。
> 日期：2026-08-13
> 背景：当前 UI E2E 被 Electron 开发插件与 Playwright `webServer` 启动链路阻塞；首次启动虽会引导到设置，但缺少连接测试和保存后进入聊天的明确闭环。

## 1. 需求背景（Why）

My Agent 已具备模型配置、Agent Loop、人格系统和 Debug / Eval，但首次使用仍有两个断点：

1. UI E2E 依赖 `npm run dev` 同时启动 Vite 与 Electron，Playwright 的 webServer 健康检查容易被监听地址 / Electron 调试启动阻塞。
2. 首次启动只做“没有 API Key 就打开设置”，用户需要自行猜测 Provider、Base URL、模型和保存顺序，也无法在保存前确认配置可用。

## 2. 功能目标（What）

- UI E2E 提供独立的纯 Renderer Vite 启动命令，不启动 Electron 主进程，不依赖 IPC。
- Playwright UI 项目通过固定 `127.0.0.1` 健康检查并能真实执行 UI 用例。
- 首次进入设置时，模型页明确展示配置步骤：Provider / Base URL / 模型 / API Key / 测试连接。
- 连接测试使用用户当前填写值，不要求先写入设置；成功后可明确“保存并开始对话”。
- 保存后进入聊天，后续再次打开设置不再显示首次配置引导。
- Key 继续只走现有安全存储；不写日志、不出现在错误或测试结果中。

## 3. 技术方案（How）

### 3.1 UI E2E 启动

- 增加 `dev:ui-e2e`，以 Vite `ui-e2e` mode 启动纯 Renderer 服务。
- `vite.config.ts` 在 `ui-e2e` mode 下不加载 Electron 插件。
- `playwright.config.ts` 的 UI 项目固定使用 `http://127.0.0.1:5174`、本机 Chrome 与本地代理例外。
- Electron 测试使用独立 `playwright.electron.config.ts`，直接启动 `dist-electron/index.js`；首次配置闭环必跑，真实对话无 Key 时保持 skip。

### 3.2 连接测试

- 在 `src/shared/types.ts` 增加连接测试输入 / 结果类型。
- 在 preload、`src/vite-env.d.ts`、`electron/main/ipc/settings.ts` 四处同步 `settings.testConnection`。
- 复用 `loadMainLLMConfig` 的统一配置工厂，允许本次未保存表单值作为受控 override。
- 通过现有 `chatComplete` 发一条最小中文探测请求；固定低输出上限和超时。
- UI 只显示成功 / 失败和耗时，不显示原始 Key 或内部堆栈。

### 3.3 首次配置 UI

- `SettingsPanel` 模型区增加首次配置引导卡，仅在当前设置没有 API Key 时显示。
- Provider 入口、API Key、Base URL、主模型和连接测试形成连续步骤；Provider 入口不预置模型 ID，主模型由用户按账户可用列表填写。
- 当前 Key / Base URL / 模型测试成功后才启用“保存并开始对话”；任一字段变化都会使旧验证失效。
- 保留已有通用保存和自动保存逻辑；不改变老用户设置行为。

## 4. 影响范围评估

- 前端：`SettingsPanel` 首次配置状态与模型区文案。
- 主进程 / IPC：新增只读外部连接测试调用，不改变真实聊天路径。
- 工具链：Vite / Playwright UI 启动配置。
- 测试：UI E2E 启动链路、连接测试配置校验与首次配置渲染。
- 文档：质量门禁、进度、变更日志、施工合同索引。
- 安全：Key 不进入日志、报告、Renderer 之外的持久化；连接测试不自动写设置。

## 5. 实施步骤

1. 独立 Renderer UI 测试命令与 Vite mode 条件插件。
2. 修正 Playwright UI webServer 与测试地址。
3. 连接测试 IPC 四处同步及配置工厂 override。
4. 首次配置引导、测试连接和保存后进入聊天。
5. 补充单测 / UI E2E，运行类型检查、Unit、Eval、Build 和 E2E。
6. 更新文档，实机验收后提交推送。

## 6. 验收标准

- `npm run test:e2e` 能启动纯 Renderer 并执行现有 UI 用例，不再超时在 webServer。
- 无 Key 的 Electron 首次启动进入设置模型页；当前配置测试成功前不可保存，成功后可保存并开始对话。
- 测试失败显示用户可理解错误，不泄露 Key / 堆栈。
- 老用户打开设置不受首次配置卡影响。
- `npm test`、`npm run eval:run`、`npx tsc --noEmit`、`npm run build` 全部通过。
