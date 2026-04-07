---
title: 解析 Agent Harness：核心结构与设计
pubDatetime: 2026-03-14T10:00:00+08:00
description: LangChain 博客文章《The Anatomy of an Agent Harness》的中文翻译（含原文引用）。
slug: the-anatomy-of-an-agent-harness
originalTitle: "The Anatomy of an Agent Harness"
originalUrl: https://blog.langchain.com/the-anatomy-of-an-agent-harness/
---

原文标题：The Anatomy of an Agent Harness  <br>
原文链接：https://blog.langchain.com/the-anatomy-of-an-agent-harness/

![](https://blog.langchain.com/content/images/2026/03/LangSmith-for-Startups--4-.png)

作者：Vivek Trivedy

TLDR：Agent = Model + Harness。Harness engineering 是我们围绕模型构建系统、把模型变成“工作引擎”的方式。模型提供智能，harness 让这种智能变得有用。我们定义了 harness 是什么，并推导出现今与未来智能体所需的核心组件。

## 谁能定义一下 “Harness”？

Agent = Model + Harness

如果你不是模型，那你就是 harness。

Harness 是除了模型本身之外的每一段代码、配置和执行逻辑。一个裸模型不是智能体；但当 harness 为它提供状态、工具执行、反馈循环和可强制执行的约束时，它就成为智能体。

具体来说，harness 包括这些内容：

- System Prompts
- Tools、Skills、MCPs 及其描述
- 打包好的基础设施（filesystem、sandbox、browser）
- 编排逻辑（subagent 生成、handoff、model routing）
- 用于确定性执行的 hooks/middleware（compaction、continuation、lint checks）

在一个智能体系统里，模型和 harness 之间边界可以有很多种“混乱”的划分方式。但在我看来，这是最清晰的定义，因为它迫使我们去思考：如何围绕模型智能去设计系统。

本文剩余部分会从模型这个核心原语出发，逆向推导 harness 的核心组件，以及为什么每一部分都存在。

## 从模型视角看：我们为什么需要 Harness

有些事情我们希望智能体完成，但模型开箱即用做不到。这正是 harness 的作用。

模型（大多数情况下）接收文本、图像、音频、视频等数据，然后输出文本。就这些。开箱即用时，它们无法：

- 在交互间维持持久状态
- 执行代码
- 访问实时知识
- 搭建环境并安装依赖以完成工作

这些都属于 harness 层能力。LLM 的结构决定了：要做有用工作，就需要某种将其包裹起来的机制。

例如，要做出“聊天”这样的产品体验，我们会把模型包进一个 while 循环中，跟踪历史消息并追加新的用户消息。读到这里的每个人都已经使用过这种 harness。

核心思想是：把我们期望的智能体行为，转化为 harness 里的实际能力。

## 从期望行为逆推到 Harness Engineering

Harness Engineering 帮助人类注入有用先验，引导智能体行为。随着模型能力提升，harness 也被用于“外科手术式”扩展和校正模型，以完成此前不可能完成的任务。

我们不会穷举每一种 harness 功能。目标是从“帮助模型做有用工作”这个起点，推导出一组功能。

我们会遵循这样的模式：

我们想要（或想修正）的行为 → 帮助模型实现该行为的 Harness 设计。

## 用 Filesystem 实现持久存储与上下文管理

我们希望智能体拥有持久存储，以便对接真实数据、卸载装不进上下文的信息，并在会话间持续保存工作。

模型只能直接操作其上下文窗口里的知识。在 filesystem 出现之前，用户必须把内容直接复制粘贴给模型，这种体验笨拙，也不适用于自治智能体。现实世界早就在用 filesystem 工作，模型也在海量 token 上学到了如何使用它们。于是自然的方案是：

Harness 提供 filesystem 抽象和 fs-ops 工具。

Filesystem 可能是最基础的 harness 原语，因为它解锁了很多能力：

- 智能体有了可读写数据、代码和文档的工作区；
- 工作可以渐进式添加和卸载，而不是把一切都塞进上下文；智能体可存储中间结果，并维持超越单次会话的状态；
- filesystem 是天然协作界面。多个智能体与人类可通过共享文件协同，Agent Teams 这类架构依赖这一点。

Git 为 filesystem 增加版本管理，使智能体能够追踪工作、回滚错误、分支实验。下面我们会再次回到 filesystem，因为它也是其他能力的关键原语。

## Bash + 代码：通用工具

我们希望智能体能自治解决问题，而不需要人类预先设计每一个工具。

如今主流智能体执行模式是 [ReAct loop](https://docs.langchain.com/oss/python/langchain/agents?ref=blog.langchain.com)：模型推理、通过工具调用采取行动、观察结果、再在 while 循环里重复。但 harness 只能执行它已经具备执行逻辑的工具。与其要求用户为每个可能动作都造工具，不如给智能体一个通用工具，比如 bash。

Harness 提供 bash 工具，让模型通过编写并执行代码来自治解决问题。

Bash + 代码执行，是把“给模型一台电脑”并让它自治解决问题向前推进的一大步。模型可以通过代码即时设计自己的工具，而不是被限制在一组预配置工具里。

Harness 仍会提供其他工具，但代码执行已经成为自治问题求解的默认通用策略。

## Sandboxes 与工具：执行并验证工作

智能体需要一个默认配置合理的环境，才能安全行动、观察结果并持续推进。

我们已经给了模型存储与代码执行能力，但这些都必须在某处运行。在本地执行智能体生成代码有风险，单一本地环境也无法支撑大规模智能体负载。

Sandbox 为智能体提供安全运行环境。harness 可以连接 sandbox 来执行代码、检查文件、安装依赖、完成任务，而不是在本地直接执行。这实现了安全、隔离的代码执行。进一步提升安全性时，harness 可以做命令 allow-list 并强制网络隔离。

Sandbox 也带来扩展性：环境可按需创建、并行分发到大量任务，并在工作完成后销毁。

好的环境也应有好的默认工具链。配置这些工具是 harness 的职责，以便智能体能完成有价值工作。这包括预装语言运行时与包、git/testing CLI、以及用于 Web 交互和验证的 [browser](https://github.com/vercel-labs/agent-browser?ref=blog.langchain.com)。

browser、logs、screenshots、test runners 等工具，让智能体能够观察与分析自己的工作。这有助于它们形成自验证循环：写代码、跑测试、看日志、修错误。

模型开箱即用时不会配置自己的执行环境。智能体在哪运行、可用哪些工具、可访问什么、如何验证结果，都是 harness 层设计决策。

## Memory 与 Search：持续学习

智能体应记住见过的信息，并访问训练时不存在的信息。

模型除参数权重与当前上下文外没有额外知识。在不能编辑模型权重的前提下，唯一“增加知识”的方式是上下文注入。

对 memory 来说，filesystem 再次是核心原语。harness 支持诸如 [AGENTS.md](http://agents.md/?ref=blog.langchain.com) 的 memory 文件标准，并在智能体启动时注入上下文。随着智能体新增和编辑该文件，harness 会把更新内容载入上下文。这是一种 [continual learning](https://www.ibm.com/think/topics/continual-learning?ref=blog.langchain.com)：智能体跨会话持久存储知识，并在后续会话注入这些知识。

知识截止意味着模型无法直接访问新数据（例如库的新版本），除非用户显式提供。要获得最新知识，Web Search 与像 [Context7](https://context7.com/?ref=blog.langchain.com) 这样的 MCP 工具可以帮助智能体访问知识截止之后的信息，比如新版本库或训练结束后才出现的实时数据。

Web Search 及查询最新上下文的工具，是适合内建进 harness 的有用原语。

## 对抗 Context Rot

智能体性能不应随着工作推进而下降。

[Context Rot](https://research.trychroma.com/context-rot?ref=blog.langchain.com) 描述的是：随着上下文窗口被填满，模型推理和完成任务的能力会变差。上下文是稀缺而宝贵的资源，因此 harness 需要管理策略。

今天的 harness 在很大程度上是“优质上下文工程”的交付机制。

Compaction 解决的是：上下文窗口快满时怎么办？如果不 compaction，当会话超出窗口怎么办？一种可能是 API 报错——这显然不好。harness 必须为此制定策略。于是 compaction 会智能卸载并摘要既有上下文，让智能体继续工作。

Tool call offloading 用于降低大型工具输出对上下文的冲击。这些输出可能制造噪声、占据窗口，却不提供有用信息。harness 会在输出超过阈值时仅保留头尾 token，把完整输出卸载到 filesystem，以便模型在需要时读取。

Skills 解决的是：启动时加载过多工具或 MCP server 到上下文，导致还没开始工作性能就下降。Skills 是 harness 层原语，通过渐进式披露来处理这个问题。模型并没有主动要求在启动时加载 Skill front-matter，但 harness 可以这样做，以保护模型免受 context rot 影响。

## 长时程自治执行

我们希望智能体在长时间范围内自治、正确地完成复杂工作。

自治式软件创建是编码智能体的“圣杯”。但今天的模型仍会早停、难以分解复杂问题，且当工作跨越多个上下文窗口时容易失去连贯性。优秀 harness 必须围绕这些问题进行设计。

此处，前面介绍的 harness 原语开始叠加。长时程工作需要持久状态、规划、观测和验证，才能跨多个上下文窗口继续推进。

使用 filesystem 和 git 跨会话追踪工作。智能体在长任务中会生成数百万 token，filesystem 可以持久捕获工作并追踪长期进度。加入 git 后，新智能体可以快速了解最新工作与项目历史。对于多智能体协作，filesystem 还是共享工作账本。

使用 Ralph Loops 持续推进工作。[Ralph Loop](https://ghuntley.com/loop/?ref=blog.langchain.com) 是一种 harness 模式：通过 hook 拦截模型的退出尝试，并在干净上下文窗口里重新注入原始提示，迫使智能体围绕完成目标继续工作。filesystem 让这成为可能，因为每轮迭代都能在新上下文中读取上一轮状态。

规划与自验证用于保持方向。规划是模型把目标拆解成步骤序列。harness 通过更好的提示，以及注入“如何使用 filesystem 中 plan 文件”的提醒来支持规划。每完成一步后，智能体可通过自验证检查正确性。harness 中的 hooks 可运行预定义测试套件，并在失败时把错误消息回传给模型形成循环；也可以提示模型独立自评代码。验证将解法锚定在测试上，并提供自改进反馈信号。

![](https://blog.langchain.com/content/images/2026/03/image.png)

## Harness 的未来

## 模型训练与 Harness 设计的耦合

今天的智能体产品，如 Claude Code 与 Codex，都是在模型和 harness 联动中后训练出来的。这帮助模型提升在 harness 设计者认为其应原生擅长的行为上表现，例如 filesystem 操作、bash 执行、规划、或通过 subagents 并行化工作。

这会形成一个反馈循环：有用原语被发现、加入 harness，再用于训练下一代模型。随着循环重复，模型在其训练所处 harness 中会变得更强。

但这种共同进化对泛化有有趣副作用。一个体现是：改变工具逻辑会导致模型性能变差。一个很好的例子是 [Codex-5.3 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide/?ref=blog.langchain.com#apply_patch) 中提到的 apply_patch 文件编辑逻辑。真正智能的模型本应能轻松在不同 patch 方法间切换，但联动训练会造成这种过拟合。

这并不意味着：最适合你任务的 harness 一定是模型后训练时使用的那个。[Terminal Bench 2.0 Leaderboard](https://www.tbench.ai/leaderboard/terminal-bench/2.0?ref=blog.langchain.com) 就是例子。Claude Code 中的 Opus 4.6 分数，明显低于它在其他 harness 里的分数。在 [之前一篇博客](https://x.com/Vtrivedy10/status/2023805578561060992?s=20&ref=blog.langchain.com) 中，我们展示了：只改 harness，就把我们的 coding agent 从 Terminal Bench 2.0 Top 30 提升到 Top 5。针对任务优化 harness 仍有巨大空间。

![](https://blog.langchain.com/content/images/2026/03/image-1.png)

## Harness Engineering 正在走向何方

随着模型越来越强，今天 harness 承担的一部分能力会被模型吸收。模型会原生地更擅长规划、自验证、长时程连贯性，例如需要更少上下文注入。

这似乎意味着 harness 随时间会变得不那么重要。但正如 prompt engineering 到今天仍有价值，harness engineering 很可能也会继续对构建优秀智能体有用。

确实，今天的 harness 在弥补模型短板；但它们也在围绕模型智能做系统工程，使模型更高效。配置良好的环境、合适工具、持久状态与验证循环，不论模型基础智能如何，都会提升效率。

Harness engineering 是一个非常活跃的研究方向，我们也用它来改进 LangChain 的 harness 构建库 [deepagents](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com)。下面是我们目前在探索的一些开放且有趣的问题：

- 在共享代码库上并行编排数百个智能体协作
- 能分析自身 trace 并识别、修复 harness 层失效模式的智能体
- 能针对给定任务按需动态组装工具与上下文，而非预配置的 harness

这篇博客是一次关于 harness 定义及其如何被“我们希望模型完成的工作”所塑造的练习。

模型承载智能，harness 是让这种智能变得有用的系统。

为更多 harness 构建、更好的系统、以及更好的智能体。

![](https://blog.langchain.com/content/images/2026/03/image-2.png)

## 引用

- 原文：The Anatomy of an Agent Harness  
  https://blog.langchain.com/the-anatomy-of-an-agent-harness/
- Deep Agents 文档：  
  https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com
