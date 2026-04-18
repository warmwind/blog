---
title: Agentic Engineering：AI Agent群体如何重新定义软件工程
pubDatetime: 2026-04-18T11:00:00+08:00
description: 本文介绍思科工程师构建的多Agent协同系统如何通过LangChain框架镜像真实工程团队，在调试、开发等工作流中实现显著的效率提升。
slug: agentic-engineering-redefining-software-engineering-zh
originalTitle: "Agentic Engineering: How Swarms of AI Agents Are Redefining Software Engineering"
originalUrl: https://www.langchain.com/blog/agentic-engineering-redefining-software-engineering
---

原文标题：Agentic Engineering: How Swarms of AI Agents Are Redefining Software Engineering<br>
原文链接：https://www.langchain.com/blog/agentic-engineering-redefining-software-engineering

![封面图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e23754937c2f749d12bb0b_76%20(1).png)

**核心要点**

- **什么是agentic engineering？** Agentic engineering是一种多Agent协同模型，其中AI Agent作为数字团队成员运作——每个Agent拥有明确的职责、共享内存和统一的可观测层——推动软件在完整交付管线中流转，而不仅仅是更快地生成代码。
- **多Agent系统在软件交付中能产生怎样的成效？** 在超过20个调试工作流的试点中，协同Agent执行使得定位根本原因的时间减少了93%（相较于历史基准），在一个月内的512次会话中累计节省了超过200个工程人时。开发工作流的执行时间减少了65%，最大的收益来自于压缩下游测试环节，而非代码生成本身。
- **Agentic engineering与Codex或Claude等AI编码Agent有何不同？** AI编码Agent擅长在单次用户驱动的会话中将意图转化为代码。Agentic engineering运作在更高的抽象层次：它是一个控制平面，编排跨团队工作流，在Agent之间维护长期记忆，并管理整个软件交付生命周期的状态与可追溯性。两者并不竞争——Codex等编码Agent可以作为推理和代码生成引擎运行在工作者Agent*内部*。

---

*本文为特邀博客，作者为思科首席软件工程师（总监级）Renuka Kumar博士和思科高级工程总监Prashanth Ramagopal。博客中表达的观点为作者个人观点，不代表思科立场。*

‍

软件开发已进入一个新阶段——在这个阶段，智能Agent不再作为孤立工具运行，而是作为协调实体，映射真实世界的团队。随着AI应用的加速普及，焦点已从**什么是可能的**转向**什么在实践中有效**。软件工程的每个阶段——需求、设计、开发、安全、测试、部署和运营——都可以实现**最低程度的部分自动化**，甚至在Agent跨职能协作时支持**完整的端到端编排**。这一目标因此从*"我们如何更快地编写代码？"*转变为*"我们如何更快、更安全地推动软件在系统中流转？"*通过对多个Agentic框架的实验，我们识别出了能够带来真实、可量化影响的实践模式。

本文描述了一个旨在从任务级执行过渡到系统级协作的Agentic工程系统。我们提出了一个参考架构，并对使用LangChain工具套件（包括LangSmith和LangGraph）实现的多Agent协同框架进行了试点评估。这个系统并不是"更好的编码AI"，也不是"更好的任务助手"。该架构被设计为多Agent协同的控制平面，专注于端到端软件交付。

## Agentic Engineering——镜像真实世界的工程模式

我们的核心洞察很简单：

*"最大的飞跃不仅来自更好的工具，而来自能够映射真实世界团队的系统。"*

Agentic engineering的核心是一个协作的智能Agent系统，旨在映射工程团队规划、执行和交付软件的方式。该框架不将AI视为一组孤立的助手，而是将Agent建模为**团队成员**——每个成员拥有明确的职责、共享的上下文和问责机制——通过轻量级但强大的领导层进行协调。

该系统提供了一个**用于多Agent协同的原生控制平面，具备以下能力：**

- 执行长期工作流
- 保留可在团队间共享的Agent记忆
- 将不同类型的工作流串联在一起，跨越团队边界
- 促进知识共享，帮助新成员快速融入Agentic工作流
- 对以Agentic方式执行的工作流进行全局可观测，确保可追溯性和可审计性

## 架构

从高层次来看，该系统是一个松散耦合的Agent系统，可以作为独立实体运行，也可以作为Agent群体中的一员运行。我们的系统由两种可适配扩展的互补角色组成：

1. **工作者Agent（Worker Agents）** – 这些Agent是工程团队中个人贡献者的数字对应物。它们在明确定义的边界内自主运作，根据工程意图——例如开发、测试、调试或运营——规划和执行任务。根据团队成熟度和复杂性，一次部署可能涉及单个工作者Agent或**动态协调的工作者Agent群体**。

工作者Agent能够：

- 解读用户意图，并使用推理模型将其转化为可执行计划。
- 从源代码仓库、问题追踪器和日志等内部知识库等记录系统中收集所需上下文。
- 通过工具、编码Agent或自定义/子Agent执行工作流。
- 验证成果以确保正确性和完整性。
- 向领导层报告计划、行动和结果，以确保透明度、问责性和可追溯性。

工作者Agent被有意设计为松散耦合，使其能够水平扩展、适应新工作流，并在必要时将任务委托给群体中的其他Agent。

2. **领导者Agent（Leader Agent）** – 这些Agent充当项目负责人的数字类比。它们在Agent群体中进行协调、治理并提供共享能力和可见性。领导者Agent提供：

- 一个标准化最佳实践并大幅降低入门摩擦的共享提示和工作流库。
- 一个以一致、安全的方式向工作者Agent提供经批准能力的公共工具网关。
- 群体的长期记忆，实现随时间推移的学习和持续改进。
- 对Agent活动、决策和成果的全局可观测性，洞察系统行为和性能。
- 确定Agent*何时*和*如何*行动的编排能力，而不仅仅是*生产什么*。
- 通过将执行与协调分离，该框架在边缘保留了自主性，同时在规模上保持了一致性。

下图展示了Agentic工程系统的参考架构。我们所有的工作者Agent通过A2A协议进行通信。但工作Agent也可以通过MCP包装器与不支持A2A的Agent进行交互。与系统交互的工程师通过其首选界面（如IDE或CLI，或通过GitHub或Jira操作的外部触发器）表达意图。在该系统中，工作流可自定义以满足团队的生产力需求。

![架构概览图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e2358c6ef03497e00cafa8_architecture-overview_dark%201%20(1).png)

在评估了多个Agentic框架后，我们基于它们如何映射到Agentic工程的生产需求，为本研究选择了LangChain框架。它是一个用于有状态、协作和可治理Agent系统的执行模型，非常适合编排能够映射真实工程团队的AI系统。我们使用LangMem抽象来存储长期状态，并使用LangSmith记录执行跟踪，实现端到端的可追溯性、遥测和对Agentic工作流及成果的系统级视图。

### 宏观架构视图

下图展示了这些Agentic系统如何跨越团队边界的参考图。Agent领导者可以与其他团队的领导者协作。例如，来自产品管理团队的产品需求可以由工程团队领导者路由给合适的工作者Agent（群体）进行规划和需求提取。

![跨团队边界的宏观架构图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e235aacaa69e679fd141cf_macro-team-boundary_dark%201.png)

## 基于LangChain的参考技术实现

本实现融合了LangChain框架套件提供的三个核心抽象并对其进行评估——LangGraph（用于可控的Agent编排）、LangSmith（用于Agent可观测性和评估）和LangMem（一个通过长期记忆帮助Agent学习和改进的库）。LangGraph的核心抽象——有状态节点图——能够基于Agent生成的计划构建自定义工作流。评估重点关注以下技术特征，旨在将Agentic工程从实验环境过渡到稳定、生产就绪的运营模型：

- 跨步骤、Agent和重试持久化的状态管理和检查点能力。
- 提供审计跟踪以追踪**谁在何时做了什么决定，以及为什么**，支持事后分析和持续改进。
- 与外部记录系统和MCP风格工具网关的接口兼容性。
- 确保Agent执行授权操作的确定性执行模型，以降低操作风险。
- 跨不同Agentic通信协议以及与使用其他框架构建的Agent之间的互操作性。

### 使用LangGraph辅助的Agentic执行

我们探索了涉及Agent间通信的几个场景，例如跨越不同团队的工作者Agent调试技术问题，以及利用Codex或Claude等AI编码Agent与工作者Agent协作进行开发。我们在下图中详细描述了后一种场景的示例。该图描绘了AI编码Agent与驻留着自主逻辑的工作者Agent之间的交互。工作者Agent内部的自主逻辑遵循适用于大多数Agentic工作流的四阶段逻辑递进。该用例演示了工作者Agent如何用于检索超越源代码的上下文、通知其他Agent以及追踪Agentic活动。

- **意图分析：** 在IDE中以自然语言输入工程意图后，请求被发送给工作者Agent。在本用例中，Agent的工作流使用LangGraph进行编排，以分析意图并通过MCP工具检索相关上下文。
- **规划与通知：** 上下文确定后，Agent生成一个结构化的多步骤计划（图中的步骤1至步骤N）。该计划通过通信渠道（如Slack、Teams或Webex）通知工程师。
- **执行与追踪：** 该计划随后与IDE中的AI编码Agent协作，一步一步地执行。Agent利用LangGraph的检查点和状态追踪机制来追踪执行状态。
- **验证与收尾：** 在最后一步，执行完成后，工作者Agent通过验证已执行的计划与内存中检查点的执行状态是否匹配来完成闭环。结果通过通信渠道以通知形式传达给工程师，并以长期状态的形式保存在LangMem中。

由于AI编码Agent不支持原生A2A能力，我们构建了一个MCP适配器工具，将AI编码Agent的请求路由到工作者Agent。这种方式因此使系统与IDE无关。

![工作者Agent流程图](https://cdn.prod.website-files.com/65c81e88c254bb0f97633a71/69e23631d69524c90a11974c_worker-agent-flow_dark%201%20(1).png)

## 试点研究的发现与观察

为评估Agentic工程的实际影响，我们将该框架应用于真实的开发、测试和调试工作流。我们没有优化单个任务，而是在Agent协作时衡量在不损失质量的前提下吞吐量的提升，选择了至少需要两个Agent协调的工作流。为了为开发和调试工作流建立基准，我们举办了一个训练营，工程团队聚集在一起策划了一份使用案例清单，并根据历史证据计算出在没有Agent的情况下完成这些工作流所需的时间。我们保守地报告数字，实际收益可能更大。

我们评估了涉及跨团队分级和根本原因分析的多个调试工作流，并由QE团队进行独立质量评估。以定位根本原因的时间作为主要指标，对20多个工作流的试点显示，相较于历史调试时间，整体减少了93%。多项跨团队调查在不到五分钟的协调Agent执行中完成，经独立QE评估确认没有可测量的质量损失。从70名独特用户在一个月内生成的共512次调试会话中，我们统计到通过利用跨协作Agentic工作流节省了超过200个人时。

对于以开发为重点的工作流，该设置将基于IDE的AI编码Agent与工作者Agent配对。虽然这不是必须的，但一个关键优势是系统能够从后端服务检索项目特定上下文，从而实现更有根据的代码生成和测试计划生成。我们还通过将规划职责转移给工作者Agent并在LangMem中维护长期状态进行了测试，允许对以前的工作流进行索引和重用。这显著减少了重复任务的入门开销。

在15多个开发工作流中，即使在工作者Agent的参与下，我们观察到与历史基准相比执行时间减少了65%以上。重要的是，主要收益并不局限于更快的代码生成——AI编码Agent已经在这方面表现出色——而是来自通过协调Agent执行压缩PR合并后的功能测试等下游工作流。PR审查流程本身成为了人机交互引入的瓶颈。

## 该系统与AI编码Agent的区别

Codex和Claude等AI编码Agent提供了多种增强软件开发的新能力。然而，这些Agent在抽象层次上与本文所描述的Agentic工程系统有根本性的不同。

1. Codex类模型通常作为工作者Agent内部的组件或工作流中的推理/代码生成引擎嵌入。
2. *虽然*AI编码Agent擅长将意图转化为代码、在代码仓库上下文中重构、解释或调试代码，但它们在用户驱动的有界交互循环中运行，编排跨团队工作流的能力有限。相比之下，本文介绍的Agentic工程系统被明确设计为像松散耦合的工程团队一样运作，跨越开发者和团队边界。
3. AI编码Agent及其子Agent可以非常出色地执行并行功能。本文介绍的系统是用于编排端到端Agentic工程的显式控制平面，以快速推动软件在软件工程管线中流转，为此我们利用了LangChain框架。

## 结论

Agentic engineering代表了软件构建方式的根本性转变——通过围绕像真实工程团队一样运作的AI系统重组工作，并充分发挥它们的特长。综合我们的研究，Agentic engineering的主要影响不是渐进式的任务加速，而是软件在组织中流转方式的结构性转变——压缩协调开销、减少跨团队延迟、共享上下文，并重新定义人类注意力最有价值的地方。LangGraph等框架将协作、记忆和可观测性作为一等关注点，使这种运营模式切实可行。Agentic工程框架的好处在于，工程师进入软件交付管线的入门难度明显降低，设置要求极少。一旦Agent配置完成，多个团队就可以利用工作者Agent从内部和外部工具中获取上下文。结果不是更快的代码生成，而是一种更具弹性、更可扩展、本质上不同的软件交付方式。

---

## 引用

- 原文：[Agentic Engineering: How Swarms of AI Agents Are Redefining Software Engineering](https://www.langchain.com/blog/agentic-engineering-redefining-software-engineering)
- [LangChain](https://www.langchain.com/)
- [LangGraph](https://www.langchain.com/langgraph)
- [LangSmith](https://smith.langchain.com/)
