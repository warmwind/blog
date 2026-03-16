---
title: "Claude Code 如何工作（中文翻译）"
pubDatetime: 2026-03-16T10:00:00+08:00
description: "Anthropic 文档《How Claude Code works》中文翻译（含原文引用）。"
slug: how-claude-code-works-zh
---

> 原文标题：How Claude Code works  
> 原文链接：https://code.claude.com/docs/en/how-claude-code-works

# Claude Code 如何工作

> 理解 agentic loop、内置 tools，以及 Claude Code 如何与你的项目交互。

Claude Code 是一个运行在终端中的 agentic assistant。它在编码方面表现出色，但也可以帮助你完成几乎所有命令行能做的事：写文档、跑构建、搜索文件、调研主题等。

本指南介绍核心架构、内置能力，以及[高效使用技巧](#高效使用-claude-code)。如果你想看按步骤讲解，请看 [Common workflows](/en/common-workflows)。如果你关注 skills、MCP、hooks 等扩展能力，请看 [Extend Claude Code](/en/features-overview)。

## agentic loop

当你给 Claude 一个任务时，它会经过三个阶段：**收集上下文**、**采取行动**、**验证结果**。这些阶段不是严格分离的。Claude 会在整个过程中持续使用 tools：可能是搜索文件以理解代码、编辑文件做修改，或运行测试验证结果。

![](https://mintcdn.com/claude-code/c5r9_6tjPMzFdDDT/images/agentic-loop.svg?fit=max&auto=format&n=c5r9_6tjPMzFdDDT&q=85&s=5f1827dec8539f38adee90ead3a85a38)

这个循环会根据你的请求自适应。关于代码库的一个问题，可能只需要收集上下文；修一个 bug，通常会反复经过三个阶段；重构任务可能会包含大量验证步骤。Claude 会基于上一步获得的信息，决定下一步需要什么，串联几十个动作并在过程中不断纠偏。

你也是这个循环的一部分。你可以随时打断 Claude，给它新的方向、补充上下文，或让它尝试不同方法。Claude 可以自主工作，同时也会对你的输入保持响应。

agentic loop 由两部分驱动：负责推理的 [models](#models) 与负责执行的 [tools](#tools)。Claude Code 是 Claude 外层的 **agentic harness**：它提供 tools、上下文管理和执行环境，把语言模型变成一个可执行工作的 coding agent。

### Models

Claude Code 使用 Claude models 来理解你的代码并对任务进行推理。Claude 可以读取任意语言的代码，理解组件之间如何连接，并判断为实现目标需要修改什么。对于复杂任务，它会拆分步骤、执行步骤，并根据过程中的新信息调整方案。

你可以使用[多个模型](/en/model-config)，它们有不同取舍。Sonnet 适合大多数编码任务；Opus 在复杂架构决策中推理更强。你可以在会话中用 `/model` 切换，或用 `claude --model <name>` 指定启动模型。

当本指南说“Claude 选择”或“Claude 决定”时，指的是模型在做推理。

### Tools

tools 是 Claude Code 具备 agentic 能力的关键。没有 tools，Claude 只能输出文本；有了 tools，Claude 才能执行操作：读取代码、编辑文件、运行命令、搜索网页、与外部服务交互。每次 tool 调用返回的信息，都会反馈进循环，影响 Claude 的下一次决策。

内置 tools 大体分为五类，每一类都对应一种不同的“执行能力”：

| 类别 | Claude 能做什么 |
| --- | --- |
| **文件操作** | 读取文件、编辑代码、创建新文件、重命名与重组 |
| **搜索** | 按模式找文件、用正则搜索内容、探索代码库 |
| **执行** | 运行 shell 命令、启动服务、跑测试、使用 git |
| **Web** | 搜索网页、抓取文档、查询报错信息 |
| **代码智能** | 编辑后查看类型错误与告警、跳转定义、查找引用（需[代码智能插件](/en/discover-plugins#code-intelligence)） |

以上是主要能力。Claude 还包含用于启动 subagents、向你提问及其他编排任务的 tools。完整列表见 [Tools available to Claude](/en/tools-reference)。

Claude 会根据你的提示与过程中获得的信息，决定使用哪些 tools。比如你说“修复失败的测试”，Claude 可能会：

1. 运行测试套件，查看哪些失败
2. 读取错误输出
3. 搜索相关源码文件
4. 读取这些文件以理解代码
5. 编辑文件修复问题
6. 再次运行测试进行验证

每一次 tool 使用都会给 Claude 新信息，并决定下一步动作。这就是 agentic loop 的实际运行方式。

**扩展基础能力：** 内置 tools 是基础。你可以用 [skills](/en/skills) 扩展 Claude 的能力，用 [MCP](/en/mcp) 连接外部服务，用 [hooks](/en/hooks) 自动化工作流，并把任务分派给 [subagents](/en/sub-agents)。这些扩展都建立在核心 agentic loop 之上。关于如何为你的需求选择扩展方式，见 [Extend Claude Code](/en/features-overview)。

## Claude 可以访问什么

本指南重点讲终端。Claude Code 也可运行在 [VS Code](/en/vs-code)、[JetBrains IDEs](/en/jetbrains) 以及其他环境中。

当你在一个目录下运行 `claude` 时，Claude Code 可以访问：

* **你的项目。** 当前目录与子目录中的文件，以及在你许可下的其他路径文件。
* **你的终端。** 你能运行的任何命令：构建工具、git、包管理器、系统工具、脚本。只要命令行能做，Claude 通常也能做。
* **你的 git 状态。** 当前分支、未提交变更、最近提交历史。
* **你的 [CLAUDE.md](/en/memory)。** 你用来存储项目级说明、约定和上下文的 markdown 文件，Claude 每次会话都会读取。
* **[Auto memory](/en/memory#auto-memory)。** Claude 在工作时自动保存的学习信息，例如项目模式和你的偏好。每次会话开始时会加载 MEMORY.md 的前 200 行。
* **你配置的扩展。** 用于外部服务的 [MCP servers](/en/mcp)、用于流程的 [skills](/en/skills)、用于委派工作的 [subagents](/en/sub-agents)、用于浏览器交互的 [Claude in Chrome](/en/chrome)。

因为 Claude 能看到整个项目，它就能跨文件、跨模块地工作。比如你让 Claude“修复认证 bug”，它会搜索相关文件、读取多个文件理解上下文、做协同修改、跑测试验证，并在你要求时提交变更。这与只能看到当前文件的内联代码助手不同。

## 环境与界面

上文提到的 agentic loop、tools 与能力，在你使用 Claude Code 的各处都一致。变化的是：代码在哪里执行，以及你如何与 Claude 交互。

### 执行环境

Claude Code 可在三种环境中运行，不同环境在“代码在哪里执行”上有不同权衡。

| 环境 | 代码执行位置 | 使用场景 |
| --- | --- | --- |
| **Local** | 你的机器 | 默认模式。完整访问你的文件、tools 与环境 |
| **Cloud** | Anthropic 托管的 VMs | 卸载任务、处理你本地没有的仓库 |
| **Remote Control** | 你的机器（由浏览器控制） | 用 Web UI 交互，同时保持本地执行 |

### 界面

你可以通过终端、[desktop app](/en/desktop)、[IDE extensions](/en/ide-integrations)、[claude.ai/code](https://claude.ai/code)、[Remote Control](/en/remote-control)、[Slack](/en/slack) 与 [CI/CD pipelines](/en/github-actions) 使用 Claude Code。界面决定你如何看到和操作 Claude，但底层 agentic loop 完全一致。完整列表见 [Use Claude Code everywhere](/en/overview#use-claude-code-everywhere)。

## 使用 sessions 工作

Claude Code 会在你工作时把会话保存在本地。每条消息、每次 tool 使用及结果都会被存储，因此支持[回退](#使用检查点撤销更改)、[恢复与分叉](#恢复或分叉-sessions)。在 Claude 修改代码前，它还会为受影响文件创建快照，以便必要时回滚。

**sessions 彼此独立。** 每个新 session 都从全新上下文窗口开始，不带前一个 session 的对话历史。Claude 可以通过 [auto memory](/en/memory#auto-memory) 跨 session 持久化学习信息，你也可以在 [CLAUDE.md](/en/memory) 里加入自己的持久化指令。

### 跨分支工作

每个 Claude Code 对话都是一个与当前目录绑定的 session。恢复时，你只能看到这个目录的 sessions。

Claude 会看到当前分支的文件。切换分支后，Claude 看到的是新分支文件，但会话历史保持不变。即便切了分支，Claude 仍记得你之前讨论过什么。

由于 session 与目录绑定，你可以用 [git worktrees](/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) 为不同分支创建不同目录，从而并行运行多个 Claude sessions。

### 恢复或分叉 sessions

当你用 `claude --continue` 或 `claude --resume` 恢复 session 时，会以同一 session ID 从上次位置继续。新消息会追加到已有对话中。完整对话历史会恢复，但 session 级权限不会恢复，需要重新批准。

![](https://mintcdn.com/claude-code/c5r9_6tjPMzFdDDT/images/session-continuity.svg?fit=max&auto=format&n=c5r9_6tjPMzFdDDT&q=85&s=fa41d12bfb57579cabfeece907151d30)

如果你想基于当前进度尝试另一种做法，又不影响原 session，可使用 `--fork-session`：

```bash
claude --continue --fork-session
```

这会创建新的 session ID，同时保留该时间点之前的会话历史。原 session 不变。和 resume 一样，fork 出来的 session 不继承 session 级权限。

**同一 session 在多个终端中使用：** 如果你在多个终端恢复同一个 session，两个终端会同时写入同一个 session 文件。消息会交错，就像两个人写同一本笔记本。文件不会损坏，但对话会变乱。会话进行中，每个终端只看到自己的消息；但以后再恢复该 session 时，你会看到全部交错内容。若要基于同一起点并行工作，使用 `--fork-session` 给每个终端独立、干净的 session。

### context window

Claude 的 context window 包含对话历史、文件内容、命令输出、[CLAUDE.md](/en/memory)、已加载 skills 以及系统指令。随着工作推进，上下文会逐渐填满。Claude 会自动 compact，但对话早期的指令可能丢失。持久规则应写在 CLAUDE.md 中，可运行 `/context` 查看上下文占用。

#### 当 context 填满时

接近上限时，Claude Code 会自动管理上下文。它会先清理较早的 tool 输出，再在必要时总结对话。你的请求与关键代码片段会被保留；对话早期的细节指令可能丢失。持久规则应放在 CLAUDE.md，而不是依赖长对话历史。

要控制 compaction 时保留什么，你可以在 CLAUDE.md 中加“Compact Instructions”段落，或用带焦点的 `/compact`（例如 `/compact focus on the API changes`）。

运行 `/context` 可查看空间占用。MCP servers 会把 tool 定义加入每次请求，因此少量 servers 就可能在开工前消耗不少上下文。可用 `/mcp` 查看每个 server 的成本。

#### 用 skills 与 subagents 管理上下文

除了 compaction，你还可以用其他特性控制上下文加载。

[Skills](/en/skills) 是按需加载。session 开始时 Claude 只看到 skill 描述，完整内容仅在使用 skill 时加载。对于你手动触发的 skills，可设置 `disable-model-invocation: true`，让描述在需要前不进入上下文。

[Subagents](/en/sub-agents) 拥有与主会话完全隔离的独立上下文窗口。它们的工作不会膨胀你的主上下文。完成后仅返回摘要。这种隔离正是 subagents 在长会话中有价值的原因。

关于各特性的上下文开销见 [context costs](/en/features-overview#understand-context-costs)，关于降低 token 使用见 [reduce token usage](/en/costs#reduce-token-usage)。

## 用 checkpoints 与 permissions 保持安全

Claude 提供两套安全机制：checkpoints 用于撤销文件更改，permissions 用于控制 Claude 在不询问时可执行的操作。

### 使用 checkpoints 撤销更改

**每一次文件编辑都可回退。** Claude 编辑任何文件前都会先快照当前内容。如果出错，你可以按两次 `Esc` 回退到之前状态，或直接让 Claude 撤销。

checkpoints 仅存在于本地 session，且独立于 git。它们只覆盖文件变更。涉及远程系统的操作（数据库、API、部署）无法 checkpoint，因此 Claude 在执行有外部副作用的命令前会先询问。

### 控制 Claude 能做什么

按 `Shift+Tab` 可在权限模式间切换：

* **Default**：文件编辑与 shell 命令都先询问
* **Auto-accept edits**：文件可直接编辑；命令仍需询问
* **Plan mode**：仅用只读 tools，先给出可批准的执行计划

你也可以在 `.claude/settings.json` 中允许特定命令，避免每次都询问。例如 `npm test` 或 `git status` 这类可信命令。设置可以从组织级策略到个人偏好逐层生效。详见 [Permissions](/en/permissions)。

***

## 高效使用 Claude Code

以下建议可帮助你获得更好结果。

### 向 Claude Code 直接提问

Claude Code 可以教你如何使用它。你可以问“如何设置 hooks？”或“CLAUDE.md 最佳结构是什么？”，Claude 会给出说明。

内置命令也会引导你完成设置：

* `/init`：引导你为项目创建 CLAUDE.md
* `/agents`：帮助你配置自定义 subagents
* `/doctor`：诊断安装中的常见问题

### 把它当作对话

Claude Code 是会话式的。你不需要完美提示词。先说你的目标，再逐步细化：

```text
Fix the login bug
```

\[Claude 调研并尝试]

```text
That's not quite right. The issue is in the session handling.
```

\[Claude 调整方案]

第一次尝试不对时，不必从头再来，继续迭代即可。

#### 随时打断并纠偏

你可以在任意时刻打断 Claude。如果它走偏了，直接输入纠正并回车。Claude 会停止当前动作，并根据你的输入调整方法。你不需要等它做完，也不需要重开。

### 一开始就尽量具体

初始提示越精确，你后续需要纠正的次数越少。尽量给出具体文件、约束条件，以及可参考的实现模式。

```text
The checkout flow is broken for users with expired cards.
Check src/payments/ for the issue, especially token refresh.
Write a failing test first, then fix it.
```

模糊提示也能工作，但你需要更多引导。像上面这样具体的提示，往往第一次就更容易成功。

### 给 Claude 可验证的目标

当 Claude 能自检时，效果更好。你可以给测试用例、贴期望 UI 截图，或明确输出格式。

```text
Implement validateEmail. Test cases: 'user@example.com' → true,
'invalid' → false, 'user@.com' → false. Run the tests after.
```

对于视觉类工作，可贴设计截图并要求 Claude 对照实现结果进行比对。

### 先探索，再实现

复杂问题建议把“调研”和“编码”拆开。你可以先用 plan mode（按两次 `Shift+Tab`）分析代码库：

```text
Read src/auth/ and understand how we handle sessions.
Then create a plan for adding OAuth support.
```

先审阅计划、通过对话打磨，再让 Claude 实现。相比直接写代码，这种两阶段方法通常更稳。

### 委派，而不是逐条指挥

可以把 Claude 当成一个能力很强的同事来委派：给上下文和方向，然后让它自己处理细节。

```text
The checkout flow is broken for users with expired cards.
The relevant code is in src/payments/. Can you investigate and fix it?
```

你不必明确指定“读哪些文件”或“跑哪些命令”，Claude 会自己决定。

## 接下来

<CardGroup cols={2}>
  <Card title="Extend with features" icon="puzzle-piece" href="/en/features-overview">
    添加 Skills、MCP 连接与自定义命令
  </Card>

  <Card title="Common workflows" icon="graduation-cap" href="/en/common-workflows">
    典型任务的分步指南
  </Card>
</CardGroup>

## 引用

- 原文：
  https://code.claude.com/docs/en/how-claude-code-works
- Claude Code 文档索引：
  https://code.claude.com/docs/llms.txt
