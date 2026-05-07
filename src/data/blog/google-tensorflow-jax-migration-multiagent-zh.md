---
title: 速度提升 6 倍：Google 如何用 AI 实现从 TensorFlow 到 JAX 的迁移
pubDatetime: 2026-05-07T12:00:00+08:00
description: Google AI 与基础设施团队开创了一种新的多 Agent AI 方法，将生产级机器学习模型从 TensorFlow 迁移到 JAX，实现 6 倍速度提升，并在 YouTube 复杂生产模型上取得验证。
slug: google-tensorflow-jax-migration-multiagent-zh
originalTitle: "6x faster migration from TensorFlow to JAX"
originalUrl: https://cloud.google.com/blog/topics/developers-practitioners/6x-faster-migration-from-tensorflow-to-jax
tags:
  - AI
  - Google
  - TensorFlow
  - JAX
  - Multi-Agent
  - Migration
---

原文标题：6x faster migration from TensorFlow to JAX<br>
原文链接：https://cloud.google.com/blog/topics/developers-practitioners/6x-faster-migration-from-tensorflow-to-jax

![](https://storage.googleapis.com/gweb-cloudblog-publish/images/1_-_Hero_Image.max-2600x2600_QgwMqCo.jpg)

**Jamie Rogers**
Head of Product, Domain Applied Machine Learning, AI and Infrastructure

**Parthasarathy Ranganathan**
Google Fellow & Vice President, AI and Infrastructure

AI 编码 Agent 正在软件行业迅速普及，从根本上改变着开发者日常编写、测试和调试代码的方式。虽然这些工具在局部、独立的任务上表现出色，但将其应用于大规模、系统性的代码库迁移则需要一种全新的方法。

Google 已经将 AI 融入许多迁移工作流：x86 到 ARM（使工作负载能够在 Google Axion 处理器上运行）、int32 到 int64 标识符（避免 ID 耗尽）、JUnit3 到 JUnit4（用于测试）以及 Joda-Time 到 java.time（一个现代的时间库）。然而，AI 模型迁移代表着全新复杂度，需要更先进的 AI 辅助迁移方法。

将生产级机器学习模型从一个框架翻译到另一个框架——例如，从 TensorFlow（TF）到 JAX——并不是简单的语法更新。这是一项长期任务，需要理清数千行代码、跨多个文件管理复杂状态，并保持精确的数学等价性。通用的单 Agent 编码助手在这种复杂度下通常力不从心——它们在长时间工作流中频繁丢失上下文、产生 API 幻觉，或无法在整个代码库中生成可构建的代码。

Google 的 AI 与基础设施团队开创了一种解决这一行业广泛问题的新方法。成果是迁移速度提升 6 倍，这一里程碑被 Sundar 在近期的 Google Cloud Next 主题演讲中特别提及。在本文中，我们将分享如何部署专业化的多 Agent AI 系统，将 Google 部分最大规模的生产模型从 TF 迁移到 JAX。

### 加速从 TF 到 JAX 的过渡

对于 Google 以及整个行业的众多团队而言，可扩展机器学习的未来正在 JAX 上构建。JAX 围绕函数式、无状态范式设计，为现代张量处理单元（TPU）基础设施和 XLA 编译进行了深度优化，是现代 AI 栈的基石。

向这一未来演进面临着巨大挑战。数以千计的生产模型是在 TensorFlow 上构建的，这是一个以面向对象、有状态层初始化和静态执行图为特征的框架。将这些模型手工迁移到 JAX 需要从根本上重新思考层之间的交互方式以及状态的显式管理方式。在大型组织中，仅此类迁移就需要数百乃至数千个软件工程师（SWE）年——这些时间本可以更好地用于研究新架构和推动产品创新。

用 AI 解决这一挑战最初是 Google AI 与基础设施团队内部的一个雄心勃勃的实验，但现在已发展成为一套可重复应用的蓝图，用于应对整个公司的复杂工程问题。

### 超越单 Agent 编码

我们早期对 Agentic 代码翻译的实验在简单模型上表现出了希望。然而，当面对 Google 规模迁移的现实——跨多个文件、数千行代码的复杂生产级模型——通用的单 Agent 配置力不从心。它们无法在高层结构规则与低层执行细节之间取得平衡，导致各种失败，例如覆盖关键文件或跳过必要功能。为了克服企业迁移中这些固有的普遍挑战，我们开发了一种高度专业化的多 Agent 架构，由以下部分组成：

- **规划 Agent（Planner Agent）**：使用确定性的、基于编译器的静态分析，规划 Agent 绘制出代码库的完整依赖树。然后与其他 Agent 协作，将迁移分解为离散的逐步计划，确保迁移从"叶节点"（没有未迁移依赖的层）向上逻辑地进行。
- **协调 Agent（Orchestrator Agent）**：此 Agent 充当项目经理。它将计划步骤动态分组为可管理的块以保持 context window 的聚焦，注入必要的领域知识，并在某个步骤构建失败时处理故障恢复。
- **编码 Agent（Coder Agent）**：作为推理和行动的 Agent 构建，编码 Agent 是核心工作力量。它直接集成到我们的内部 IDE 工具中，能够读取文件、编写代码、运行构建和执行单元测试。关键是，它在"测试并修复"循环中运行，进行自我纠正直到在目标语言中生成可编译的、可验证的组件。

![](https://storage.googleapis.com/gweb-cloudblog-publish/images/2_-_System_diagram.max-1400x1400.jpg)

*图：用于复杂代码迁移的多 Agent AI 系统。描述用于将遗留模型代码迁移到 JAX 的多 Agent 系统的流程图。图片由 Gemini Nano Banana 2 生成。*

### 可扩展的验证与动态 Playbook

生成式 AI 模型的质量与其所获得的上下文密切相关。由于源架构和目标架构很少能一一对应，我们设计了一套可扩展的分层 Playbook 系统。

这些 Playbook 涵盖从通用仓库指令到从成功的手工迁移中提炼出的高度专一的"黄金示例"。通过向协调 Agent 提供特定于客户端的 Playbook（例如，针对 YouTube 独特排序模型基础设施量身定制的 Playbook），系统可以避免通用幻觉，并严格遵守内部编码标准。这种 Playbook 架构与框架无关，意味着它可以被适配来指导任何两种编程语言或框架之间的迁移。

此外，我们建立了严格的质量指标来确保生成的代码确实达到生产就绪状态：

- **定量验证**：对于每个代码单元，我们在数学上验证其正确性。在 TF 到 JAX 迁移的案例中，系统使用算法梯度上升找到原始 TF 层和新 JAX 层之间的最大误差，从数学上验证功能等价性。
- **定性评估**：我们还根据一套定性标准评估迁移后的代码。在 TF 到 JAX 迁移的案例中，我们部署了一个盲审 LLM 裁判，根据框架无关的架构检查清单对迁移代码进行评分，确保关键的领域特定逻辑被完整捕获。

### 重新定义迁移速度

通过部署这个多 Agent 系统，我们从根本上改变了软件迁移的经济性。

在我们对真实世界高度复杂的 YouTube 模型（具有数千行代码、数百个层和深度指标依赖）的评估中，多 Agent 系统实现了比手工迁移快 6.4 倍到 8 倍的速度。原本需要数个 SWE 月的工作，现在只需数周的 AI 辅助代码生成，然后由专家进行人工审查。

该系统有效地处理了样板代码、识别了目标习惯用语、映射了依赖关系，并生成了单元测试，使工程师能够作为审查者和架构师，而不是手工翻译者。

### 展望 AI 辅助时代

AI 正在改变技术创新的步伐。如果不使用 AI 来加速我们进行大规模迁移的能力，组织将越来越难以采用最新突破并维护其系统的安全性、可靠性和性能。

我们将机器学习实现从一个 ML 框架迁移到另一个框架的工作证明，通过将确定性静态分析、严格的测试循环和专业化的多 Agent 架构相结合，我们可以安全地自动化行业中最复杂的软件工程挑战。该过程的详细描述已发表在我们的技术论文中。

这项工作是 Google 跨团队协作的成果。我们感谢以下关键贡献者：Stoyan Nikolov、Niyati Parameswaran、Bernhard Konrad、Moritz Gronbach、Niket Kumar、Ann Yan、Varun Singh、Yaning Liang、Antoine Baudoux、Xevi Miró Bruix、Daniele Codecasa、Madhura Dudhgaonkar、Elian Dumitru、Alex Ivanov、Christopher Milne-O'Grady、Ahmed Omran、Ivan Petrychenko、Assaf Raman、Stefan Schnabl、Yurun Shen、Maxim Tabachnyk、Niranjan Tulpule、Amin Vahdat 和 Jeff Zhou。

## 引用

- 原文：[6x faster migration from TensorFlow to JAX](https://cloud.google.com/blog/topics/developers-practitioners/6x-faster-migration-from-tensorflow-to-jax)
