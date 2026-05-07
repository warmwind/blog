---
title: 用极致协同设计应对 Agentic 系统日益增长的复杂性
pubDatetime: 2026-05-07T10:00:00+08:00
description: 深入分析 Agentic 系统的 token 消耗模式与工作负载经济学，探讨为何单一处理器无法满足需求，并介绍 NVIDIA 极致协同设计栈与 Vera Rubin 平台如何专为 Agent 推理而生。
slug: nvidia-agentic-extreme-codesign-vera-rubin-zh
originalTitle: "Building for the Rising Complexity of Agentic Systems with Extreme Co-Design"
originalUrl: https://developer.nvidia.com/blog/building-for-the-rising-complexity-of-agentic-systems-with-extreme-co-design/
tags:
  - AI
  - NVIDIA
  - Agentic
  - Inference
  - GPU
---

原文标题：Building for the Rising Complexity of Agentic Systems with Extreme Co-Design<br>
原文链接：https://developer.nvidia.com/blog/building-for-the-rising-complexity-of-agentic-systems-with-extreme-co-design/

生成式 AI 爆炸式发展的第一章，以人类发送请求、模型做出响应为典型特征。而 Agentic 时代则截然不同。

Agent 不再遵循预先设定的动作序列。它们调用工具、生成具有不同任务和模型的子 Agent、在记忆中保留信息、自主管理 context window，并自行决定何时完成任务。在这一过程中，这些系统将 token 消耗量、上下文长度和延迟要求推向极为苛刻的区间——而这正是当前推动 NVIDIA 极致协同设计栈（Extreme Co-Design Stack）和 NVIDIA Vera Rubin 平台的核心压力。

本文从三个维度分析这一演进：

- Agent 如何消耗 token
- 为何其经济性在传统服务架构下难以为继
- 专为 Agent 设计的基础设施栈应具备哪些特征

## 从聊天机器人到 Agent 的转变

如图 1 所示，生成式 AI 的普及始于一种简单的交互模型：用户发送一条消息，聊天机器人回复一条消息，如此循环。模型从 context window 中的记忆作出响应，对话历史线性增长，系统需求可以预测。

![对比三种 AI 交互模式的图表——标准聊天机器人、带工具的聊天以及 Agentic 模式——使用颜色编码的块表示用户、模型、工具调用和工具响应回合，展示从线性到链式序列复杂性不断增加的过程。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image7.webp)

*图 1. 按复杂度排序的三种 AI 交互模式：标准聊天机器人（线性）；带工具的聊天（有界、可变）；Agentic 模式（链式、高熵）*

工具调用的引入从根本上改变了 AI 聊天机器人的运作方式。一旦模型可以调用计算器来代替猜测数学结果，整个工作负载便随之改变。由于工具响应直接加入到 context window 中，它们为输入序列引入了不可预测性。这是因为工具输出的大小取决于具体查询和工具设计——包括它如何处理相关数据。尽管整个过程仍受提示词与最终答案的约束，但标准聊天所具有的简单可预测性已不复存在。

当我们引入 Agent 时，这一动态变得更加复杂。如果一个模型有能力调用一个工具，那它同样有能力决定使用多少工具、以什么顺序使用。例如，一个被委托撰写邮件的 Agent 可能会：

- 阅读现有往来邮件
- 检索云端驱动器获取背景信息
- 核实收件人身份
- 然后起草邮件

这种链式调用正是模型演变为 Agent 之处，也是工作负载从"具有概率性尖峰的线性可预测"转变为"结构性概率性"的关键——使得每个 Agent 会话的形态可能彼此大相径庭。

### Agentic 架构的特征

现代 Agentic 架构由多种 Agent 层级结构与优化技术混合构成，以实现有效的上下文管理、工具使用和任务优化：

![流程图展示了一种标准的主 Agent/子 Agent 架构，其中请求流入中央主 Agent，主 Agent 与子 Agent 进行双向通信，最终输出结果。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image9.webp)

*图 2. 标准主 Agent/子 Agent 架构的简单流程图*

- **主 Agent**：负责端到端地完成整个任务。可以协调子 Agent 处理子任务。通常，主 Agent 由最强大的模型驱动，直接与用户进行交互。
- **子 Agent**：由主 Agent 生成，用于处理范围更窄的任务，具备与主 Agent 类似的自主管理 context window 的能力。通常，子 Agent 在架构上与主 Agent 相同或非常相似，只是任务范围受主 Agent 提供的提示词限制而更加有限。
- **文件系统状态持久化**：Agent 通过将记忆和工具调用输出写入文件、后续搜索或重新读取其内容来获得额外的状态持久化能力。这作为一种上下文管理和记忆的方法。
- **摘要与压缩（Compaction）**：一种对 Agent 的 context window 进行摘要从而压缩的技术，以便为新信息腾出空间并降低输入处理成本。

![折线图展示了 Agentic 会话期间输入 token 随时间增长的情况，显示在接近模型上下文限制时，context window 达到峰值后发生一次压缩事件，随后下降并随任务继续增长。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image5.webp)

*图 3. 展示 Agentic 会话中每次请求输入 token 增长的简化定性图*

如今最流行的一些 Agentic 工具遵循类似的架构。Claude Code 等工具中的主 Agent 经常将工作委托给子 Agent，以利用更小的 context window 并实现任务并行化。由于系统必须在每一个推理步骤中处理输入 token，利用更小的上下文能提升效率、降低输入 token 处理成本。这种架构是应对"上下文腐化（context rot）"现象的必要防御手段——随着上下文不断扩展，输出质量将不可避免地下降。当任务复杂度增加时，刻意触发的压缩事件会强制大幅缩减主 Agent 的 context window，以补偿无法无限扩展 token 的局限。

## Agentic 系统的工作负载动态与经济性

Anthropic 在其关于构建多 Agent 系统的报告中估计，这些系统消耗的 token 量高达标准聊天的 15 倍。这一显著增长要求改善 token 的单位经济性，以使这些应用在规模化时能够实现经济盈利。要应对这一推理经济学挑战，需要深入理解系统层面的 token 吞吐量和延迟要求，而这些正是决定 Agentic 经济学的关键。

理解这些工作负载的成本与复杂性，最好通过分析真实的 Agentic 会话来实现。图 4 提供了一个 Claude Code 编码任务的实测示例。图中的折线代表了会话期间每次请求时子 Agent（橙色）和主 Agent（灰色）的输入序列长度（上下文 + ISL）。即便在单个会话中，这条轨迹也清晰地说明了为什么长上下文容量、缓存可编程性以及可预测的每 token 延迟与原始模型质量同样重要。

![实际会话折线图，追踪 33 分钟内主 Agent 和子 Agent 在 Agentic 编码会话中的输入 token 增长情况，显示主 Agent 的上下文在约 25 分钟时达到峰值并发生压缩，而子 Agent 则全程产生频繁的较小尖峰。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image4.webp)

*图 4. 一次跨越 33 分钟、涵盖主 Agent 和子 Agent 的 283 次请求的实时 Claude Code Agentic 编码会话的上下文增长轨迹*

这个持续 33 分钟的会话追踪了 58 个主 Agent 回合，协调了 225 次子 Agent 调用。在 283 次推理请求中，context window 从 15K token 增长到峰值 156K，然后经过一次上下文压缩事件降至约 20K。这条轨迹清楚地表明，Agent token 消耗既受 Agentic 系统行为影响，也受任务本身性质的影响。

当主 Agent 没有进行委托或压缩上下文时，输入上下文会迅速累积，导致缓存读取的输入 token 成本在每次回合都会重复产生。在前 40 个回合中，主 Agent 平均约有 85K token 的上下文，在发生压缩之前共处理了约 350 万个输入 token，此后又在同一会话中追加了约 100 万个。这正是高带宽内存（HBM）、Vera Rubin NVL72 等高吞吐量平台变得至关重要的场景——因为长上下文提示词需要在经济上保持可行，同时预填充需求还在持续增长。

Prompt 缓存是使这一模式得以可行的关键。若无 KV 缓存复用，每个输入 token 都需要被完整地重新处理。主流 API 提供商对缓存命中给予约 90% 的折扣，因此在 95% 的缓存命中率下，输入处理成本下降约 85%；若无 prompt 缓存，此处的成本大约会高出 6 倍。编码 Agent 通常能维持 95-98% 的缓存命中率，尤其是在工具输出较小的情况下。这就是为什么 prompt 缓存越来越成为一个系统层面的问题，而不仅仅是一个 API 功能：维持高缓存命中率依赖于高效的 CPU 侧 KV 缓存管理和专为此设计的高容量上下文存储（如 NVIDIA CMX），以保留长前缀并在会话规模扩大时快速恢复它们。

子 Agent 轨迹中的 225 次请求展示了各自独立的推理会话，每个会话使用独特的上下文和特定的工具定义。子 Agent 通常会增加总输出 token 量，但通过从全新的 context window 启动并仅携带与委托任务相关的信息，它们可以降低输入成本。它们还可以在更小的模型上运行，从而降低延迟和成本，同时仍然保持针对较窄任务的准确性。

上下文压缩同样重要。它提供了一种避免触及 context window 上限的机制，减轻了上下文腐化的影响，并带来了降低成本的额外效果。将 context window 从 156K token 减少到 20K，立即减少了缓存输入 token 的支出，并为下一组任务腾出了空间。

如图 5 所示，从定性角度看，大多数已处理的 token 来自缓存。一旦发生这种情况，网络和内存系统的行为就会直接影响用户感知延迟，而 NVLink 6、ConnectX-9、BlueField-4 和 Spectrum-X 等低延迟互联帮助保持共享上下文的可访问性，并在会话扩展到多个 Agent 时减少重新计算的代价。

![一个 33 分钟 Agentic 编码会话中总输入 token 的堆叠面积图，绿色代表缓存 token，蓝色代表未缓存 token，涵盖 283 次主 Agent 和子 Agent 的合并请求。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image6.webp)

*图 5. 一次实时 Agentic Claude Code 编码会话的 token 缓存分解轨迹，区分了 283 次请求在 33 分钟内的缓存与未缓存输入 token；与图 4 为同一会话*

从这个示例可以清晰地看到，Agent token 动态相当复杂，token 消耗可以在主 Agent 和子 Agent 间迅速扩展。为了理解在这种不断增长的 token 需求下扩展这些应用所面临的挑战，我们必须考虑其性能交付需求。

### Agentic 工作负载的性能要求

释放 Agentic 工作负载的价值需要高模型智能、大上下文和低延迟。这些 Agent 产生洞察的速度越快，它们所创造的价值就越呈指数级增长。这种速度缩短了研发周期、改善了 Harness 控制，并实现了复杂的多 Agent 循环。由于支撑这些能力的 token 在本质上就很昂贵，交付性能成为使这些系统既可扩展又能盈利的关键杠杆。

降低这些 token 成本需要生产者在大模型和大上下文下，在高交互性区间持续维持规模。图 6 通过一条标准推理性能帕累托曲线展示了这一瓶颈。曲线的左侧提供高吞吐量，但处于交互性的低端，Agentic 工作负载无法在此正常运转。

![定性帕累托曲线图，将每 GPU 吞吐量与三种用例区间的交互性进行对比——批处理和搜索、标准编码和研究、Agentic 应用——显示吞吐量与交互性之间的反比关系。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image1.webp)

*图 6. 定性帕累托曲线，在每 GPU 基础上展示批处理、标准编码和 Agentic 应用工作负载中吞吐量与交互性之间的权衡*

这些工作负载必须转向曲线的高交互性一侧（右侧）才能成功运行。Agentic 系统在消耗大量 token 的同时，需要较快的生成速度以维持终端用户的交互体验。问题在于，实现这种低延迟通常会导致系统吞吐量大幅下降。吞吐量的下降导致每 token 成本高得令人望而却步，使 Agentic 系统在规模化时面临经济上的挑战。

![定性帕累托曲线图，将每百万 token 成本与三种用例区间的交互性进行对比——批处理和搜索、标准编码和研究、Agentic 应用——显示更高交互性水平下成本呈指数级增长，虚线绿线表示通过更高吞吐量降低成本。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image8.webp)

*图 7. 定性帕累托曲线，展示批处理、标准编码和 Agentic 应用工作负载中每百万 token 成本与交互性之间的权衡*

打破这一瓶颈需要在基础设施设计上进行彻底转变。现代 GPU 提供了强大的计算能力和充足的带宽，但在低延迟下维持规模需要的远不止任何单一架构所能提供的。答案在于极致协同设计（Extreme Co-Design）。这种方法通过针对每个阶段专门化的硬件来优化推理，并将这些独特挑战委托给一个完整的平台，而不仅仅是一个处理器。

## 为何单一处理器不够用

这些独特需求不会仅凭增加更多计算 FLOP 和内存容量就能解决。这些需求源于 Agent 工作方式的架构特性，没有任何单一处理器能同时解决它们。

![NVIDIA Agentic 极致协同设计栈的系统架构图，分为三个部分：推理优化引擎（包含推理解耦、KV 缓存管理、低延迟通信和低精度推理）；关键网络层（NVLink 6 交换机、ConnectX-9 SuperNIC、BlueField-4 和 Spectrum-X）；以及核心计算平台（NVIDIA Vera Rubin NVL72、NVIDIA Vera CPU 和 NVIDIA Groq 3 LPX）。](https://developer-blogs.nvidia.com/wp-content/uploads/2026/05/image1-1.webp)

*图 8. 突出展示 NVIDIA 极致协同设计策略中针对 Agentic 工作负载优势的示意图*

所需要的是一个平台，其中每个瓶颈都映射到专门的硬件上，通过极致协同设计作为一个统一的系统进行编排（见图 8）：

- **平台**

Vera Rubin NVL72 以 Blackwell 十分之一的每百万 token 成本提供容量和计算能力。HBM 容量使长上下文流水线在经济上切实可行；计算密度在规模化时吸收预填充成本。

- Vera CPU 通过降低 Agent 延迟、无缝 KV 缓存卸载和统一的 CPU-GPU 执行，弥合了工具执行的差距。

- Groq 3 LPX 打破了吞吐量-延迟的权衡。SRAM 优先架构提供严格有界、低抖动的 token 生成——这在任何单个 Agent 的差异都会在整个流水线中传播时至关重要。

- 网络芯片（NVLink 6 交换机、ConnectX-9 SuperNIC、BlueField-4 DPU 和 Spectrum-X 以太网）为 Agentic 工作负载创建了一个统一的、低延迟的服务网络，使 Agent 能够更快地协调、保持共享上下文的可访问性，并随着会话在多个 Agent 中扩展而避免昂贵的重新计算。

- **软件栈组件：**

Dynamo 和注意力-FFN 解耦（AFD）通过将工作分配到最合适的处理器并协调执行以减少资源争用和延迟，创建了一条连贯的服务路径。此外，Dynamo 向 Agent Harness 暴露了缓存可编程性。

- NVFP4 降低了精度开销，使 MoE Agent 能够以更低的延迟、更高的吞吐量和更低的内存压力运行，而不会牺牲智能水平。

- TRT-LLM WideEP 为前沿 MoE 优化了大型专家并行性，使 Agent 能够以更低的延迟和更高的吞吐量提供高智能响应。

- 推测性解码（Speculative Decoding）通过并行生成可能的 token 并快速验证，降低了 Agent 响应延迟，加速了大模型的低延迟推理。

通过极致协同设计将这七个芯片与软件栈相结合，Vera Rubin 平台能够在 40 万上下文的万亿参数 MoE 模型上实现每用户每秒 400+ token 的交付性能。这一性能水平改变了 Agent 历史上的权衡范式——不再需要为了实现高用户速度和高系统吞吐量而以较小的模型和有限的 context window 来妥协质量。在这一区间，Agentic 架构成为了规模化可行的产品，而不再是昂贵的实验。

有关 Vera Rubin 平台规格和 LPX 的更多详情，请参阅各自的发布博客：

- [Inside the NVIDIA Vera Rubin Platform: Six New Chips, One AI Supercomputer](https://developer.nvidia.com/blog/inside-the-nvidia-vera-rubin-platform-six-new-chips-one-ai-supercomputer/)
- [Inside NVIDIA Groq 3 LPX: The Low-Latency Inference Accelerator for the NVIDIA Vera Rubin Platform](https://developer.nvidia.com/blog/inside-nvidia-groq-3-lpx-the-low-latency-inference-accelerator-for-the-nvidia-vera-rubin-platform/)

## 引用

- 原文：[Building for the Rising Complexity of Agentic Systems with Extreme Co-Design](https://developer.nvidia.com/blog/building-for-the-rising-complexity-of-agentic-systems-with-extreme-co-design/)
