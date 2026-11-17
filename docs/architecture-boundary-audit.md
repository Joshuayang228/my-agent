# 五边界架构审计

## 审计结论（2026-11-17）

Agent Loop、Runtime、Application、Agent Host、Capability、Companion Domain、Memory、Storage 和外部适配器的边界已完成本轮收口。Headless、Scheduler、IPC、LLM Tool 和 Companion 写入路径均有统一的权限、trace、幂等和恢复证据，生活领域持久化集中在 Core persistence。

### Context

上下文由会话历史、Persona、Memory、Companion 世界切片、Workspace 和 Tool 环境组成。生产 Prompt 通过 `registered-request.ts` 和运行时上下文编译器装配，动态生活状态不写入稳定 Persona。`ConversationApplicationContext` 现在承载 Agent、Session、权限策略、Domain Read Model 和 Prompt Context Evidence，Runtime 内部只保留会话编排。

### Memory

长期记忆、用户画像和向量召回由 Memory 模块负责。人物当前心情、精力、地点和关系阶段保存在 Companion 运行态与关系事实中，不伪装成长期记忆。对话完成后的画像提取仍由既有异步任务触发，本批应用服务只移动编排位置，没有改变 Memory 存储契约。

### Persona

稳定身份来自 Role Pack 和生产 Prompt 注册表，可变人格覆盖由 Companion mutable store 管理。运行时上下文只能注入动态事实，不能覆盖稳定身份正文。当前没有发现 `src/components/playground` 复制生产 Persona Prompt 的路径。

### Permission

Tool Registry、Permission Engine 和文件 / Shell / MCP 沙箱仍位于 Agent Runtime 及工具层。用户确认、调用身份和实际执行前复核没有下沉到 Companion Domain。IPC sender 校验位于 Electron 入口，不能替代工具权限判断。

### Runtime

Agent Runtime 保留 Loop、取消、流式生命周期、Context 装配和后台任务。对话完成后的伙伴生活结算已经迁移到 `conversation-application-service.ts`。主角、召唤和 Workspace 的领域证据边界由 Application Context 生成，Headless / Scheduler 继续通过 Agent Host Workflow 进入统一执行链。

## 数据流不变量

```text
Renderer / Tool / Ticker
        ↓
Application / Agent Host / Command Gateway
        ↓
BEGIN
  Domain Fact + Runtime State + Read Projection + Domain Event + Outbox
COMMIT
        ↓
Dispatcher / Session Store
```

模型、网络、窗口通知和文件副作用不进入本地事务。Outbox 采用至少一次投递，消费者按稳定消息 ID 幂等。SQLite 基准命令 `npm run bench:database` 记录写入、导出、重载和 Outbox 批处理耗时。

执行账本的 `running`、`completed` 和 `retryable` 是跨外部等待的生命周期元数据。领域事件、Runtime State、Outbox 及执行与事件的关联在本地 Unit of Work 内提交，外部模型、网络、窗口和文件等待不进入事务。该边界由 DEC-2026-11-13-01 固定，后续用例不得持有事务跨越外部等待。

生活领域表的查询与同步投影写入统一经过 `core/persistence/life-repository`。Application Gateway 在本地 Unit of Work 中协调领域事实、事件和 Outbox，Read Model 按产品需要组合查询。旧 store 和仅转发的 legacy 适配已删除。

2026-11-17 复核补齐实际迁移，运行态镜像、旧生活 store 与转发层已移除。分层反向依赖由 AST 导入扫描门禁约束。真实磁盘重开与并发回滚测试证明本地事务提交边界，Headless 失败终态不再报告成功。自动生活行为共享持久提醒预算。
