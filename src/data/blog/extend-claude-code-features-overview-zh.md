---
title: "扩展 Claude Code"
pubDatetime: 2026-03-16T15:00:00+08:00
description: "Claude Code 文档《Extend Claude Code》中文翻译（含原文引用）。"
slug: extend-claude-code-features-overview-zh
originalTitle: "Extend Claude Code"
originalUrl: https://code.claude.com/docs/en/features-overview
---

原文标题：Extend Claude Code  <br>
原文链接：https://code.claude.com/docs/en/features-overview

# 扩展 Claude Code

> 理解何时使用 CLAUDE.md、Skills、subagents、hooks、MCP 与 plugins。

Claude Code 将一个能对你的代码进行推理的 model，与用于文件操作、搜索、执行和 Web 访问的[内置 tools](https://code.claude.com/docs/en/how-claude-code-works#tools)结合在一起。内置 tools 覆盖了大多数编码任务。本指南聚焦扩展层：你可借此自定义 Claude 已知内容、连接外部服务并自动化工作流。

> 关于核心 agentic loop 的工作方式，参见 [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)。

**刚接触 Claude Code？** 先从项目约定的 [CLAUDE.md](https://code.claude.com/docs/en/memory) 开始。其他扩展按需添加。

## 概览

扩展可插入 agentic loop 的不同位置：

- **[CLAUDE.md](https://code.claude.com/docs/en/memory)**：添加持久上下文，Claude 每次会话都能看到
- **[Skills](https://code.claude.com/docs/en/skills)**：添加可复用知识和可调用工作流
- **[MCP](https://code.claude.com/docs/en/mcp)**：将 Claude 连接到外部服务与 tools
- **[Subagents](https://code.claude.com/docs/en/sub-agents)**：在隔离上下文中运行独立 loop，并返回摘要
- **[Agent teams](https://code.claude.com/docs/en/agent-teams)**：协调多个独立会话，支持共享任务与点对点消息
- **[Hooks](https://code.claude.com/docs/en/hooks)**：完全在 loop 外运行，作为确定性脚本
- **[Plugins](https://code.claude.com/docs/en/plugins)** 与 **[marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)**：用于打包与分发上述能力

[Skills](https://code.claude.com/docs/en/skills) 是最灵活的扩展。skill 是包含知识、工作流或指令的 markdown 文件。你可以用 `/deploy` 这类命令调用 skill，或者让 Claude 在相关时自动加载。skills 既可在当前会话执行，也可通过 subagents 在隔离上下文执行。

## 按目标匹配功能

这些功能从“每次会话 Claude 都会看到的常驻上下文”，到“你或 Claude 按需调用的能力”，再到“在特定事件触发的后台自动化”都有。下表展示了可用选项及适用场景。

| 功能 | 作用 | 适用场景 | 示例 |
| --- | --- | --- | --- |
| **CLAUDE.md** | 每次会话自动加载的持久上下文 | 项目约定、"总是做 X" 规则 | "用 pnpm，不用 npm。提交前跑测试。" |
| **Skill** | Claude 可使用的指令、知识与工作流 | 可复用内容、参考文档、可重复任务 | `/deploy` 运行部署检查清单；API docs skill 包含端点模式 |
| **Subagent** | 返回摘要结果的隔离执行上下文 | 上下文隔离、并行任务、专用 worker | 读取大量文件的研究任务，仅返回关键发现 |
| **[Agent teams](https://code.claude.com/docs/en/agent-teams)** | 协调多个独立 Claude Code 会话 | 并行研究、新功能开发、竞争性假设调试 | 同时拉起 reviewer 检查安全、性能和测试 |
| **MCP** | 连接外部服务 | 外部数据或外部动作 | 查询数据库、发 Slack、控制浏览器 |
| **Hook** | 在事件上触发的确定性脚本 | 可预测自动化，不涉及 LLM | 每次文件编辑后运行 ESLint |

**[Plugins](https://code.claude.com/docs/en/plugins)** 是打包层。plugin 将 skills、hooks、subagents 和 MCP servers 打包成一个可安装单元。plugin skill 具备命名空间（例如 `/my-plugin:review`），因此多个 plugins 可共存。当你希望跨多个仓库复用同一套配置，或通过 **[marketplace](https://code.claude.com/docs/en/plugin-marketplaces)** 分发给他人时，使用 plugins。

### 相似功能对比

有些功能看起来相似。下面是区分方法。

#### Skill vs Subagent

Skills 与 subagents 解决的问题不同：

- **Skills**：可加载到任意上下文的可复用内容
- **Subagents**：与主会话分离运行的隔离 worker

| 维度 | Skill | Subagent |
| --- | --- | --- |
| **本质** | 可复用指令、知识或工作流 | 拥有独立上下文的隔离 worker |
| **核心收益** | 跨上下文共享内容 | 上下文隔离，工作分离，仅返回摘要 |
| **最适合** | 参考材料、可调用工作流 | 读大量文件任务、并行工作、专用 worker |

**Skills 可以是 reference 或 action。** Reference skill 提供可在整个会话中使用的知识（例如 API 风格指南）。Action skill 让 Claude 执行特定动作（例如运行部署流程的 `/deploy`）。

**使用 subagent**：当你需要上下文隔离，或 context window 接近满载。subagent 可能读取几十个文件、执行大量搜索，但主会话只接收摘要。由于 subagent 工作不会消耗主会话上下文，在你不需要保留中间过程可见性时也非常有用。自定义 subagent 可有独立指令，并可预加载 skills。

**两者可组合。** subagent 可预加载特定 skills（`skills:` 字段）。skill 也可用 `context: fork` 在隔离上下文运行。详见 [Skills](https://code.claude.com/docs/en/skills)。

#### CLAUDE.md vs Skill

两者都存储指令，但加载方式不同、用途不同。

| 维度 | CLAUDE.md | Skill |
| --- | --- | --- |
| **加载方式** | 每次会话自动加载 | 按需加载 |
| **是否可包含文件** | 可以，用 `@path` 导入 | 可以，用 `@path` 导入 |
| **是否可触发工作流** | 不可以 | 可以，用 `/<name>` |
| **最适合** | "始终执行 X" 规则 | 参考材料、可调用工作流 |

**放到 CLAUDE.md**：如果 Claude 应该始终知道，例如编码约定、构建命令、项目结构、"绝不做 X" 规则。

**放到 skill**：如果是 Claude 偶尔需要的参考材料（API 文档、风格指南），或你通过 `/<name>` 触发的工作流（deploy、review、release）。

**经验法则：** CLAUDE.md 保持在 200 行以内。若持续增长，把参考内容迁到 skills，或拆分到 [`.claude/rules/`](https://code.claude.com/docs/en/memory#organize-rules-with-clauderules)。

#### CLAUDE.md vs Rules vs Skills

三者都能存指令，但加载机制不同：

| 维度 | CLAUDE.md | `.claude/rules/` | Skill |
| --- | --- | --- | --- |
| **加载** | 每次会话 | 每次会话，或打开匹配文件时 | 按需：调用或相关时 |
| **作用域** | 全项目 | 可按文件路径限定 | 任务级 |
| **最适合** | 核心约定与构建命令 | 语言或目录特定指南 | 参考材料、可重复工作流 |

**CLAUDE.md** 用于每次会话都需要的指令：构建命令、测试约定、项目架构。

**Rules** 用于让 CLAUDE.md 保持聚焦。带有 [`paths` frontmatter](https://code.claude.com/docs/en/memory#path-specific-rules) 的 rules 仅在 Claude 处理匹配文件时加载，从而节省上下文。

**Skills** 用于 Claude 偶尔才需要的内容，如 API 文档，或你通过 `/<name>` 触发的部署清单。

#### Subagent vs Agent team

两者都可并行化工作，但架构不同：

- **Subagents** 在你的会话内运行，并把结果回传主上下文
- **Agent teams** 是彼此通信的独立 Claude Code 会话

| 维度 | Subagent | Agent team |
| --- | --- | --- |
| **上下文** | 独立 context window；结果返回调用者 | 独立 context window；完全独立 |
| **通信** | 仅向主 agent 回报结果 | 队友间可直接互发消息 |
| **协调方式** | 主 agent 统一管理 | 共享任务列表，自主协作 |
| **最适合** | 只关心结果的聚焦任务 | 需要讨论与协作的复杂工作 |
| **Token 成本** | 更低：结果摘要回主上下文 | 更高：每位队友是独立 Claude 实例 |

**使用 subagent**：快速、聚焦 worker（调研问题、核验声明、审阅文件）。subagent 做完返回摘要，主会话保持清爽。

**使用 agent team**：当队友需要共享发现、相互质疑并独立协调。最适合竞争性假设研究、并行代码审查和由不同成员负责不同部分的新功能开发。

**转折点：** 如果你已在并行使用 subagents 但触达上下文上限，或 subagents 之间需要互相通信，agent teams 是自然下一步。

> Agent teams 属于实验功能，默认关闭。配置与限制见 [agent teams](https://code.claude.com/docs/en/agent-teams)。

#### MCP vs Skill

MCP 让 Claude 连接外部服务。Skills 扩展 Claude 的知识，包括如何高效使用这些服务。

| 维度 | MCP | Skill |
| --- | --- | --- |
| **本质** | 连接外部服务的协议 | 知识、工作流与参考材料 |
| **提供** | tools 与数据访问 | 知识、工作流、参考材料 |
| **示例** | Slack 集成、数据库查询、浏览器控制 | 代码审查清单、部署工作流、API 风格指南 |

二者解决的问题不同，并且可良好协同：

**MCP** 赋予 Claude 与外部系统交互能力。没有 MCP，Claude 无法查询你的数据库或发 Slack。

**Skills** 赋予 Claude“如何更好使用这些 tools”的知识，以及可通过 `/<name>` 触发的工作流。一个 skill 可以包含团队数据库 schema 与查询模式，或 `/post-to-slack` 工作流及团队消息格式规范。

示例：MCP server 负责连通数据库；skill 教 Claude 你的数据模型、常见查询模式，以及不同任务应使用哪些表。

### 理解功能如何分层

功能可定义在多个层级：用户级、项目级、plugin 级、托管策略级。你也可在子目录嵌套 CLAUDE.md，或在 monorepo 的特定 package 放置 skills。当同名功能在多层同时存在时，分层规则如下：

- **CLAUDE.md 文件**是叠加关系：各层内容会同时进入 Claude 上下文。启动时加载工作目录及其上级文件；在子目录工作时动态加载子目录文件。指令冲突时，Claude 会进行协调，通常更具体的指令优先。详见 [how CLAUDE.md files load](https://code.claude.com/docs/en/memory#how-claudemd-files-load)。
- **Skills 与 subagents**按名称覆盖：同名时按优先级胜出（skills：managed > user > project；subagents：managed > CLI flag > project > user > plugin）。plugin skills 使用[命名空间](https://code.claude.com/docs/en/plugins#add-skills-to-your-plugin)避免冲突。详见 [skill discovery](https://code.claude.com/docs/en/skills#where-skills-live) 与 [subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)。
- **MCP servers**按名称覆盖：local > project > user。详见 [MCP scope](https://code.claude.com/docs/en/mcp#scope-hierarchy-and-precedence)。
- **Hooks**合并：所有已注册 hooks 都会在匹配事件上触发，不区分来源。详见 [hooks](https://code.claude.com/docs/en/hooks)。

### 组合使用功能

每种扩展解决不同问题：CLAUDE.md 处理常驻上下文，skills 处理按需知识与工作流，MCP 处理外部连接，subagents 处理隔离执行，hooks 处理自动化。真实配置通常是按工作流组合使用。

例如，你可以用 CLAUDE.md 维护项目约定，用 skill 承载部署流程，用 MCP 连接数据库，再用 hook 在每次编辑后跑 lint。每个功能各司其职。

| 组合模式 | 工作方式 | 示例 |
| --- | --- | --- |
| **Skill + MCP** | MCP 提供连接；skill 教 Claude 如何高效使用 | MCP 连接数据库，skill 记录 schema 与查询模式 |
| **Skill + Subagent** | skill 拉起 subagents 并行处理 | `/audit` skill 启动安全、性能、风格 subagents，在隔离上下文工作 |
| **CLAUDE.md + Skills** | CLAUDE.md 放常驻规则；skills 放按需参考内容 | CLAUDE.md 写“遵循 API 约定”，skill 提供完整 API 风格指南 |
| **Hook + MCP** | hook 通过 MCP 触发外部动作 | 编辑后 hook 在 Claude 修改关键文件时发 Slack 通知 |

## 理解 context 成本

你添加的每项功能都会消耗 Claude 的 context。功能过多会填满 context window，也会引入噪声，导致 Claude 效果下降：skill 触发不准，或 Claude 丢失你的约定。理解这些权衡，有助于搭建更有效配置。

### 各功能的 context 成本

每项功能都有不同加载策略与 context 成本：

| 功能 | 加载时机 | 加载内容 | Context 成本 |
| --- | --- | --- | --- |
| **CLAUDE.md** | 会话开始 | 全量内容 | 每次请求都计入 |
| **Skills** | 会话开始 + 使用时 | 开始时加载描述，使用时加载完整内容 | 低（描述每次请求都在）\* |
| **MCP servers** | 会话开始 | 全部 tool 定义与 schemas | 每次请求都计入 |
| **Subagents** | 被拉起时 | 带指定 skills 的全新上下文 | 与主会话隔离 |
| **Hooks** | 触发时 | 默认不加载任何内容（外部执行） | 零，除非 hook 回传额外上下文 |

\* 默认情况下，skill 描述会在会话开始时加载，便于 Claude 判断何时使用。若在 skill frontmatter 里设置 `disable-model-invocation: true`，则对 Claude 完全隐藏，直到你手动调用。这样可把该 skill 的 context 成本降至零。

### 理解功能加载方式

每项功能在会话中的加载时点不同。下面说明各功能何时加载、哪些内容会进入上下文。

![](https://mintcdn.com/claude-code/c5r9_6tjPMzFdDDT/images/context-loading.svg?fit=max&auto=format&n=c5r9_6tjPMzFdDDT&q=85&s=729b5b634ba831d1d64772c6c9485b30)

#### CLAUDE.md

**时机：** 会话开始。  
**加载内容：** 所有 CLAUDE.md 文件的完整内容（managed、user、project 层级）。

**继承：** Claude 会从工作目录一路向上读取 CLAUDE.md，到根目录为止；访问子目录文件时也会发现并加载嵌套文件。详见 [How CLAUDE.md files load](https://code.claude.com/docs/en/memory#how-claudemd-files-load)。

建议：CLAUDE.md 保持在约 500 行以内。参考资料应迁移到按需加载的 skills。

#### Skills

Skills 是 Claude 工具箱中的扩展能力。它们可以是参考材料（如 API 风格指南），也可以是通过 `/<name>` 触发的工作流（如 `/deploy`）。Claude Code 自带 [bundled skills](https://code.claude.com/docs/en/skills#bundled-skills)，例如 `/simplify`、`/batch`、`/debug`，开箱即用。你也可以创建自定义 skills。Claude 会在适当时使用 skills，或由你直接调用。

**时机：** 取决于 skill 配置。默认会话开始时加载描述，使用时加载完整内容。对于用户专用 skills（`disable-model-invocation: true`），在你调用前不加载任何内容。

**加载内容：** 对可由 model 调用的 skills，Claude 在每次请求都能看到名称和描述。你用 `/<name>` 调用，或 Claude 自动触发后，完整内容进入会话。

**Claude 如何选择 skill：** Claude 会将任务与 skill 描述进行匹配，判断相关性。若描述模糊或重叠，可能加载错误 skill，或漏掉有用 skill。若要指定 skill，请直接用 `/<name>`。设了 `disable-model-invocation: true` 的 skill 对 Claude 不可见，直到你手动调用。

**Context 成本：** 使用前较低。用户专用 skills 在调用前为零。

**在 subagents 中：** skills 行为不同。不是按需加载，而是在 subagent 启动时将 `skills:` 中列出的 skills 全量预加载。subagents 不会继承主会话 skill，必须显式指定。

建议：对有副作用的 skills 使用 `disable-model-invocation: true`。这样既节省 context，也确保仅由你触发。

#### MCP servers

**时机：** 会话开始。  
**加载内容：** 所有已连接 server 的 tool 定义和 JSON schemas。

**Context 成本：** 默认启用的 [Tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) 会将 MCP tools 控制在最多 10% context，其他按需延迟加载。

**可靠性说明：** MCP 连接可能在会话中途静默失败。server 断开后，其 tools 会无提示消失。Claude 可能尝试调用已不存在的 tool。若发现 Claude 无法使用此前可用的 MCP tool，请用 `/mcp` 检查连接。

建议：执行 `/mcp` 查看各 server 的 token 成本，断开当前不用的 server。

#### Subagents

**时机：** 按需，当你或 Claude 为某任务拉起 subagent 时。  
**加载内容：** 全新隔离上下文，包括：

- system prompt（与父级共享，利于缓存效率）
- 该 agent `skills:` 字段中列出的 skills 全量内容
- CLAUDE.md 和 git status（继承自父级）
- lead agent 在 prompt 中传入的上下文

**Context 成本：** 与主会话隔离。subagent 不继承你的会话历史或已调用 skills。

建议：把不需要完整会话上下文的工作交给 subagent。隔离可避免主会话膨胀。

#### Hooks

**时机：** 触发时。hooks 在特定生命周期事件触发，如 tool 执行、会话边界、prompt 提交、权限请求与 compaction。完整列表见 [Hooks](https://code.claude.com/docs/en/hooks)。

**加载内容：** 默认不加载任何内容。hooks 作为外部脚本运行。  
**Context 成本：** 零；除非 hook 返回输出并追加为会话消息。

建议：hooks 很适合做副作用任务（lint、日志），且不影响 Claude 上下文。

## 了解更多

各功能都有独立指南，包含安装步骤、示例与配置选项。

- [CLAUDE.md](https://code.claude.com/docs/en/memory)：存储项目上下文、约定与指令
- [Skills](https://code.claude.com/docs/en/skills)：为 Claude 提供领域知识与可复用工作流
- [Subagents](https://code.claude.com/docs/en/sub-agents)：将工作卸载到隔离上下文
- [Agent teams](https://code.claude.com/docs/en/agent-teams)：协调多个并行会话
- [MCP](https://code.claude.com/docs/en/mcp)：将 Claude 连接到外部服务
- [Hooks](https://code.claude.com/docs/en/hooks-guide)：用 hooks 自动化工作流
- [Plugins](https://code.claude.com/docs/en/plugins)：打包并共享功能集合
- [Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)：托管并分发 plugin 集合

## 引用

- 原文：
  https://code.claude.com/docs/en/features-overview
