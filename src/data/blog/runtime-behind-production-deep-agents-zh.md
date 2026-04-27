---
title: 生产级深度 Agent 背后的运行时
pubDatetime: 2026-04-27T10:00:00+08:00
description: 在生产环境中部署长时运行的 Agent 需要专门构建的基础设施。本指南涵盖持久化执行、内存、人机协作（HITL）、可观测性，以及 deepagents deploy 如何将这一切交付到生产环境。
slug: runtime-behind-production-deep-agents-zh
originalTitle: The Runtime Behind Production Deep Agents
originalUrl: https://www.langchain.com/blog/runtime-behind-production-deep-agents
---

原文标题：The Runtime Behind Production Deep Agents<br>
原文链接：https://www.langchain.com/blog/runtime-behind-production-deep-agents

![生产级深度 Agent 背后的运行时](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69ea236ce872ec8be413bd2f_runtime-behind-production-deep-agents-thumbnail.png)

**作者：Sydney Runkle、Vivek Trivedy | 2026 年 4 月 20 日**

## 核心要点

- 好的 harness 为你的 Agent 提供正确的提示、工具和技能。但在生产环境中部署长时运行的 Agent 需要持久化执行、内存、多租户、人机协作（HITL）和可观测性。这些基础设施位于 harness 之下，让 Agent 在崩溃、部署和长时运行任务中可靠地运行。
- 持久化执行是其他一切所依赖的基础。运行数分钟或数小时、等待人工审批或在部署中途存活的 Agent 都需要检查点式执行，能够跨进程边界停止、恢复和重试。流式传输、人机协作、定时任务和并发消息处理都构建于其上。
- 生产级 Agent 需要开放且模型无关的基础设施。Deep Agents 采用 MIT 许可证，Agent 通过开放协议（MCP、A2A）暴露接口，内存存储在你自己的 PostgreSQL 中。团队对 Agent 的工作方式保持完全可见，并能在无需重写的情况下进行更改。

在生产环境中部署长时运行的 Agent 需要专门构建的基础设施。本指南涵盖持久化执行、内存、HITL、可观测性，以及 deepagents deploy 如何将这一切交付到生产环境。

要构建一个好的 Agent，你需要一个好的 harness。要部署那个 Agent，你需要一个好的运行时。

Harness 是你围绕模型构建的系统，帮助你的 Agent 在其领域内取得成功。这包括提示、工具、技能，以及定义 Agent 的模型与工具调用循环中的其他一切辅助内容。运行时是其下的一切：持久化执行、内存、多租户、可观测性——让 Agent 在生产中运行而无需你的团队重复造轮子的机制。

本指南介绍了部署 Agent 后出现的生产需求、满足这些需求的运行时能力，以及 `deepagents deploy` 如何将这些能力打包成可交付的成品。

## 生产级 Agent 的运行时能力

在本节中，"运行时"指的是 [LangSmith Deployment（LSD）](https://docs.smith.langchain.com/deployment) 及其 [Agent Server](https://docs.smith.langchain.com/agent-server)：LSD 在生产中运行 Agent，Agent Server 是助手、线程、运行、内存和定时任务的接口。下表将每个生产需求映射到满足它的运行时原语。

| 生产需求 | 运行时能力 |
|---------|-----------|
| 可靠性 | 持久化执行 |
| 内存 | 检查点（短期）、store（长期） |
| 护栏 | 中间件 |
| 多租户 | 认证、授权、Agent Auth、RBAC |
| 人工监督 | 人机协作（interrupt/resume） |
| 实时交互 | 流式传输、并发控制（double-texting） |
| 可观测性 | 追踪、时间旅行 |
| 代码执行 | 沙箱 |
| 集成 | MCP、A2A、webhooks |
| 定时任务 | Cron |

## 持久化执行

Agent 通过运行循环来工作：给定提示，模型进行推理，调用工具，观察结果，然后重复，直到它认为任务完成。

![Agent 模型流程图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28c1155428902746622_69e7b90b41bb837eab283086_diagram4_model_flow_dark%25201.png)

与通常在毫秒内返回的典型 Web 请求不同，这个循环可能跨越数分钟或数小时。单次运行可能发起数十次模型调用、生成子 Agent，或无限期等待人工审批草稿。该循环中任何地方发生的崩溃、部署或瞬时故障，都不应抹去已完成的工作。

在实践中，你在两个地方会感受到这一点：

**长时运行需要在基础设施故障中存活。** 一个花费二十分钟收集来源并综合研究发现的 Agent，如果工作进程崩溃，无法承受从头开始的代价：Agent 已经为 token 和工具调用付出了成本。你想要的是从最后完成的步骤恢复，并保留所有先前的状态。

**Agent 需要能够停下来等待。** 一个等待人工批准交易的 Agent，不知道人工是三十秒后还是三天后响应。在整个等待期间占用工作进程或客户端连接是不可行的。Agent 需要真正停下来：释放资源、释放工作进程，然后在稍后从停止的地方精确恢复。

这两个需求都由同一件事解决：持久化执行。

Agent 在一个托管任务队列上运行，带有自动[检查点](https://langchain-ai.github.io/langgraph/concepts/persistence/)功能，因此任何运行都可以从中断的确切点重试、重放或恢复。

- 图执行的每个[超步](https://langchain-ai.github.io/langgraph/concepts/low_level/#graphs)都将检查点写入持久化层（默认为 PostgreSQL），以 `thread_id` 为键，充当运行的持久游标。
- 当工作进程崩溃时，运行的租约被释放，另一个工作进程从最新检查点接管。
- 当 Agent 等待人工输入时，进程交出其槽位，运行无限期休眠，直到恢复。
- 可配置的[重试策略](https://langchain-ai.github.io/langgraph/how-tos/node-retries/)按节点控制退避、最大尝试次数以及哪些异常触发重试。

![持久化执行崩溃恢复示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28c115542890274661f_69e64614ec8287bee98a7e88_diagram2_durable_execution_crash_recovery_dark%25201.png)

持久性是这份列表中其余一切所依赖的基础。因为执行可以跨进程边界暂停和恢复，Agent 可以无限期等待人工输入、在后台运行、在部署中途存活，并在不破坏状态的情况下处理并发输入。

## 内存

Agent 需要两种不同类型的内存，这种区别很重要。

**短期内存**是 Agent 在单次对话*内*积累的内容。交换的消息、发起的工具调用、跨运行积累的中间状态。这存储在线程的检查点中，以 `thread_id` 为范围，并在对话结束时（概念上）消失。同一线程上的后续消息可以看到该线程上之前发生的所有事情。

**长期内存**是 Agent 在对话*间*携带的内容。这可以包括跨对话学到的用户偏好、项目惯例和最佳实践，或随每次新查询增强的知识库。这些都不属于任何单个线程。它是应在 Agent 进行的每次对话中持久存在的用户级或组织级上下文。仅靠检查点无法做到这一点，因为检查点状态的范围限于单个线程。

![内存架构示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d115542890274664f_69e666ea5bd7ae91146d6ae8_diagram6_memory_dark%25201%2520(1).png)

长期内存正是 Agent Server 内置 [store](https://langchain-ai.github.io/langgraph/concepts/memory/#long-term-memory) 的用途。它是一个键值接口，内存按命名空间元组组织（例如 `(user_id, "memories")`），并跨线程持久化。你的 Agent 在一次对话中写入 store，在下一次对话中读取它。默认由 PostgreSQL 支持，通过嵌入配置支持[语义搜索](https://langchain-ai.github.io/langgraph/how-tos/memory/semantic-search/)，使 Agent 能够按含义而非精确匹配检索内存，并且你可以[换入自定义后端](https://langchain-ai.github.io/langgraph/how-tos/memory/custom-memory-backend/)，如果你需要不同的存储特性。命名空间结构是灵活的：可按用户、助手、组织或任何适合你数据模型的组合来确定范围。

由于数月积累的内存是系统产生的最有价值的数据之一，它存储在哪里很重要。store 可以直接通过 [API](https://docs.smith.langchain.com/agent-server/memory) 查询，如果你自托管，它存储在你自己的 PostgreSQL 实例中。将这些数据保存在你控制的标准格式中，使你能够在 Agent 本身之外迁移模型、分析数据或在其上构建。

## 多租户

当你的 Agent 服务于多个用户时，单用户模式下不存在的一系列问题随之出现。这些问题分解为三个不同的关注点，Agent Server 用各自的原语处理每一个。

**隔离一个用户的数据与另一个用户的数据。** 用户 A 的运行应只触及用户 A 的线程，只读取用户 A 的内存。[自定义认证](https://langchain-ai.github.io/langgraph/concepts/auth/)作为中间件在每个请求上运行：你的 `@auth.authenticate` 处理器验证传入凭证并返回用户的身份和权限，这些信息被附加到运行上下文中。注册了 `@auth.on.threads`、`@auth.on.assistants.create` 等的[授权处理器](https://langchain-ai.github.io/langgraph/concepts/auth/#authorization)，通过在创建时用所有权元数据标记资源，并在读取时返回过滤字典，来强制执行谁可以查看或修改什么。处理器从最具体到最不具体匹配，因此你可以从单个全局处理器开始，随着你的数据模型增长而添加资源特定的处理器。

**让 Agent 代表用户行动。** Agent 通常需要使用用户的凭证调用第三方服务——读取*他们的*日历，发布到*他们的* Slack，在*他们的*仓库中打开 PR。[Agent Auth](https://langchain-ai.github.io/langgraph/concepts/auth/#agent-auth) 处理 OAuth 流程和令牌存储，使 Agent 在运行时获得用户范围的凭证，而无需你自己管理刷新流程。用户认证一次；Agent 在后续运行中可以代表他们行动。

**控制谁可以操作系统本身。** 与最终用户访问分开，还有一个问题：*你的*团队中哪些成员可以部署 Agent、配置它们、查看追踪或更改认证策略。[RBAC](https://docs.smith.langchain.com/deployment/rbac) 处理这种操作者级别的访问控制。

这三层组合在一起：最终用户通过你的认证处理器进行认证，Agent 通过 Agent Auth 调用第三方服务，你的团队在 RBAC 策略下操作部署。

![三层认证架构示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d1155428902746634_69e66702ef0a70fffd7e7128_three_auth_layers_compose_dark%25201%2520(1).png)

## 人机协作（HITL）

Agent 通过运行循环来工作：给定提示，模型推理并决定调用工具，观察结果，然后重复，直到它认为已完成手头的任务。大多数时候你希望该循环不间断运行。这就是价值所在。但有时你需要在关键决策点将人放入循环中。

以下两种常见情况会出现这种需求：

**审查建议的工具调用。** 在 Agent 执行重要行动（发送电子邮件、执行金融交易、删除文件）之前，你希望人工查看它准备做什么并决定如何响应。以电子邮件为例：Agent 起草消息并在发送前暂停。你可以原样批准它，在发出前编辑主题或正文，或者以理由拒绝并提出具体的编辑请求，以便 Agent 修改后再试。

**Agent 提出澄清问题。** 有时 Agent 到达一个无法独立解决的决策点，不是因为缺少工具，而是因为正确答案取决于人的判断或偏好。Agent 可以直接提出问题，而不是猜测："我发现三个符合该模式的配置文件。我应该修改哪个？"或"这应该部署到暂存环境还是生产环境？"你的回答成为 interrupt 的返回值，Agent 从精确停止的地方继续。

Agent Server 用两个原语处理这个问题：`interrupt()` 暂停执行并将 payload 呈现给调用者；`Command(resume=...)` 用人工的响应继续执行。它们共同让你构建审批门、草稿审查循环、输入验证，以及任何需要人工在执行中途参与的工作流。

![中断检查点示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d1155428902746637_69e646bcd3a160827f8db9d9_diagram5_interrupt_checkpoint_dark%25201.png)

在底层，`interrupt()` 触发运行时的检查点器，将完整的图状态写入持久存储，以 `thread_id` 为键充当持久游标。进程随后释放资源并无限期等待。与在特定节点之前或之后暂停的静态断点不同，`interrupt()` 是动态的：可以放在代码中的任何地方，用条件语句包装，或嵌入工具函数内，使审批逻辑随工具一起移动。当 `Command(resume=...)` 到来——几分钟、几小时或几天后——恢复值成为 `interrupt()` 调用的返回值，执行从停止的地方精确继续。由于 `resume` 接受任何 JSON 可序列化的值，响应不限于批准/拒绝：审阅者可以返回编辑后的草稿，人工可以提供缺失的上下文，下游系统可以注入计算结果。当并行分支各自调用 `interrupt()` 时，所有待处理的 interrupt 会一起呈现，可以在单次调用中全部恢复，也可以随着响应到来逐一恢复。

## 实时交互

人机协作是一种执行模式，可以暂停执行让人工审查或提供输入——有时是立即，有时是很久之后。另外，当 Agent 在用户在场时积极工作时，会出现"实时会话"问题：使进度可见（流式传输）和协调并发消息（double-texting）。

### 流式传输

一个需要三十秒才能产生响应的 Agent，让用户盯着一个加载动画，不知道它是否在取得进展、卡住了还是即将失败。他们也无法在完成前开始阅读答案。流式传输解决了这两个问题：随着 Agent 生成输出，部分输出流向客户端，用户可以看到响应实时显现。

[流式传输 API](https://docs.smith.langchain.com/agent-server/streaming) 支持几种模式，取决于你想要的粒度：每个图步骤后的完整状态快照、仅状态更新、逐 token 的 LLM 输出，或自定义应用事件。你也可以组合使用它们。运行流式传输（`client.runs.stream()`）的范围限于单次运行；[线程流式传输](https://docs.smith.langchain.com/agent-server/streaming#thread-streaming)（`client.threads.joinStream()`）打开一个长时连接，传递线程上每次运行的事件，当后续消息、后台运行或 HITL 恢复都在同一线程上触发活动时很有用。

线程流式传输通过 `Last-Event-ID` [header](https://docs.smith.langchain.com/agent-server/streaming#resumption) 支持恢复：客户端重新连接时带上它收到的最后一个事件的 ID，服务器从那里重放，没有间隙。没有这个机制，每次连接中断都意味着客户端要么错过输出，要么必须从头开始。

### Double-texting

第二个实时问题：用户在 Agent 仍在处理上一条消息时发送了新消息。这在聊天界面中时常发生。有人打了一个问题，意识到自己想说的略有不同，在第一次运行结束前又发了一条更正。我们称之为 [double-texting](https://langchain-ai.github.io/langgraph/concepts/double_texting/)，运行时必须确定如何处理它。

有四种策略，正确的选择取决于你的应用：

- `enqueue`（默认）：新输入等待当前运行完成，然后顺序处理。
- `reject`：在当前运行完成之前拒绝任何新输入。
- `interrupt`：停止当前运行，保留进度，并从该状态处理新输入。适合第二条消息在第一条消息基础上构建的情况。
- `rollback`：停止当前运行，回滚所有进度（包括原始输入），并将新消息作为新鲜运行处理。适合第二条消息替换第一条消息的情况。

![并发运行控制示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d115542890274662e_69e667170c7e9442d95e42cb_diagram3_concurrent_runs_dark%25201%2520(1).png)

`interrupt` 提供最流畅的聊天体验，但要求你的图能干净地处理部分工具调用（在 interrupt 发生时已发起但未完成的工具调用在恢复时可能需要清理）。`enqueue` 是最安全的默认选项——没有状态损坏，代价是让用户等待。

## 护栏

并非每个生产关注点都能表达为"持久地运行循环"。有些必须影响循环本身：拦截模型输入、过滤工具输出、对昂贵操作强制限制。这些策略属于代码，而非提示。它们需要每次运行，而不是只在模型碰巧记得时运行。

两个具体案例：

**在模型看到之前对敏感数据进行脱敏。** 一个处理用户消息（包含 PII：姓名、电子邮件、账户号码）的客户支持 Agent。你不希望模型看到这些数据，不希望它们出现在追踪中，且合规性可能要求在记录前脱敏。这必须在每次模型调用之前确定性地发生。

**限制昂贵操作。** 能够调用付费外部 API 的 Agent 需要对每次运行的调用次数设置硬上限，因为困惑的模型否则会愉快地在午饭前调用五十次，耗尽你的预算。

这两者都由[中间件](https://docs.smith.langchain.com/agent-server/middleware)处理，它在定义的钩子处包装 Agent 循环——`before_model`、`wrap_model_call`、`wrap_tool_call`、`after_model`——使策略在每个相关步骤周围确定性地执行。

![Agent 生命周期示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d1155428902746631_69e7b91f98343dd874c7d08d_diagram2_agent_lifecycle_dark%25201.png)

LangChain 提供[内置中间件](https://docs.smith.langchain.com/agent-server/middleware#built-in-middleware)覆盖常见场景：`PIIRedactionMiddleware`、`ModelRetryMiddleware`、`ModelFallbackMiddleware`、`ToolCallLimitMiddleware`、`SummarizationMiddleware`、`HumanInTheLoopMiddleware`、`OpenAIModerationMiddleware`，以及[自定义中间件](https://docs.smith.langchain.com/agent-server/middleware#custom-middleware)用于应用特定策略。

中间件是开源的，但只有当它运行在 Agent 运行时*内部*时才真正发挥价值。当它这样运行时，这些相同的策略成为运行时支持的每种交互模式的一部分——流式传输、人机协作暂停/恢复、重试、后台运行和长时线程。在实践中，这意味着你的护栏和监控不是"尽力而为"的：它们在你期望的精确位置，一致地包装每次模型调用和每次工具调用，无论 Agent 在做什么。

## 可观测性

在生产中运行 Agent 之前，你不知道它会做什么。

与可以从代码推断行为的传统应用不同，Agent 的执行路径取决于模型在运行时的选择：调用哪些工具、传递什么参数、如何解读结果，以及何时放弃并尝试其他方法。出现问题时，你不能只是重读函数。你需要看到实际发生了什么。

一张支持工单说"Agent 一直在重复同一个问题"。没有追踪，你只能从用户的描述中猜测。有了追踪，你看到完整的执行树：用户的消息、模型计划的响应、它调用的工具、返回的结果、它生成的下一条消息、它陷入的循环。你可以按成本过滤找到消耗大量 token 的运行，按错误过滤找到失败的运行，按用户过滤查看特定客户的体验。你可以在数千次运行中发现没有单个追踪能揭示的模式。

每个 LangSmith Deployment 都[自动连接到追踪项目](https://docs.smith.langchain.com/deployment/observability)。你可以开箱即用地获得完整的执行树——模型调用、工具调用、子 Agent 运行、中间件钩子——以及可按用户、时间窗口、成本、延迟、错误状态、反馈或自定义标签查询的结构化元数据。

追踪是改进循环的基础：

![Agent 改进循环示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d115542890274664b_69cb9f8943788df6ce222c32_agent-improvement-loop.png)

[Polly](https://docs.smith.langchain.com/langsmith/polly)——LangSmith AI 助手——分析追踪并呈现洞察——常见失败模式、慢速工具调用、重复模式——这样你就不必手动阅读数千条追踪。

[在线评测](https://docs.smith.langchain.com/evaluation/online)自动对生产追踪运行 LLM-as-judge 或自定义评分器，使回归在发生时即被捕获。我们使用这个循环通过仅更改 harness，在 Terminal Bench 2.0 上[将 Deep Agents 提升了 13.7 分](https://langchain-ai.github.io/deep-agents/)——完整论述[从追踪开始的 Agent 改进循环](https://blog.langchain.com/agent-improvement-loop/)值得完整阅读。

### 时间旅行

可观测性告诉你发生了什么。时间旅行让你问*如果某事有所不同会发生什么*。

驱动场景是调试一个出了问题的运行。你的 Agent 在 20 步运行的第 5 步做了一个糟糕的决定：调用了错误的工具、误读了工具结果，或者在应该继续的时候提出了澄清问题。你想理解原因，并希望在不从头重新运行的情况下尝试替代方案。更一般地，每当 Agent 的路径取决于特定检查点的状态时，你都希望能够回退到该检查点、更改状态，并让运行的其余部分以不同的方式展开。

由于每个超步都写入一个[检查点](https://langchain-ai.github.io/langgraph/concepts/persistence/)，运行历史中的每个点已经是一个你可以返回的快照。[时间旅行](https://langchain-ai.github.io/langgraph/concepts/time-travel/)使这一点变得明确：从线程历史中选择一个检查点，可选地修改其状态，然后从那里恢复。修改后的检查点分叉线程的历史。原始历史保持不变，新路径作为自己的分支向前运行。LLM 调用、工具调用和 interrupt 都在重放时重新触发，因此分叉行使的是真实的 Agent 循环，而非其存根。

![分叉检查点示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28c1155428902746628_69e667324d2195f754cab3dd_forking_checkpoint_dark%25201%2520(1).png)

这解锁了其他方式难以构建的模式：调试 Agent 为何选择工具 A 而应选择工具 B、将两个提示与相同的上游上下文进行比较、通过回退到最后一个好的状态从出轨的运行中恢复，或者跨多个分叉探索反事实以理解模型行为。LangSmith [Studio UI](https://docs.smith.langchain.com/langsmith/studio) 为你提供了所有这些功能的可视化界面；[API](https://docs.smith.langchain.com/agent-server/time-travel) 是大多数生产调试工作流最终使用的。

## 代码执行

只能调用你预先接线的工具的 Agent 受限于你预期的范围。能够运行任意代码的 Agent 是通用的：它可以安装依赖、克隆仓库、执行测试、运行数据分析、生成文档和渲染图表。这就是"带函数调用的聊天机器人"与"真正能做事情的 Agent"之间的差距。

任意代码执行需要隔离。如果 Agent 在你的主机上运行 `rm -rf /`，你就有麻烦了。如果它读取你的环境变量，就会泄露你的 API 密钥。在 Agent 写下第一个命令之前，你需要在 Agent 的执行环境和你关心的一切之间建立一个边界。

在 Deep Agents 中，隔离通过[沙箱后端](https://langchain-ai.github.io/deep-agents/deployment/sandboxes/)实现。当你配置实现了 `SandboxBackendProtocol` 的后端时，Agent 会自动获得一个在沙箱中运行 shell 命令的 `execute` 工具，以及标准的文件系统工具。没有沙箱后端，`execute` 工具甚至对 Agent 不可见。

[支持的提供商](https://langchain-ai.github.io/deep-agents/deployment/sandboxes/)包括 Daytona、Modal、Runloop 和 [LangSmith Sandboxes](https://docs.smith.langchain.com/deployment/sandboxes)，只需一个配置更改即可在它们之间切换。

[LangSmith Sandboxes](https://docs.smith.langchain.com/deployment/sandboxes)（目前处于私有预览）值得特别提及，因为它们是为与运行时的其他部分集成而构建的。[模板](https://docs.smith.langchain.com/deployment/sandboxes#templates)以声明方式定义容器镜像、资源限制和卷。[热池](https://docs.smith.langchain.com/deployment/sandboxes#warm-pools)预先配置沙箱并自动补充，消除交互式 Agent 的冷启动延迟。而[认证代理](https://docs.smith.langchain.com/deployment/sandboxes#auth-proxy)解决了每个团队最终都会遇到的问题：Agent 需要调用已认证的 API，但将凭证放在沙箱内是安全风险。代理作为 sidecar 运行，拦截出站请求，并自动从工作区密钥注入凭证——沙箱代码调用 `api.openai.com` 时不带任何 header，代理在发出时添加正确的 `Authorization` header。密钥从不进入沙箱，Agent 无法泄露它看不到的东西。

![认证代理架构示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28c1155428902746625_69e66748e7834a7b7538b6c2_auth_proxy_dark%25201%2520(1).png)

有一条值得重申的安全建议：**沙箱保护你的主机，而不是沙箱本身**。控制 Agent 输入的攻击者（通过被抓取网页中的提示注入、恶意电子邮件、被污染的工具结果）可以指示 Agent 在沙箱内运行命令。沙箱让攻击者远离你的机器，但沙箱*内部*的任何东西——包括直接放在那里的凭证——都会受到危害。认证代理模式就是为此而存在的。

## 集成

Agent 最有用的时候是当它们接入人们和组织已经使用的系统。编程 Agent 在能够访问 GitHub、Linear 和你的 CI 系统时变得更强大。研究 Agent 在其输出能够输入你的发布流水线时变得更有用。内部 Agent 在其他 Agent 可以将其作为构建块调用时成为一个平台。如果这些集成中的每一个都是手工制作的适配器，你的 Agent 就会保持孤立。"Agent"与"其他一切"之间的边界变成了一堵墙。

开放协议通过让 Agent 和外部系统发现彼此并相互通信来解决这个问题，而双方都不需要知道对方的实现。Agent Server 自动配置三个集成接口。

### MCP

[MCP（模型上下文协议）](https://modelcontextprotocol.io/)是连接 Agent 与工具和数据源的开放标准。每个 LangSmith Deployment 都[自动暴露 MCP 端点](https://docs.smith.langchain.com/deployment/mcp)，使你的 Agent 可以被任何 MCP 兼容客户端发现——Claude Desktop、IDE、其他 Agent、自定义应用——而无需编写适配器代码。另一方面，你的 Agent 可以调用任何 MCP 服务器（Linear、GitHub、Notion 等数百个）来访问你的用户已有的工具和数据。

### A2A

[A2A（Agent-to-Agent）](https://google.github.io/a2a-protocol/)是 Agent 间通信的类似标准，每个部署也[自动暴露 A2A 端点](https://docs.smith.langchain.com/deployment/a2a)。这使得跨部署的多 Agent 架构变得可行：一个部署中的协调 Agent 可以使用双方都理解的协议发现和调用另一个部署中的工作 Agent，无需手工制作的 HTTP 合约。

### Webhooks

[Webhooks](https://docs.smith.langchain.com/deployment/webhooks) 处理出站情况：你的 Agent 完成一次运行，你希望在不轮询的情况下触发下游操作。在创建运行时传入一个 `webhook` URL，服务器在完成时将运行 payload POST 到该 URL。这就是你将 Agent 运行链入现有工作流的方式——研究运行完成并触发发布流水线，每日摘要完成并通知 Slack，合规性检查完成并写入审计日志。Header、域允许列表和 HTTPS 强制执行均可针对生产环境配置。

## Cron

我们目前讨论的 Agent 都是响应式的：用户发送消息，Agent 做出响应。但许多有价值的 Agent 工作是主动的——它在计划上发生，没有人类触发它。

特别是两种模式：

**睡眠时计算。** 在空闲期间做有用工作的 Agent，使用户受益于积累的思考，而非按需等待延迟。每晚运行以跟上你领域新论文的研究 Agent。在你开始工作日之前审查明天日历并起草简报的准备 Agent。对隔夜支持工单进行分类以便你的团队能走进一个优先级队列的分类 Agent。工作在没有人等待时发生，输出在用户到来时已准备好。

**健康和监控循环。** 定期检查某事并在发现问题时采取行动（或上报）的 Agent。每十五分钟审查警报的值班 Agent，监控你的暂存环境是否有回归的 Agent，按节奏扫描策略违规的合规 Agent。这些需要与面向用户的运行相同的持久性、追踪和认证，但没有用户在等待它们。

Agent Server 内置了 [cron 任务](https://docs.smith.langchain.com/agent-server/cron)，因此计划运行与任何其他运行具有相同的持久性、追踪和认证保证——不需要维护单独的调度器，不需要接线第二套可观测性。你传入一个标准的 cron 表达式（UTC）和一个输入，服务器按计划触发运行。

两种风格适合不同的模式：

**有状态 cron**（`client.crons.create_for_thread`）将计划绑定到特定的 `thread_id`，因此每次触发的运行都附加到同一对话。这适合应该看到自己历史的 Agent——每天构建在昨日发现基础上的研究 Agent，或记住它已标记内容的监控 Agent。

**无状态 cron**（`client.crons.create`）为每次执行创建一个新线程，适合不需要运行间连续性的批处理式工作。通过 `on_run_completed` 控制线程清理：`"delete"`（默认）在运行完成时删除线程，`"keep"` 通过 `client.runs.search(metadata={"cron_id": cron_id})` 保留它以供后续检索。

![Cron 运行模式示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d115542890274663d_69e6675b2baf59460fdc3de5_cron_run_patterns%2520(2).png)

每个 cron 运行都显示在追踪中，遵守认证处理器和中间件，并支持失败时恢复——凌晨 3 点遇到瞬时模型中断的 cron 不会静默失败，它会像任何其他运行一样重试。一个操作注意事项：完成后删除 cron。它们会一直运行（并计费）直到你这样做。

我们看到企业团队有不同的部署需求，因此运行时支持[云端](https://docs.smith.langchain.com/deployment/cloud)、[混合](https://docs.smith.langchain.com/deployment/hybrid)和[自托管](https://docs.smith.langchain.com/deployment/self-hosted)部署。无论在哪里运行，能力都是相同的。

## deepagents deploy

`deepagents deploy` 是将你的 Agent 部署在上述运行时上的打包步骤。你在 `deepagents.toml` 中定义你的 Agent，CLI 打包你的配置并将其作为带有所有上述功能的 LangSmith Deployment 进行部署。

![Agent 配置结构示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d1155428902746640_69e649c5799c3f98049f6614_diagram12_agent_configuration_structure%25201%25201.png)

- **内存**使用带有[可插拔后端的虚拟文件系统](https://langchain-ai.github.io/deep-agents/memory/)，为 Agent 提供临时暂存空间和跨对话的持久存储。Deep Agents 支持以用户或助手（或两者）为范围的内存！
- **沙箱提供商**（LangSmith Sandboxes、Daytona、Modal、Runloop 或自定义）是单个配置值。当有沙箱存在时，harness 自动添加 `execute` 工具。
- **沙箱生命周期**（线程范围 vs 助手范围）通过图工厂处理。沙箱内的凭证通过[沙箱认证代理](https://langchain-ai.github.io/deep-agents/deployment/sandboxes/#auth-proxy)管理，使 API 密钥永远不会出现在沙箱代码或日志中。
- **技能和指令**从你的 `skills/` 目录和 `AGENTS.md` 自动检测。MCP 服务器从 `mcp.json` 中获取。`name` 字段是唯一必需的配置值；其他一切都有合理的默认值。

结果是一个可以随时间演进的部署，能够添加新技能、工具和内存策略，而无需完全重写。关于完整的生产注意事项（凭证管理、异步模式、前端集成等），请参阅[生产指南](https://langchain-ai.github.io/deep-agents/deployment/production/)。

## 开放 Harness

Agent 基础设施有一个日益增长的趋势：迁移到托管解决方案意味着构建者选择减少——锁定到单一模型提供商、封闭的 harness，或隐藏在 API 后面的 harness 功能（如生成加密摘要的服务器端压缩，你无法在一个生态系统外使用）。实际后果是团队失去了对 Agent 实际工作方式的可见性，以及在出问题时进行更改的能力。

关于供应商锁定的说明：`deepagents deploy` 旨在避免这一点。Harness 是[MIT 许可且完全开源的](https://github.com/langchain-ai/deep-agents)，Agent 指令使用 [AGENTS.md](https://github.com/google/AGENTS.md)（开放标准），Agent 通过开放协议暴露——MCP、A2A、Agent Protocol。没有模型或沙箱锁定，harness 中没有任何黑盒。默认 harness 提供以下能力：

![深度 Agent 能力架构示意图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e9d28d115542890274663a_69e649f5cff8b7e0e23996d5_diagram13.png)

此外，Deep Agents 允许你通过 LangChain 的[中间件](https://docs.smith.langchain.com/agent-server/middleware)检查、自定义和扩展 Agent 行为的每一层，包括速率限制、重试逻辑、模型回退、PII 检测和文件权限。

## 将你的 Agent 带入生产

本指南概述的能力——持久化执行、内存、多租户、护栏、人机协作、可观测性、沙箱代码执行、计划运行等——是生产 Agent 无法缺少的基础设施需求。

`deepagents deploy` 将这一切打包好，使团队无需从头拼凑，并在整个过程中保持技术栈开放、可配置且归你所有。

构建 Agent 是一个深度迭代的循环：追踪揭示生产中实际发生的事情，在线评测在回归复杂化之前捕获它们，内存意味着 Agent 随时间变得更有用。基础设施不仅支持实时 Agent，它是使 Agent 变得更好的基础。

如果你想尝试，[快速入门指南](https://langchain-ai.github.io/deep-agents/quickstart/)将帮助你快速上手。

## 引用

- 原文：[The Runtime Behind Production Deep Agents](https://www.langchain.com/blog/runtime-behind-production-deep-agents)
- [LangSmith Deployment 文档](https://docs.smith.langchain.com/deployment)
- [Deep Agents GitHub](https://github.com/langchain-ai/deep-agents)
- [LangGraph 持久化概念](https://langchain-ai.github.io/langgraph/concepts/persistence/)
