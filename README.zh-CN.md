# My Agent

[English](./README.md) · 中文

**人格化优先的桌面 AI 伙伴**——不只是 Coding Harness，而是有性格、有记忆、有生活世界的数字同伴。

> 状态：**早期公开 alpha**（`v0.1.0`）。我们边迭代边运营 GitHub，接口与 UI 会持续变化。

## 为什么做这个

多数 Agent 优化工具与吞吐。My Agent 优化的是**关系连续性**：

- **三角色槽** — 可切换聊天对象；同时只活跃一个主角
- **生活世界** — 日剧本、朋友圈 Moments、衣柜/书架、卡司召唤
- **会成长** — MUTABLE 行为层 + 有门闸的反思（不是换皮 System Prompt）
- **记得住** — 结构化记忆 + 向量召回，引用可指认、可纠错
- **本地优先** — SQLite + 本地向量，数据在你机器上
- **可信 Harness** — Agent Loop、沙箱/权限引擎、MCP 与 Skill

## 功能亮点

| 方向 | 你会得到 |
|------|----------|
| 伙伴世界 | Role Pack、LifeEngine、Catch-up、Moments、物什、召唤 |
| Agent 运行时 | 流式 Loop、Prompt 组装、上下文压缩、任务队列 |
| 工具 | 文件 / Shell / 搜索 / 记忆 / RAG 等（权限门控） |
| MCP | Stdio + SSE，接入外部服务器 |
| Skill | Markdown 手册，按需注入 |
| LLM | OpenAI / Anthropic / Gemini / DeepSeek 等 + 故障转移 |
| 安全 | 只读 / 工作区写入 / 完全访问 + 命令分级 + 审批 |
| UI | 多主题桌面聊天、伴侣表面、Dev Playground |

## 技术栈

| 层级 | 技术 |
|------|------|
| 外壳 | Electron |
| 语言 | TypeScript（主进程 + 渲染进程） |
| UI | React + Tailwind CSS |
| 存储 | sql.js（SQLite）+ Vectra |
| 核心 | AsyncGenerator Agent Loop + Runtime |
| 测试 | Vitest + Playwright |
| 打包 | electron-builder |

## 快速开始

**环境：** Node.js ≥ 20，npm ≥ 10

```bash
git clone https://github.com/Joshuayang228/my-agent.git
cd my-agent
npm install
cp .env.example .env   # 填入 API Key
npm run dev
```

### 常用脚本

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发模式（Vite + Electron） |
| `npm run test` | 单元测试 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run package` | 生产构建 + 安装包 |

## 架构示意

```text
┌────────────────────────────────────────────────────┐
│                   Electron App                     │
│  ┌─────────────┐   IPC / 事件流    ┌────────────┐  │
│  │  渲染进程    │◄────────────────►│ 主进程      │  │
│  │  React UI   │  AgentStreamEvent │ Node.js    │  │
│  │  聊天 /     │                   │ Loop ·     │  │
│  │  Moments /  │                   │ Runtime ·  │  │
│  │  设置       │                   │ 工具 ·     │  │
│  └─────────────┘                   │ 伙伴世界 · │  │
│                                    │ 记忆 ·     │  │
│                                    │ 沙箱       │  │
│                                    └────────────┘  │
└────────────────────────────────────────────────────┘
```

详细说明：[docs/architecture.md](docs/architecture.md)

## 文档怎么读

仓库维护**四维文档**（产品 / 技术 / 质量 / 账本），外加旁路**施工合同**（`docs/requirements/`，统一称呼，勿称「需求文档」）。

| 文档 | 用途 |
|------|------|
| [docs/modules/README.md](docs/modules/README.md) | 产品模块导览（伙伴 / 记忆 / 权限 / 运行时） |
| [docs/architecture.md](docs/architecture.md) | 系统架构 |
| [docs/quality.md](docs/quality.md) | Unit / Eval / E2E 门禁 |
| [docs/requirements/README.md](docs/requirements/README.md) | 施工合同（大改开工前） |
| [docs/changelog.md](docs/changelog.md) | 对外变更 |
| [docs/progress.md](docs/progress.md) | 对内进度 |
| [docs/wishlist.md](docs/wishlist.md) | 暂缓与灵感 |
| [docs/docs-system.md](docs/docs-system.md) | 文档体系说明 |

英文 README 是 GitHub 前门；长文目前以中文为主，后续按需英文化。

## 路线图（高层）

- 打磨伴侣体验与 Pack 内容
- 加强可观测与 Eval
- 前端视觉统一（将写施工合同）
- 可靠语音输入（暂缓，见 `docs/deferred/`）
- 生图朋友圈 / 多宇宙（非本阶段）

## 参与贡献

详见 **[CONTRIBUTING.md](./CONTRIBUTING.md)**。欢迎 Issue / PR。

大改请先在 `docs/requirements/` 写**施工合同**（见根目录 `CLAUDE.md`）。

## 许可证

[MIT](LICENSE) · © [Joshuayang228](https://github.com/Joshuayang228)
