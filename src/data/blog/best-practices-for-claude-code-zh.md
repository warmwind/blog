---
title: "Claude Code 最佳实践（Best Practices）中文翻译"
pubDatetime: 2026-03-16T16:00:00+08:00
description: "Claude Code 文档《Best Practices for Claude Code》中文翻译（含原文引用）。"
slug: best-practices-for-claude-code-zh
---

> 原文标题：Best Practices for Claude Code  
> 原文链接：https://code.claude.com/docs/en/best-practices

# Claude Code 最佳实践

> 从环境配置到跨并行会话扩展，帮助你最大化 Claude Code 效能的技巧与模式。

Claude Code 是一个 agentic 编码环境。它不同于“回答问题后等待下一步”的 chatbot：Claude Code 可以读取你的文件、运行命令、修改代码，并在你旁观、重定向，甚至离开时自主推进问题求解。

这改变了你的工作方式。你不再是“自己写代码，再让 Claude 评审”，而是描述目标，让 Claude 决定如何构建。Claude 会探索、规划并实现。

但这种自主性也有学习曲线。Claude 在一些你需要理解的约束下工作。

本指南总结了 Anthropic 内部团队，以及在多种代码库、语言与环境中使用 Claude Code 的工程师所验证有效的模式。关于 agentic loop 的底层机制，参见 [How Claude Code works](/en/how-claude-code-works)。

***

大多数最佳实践都基于一个约束：Claude 的 context window 很快会被填满，并且越满性能越会下降。

Claude 的 context window 包含整个对话：每条消息、Claude 读取的每个文件、每次命令输出。它可能很快填满。一次调试会话或代码库探索就可能产生并消耗数万 token。

这很关键，因为随着 context 填满，LLM 的表现会下降。当 context window 接近上限时，Claude 可能开始“遗忘”更早的指令，或出现更多错误。context window 是你最重要的资源。你可以用[自定义状态栏](/en/statusline)持续跟踪 context 使用情况，并参考 [Reduce token usage](/en/costs#reduce-token-usage) 获取降耗策略。

***

## 给 Claude 提供自我验证路径

> 提示：提供测试、截图或预期输出，让 Claude 可以自行检查结果。这是你能做的最高杠杆动作。

当 Claude 能验证自己的工作（例如运行测试、对比截图、校验输出）时，效果会显著提升。

如果没有明确成功标准，它可能产出“看起来对、实际上不可用”的结果。你就会成为唯一反馈回路，每个错误都需要你亲自介入。

| 策略 | Before | After |
| --- | --- | --- |
| **提供验证标准** | *"implement a function that validates email addresses"* | *"write a validateEmail function. example test cases: user@example.com is true, invalid is false, user@.com is false. run the tests after implementing"* |
| **用可视化方式验证 UI 改动** | *"make the dashboard look better"* | *"[粘贴截图] implement this design. take a screenshot of the result and compare it to the original. list differences and fix them"* |
| **修复根因而非症状** | *"the build is failing"* | *"the build fails with this error: [粘贴错误]. fix it and verify the build succeeds. address the root cause, don't suppress the error"* |

UI 改动可以通过 [Claude in Chrome extension](/en/chrome) 验证。它会在浏览器里打开新标签页、测试 UI，并迭代直到代码可用。

你的验证手段也可以是测试套件、linter，或用于检查输出的 Bash 命令。请投入精力把验证机制做扎实。

***

## 先探索，再规划，再编码

> 提示：把调研与规划和实现分离，避免解决错问题。

让 Claude 直接开始写代码，可能导致“代码解决了错误的问题”。使用 [Plan Mode](/en/common-workflows#use-plan-mode-for-safe-code-analysis) 把探索与执行分离。

推荐工作流分四个阶段：

1. **Explore（探索）**  
   进入 Plan Mode。Claude 读取文件并回答问题，但不做修改。

   ```txt
   read /src/auth and understand how we handle sessions and login.
   also look at how we manage environment variables for secrets.
   ```

2. **Plan（规划）**  
   让 Claude 产出详细实现计划。

   ```txt
   I want to add Google OAuth. What files need to change?
   What's the session flow? Create a plan.
   ```

   按 `Ctrl+G` 可在 Claude 继续前，先在编辑器中直接编辑计划。

3. **Implement（实现）**  
   切回 Normal Mode，让 Claude 按计划编码并验证。

   ```txt
   implement the OAuth flow from your plan. write tests for the
   callback handler, run the test suite and fix any failures.
   ```

4. **Commit（提交）**  
   让 Claude 以描述性信息提交并创建 PR。

   ```txt
   commit with a descriptive message and open a PR
   ```

> 注意：Plan Mode 很有用，但也有额外开销。  
> 当任务范围清晰且改动很小（如修 typo、加日志、重命名变量）时，直接让 Claude 执行即可。  
> 当你不确定方案、改动跨多个文件，或你对目标代码不熟时，规划最有价值。若你能用一句话描述 diff，就跳过规划。

***

## 在 prompt 中提供具体上下文

> 提示：指令越精确，需要的返工越少。

Claude 可以推断意图，但它不能读心。请引用具体文件、明确约束、指出可参考的现有模式。

| 策略 | Before | After |
| --- | --- | --- |
| **限定任务范围**（指定文件、场景、测试偏好） | *"add tests for foo.py"* | *"write a test for foo.py covering the edge case where the user is logged out. avoid mocks."* |
| **指明信息来源**（告诉 Claude 去哪里找答案） | *"why does ExecutionFactory have such a weird api?"* | *"look through ExecutionFactory's git history and summarize how its api came to be"* |
| **引用现有模式**（指向代码库中的惯例实现） | *"add a calendar widget"* | *"look at how existing widgets are implemented on the home page to understand the patterns. HotDogWidget.php is a good example. follow the pattern to implement a new calendar widget that lets the user select a month and paginate forwards/backwards to pick a year. build from scratch without libraries other than the ones already used in the codebase."* |
| **描述症状**（提供症状、可能位置、修复标准） | *"fix the login bug"* | *"users report that login fails after session timeout. check the auth flow in src/auth/, especially token refresh. write a failing test that reproduces the issue, then fix it"* |

在探索阶段，模糊 prompt 也可能有价值，比如 `"what would you improve in this file?"`，它会暴露你未必会主动问到的问题。

### 提供富内容

> 提示：使用 `@` 引用文件、直接粘贴截图/图片，或直接管道输入数据。

你可以通过多种方式向 Claude 提供富数据：

- **用 `@` 引用文件**，而不是口述代码位置。Claude 会先读取文件再回应。
- **直接粘贴图片**：复制粘贴或拖拽到 prompt。
- **提供 URL**：用于文档和 API 参考。可用 `/permissions` 对常用域名加入 allowlist。
- **管道输入数据**：例如 `cat error.log | claude` 直接发送文件内容。
- **让 Claude 自取上下文**：通过 Bash 命令、MCP tools 或读取文件获取所需信息。

***

## 配置你的环境

一些前置配置能显著提升 Claude Code 在所有会话中的表现。关于扩展能力总览与选型，参见 [Extend Claude Code](/en/features-overview)。

### 编写有效的 CLAUDE.md

> 提示：运行 `/init` 基于当前项目结构生成初版 CLAUDE.md，再持续迭代。

CLAUDE.md 是 Claude 在每次对话开始都会读取的特殊文件。你应写入 Bash 命令、代码风格和工作流规则。这些是 Claude 仅靠阅读代码无法稳定推断的持久上下文。

`/init` 会分析代码库，识别构建系统、测试框架和代码模式，给你一个可继续打磨的基础。

CLAUDE.md 没有强制格式，但应保持简短、可读。例如：

```markdown
# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
```

CLAUDE.md 会在每个会话加载，所以只保留广泛适用内容。对于仅偶尔相关的领域知识或工作流，使用 [skills](/en/skills) 更合适：按需加载，不会让每次对话都膨胀。

保持精简。每一行都问自己：**“删掉它会让 Claude 更易犯错吗？”** 如果不会，就删。臃肿的 CLAUDE.md 会让 Claude 忽略你真正重要的指令。

| ✅ 应包含 | ❌ 应排除 |
| --- | --- |
| Claude 无法自行猜到的 Bash 命令 | Claude 读代码就能推断的内容 |
| 偏离默认的代码风格规则 | Claude 已知的标准语言约定 |
| 测试说明与首选测试运行器 | 详细 API 文档（改为链接） |
| 仓库协作规范（分支命名、PR 约定） | 高频变动信息 |
| 项目特有架构决策 | 过长解释或教程 |
| 开发环境陷阱（必需 env vars） | 按文件逐个说明代码库 |
| 常见坑与不明显行为 | “写干净代码”这类显而易见建议 |

如果 Claude 在明明有规则的情况下仍反复做错，多半是文件太长导致规则被淹没。如果 Claude 问了 CLAUDE.md 已回答的问题，多半是措辞有歧义。把 CLAUDE.md 当作代码来维护：出问题就复盘、定期修剪，并通过行为变化验证改动是否有效。

你可以添加强调词（如“IMPORTANT”“YOU MUST”）提升遵循度。建议将 CLAUDE.md 纳入 git，让团队共同迭代，它会持续复利。

CLAUDE.md 支持 `@path/to/import` 导入其他文件：

```markdown
See @README.md for project overview and @package.json for available npm commands.

# Additional Instructions
- Git workflow: @docs/git-instructions.md
- Personal overrides: @~/.claude/my-project-instructions.md
```

你可在多个位置放置 CLAUDE.md：

- **Home 目录（`~/.claude/CLAUDE.md`）**：作用于所有会话
- **项目根目录（`./CLAUDE.md`）**：可提交到 git 与团队共享
- **父目录**：适合 monorepo，自动叠加如 `root/CLAUDE.md` 与 `root/foo/CLAUDE.md`
- **子目录**：Claude 在处理对应目录文件时按需加载子目录 CLAUDE.md

### 配置权限

> 提示：使用 `/permissions` 配置安全命令 allowlist，或用 `/sandbox` 做 OS 级隔离。这样可减少打断，同时保留控制权。

默认情况下，Claude Code 会为可能修改系统的动作请求许可：文件写入、Bash 命令、MCP tools 等。这很安全，但也容易繁琐。你可以通过两种方式减少中断：

- **Permission allowlists**：放行你确认安全的工具（如 `npm run lint`、`git commit`）
- **Sandboxing**：启用 OS 级隔离，限制文件系统与网络访问，让 Claude 在边界内更自主

另外，也可用 `--dangerously-skip-permissions` 跳过所有权限检查，适用于受控工作流（如修 lint、生成样板代码）。

> 警告：允许 Claude 运行任意命令可能造成数据丢失、系统损坏，或被 prompt injection 导致数据外泄。仅应在无互联网访问的 sandbox 中使用 `--dangerously-skip-permissions`。

参见 [configuring permissions](/en/permissions) 与 [enabling sandboxing](/en/sandboxing)。

### 使用 CLI tools

> 提示：与外部服务交互时，告诉 Claude Code 优先使用 `gh`、`aws`、`gcloud`、`sentry-cli` 等 CLI 工具。

CLI tools 是与外部服务交互时最节省上下文的方式。若你用 GitHub，请安装 `gh` CLI。Claude 能用它创建 issue、发起 PR、读取评论。没有 `gh` 时也可调用 GitHub API，但匿名请求常受 rate limit 限制。

Claude 也擅长快速学习它原本不熟悉的 CLI。可尝试：`Use 'foo-cli-tool --help' to learn about foo tool, then use it to solve A, B, C.`

### 连接 MCP servers

> 提示：运行 `claude mcp add` 连接 Notion、Figma、数据库等外部工具。

通过 [MCP servers](/en/mcp)，你可以让 Claude 根据 issue tracker 实现功能、查询数据库、分析监控数据、接入 Figma 设计并自动化工作流。

### 设置 hooks

> 提示：对于“必须每次都发生且零例外”的动作，使用 hooks。

[Hooks](/en/hooks-guide) 会在 Claude 工作流特定时机自动执行脚本。不同于 CLAUDE.md 的建议性指令，hooks 是确定性的，能保证动作发生。

Claude 可以帮你写 hooks。例如：*“Write a hook that runs eslint after every file edit”* 或 *“Write a hook that blocks writes to the migrations folder.”*。你也可以手动编辑 `.claude/settings.json` 配置，并用 `/hooks` 浏览当前配置。

### 创建 skills

> 提示：在 `.claude/skills/` 下创建 `SKILL.md`，为 Claude 提供领域知识与可复用工作流。

[Skills](/en/skills) 可扩展 Claude 在项目、团队、领域上的知识。Claude 会在相关时自动应用，或你用 `/skill-name` 直接调用。

在 `.claude/skills/` 新建目录并添加 `SKILL.md`：

```markdown
---
name: api-conventions
description: REST API design conventions for our services
---
# API Conventions
- Use kebab-case for URL paths
- Use camelCase for JSON properties
- Always include pagination for list endpoints
- Version APIs in the URL path (/v1/, /v2/)
```

skills 也可定义可重复执行的工作流：

```markdown
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---
Analyze and fix the GitHub issue: $ARGUMENTS.

1. Use `gh issue view` to get the issue details
2. Understand the problem described in the issue
3. Search the codebase for relevant files
4. Implement the necessary changes to fix the issue
5. Write and run tests to verify the fix
6. Ensure code passes linting and type checking
7. Create a descriptive commit message
8. Push and create a PR
```

运行 `/fix-issue 1234` 即可调用。对于有副作用的工作流，建议设置 `disable-model-invocation: true`，改为手动触发。

### 创建自定义 subagents

> 提示：在 `.claude/agents/` 定义专用助手，让 Claude 在隔离上下文中委派任务。

[Subagents](/en/sub-agents) 在独立 context 中运行，并可配置独立可用工具。它们适合读取大量文件或需要专注处理的任务，且不会污染主会话。

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling

Provide specific line references and suggested fixes.
```

你也可显式要求 Claude 使用 subagent：*“Use a subagent to review this code for security issues.”*

### 安装 plugins

> 提示：运行 `/plugin` 浏览 marketplace。plugins 可无配置引入 skills、tools 与 integrations。

[Plugins](/en/plugins) 将 skills、hooks、subagents 与 MCP servers 打包为可安装单元（来自社区或 Anthropic）。若你使用强类型语言，可安装[代码智能 plugin](/en/discover-plugins#code-intelligence)，获得精确符号导航和编辑后自动报错检测。

关于 skills、subagents、hooks、MCP 的选型，参见 [Extend Claude Code](/en/features-overview#match-features-to-your-goal)。

***

## 有效沟通

你与 Claude Code 的沟通方式，会显著影响结果质量。

### 提问代码库问题

> 提示：把 Claude 当成资深工程师来提问。

当你接手新代码库时，Claude Code 非常适合做学习和探索。你可以问它与你会问同事类似的问题：

- logging 是如何工作的？
- 我该如何新增一个 API endpoint？
- `foo.rs` 第 134 行的 `async move { ... }` 在做什么？
- `CustomerOnboardingFlowImpl` 处理了哪些 edge cases？
- 为什么第 333 行调用的是 `foo()` 而不是 `bar()`？

这样使用 Claude Code 是高效 onboarding 工作流，能加快上手并减轻其他工程师负担。无需特殊 prompt，直接问即可。

### 让 Claude 反向采访你

> 提示：做较大功能时，先让 Claude 采访你。用最小 prompt 开场，并要求用 `AskUserQuestion` 工具深入提问。

Claude 会问到你可能尚未考虑的问题，包括技术实现、UI/UX、边界情况与取舍。

```text
I want to build [brief description]. Interview me in detail using the AskUserQuestion tool.

Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered.

Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.
```

当规范完成后，开启新会话执行实现。新会话有干净 context，专注实现，同时你也有可引用的书面规格。

***

## 管理你的会话

对话是持久且可回退的。把这点用起来。

### 尽早且频繁地纠偏

> 提示：一旦发现 Claude 偏离轨道，立即纠正。

最佳结果通常来自紧密反馈回路。虽说 Claude 偶尔能一次做对，但快速纠偏通常更快得到优解。

- **`Esc`**：中途按 `Esc` 停止 Claude。context 会保留，便于你重定向。
- **`Esc + Esc` 或 `/rewind`**：双击 `Esc` 或运行 `/rewind` 打开回退菜单，恢复历史对话与代码状态，或从某条消息开始摘要。
- **`"Undo that"`**：让 Claude 撤销刚才改动。
- **`/clear`**：在无关任务间重置 context。长会话中的无关信息会降低性能。

如果同一问题在一个会话里你已经纠正 Claude 超过两次，说明上下文已被失败尝试污染。请 `/clear` 后重开，并用更具体 prompt（结合你刚学到的信息）。干净会话 + 更好 prompt，几乎总是优于带历史包袱的长会话。

### 激进管理 context

> 提示：在无关任务之间运行 `/clear`，重置 context。

当接近 context 限制时，Claude Code 会自动 compact 对话历史：保留关键代码与决策，同时释放空间。

长会话中，context window 可能被无关对话、文件内容、命令输出占满，影响表现并分散 Claude 注意力。

- 在任务之间频繁使用 `/clear` 完全重置 context window
- 自动 compact 触发时，Claude 会总结最关键内容（代码模式、文件状态、关键决策）
- 若需更可控，使用 `/compact <instructions>`，如 `/compact Focus on the API changes`
- 若只想压缩部分对话，使用 `Esc + Esc` 或 `/rewind` 选中检查点，再选 **Summarize from here**
- 可在 CLAUDE.md 定制 compact 行为，例如：`"When compacting, always preserve the full list of modified files and any test commands"`
- 对于不希望进入主上下文的临时问题，可用 [`/btw`](/en/interactive-mode#side-questions-with-btw)；回答显示为可关闭浮层，不进入会话历史

### 用 subagents 做调查

> 提示：通过 `"use subagents to investigate X"` 委派调研。它们在独立 context 探索，主会话保持干净，便于实现。

既然 context 是核心约束，subagents 就是最强工具之一。当 Claude 自行调研代码库时会读很多文件，而这些都会消耗你的 context。subagents 在独立 context window 运行，再把结果摘要回传：

```text
Use subagents to investigate how our authentication system handles token
refresh, and whether we have any existing OAuth utilities I should reuse.
```

subagent 会探索代码库、读取相关文件并汇总关键发现，且不污染你的主会话。

你也可以在实现后让 subagent 做验证：

```text
use a subagent to review this code for edge cases
```

### 用检查点回退

> 提示：Claude 每次动作都会创建检查点。你可恢复到任一历史检查点的对话、代码，或两者同时恢复。

Claude 在改动前会自动创建检查点。双击 `Escape` 或运行 `/rewind` 打开菜单。你可只恢复对话、只恢复代码、两者都恢复，或从某消息开始摘要。详情见 [Checkpointing](/en/checkpointing)。

与其把每一步都规划得非常保守，不如让 Claude 先尝试高风险方案；若失败，直接回退再换路线。检查点可跨会话持久化：即使关闭终端，之后仍可回退。

> 警告：检查点只跟踪 **Claude 本身** 做出的改动，不跟踪外部进程改动。它不能替代 git。

### 恢复会话

> 提示：运行 `claude --continue` 继续最近会话，或 `--resume` 从最近会话列表选择。

Claude Code 会把会话保存在本地。任务跨多个会话时，你不必重复解释上下文：

```bash
claude --continue    # Resume the most recent conversation
claude --resume      # Select from recent conversations
```

使用 `/rename` 给会话命名（如 `"oauth-migration"`、`"debugging-memory-leak"`），便于后续检索。可把会话当成分支：不同工作流对应独立且可持久化的上下文。

***

## 自动化与规模化

当你已经能高效使用“一个 Claude”后，可通过并行会话、非交互模式和 fan-out 模式放大产出。

前述内容默认是“一个人 + 一个 Claude + 一段对话”。但 Claude Code 可水平扩展。本节介绍如何进一步提升吞吐。

### 运行非交互模式

> 提示：在 CI、pre-commit hooks 或脚本中使用 `claude -p "prompt"`。如需流式 JSON 输出，加 `--output-format stream-json`。

用 `claude -p "your prompt"` 可在无会话情况下运行 Claude。非交互模式适用于把 Claude 接入 CI、pre-commit、自动化流程。输出可编程解析：纯文本、JSON、流式 JSON。

```bash
# One-off queries
claude -p "Explain what this project does"

# Structured output for scripts
claude -p "List all API endpoints" --output-format json

# Streaming for real-time processing
claude -p "Analyze this log file" --output-format stream-json
```

### 运行多个 Claude 会话

> 提示：并行运行多个 Claude 会话，加速开发、隔离实验或启动复杂工作流。

并行会话主要有三种方式：

- [Claude Code desktop app](/en/desktop#work-in-parallel-with-sessions)：可视化管理多个本地会话；每个会话有隔离 worktree
- [Claude Code on the web](/en/claude-code-on-the-web)：在 Anthropic 安全云基础设施的隔离 VM 运行
- [Agent teams](/en/agent-teams)：多会话自动协调，支持共享任务、消息通信与 team lead

多会话不仅能并行，还能提升质量。评审时使用新上下文，能避免 Claude 对自己刚写的代码产生偏见。

例如 Writer/Reviewer 模式：

| Session A（Writer） | Session B（Reviewer） |
| --- | --- |
| `Implement a rate limiter for our API endpoints` | |
| | `Review the rate limiter implementation in @src/middleware/rateLimiter.ts. Look for edge cases, race conditions, and consistency with our existing middleware patterns.` |
| `Here's the review feedback: [Session B output]. Address these issues.` | |

测试也可同理：让一个 Claude 写测试，另一个 Claude 写代码使测试通过。

### 跨文件 fan out

> 提示：循环任务并对每项调用 `claude -p`。批量操作时用 `--allowedTools` 限制权限。

对于大型迁移或分析任务，可把工作分发到多个并行 Claude 调用：

1. **生成任务清单**  
   让 Claude 列出所有待迁移文件（如“列出需要迁移的 2,000 个 Python 文件”）。

2. **写脚本遍历清单**

   ```bash
   for file in $(cat files.txt); do
     claude -p "Migrate $file from React to Vue. Return OK or FAIL." \
       --allowedTools "Edit,Bash(git commit *)"
   done
   ```

3. **先小规模验证，再全量执行**  
   先在 2–3 个文件上试跑，根据问题优化 prompt，再跑全量。`--allowedTools` 能限制 Claude 行为，这在无人值守场景尤其重要。

你也可把 Claude 接入已有数据/处理流水线：

```bash
claude -p "<your prompt>" --output-format json | your_command
```

开发阶段可用 `--verbose` 调试，生产阶段关闭。

***

## 避免常见失败模式

以下是常见错误，尽早识别可显著节省时间：

- **大杂烩会话（kitchen sink session）**：先做任务 A，又问无关问题，再回到 A，导致 context 塞满无关信息。  
  > **修复**：无关任务之间使用 `/clear`。
- **反复纠错循环**：Claude 做错，你纠正，它还错，再纠正。context 被失败方案污染。  
  > **修复**：两次纠正仍失败就 `/clear`，并重写更好的初始 prompt（吸收已学信息）。
- **过度膨胀的 CLAUDE.md**：CLAUDE.md 太长，关键规则淹没在噪声中。  
  > **修复**：强力修剪。若 Claude 无该指令也能做对，就删掉或改成 hook。
- **“先信任后验证”的缺口**：Claude 给出看似合理实现，但没覆盖 edge cases。  
  > **修复**：始终提供验证（测试、脚本、截图）。不能验证就不要发布。
- **无限探索**：让 Claude “investigate” 但不设边界，Claude 读了几百个文件把 context 吃满。  
  > **修复**：缩小调查范围，或用 subagents 承担探索。

***

## 形成你的直觉

本指南中的模式不是教条，而是一般情况下有效的起点；在具体场景下未必总是最优。

有时你确实应该让 context 累积，因为你正在攻克单个复杂问题，历史信息很有价值。有时应跳过规划，直接让 Claude 探索，因为任务本身需要探索性。有时模糊 prompt 反而正确，因为你希望先观察 Claude 如何理解问题，再决定约束方式。

关注“什么有效”。当 Claude 产出优秀结果时，回看你做了什么：prompt 结构、提供的上下文、所处模式。当 Claude 表现不佳时，问自己原因：context 太嘈杂？prompt 太模糊？任务是否过大，不适合一次完成？

随着实践，你会形成任何指南都无法完全覆盖的直觉。你会知道何时具体、何时开放，何时规划、何时探索，何时清空 context、何时保留历史。

## 相关资源

- [How Claude Code works](/en/how-claude-code-works)：agentic loop、tools 与 context 管理
- [Extend Claude Code](/en/features-overview)：skills、hooks、MCP、subagents、plugins
- [Common workflows](/en/common-workflows)：调试、测试、PR 等步骤化实践
- [CLAUDE.md](/en/memory)：存放项目约定与持久上下文

## 引用

- 原文：
  https://code.claude.com/docs/en/best-practices
