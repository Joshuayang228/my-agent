# My Agent

一个人格化桌面 AI Agent — 有性格、有记忆、能成长的数字伙伴。

## 愿景

不只是一个 AI 工具，而是一个真正的数字伙伴：

- **人格化交互** — 有一致的性格特征和交流风格，3 个内置人格可切换
- **持久记忆** — 记住你的偏好、项目上下文、历史对话，越用越懂你
- **主动协作** — 不仅被动回答，还能主动提醒、建议、推进任务
- **本地优先** — SQLite + 向量数据库，数据全部存储在本地
- **可扩展** — Skill 系统 + MCP 协议，按需扩展能力边界

## 功能亮点

| 能力 | 描述 |
|------|------|
| Agent Loop | AsyncGenerator 事件流驱动，LLM 重试 + 工具超时保护 |
| 13 个内置工具 | 文件读写、终端命令、代码搜索、网页搜索、记忆管理、RAG 搜索等 |
| MCP 协议 | 支持 Stdio + SSE 两种传输层，可接入外部 MCP 服务器 |
| Skill 系统 | Markdown 操作手册，YAML 元数据，按需激活注入上下文 |
| 多 Provider | OpenAI / Anthropic / Gemini / DeepSeek 等，自动检测适配 |
| 沙箱安全 | 三级策略（只读 / 工作区写入 / 完全访问）+ 命令分级 + 审批记录 |
| 多主题 | 7 个命名主题（dark / light / mist / night-feast 等） |
| 语音交互 | Web Speech API 语音输入 + TTS 朗读 |
| RAG 管道 | 文档导入分块 + Embedding + 语义检索 |
| 定时任务 | interval + cron 调度，SQLite 持久化 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 外壳 | Electron 42 |
| 语言 | TypeScript 全栈 |
| 前端 | React 19 + TailwindCSS 4 |
| 存储 | SQLite (sql.js WASM) + Vectra 向量数据库 |
| 核心 | Agent Loop (AsyncGenerator) + Runtime 编排层 |
| 测试 | vitest (单元) + Playwright (E2E) |
| 打包 | electron-builder (NSIS / DMG) |

## 快速开始

### 环境要求

- Node.js >= 20
- npm >= 10

### 安装 & 启动

```bash
# 克隆项目
git clone https://github.com/Joshuayang228/my-agent.git
cd my-agent

# 安装依赖
npm install

# 配置 API Key（复制 .env.example 并填入你的 Key）
cp .env.example .env

# 启动开发模式
npm run dev
```

### 打包

```bash
# 构建 + 打包 Windows 安装程序
npm run package
```

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                    Electron App                      │
│                                                      │
│  ┌────────────┐      IPC (12模块)    ┌────────────┐ │
│  │  渲染进程   │◄───────────────────►│   主进程    │ │
│  │  (React)   │  AgentStreamEvent   │  (Node.js) │ │
│  │            │                     │            │ │
│  │ - UI V2   │                     │ - Agent    │ │
│  │   Codex风格│                     │   Loop     │ │
│  │ - 多主题  │                     │ - Runtime  │ │
│  │ - Markdown│                     │ - 工具系统 │ │
│  │   渲染    │                     │ - 记忆系统 │ │
│  │ - 设置/   │                     │ - MCP/Skill│ │
│  │   技能/   │                     │ - 沙箱策略 │ │
│  │   记忆面板│                     │ - LLM 路由 │ │
│  └────────────┘                     │ - SQLite   │ │
│                                     └────────────┘ │
└──────────────────────────────────────────────────────┘
```

详细架构文档见 [docs/architecture.md](docs/architecture.md)。

## 项目文档

| 文档 | 说明 |
|------|------|
| [architecture.md](docs/architecture.md) | 系统架构与数据流 |
| [features.md](docs/features.md) | 完整功能清单 |
| [progress.md](docs/progress.md) | 开发进度时间线 |
| [changelog.md](docs/changelog.md) | 变更记录 |
| [api-contracts.md](docs/api-contracts.md) | IPC / 类型契约 |
| [decisions.md](docs/decisions.md) | 架构决策记录 (ADR) |
| [glossary.md](docs/glossary.md) | 术语表 |
| [pitfalls.md](docs/pitfalls.md) | 踩坑记录 |
| [testing.md](docs/testing.md) | 测试策略 |

## 许可证

[MIT](LICENSE)
