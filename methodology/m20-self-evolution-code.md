# M10：自进化与 Skill 代码走读

> 对照 m10-self-evolution.md 各章节，展示真实代码实现。
> 代码块带逐行中文注释（教学材料，不是生产代码）。
> 核心文件：electron/main/skills/loader.ts + registry.ts

---

## §二 + §三：Skill 定位与按需激活 → 加载和解析

→ m10 §二（Skill 定位）+ §三（when_to_use 按需激活）

```typescript
// electron/main/skills/loader.ts

function parseSkillFile(content: string, filePath: string, source: 'builtin' | 'user'): SkillDefinition | null {
  try {
    // ① gray-matter 解析 YAML frontmatter + Markdown 正文
    const { data, content: body } = matter(content)
    const meta = data as Partial<SkillFrontmatter>

    // ② name 和 description 是必填——没有就不是合法 Skill
    if (!meta.name || !meta.description) {
      log.warn('Skill missing name or description', { filePath })
      return null
    }

    return {
      meta: {
        name: meta.name,
        description: meta.description,
        when_to_use: meta.when_to_use,           // ③ 按需激活的路由信号（§三）
        allowed_tools: meta.allowed_tools,       // ④ 最小权限白名单（§四）
        disable_model_invocation: meta.disable_model_invocation ?? false,  // ⑤ 控制主动性
        version: meta.version,
      },
      body: body.trim(),                         // ⑥ 正文 = 给 AI 的操作手册
      filePath,
      source,
    }
  } catch (err) {
    log.error('Failed to parse skill', { filePath, error: String(err) })
    return null
  }
}
```

**编号说明**：

① **frontmatter + body 分离**：YAML 头是元数据（给系统路由用），Markdown 正文是操作指南（给 AI 执行用）

③ **when_to_use**：不参与执行，只用来让模型判断"该不该激活"——是路由信号

⑥ **body**：Skill 的本体，激活后作为 system 消息注入，指导 AI 后续行为

**方法论对照 → m10 §二/§三**：Skill = 元数据（路由）+ 正文（手册）。工具是被调用的原子能力，Skill 是激活后指导 AI 调工具的编排层。

---

## §三：按需激活 → skill_invoke 工具生成 + 注入

→ m10 §三：只有匹配时才注入上下文

```typescript
// electron/main/skills/registry.ts

function buildSkillTool(skill: SkillDefinition): ToolDefinition {
  // ① 每个 Skill 自动生成一个 skill_invoke_xxx 工具
  const toolName = `skill_invoke_${skill.meta.name.replace(/[^a-z0-9]/g, '_')}`
  return {
    name: toolName,
    description: `激活 Skill: ${skill.meta.description}. 调用此工具后，Skill 的操作指南将注入上下文，指导你完成任务。`,
    // ... parameters
    metadata: {
      isReadOnly: true,      // ② 激活 Skill 本身是只读操作（不改任何东西）
      isDestructive: false,
      isConcurrencySafe: true,
    },
    execute: async (args) => {
      activeSkill = skill    // ③ 标记为当前激活的 Skill
      log.info('Skill activated', { name: skill.meta.name, reason: args.reason })

      // ④ 返回 Skill 正文作为操作指南（注入到对话）
      return [
        `✅ Skill「${skill.meta.name}」已激活。`,
        '以下是该 Skill 的操作指南，请严格遵循：',
        '---',
        skill.body,        // ← 正文在这里注入
        '---',
        skill.meta.allowed_tools
          ? `⚠️ 本 Skill 限定使用以下工具：${skill.meta.allowed_tools.join(', ')}`
          : '',
      ].filter(Boolean).join('\n')
    },
  }
}
```

**编号说明**：

① **一 Skill 一工具**：模型看到 `skill_invoke_content_creator` 这样的工具，通过调用来激活 Skill

③ **activeSkill 状态**：记录当前激活的 Skill，供 `filterTools`（§四白名单）和 prompt 构建使用

④ **正文按需注入**：只有模型调了这个工具，Skill 正文才进入上下文——这就是"按需激活"，避免所有 Skill 都塞满上下文

**方法论对照 → m10 §三**：按需激活的实现 = 每个 Skill 生成一个工具 + 激活时才注入正文。未激活的 Skill 只在 summary 里占一行（name/description/when_to_use）。

---

## §四：最小权限 → allowed_tools 白名单过滤

→ m10 §四：Skill 激活收窄工具范围

```typescript
// electron/main/agent/runtime.ts — filterTools 回调

filterTools: (allTools) => {
  const active = getActiveSkill()
  // ① 激活的 Skill 有 allowed_tools 时，过滤工具集
  if (active?.meta.allowed_tools?.length) {
    const allowed = new Set(active.meta.allowed_tools)
    // ② 只保留白名单内工具 + skill_invoke_ 前缀工具（允许切换 Skill）
    return allTools.filter(t => allowed.has(t.name) || t.name.startsWith('skill_invoke_'))
  }
  return allTools
},
```

**方法论对照 → m10 §四**：`filterTools` 每轮 loop 动态过滤。激活带 `allowed_tools` 的 Skill 后，工具集收窄到白名单——防止写作 Skill 误调删除工具。权限"只降不升"。

---

## §八：版本备份与回滚 → G1 本次落地核心

→ m10 §八：改坏了能退回去（自进化的安全地基）

### 备份逻辑

```typescript
// electron/main/skills/loader.ts

/** 每个 Skill 最多保留的历史版本数（对齐 Alice Ch.10 的「保留最近 10 版」） */
const MAX_SKILL_VERSIONS = 10

async function backupSkillVersion(skillDir: string, oldContent: string): Promise<void> {
  const versionsDir = join(skillDir, '.versions')
  await ensureDir(versionsDir)

  // ① 现有版本文件（v{N}.md），过滤出符合命名的
  let existing: string[] = []
  try {
    existing = (await readdir(versionsDir)).filter(f => /^v\d+\.md$/.test(f))
  } catch { /* no versions yet */ }

  // ② 按序号排序（v2.md < v10.md，要按数字不是字典序）
  const seqOf = (f: string) => parseInt(f.slice(1, -3), 10)  // "v3.md" → 3
  existing.sort((a, b) => seqOf(a) - seqOf(b))

  // ③ 新版本号 = 当前最大 + 1（不复用已删号，保证时间顺序单调递增）
  const nextSeq = existing.length > 0 ? seqOf(existing[existing.length - 1]) + 1 : 1
  await writeFile(join(versionsDir, `v${nextSeq}.md`), oldContent, 'utf-8')

  // ④ 超出上限：删最旧的
  const afterWrite = [...existing, `v${nextSeq}.md`]
  const overflow = afterWrite.length - MAX_SKILL_VERSIONS
  for (let i = 0; i < overflow; i++) {
    await unlink(join(versionsDir, afterWrite[i])).catch(() => { /* already gone */ })
  }

  log.info('Skill version backed up', { skillDir, version: nextSeq, kept: Math.min(afterWrite.length, MAX_SKILL_VERSIONS) })
}
```

**编号说明**：

② **数字排序而非字典序**：`['v10.md', 'v2.md'].sort()` 字典序会把 v10 排在 v2 前面，出错。所以提取数字比较

③ **序号单调递增**：新号 = 最大号 + 1，即使中间删了旧版本也不复用号。保证"版本号大 = 时间新"，这是 `listSkillVersions` 排序的前提

④ **删最旧**：existing 已按序号升序，`afterWrite[0]` 就是最旧的，删前 `overflow` 个

### saveSkill 接入备份

```typescript
export async function saveSkill(name: string, content: string): Promise<string> {
  const dir = join(getSkillsDir(), name)
  await ensureDir(dir)
  const filePath = join(dir, 'SKILL.md')

  // ① 若已存在旧版本，先备份再覆盖
  try {
    const oldContent = await readFile(filePath, 'utf-8')
    if (oldContent !== content) {       // ② 内容有变才备份（相同不产生冗余版本）
      await backupSkillVersion(dir, oldContent)
    }
  } catch { /* 首次创建，无旧版本可备份 */ }  // ③ readFile 失败 = 首次创建，跳过备份

  await writeFile(filePath, content, 'utf-8')
  log.info('Skill saved', { name, filePath })
  return filePath
}
```

**编号说明**：

② **内容相同不备份**：避免用户反复保存同样内容产生一堆无意义版本

③ **首次创建不备份**：`readFile` 抛错说明还没有 SKILL.md，是首次创建，无需备份

### 回滚

```typescript
/** 列出某个 Skill 的历史版本序号（新→旧） */
export async function listSkillVersions(name: string): Promise<number[]> {
  const versionsDir = join(getSkillsDir(), name, '.versions')
  try {
    const files = (await readdir(versionsDir)).filter(f => /^v\d+\.md$/.test(f))
    return files.map(f => parseInt(f.slice(1, -3), 10)).sort((a, b) => b - a)  // ① 降序=新在前
  } catch {
    return []
  }
}

export async function rollbackSkill(name: string, version: number): Promise<boolean> {
  const dir = join(getSkillsDir(), name)
  const versionFile = join(dir, '.versions', `v${version}.md`)
  try {
    const versionContent = await readFile(versionFile, 'utf-8')
    // ② 复用 saveSkill → 当前内容自动备份，所以回滚本身可再回滚
    await saveSkill(name, versionContent)
    log.info('Skill rolled back', { name, version })
    return true
  } catch (err) {
    log.warn('Skill rollback failed', { name, version, error: String(err) })
    return false  // ③ 版本不存在时优雅返回 false，不抛错
  }
}
```

**编号说明**：

② **回滚复用 saveSkill 的巧妙**：回滚不是直接覆盖 SKILL.md，而是走 saveSkill——于是"当前内容"（回滚前的）也会被备份一版。这样"回滚错了"还能再回滚回来

③ **优雅失败**：回滚不存在的版本返回 false 而非抛错，让调用方（IPC）能返回 `{ success: false }`

**方法论对照 → m10 §八**：版本备份是自进化的安全地基。回滚复用 saveSkill 让"回滚可再回滚"，这是"任何修改都可撤销"原则的落地。

---

## §八 续：IPC 三处同步

→ m10 §八：暴露给前端（CLAUDE.md 硬约束：IPC 改动三处同步）

```typescript
// 1. electron/main/ipc/skills.ts — 主进程处理器
ipcMain.handle('skills:versions', async (_event, name: string) => {
  return listSkillVersions(name)
})
ipcMain.handle('skills:rollback', async (_event, name: string, version: number) => {
  const success = await rollbackSkill(name, version)
  if (success) await reloadSkills(toolRegistry)  // ← 回滚后重载，让新内容生效
  return { success }
})

// 2. electron/preload/index.ts — preload 桥接
skills: {
  // ...
  versions: (name: string) => ipcRenderer.invoke('skills:versions', name),
  rollback: (name: string, version: number) => ipcRenderer.invoke('skills:rollback', name, version),
},

// 3. src/vite-env.d.ts — 类型定义
skills: {
  // ...
  versions: (name: string) => Promise<number[]>
  rollback: (name: string, version: number) => Promise<{ success: boolean }>
}
```

**方法论对照**：CLAUDE.md 硬约束——IPC 改动必须同步 types.ts / preload / ipc handler 三处，否则运行时报"方法未定义"。回滚后 `reloadSkills` 让改动立即生效。

---

## §九-§十一：占位待做的自进化能力

→ m10 §九（自动改进）§十（主动提案）§十一（沙盒代码生成）

这三项本次未实现，但认知框架已在产品思考文档写全。代码层面它们的"接入点"是清晰的：

```typescript
// §九 自动改进闭环（占位）——接入点在 runtime.ts 的后台任务队列
// 对话结束后（enqueuePostTasks 附近），若本轮激活过 Skill：
//   analyzeSkillImprovement(skill, conversationSlice)  // LLM 分析
//     → 检测到改进点 → 生成建议 → 前端确认卡片
//     → 用户确认 → saveSkill(name, improvedContent)  // 复用 G1，自动备份

// §十 主动提案（占位）——新增 propose_evolution 工具
//   metadata: { isReadOnly: true }  // 只返回元数据，不改系统
//   execute → 返回提案卡片数据，UI 渲染，用户确认后才触发实际操作

// §十一 代码级自进化（占位）——最大工程
//   需要：代码生成管线 + SecurityScanner + 沙盒 WebView + 白名单 Bridge + CSP
//   Alice/Hermes 的根本分叉点，需求明确再评估
```

**方法论对照**：G1 版本备份已就位，是 G2 自动改进的安全前提。占位不写半成品代码，而是把接入点和设计写清楚——下次从这里接着做。

---

## 关键设计总结

### 1. G1 版本备份是自进化的地基

```
先做 G1（改了能退回）
  ↓ 安全前提就位
才敢做 G2（自动改进 Skill）
```
顺序不能反——没有回滚就敢自动改 = 自动搞坏。

### 2. 序号单调递增保证时间顺序

版本号新 = 最大 + 1，不复用已删号。于是 `listSkillVersions` 按号降序 = 按时间新→旧，无需存时间戳。

### 3. 回滚复用 saveSkill → 回滚可再回滚

回滚不直接覆盖，而是走 saveSkill，让当前内容也备份。"回滚错了"能再回滚回来。

### 4. Skill 系统的完整度

| 部分 | 状态 |
|------|------|
| 加载/解析/CRUD | ✅ 完整 |
| 按需激活（skill_invoke + 正文注入）| ✅ 完整 |
| 最小权限（allowed_tools 白名单）| ✅ 完整 |
| 版本备份/回滚（G1）| ✅ 本次落地 |
| 自动改进闭环（G2）| ⏸️ 占位 |
| 代码级自进化（G3）| ⏸️ 占位 |
| 主动提案（G4）/ 撤销栈（G5）| ⏸️ 占位 |

---

**全文完** — 对照 m10-self-evolution.md 认知框架阅读。
