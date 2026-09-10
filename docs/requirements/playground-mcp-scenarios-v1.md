# 施工合同：MCP Playground 场景审阅 v1

> 状态：进行中
> 生命周期：进行中
> 范围：P0；本轮用户已明确要求用场景 Tab 替换复杂交互。仅改 Playground、隔离测试和相关文档，不回流正式 Settings 或 MCP 后端。

## Why

旧候选只有一个服务和串行添加向导，必须走完整流程才能看到后续状态。用户审阅的是页面场景与信息层级，需要直接切换单服务、多服务、连接与工具状态。

## What

顶部用一组可换行的场景 Tab 直接选择：未添加、1 个 MCP、2 个 MCP、连接中、待确认、1 个工具、2 个工具、3 个工具、无工具、已停用、连接失败、待登录。

- 一个 MCP 对应一张独立卡片；外面不再套“外部服务连接”卡片。
- 名称与纯开关同行；传输方式、连接状态、工具数量各自准确表达。
- 工具只有 1–3 项时直接展示，无需层层展开。未发现工具与发现 0 个工具不同；连接中或未认证时不展示伪造的工具数。
- 待确认表示添加服务的信任与工具选择预览；Agent 执行具体工具的批准仍属于 Chat，不放设置页面。
- 开关、取消、确认、重试只更改本地样张；场景切换重置夹具，不访问外网、不启动本地 MCP 进程、不保存设置。
- 删除旧添加向导及其单服务固定结果，以场景直达代替；不删除正式管理能力。

## 研究依据

- [MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture)：Host 为每个 Server 建立独立 Client；MCP 使用 JSON-RPC，能力包括 tools、resources、prompts。标准传输为 stdio 与 Streamable HTTP；因此无工具不等于服务失败。
- Alice：本地 `alice-methodology/chapters/08-mcp.md` 与 `alice-source/_extract/page-settings-B6VzAHzq.js`。可核对服务器列表、传输类型、测试、工具计数、手动填写与 JSON 导入；本轮借鉴服务/工具分层，不复制其所有配置入口。
- [OpenClaw MCP Settings](https://docs.openclaw.ai/cli/mcp/control-ui) 与 [Connect MCP servers](https://docs.openclaw.ai/tools/mcp)：独立服务条目、启停、配置与实际探测分离；登录和工具发现是不同状态。其运维统计与配置编辑器不进入本轮候选。
- Codex 官方 `developers.openai.com/codex/mcp/` 及 Markdown 地址本次访问返回 403，未取得页面证据，不据此声称已复刻 Codex 前端。

## How

在现有 `SettingsExperienceCandidate.tsx` 内新增 MCP 场景数据和隔离视图，复用 SettingCard、CandidateSwitch、settings-option 与现有语义色。每个服务保留稳定 ID、独立状态、工具清单和工具选择；不引入第三方组件或注册新的基础组件。

当前生产 `electron/main/mcp/client.ts` 只实现 stdio / SSE；Streamable HTTP、OAuth 与逐工具启用回流需另行补齐并写入 wishlist。候选远程服务使用 Streamable HTTP 作为设计目标，不冒充已经接通。

## 验收与步骤

1. 核对协议、参考实现和生产边界，写明场景与删除范围。
2. 替换旧向导；场景通过顶部 Tab 直接进入，多个服务的开关互不影响。
3. E2E 验证全部场景、1/2/3 工具数、未知与零的区分、确认/取消/重试、本地状态隔离，以及深浅主题窄宽布局截图。
4. 自审、单测、类型检查、构建、资产与 staged 文档门禁；提交推送后交给用户审阅。

## 风险与权衡

本轮完整交付的是隔离场景审阅，不是可连接外部服务的管理器。确认与重试为确定性夹具转换，连接中场景保持展示直到取消或切换场景，不用定时器自动跳走。更多配置字段、JSON 导入和真实 OAuth 流程不在本轮范围。
