---
title: "Open SWE：面向内部 Coding Agents 的开源框架"
pubDatetime: 2026-03-21T14:00:00+08:00
description: "LangChain 博客《Open SWE: An Open-Source Framework for Internal Coding Agents》中文翻译（含原文引用）。"
slug: open-swe-open-source-framework-for-internal-coding-agents-zh
originalTitle: "Open SWE: An Open-Source Framework for Internal Coding Agents"
originalUrl: https://blog.langchain.com/open-swe-an-open-source-framework-for-internal-coding-agents/
---

> 原文标题：Open SWE: An Open-Source Framework for Internal Coding Agents
> 原文链接：https://blog.langchain.com/open-swe-an-open-source-framework-for-internal-coding-agents/

# Open SWE：面向内部 Coding Agents 的开源框架

![](https://blog.langchain.com/content/images/size/w1200/2026/03/OpenSWE.png)

基于 Deep Agents 和 LangGraph 构建，Open SWE 提供了内部 coding agents 的核心架构组件。

阅读时长：7 分钟
发布时间：2026 年 3 月 17 日

## 引言

在过去一年中，多个工程组织构建了与开发团队协同工作的内部 coding agents。Stripe 开发了 [Minions](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents?ref=blog.langchain.com)，Ramp 构建了 [Inspect](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal?ref=blog.langchain.com)，Coinbase 创建了 [Cloudbot](https://www.coinbase.com/blog/building-enterprise-AI-agents-at-Coinbase?ref=blog.langchain.com)。这些系统通过 Slack、Linear 和 GitHub 集成到现有工作流中，而不需要工程师去适配新的界面。

尽管这些系统是独立开发的，但它们在架构模式上趋于一致：隔离的云沙箱、精心策划的工具集、子 agent 编排，以及与开发者工作流的集成。这种趋同说明，在生产环境中部署 AI agents 存在共同的需求。

今天，我们发布 **Open SWE**，一个以可定制形式捕获这些模式的开源框架。基于 [Deep Agents](https://github.com/langchain-ai/deepagents?ref=blog.langchain.com) 和 [LangGraph](https://langchain-ai.github.io/langgraph/?ref=blog.langchain.com) 构建，Open SWE 提供了在这些实现中观察到的核心架构组件。正在探索内部 coding agents 的组织可以将其作为起点。

## 生产部署中的模式

Stripe、Ramp 和 Coinbase 各自构建了内部 coding agents。Kishan Dahya [撰写了一篇出色的文章](https://x.com/kishan_dahya/status/2028971339974099317?ref=blog.langchain.com)，分析了这些 coding agents 做出的不同架构决策。关键模式包括：

**隔离的执行环境**：任务在专用的云沙箱中运行，在严格边界内拥有完整权限。这将错误的影响范围与生产系统隔离，同时允许 agent 在不需要逐一审批的情况下执行命令。

**精心策划的工具集**：据 [Stripe 工程团队](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents?ref=blog.langchain.com)介绍，他们的 agents "可以访问约 500 个工具，但这些工具是精心挑选和维护的"，而非随时间累积。工具的质量看起来比数量更重要。

**Slack 优先的调用方式**：三个系统都将 Slack 作为主要界面集成，在开发者现有的沟通工作流中与他们交互，而非要求他们切换到新的应用程序。

**启动时的丰富上下文**：这些 agents 在开始工作前会从 Linear issue、Slack 线程或 GitHub PR 中提取完整上下文，减少了通过工具调用来发现需求的开销。

**子 agent 编排**：复杂任务被分解并委派给专门的子 agents，每个子 agent 都有隔离的上下文和专注的职责。

这些架构选择已在多个生产部署中证明了其有效性，尽管各组织可能需要根据自身环境和需求调整特定组件。

## Open SWE 的架构

Open SWE 提供了类似架构模式的开源实现。

### 1. Agent Harness：基于 Deep Agents 组合

Open SWE 没有 fork 已有的 agent 或从零开始构建，而是在 [Deep Agents](https://github.com/langchain-ai/deepagents?ref=blog.langchain.com) 框架上进行组合。这种方式类似于 [Ramp 团队在 OpenCode 之上构建 Inspect](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal?ref=blog.langchain.com) 的做法。

组合提供了两个优势：

**升级路径**：当 Deep Agents 改进时（更好的上下文管理、更高效的规划、优化的 token 使用），你可以直接引入这些改进而无需重建你的定制内容。

**无需 fork 的定制**：你可以将组织特定的工具、提示词和工作流作为配置来维护，而非对核心 agent 逻辑的修改。

```python
create_deep_agent(
    model="anthropic:claude-opus-4-6",
    system_prompt=construct_system_prompt(repo_dir, ...),
    tools=[
        http_request,
        fetch_url,
        commit_and_open_pr,
        linear_comment,
        slack_thread_reply
    ],
    backend=sandbox_backend,
    middleware=[
        ToolErrorMiddleware(),
        check_message_queue_before_model,
        ...
    ],
)
```

Deep Agents 提供了支持这些模式的基础设施：通过 `write_todos` 进行内建规划、基于文件的上下文管理、通过 `task` 工具原生支持子 agent 生成，以及用于确定性编排的中间件钩子。

### 2. Sandbox：隔离的云环境

每个任务在自己的隔离云沙箱中运行——一个拥有完整 shell 访问权限的远程 Linux 环境。仓库被克隆进来，agent 获得完整权限，任何错误都被限制在该环境内。

Open SWE 开箱即支持多个 sandbox 提供商：

* [Modal](https://modal.com/?ref=blog.langchain.com)
* [Daytona](https://www.daytona.io/?ref=blog.langchain.com)
* [Runloop](https://www.runloop.ai/?ref=blog.langchain.com)
* [LangSmith](https://blog.langchain.com/introducing-langsmith-sandboxes-secure-code-execution-for-agents/)

你也可以实现自己的 sandbox 后端。

这遵循了我们观察到的一个模式：先隔离，再在边界内授予完整权限。

关键行为：

* 每个会话线程获得一个持久化的 sandbox，在后续消息中复用
* 如果 sandbox 变得不可达，会自动重新创建
* 多个任务并行运行，每个任务都在自己的 sandbox 中

### 3. 工具：精心策划，而非堆积

Open SWE 附带了一个精焦的工具集：

| 工具 | 用途 |
|------|------|
| `execute` | 在 sandbox 中执行 shell 命令 |
| `fetch_url` | 将网页抓取为 markdown |
| `http_request` | API 调用（GET、POST 等） |
| `commit_and_open_pr` | Git 提交并创建 GitHub Draft PR |
| `linear_comment` | 在 Linear ticket 上发布更新 |
| `slack_thread_reply` | 在 Slack 线程中回复 |

加上 Deep Agents 的内建工具：`read_file`、`write_file`、`edit_file`、`ls`、`glob`、`grep`、`write_todos` 和 `task`（子 agent 生成）。

一个更小的、精心策划的工具集更易于测试、维护和推理。当你需要为组织添加额外的工具（内部 API、自定义部署系统、专用测试框架）时，可以显式地添加它们。

### 4. Context Engineering：AGENTS.md + 源上下文

Open SWE 从两个来源收集上下文：

**AGENTS.md 文件**：如果你的仓库根目录包含 `AGENTS.md` 文件，它会从 sandbox 中读取并注入到 system prompt 中。该文件可以编码约定、测试要求、架构决策和团队特定的模式，供每次 agent 运行遵循。

**源上下文**：完整的 Linear issue（标题、描述、评论）或 Slack 线程历史会在 agent 开始之前被组装并传递给它，提供特定于任务的上下文，无需额外的工具调用。

这种两层方式在仓库级知识和任务特定信息之间取得了平衡。

### 5. 编排：子 Agents + 中间件

Open SWE 的编排结合了两种机制：

**子 Agents**：Deep Agents 框架支持通过 `task` 工具生成子 agents。主 agent 可以将独立的子任务委派给隔离的子 agents，每个子 agent 都有自己的中间件栈、todo 列表和文件操作。

**中间件**：确定性中间件钩子在 agent 循环周围运行：

* `check_message_queue_before_model`：在下一次模型调用之前注入后续消息（运行中到达的 Linear 评论或 Slack 消息）。这允许用户在 agent 工作时提供额外的输入。
* `open_pr_if_needed`：作为安全网，如果 agent 没有完成提交和创建 PR 这一步，中间件会自动处理。这确保了关键步骤的可靠执行。
* `ToolErrorMiddleware`：优雅地捕获和处理工具错误。

这种 agentic（模型驱动）和确定性（中间件驱动）编排之间的分离，有助于在可靠性和灵活性之间取得平衡。

### 6. 调用方式：Slack、Linear 和 GitHub

我们观察到许多团队趋向于将 Slack 作为主要的调用界面。Open SWE 遵循了类似的模式：

**Slack**：在任何线程中 @提及 bot。支持 `repo:owner/name` 语法来指定要操作的仓库。Agent 在线程内回复状态更新和 PR 链接。

**Linear**：在任何 issue 上评论 `@openswe`。Agent 读取完整的 issue 上下文，用 👀 反应确认，并将结果作为评论发回。

**GitHub**：在 agent 创建的 PR 评论中标记 `@openswe`，让它处理 review 反馈并将修复推送到同一分支。

每次调用都会创建一个确定性的线程 ID，因此在同一 issue 或线程上的后续消息会路由到同一个运行中的 agent。

### 7. 验证：Prompt 驱动 + 安全网

Agent 被指示在提交前运行 linter、formatter 和测试。`open_pr_if_needed` 中间件充当后备——如果 agent 完成时没有创建 PR，中间件会自动处理。

你可以通过添加确定性 CI 检查、视觉验证或审查门控作为额外的中间件来扩展这个验证层。

## 为什么选择 Deep Agents

Deep Agents 提供了使这个架构可组合且易维护的基础。

**上下文管理**：长时间运行的编码任务会产生大量中间数据（文件内容、命令输出、搜索结果）。Deep Agents 通过基于文件的内存来处理，将大型结果卸载而非全部保留在对话历史中。这有助于在处理较大代码库时防止上下文溢出。

**规划原语**：内建的 `write_todos` 工具提供了结构化的方式来分解复杂工作、跟踪进度，并在新信息出现时调整计划。这对于跨越较长时间的多步骤任务特别有帮助。

**子 agent 隔离**：当主 agent 通过 `task` 工具生成子 agent 时，该子 agent 获得自己的隔离上下文。不同子任务不会污染彼此的对话历史，这可以在复杂的多方面工作中带来更清晰的推理。

**中间件钩子**：Deep Agents 的中间件系统允许你在 agent 循环的特定点注入确定性逻辑。Open SWE 就是通过这种方式实现消息注入和自动 PR 创建——这些行为需要可靠地执行。

**升级路径**：由于 Deep Agents 作为独立库在积极开发中，上下文压缩、prompt 缓存、规划效率和子 agent 编排的改进可以直接流向 Open SWE，而无需你重建定制内容。

这种可组合性提供了与 [Ramp 团队在 OpenCode 上构建时所描述的](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal?ref=blog.langchain.com)类似的优势：你可以获得一个持续维护和改进的基础的好处，同时保留对组织特定层的控制。

## 为你的组织定制

Open SWE 旨在作为可定制的基础，而非成品。每个主要组件都是可插拔的：

**Sandbox 提供商**：在 Modal、Daytona、Runloop 或 LangSmith 之间切换。如果你有内部基础设施需求，可以实现自己的 sandbox 后端。

**模型**：使用任何 LLM 提供商。默认是 Claude Opus 4，但你可以为不同的子任务配置不同的模型。

**工具**：为你的内部 API、部署系统、测试框架或监控平台添加工具。移除你不需要的工具。

**触发器**：修改 Slack、Linear 和 GitHub 的集成逻辑。添加新的触发界面，如邮件、webhook 或自定义 UI。

**System prompt**：自定义基础提示词和引入 `AGENTS.md` 文件的逻辑。添加组织特定的指令、约束或约定。

**中间件**：添加你自己的中间件钩子，用于验证、审批门控、日志记录或安全检查。

[定制指南](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md?ref=blog.langchain.com)详细介绍了每个扩展点及其示例。

## 与内部实现的对比

以下是 Open SWE 与 Stripe、Ramp 和 Coinbase 内部系统基于[公开](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents?ref=blog.langchain.com)[可用](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal?ref=blog.langchain.com)[信息](https://www.coinbase.com/blog/building-enterprise-AI-agents-at-Coinbase?ref=blog.langchain.com)的对比：

| 决策 | Open SWE | Stripe (Minions) | Ramp (Inspect) | Coinbase (Cloudbot) |
|------|----------|------------------|----------------|---------------------|
| **Harness** | 组合式（Deep Agents/LangGraph） | Fork 式（Goose） | 组合式（OpenCode） | 从零构建 |
| **Sandbox** | 可插拔（Modal、Daytona、Runloop 等） | AWS EC2 devboxes（预热） | Modal 容器（预热） | 内部方案 |
| **工具** | 约 15 个，精心策划 | 约 500 个，按 agent 策划 | OpenCode SDK + 扩展 | MCPs + 自定义 Skills |
| **上下文** | AGENTS.md + issue/线程 | Rule 文件 + 预注入 | OpenCode 内建 | Linear 优先 + MCPs |
| **编排** | 子 agents + 中间件 | Blueprints（确定性 + agentic） | Sessions + 子 sessions | 三种模式 |
| **调用方式** | Slack、Linear、GitHub | Slack + 嵌入式按钮 | Slack + Web + Chrome 扩展 | Slack 原生 |
| **验证** | Prompt 驱动 + PR 安全网 | 3 层（本地 + CI + 1 次重试） | 视觉 DOM 验证 | Agent 委员会 + 自动合并 |

核心模式是相似的。差异在于实现细节、内部集成和组织特定的工具——这正是你在将框架适配到不同环境时所预期的。

## 开始使用

Open SWE 现已在 [GitHub](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com) 上可用。

[**安装指南**](https://github.com/langchain-ai/open-swe/blob/main/INSTALLATION.md?ref=blog.langchain.com)：详细介绍 GitHub App 创建、LangSmith 设置、Linear/Slack/GitHub 触发器和生产部署。

[**定制指南**](https://github.com/langchain-ai/open-swe/blob/main/CUSTOMIZATION.md?ref=blog.langchain.com)：展示如何为你的组织替换 sandbox、模型、工具、触发器、system prompt 和中间件。

该框架采用 MIT 许可证。你可以 fork 它、定制它，并在内部部署。如果你在此基础上构建了有趣的东西，我们很乐意了解。

---

多个工程组织已成功在生产环境中部署了内部 coding agents。Open SWE 提供了类似架构模式的开源实现，旨在为不同的代码库和工作流进行定制。虽然我们仍在学习哪些方法在不同上下文中有效，但这个框架为正在探索这一方向的团队提供了一个起点。

**试用 Open SWE**：[github.com/langchain-ai/open-swe](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com)

**了解 Deep Agents**：[docs.langchain.com/oss/python/deepagents](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com)

**注册 LangSmith Sandboxes 候补名单**：[langchain.com/langsmith-sandboxes-waitlist](https://www.langchain.com/langsmith-sandboxes-waitlist?ref=blog.langchain.com)

**阅读文档**：[Open SWE Documentation](https://github.com/langchain-ai/open-swe/tree/main/apps/docs?ref=blog.langchain.com)

## 引用

- 原文：[Open SWE: An Open-Source Framework for Internal Coding Agents](https://blog.langchain.com/open-swe-an-open-source-framework-for-internal-coding-agents/) — LangChain Blog，2026 年 3 月 17 日
- [Open SWE GitHub 仓库](https://github.com/langchain-ai/open-swe)
- [Deep Agents](https://github.com/langchain-ai/deepagents)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
