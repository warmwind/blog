---
title: "ReasoningBank：让 Agent 从经验中学习"
pubDatetime: 2026-04-24T10:00:00+08:00
description: "Google Research 介绍 ReasoningBank——一种新颖的 agent 记忆框架，通过从成功与失败经验中提炼可泛化的推理策略，使 agent 在部署后持续进化。"
slug: reasoningbank-enabling-agents-to-learn-from-experience-zh
originalTitle: "ReasoningBank: Enabling agents to learn from experience"
originalUrl: https://research.google/blog/reasoningbank-enabling-agents-to-learn-from-experience/
---

原文标题：ReasoningBank: Enabling agents to learn from experience<br>
原文链接：https://research.google/blog/reasoningbank-enabling-agents-to-learn-from-experience/

![ReasoningBank](https://storage.googleapis.com/gweb-research2023-media/original_images/ReasoningBank-2.png)

**作者：** Jun Yan 与 Chen-Yu Lee，Google Cloud 研究科学家

ReasoningBank 是一种新颖的 agent 记忆框架，通过利用成功与失败经验来提炼可泛化的推理策略，使 agent 能够在部署后持续从经验中学习。

**快速链接：** [论文](https://arxiv.org/abs/2509.25140) | [ReasoningBank 代码](https://github.com/google-research/reasoning-bank)

---

Agent 在处理复杂的现实世界任务方面正变得日益重要，涵盖范围从通用网页导航到协助处理大型软件工程代码库。然而，随着这些 agent 逐渐转变为现实世界中持久运行的长期角色，它们面临一个关键局限：它们难以在部署后分析并从成功与失败的经验中学习。

如果 agent 没有记忆机制，每次面对新任务时都会从零开始，反复犯下相同的策略性错误，丢弃宝贵的洞见。为解决这一问题，各种形式的 agent 记忆已被引入，用于存储过去交互的信息以供复用。然而，现有方法通常只关注记录每次采取的所有行动（例如 [Synapse](https://arxiv.org/abs/2306.07863) 中使用的轨迹记忆），或仅记录从成功尝试中总结出的工作流程（例如 [Agent Workflow Memory](https://arxiv.org/abs/2409.07429)）。这些方法存在两个根本性缺陷：第一，通过记录详细动作而非战术预判，它们无法提炼更高层次的、可迁移的推理模式；第二，通过过度强调成功经验，它们错失了一个主要学习来源——agent 自身的失败。

为弥补这一差距，在我们的 ICLR 论文 "[ReasoningBank: Scaling Agent Self-Evolving with Reasoning Memory](https://arxiv.org/abs/2509.25140)" 中，我们介绍了一种新颖的 agent 记忆框架（[github](https://github.com/google-research/reasoning-bank)），该框架从成功与失败经验中提炼有用洞见，用于测试时自我进化。在网页浏览和软件工程基准测试上进行评估时，ReasoningBank 相比基线方法提升了 agent 的有效性（更高的成功率）和效率（更少的任务步骤）。

## 用 ReasoningBank 提炼洞见

![ReasoningBank-1](https://storage.googleapis.com/gweb-research2023-media/images/ReasoningBank-1.width-1250.png)

*记忆内容对比：现有策略与 ReasoningBank。*

ReasoningBank 将全局推理模式提炼为高层次的结构化记忆。每个结构化记忆条目包含以下内容：

- **标题**：简洁标识核心策略的摘要。
- **描述**：记忆条目的简要摘要。
- **内容**：从过去经验中提炼的推理步骤、决策依据或操作洞见。

记忆工作流在检索、提取和整合的持续闭环中运行。在采取行动之前，agent 从 ReasoningBank 中提取相关记忆纳入上下文。随后与环境交互，并利用 [LLM-as-a-judge](https://arxiv.org/abs/2306.05685) 对生成的轨迹进行自我评估，提取成功洞见或失败反思。值得注意的是，这种自我判断不需要完全准确，因为我们发现 ReasoningBank 对判断噪声具有相当强的鲁棒性。在提取阶段，agent 将轨迹中的工作流和可泛化洞见提炼为新的记忆。为简单起见，我们直接将这些记忆追加到 ReasoningBank 中，将更复杂的整合策略留待未来工作探索。

关键在于，与仅关注成功运行的现有[工作流记忆策略](https://arxiv.org/abs/2409.07429)不同，ReasoningBank 主动分析失败经验以挖掘反事实信号和陷阱。通过将这些错误提炼为预防性经验教训，ReasoningBank 构建了强大的策略性护栏。例如，agent 不只是学习"点击'加载更多'按钮"这样的程序性规则，而是可能从过去的失败中学到"在尝试加载更多结果之前，始终验证当前页面标识符，以避免无限滚动陷阱"。

![ReasoningBank-2](https://storage.googleapis.com/gweb-research2023-media/images/ReasoningBank-2.width-1250.png)

*ReasoningBank 与 agent 在测试时集成的工作流程。*

## 记忆感知测试时扩展（MaTTS）

[测试时扩展](https://arxiv.org/abs/2408.03314)（TTS）——在推理时扩展计算资源——在[数学](https://arxiv.org/abs/2501.19393)和[竞争性编程](https://arxiv.org/abs/2502.14382)等推理领域已展现出巨大的有效性。然而，在 agentic 环境中，现有的 TTS 方法往往丢弃探索轨迹，仅将最终答案作为唯一有用的结果。这些被忽略的探索实际上是丰富的数据来源，可以加速 agent 随时间从经验中学习的能力。

我们通过记忆感知测试时扩展（MaTTS）来弥补这一差距，将记忆与扩展明确地联系起来。通过使用 ReasoningBank 作为强大的经验学习器，MaTTS 通过对比和优化信号将大量探索提炼为高质量记忆。我们通过两种不同形式的扩展来展示 MaTTS 的功能：

**并行扩展**：agent 在记忆的引导下，为同一查询生成多条不同的轨迹。通过自我对比，ReasoningBank 比较成功和错误推理的轨迹，提炼更鲁棒的策略并合成更高质量的记忆。

**序列扩展**：agent 在单条轨迹内迭代优化推理，产生强大的中间理由。ReasoningBank 将 agent 的试错和逐步改进过程中的中间洞见作为高质量记忆条目进行捕获。

MaTTS 建立了强大的协同效应：来自 ReasoningBank 的高质量记忆将扩展后的探索引导至更有希望的策略，反过来，扩展后的交互生成了显著更丰富的学习信号，反馈给更智能的 ReasoningBank，从而帮助 agent 不断进步。

![ReasoningBank-3](https://storage.googleapis.com/gweb-research2023-media/images/ReasoningBank-3.width-1250.png)

*记忆感知测试时扩展（MaTTS）与 ReasoningBank 的对比。*

## 性能与涌现能力

我们在涵盖动态环境的挑战性基准测试上评估了 ReasoningBank。以 [ReAct](https://arxiv.org/abs/2210.03629) 提示策略作为所有 agent 的基础，我们将 ReasoningBank 与三种记忆配置进行了对比：无记忆基线（Vanilla ReAct）、[Synapse](https://arxiv.org/abs/2306.07863)（轨迹记忆）和 [AWM](https://arxiv.org/abs/2409.07429)（工作流记忆）。基于 [Gemini-2.5-Flash](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash) 在 [WebArena](https://arxiv.org/abs/2307.13854) 和 [SWE-Bench-Verified](https://openai.com/index/introducing-swe-bench-verified/) 上的主要评估结果，我们有以下关键观察：

**卓越的成功率**：不带扩展的 ReasoningBank 在 WebArena 上比无记忆 agent 高出 8.3%，在 SWE-Bench-Verified 上高出 4.6%。

**效率提升**：由于 agent 主动访问过去的决策依据，它以大幅减少的无目标探索执行命令。在 SWE-Bench-Verified 上，ReasoningBank 相比无记忆基线每个任务节省了近 3 个总执行步骤。

**MaTTS 协同效应**：添加 MaTTS（并行扩展，扩展因子 k=5）后，成功率进一步提升。在 WebArena 上，带 MaTTS 的 ReasoningBank 相比不带 MaTTS 的 ReasoningBank 成功率提高了 3%，步骤数减少了 0.4。

![ReasoningBank-4](https://storage.googleapis.com/gweb-research2023-media/images/ReasoningBank-4.width-1250.png)

*不同 agent 记忆策略在 WebArena 和 SWE-Bench-Verified 上的性能对比（任务成功率和每任务平均步骤数）。*

值得注意的是，在评估过程中，我们观察到了策略成熟度的涌现。在一个网页浏览示例中，agent 最初策划的规则类似于简单的程序性清单（例如，"寻找页面链接"）。随着 agent 经历更多问题集，这些记忆在执行过程中被融入。在已有知识的基础上，agent 将新轨迹提炼为更高级的记忆。随着时间推移，简单清单逐渐演化为具有组合性、预防性逻辑结构的记忆（例如，"在检索数据集时，持续将任务与活跃页面过滤器进行交叉参照，确保检索到的数据集不会过早被分页"）。更多详情请参见[论文](https://arxiv.org/abs/2509.25140)。

## 结论

ReasoningBank 为让大语言模型从经验中学习、进化为测试时的持续学习者提供了一个强大的框架。我们相信，记忆驱动的经验扩展代表着 agent 扩展的一个关键新前沿。

我们非常期待与更广泛的研究社区分享这项工作。

## 致谢

本研究由 Siru Ouyang、Jun Yan、I-Hung Hsu、Yanfei Chen、Ke Jiang、Zifeng Wang、Rujun Han、Long T. Le、Samira Daruki、Xiangru Tang、Vishy Tirumalashetty、George Lee、Mahsan Rofouei、Hangfei Lin、Jiawei Han、Chen-Yu Lee 和 Tomas Pfister 共同完成。

---

## 引用

- 原文：[ReasoningBank: Enabling agents to learn from experience](https://research.google/blog/reasoningbank-enabling-agents-to-learn-from-experience/)
- 论文：[ReasoningBank: Scaling Agent Self-Evolving with Reasoning Memory](https://arxiv.org/abs/2509.25140)
- 代码：[github.com/google-research/reasoning-bank](https://github.com/google-research/reasoning-bank)
