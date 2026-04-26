---
title: 关于近期 Claude Code 质量问题的说明
pubDatetime: 2026-04-26T10:00:00+08:00
description: Anthropic 工程博客文章《An update on recent Claude Code quality reports》中文翻译。解释了 2026 年 3–4 月影响 Claude Code 质量的三项变更：默认推理力度调低、缓存优化 Bug 导致推理历史丢失、system prompt 冗余限制，以及已采取的修复和后续改进措施。
slug: claude-code-quality-postmortem-april-2026-zh
originalTitle: "An update on recent Claude Code quality reports"
originalUrl: https://www.anthropic.com/engineering/april-23-postmortem
tags:
  - Claude Code
  - Engineering
  - Postmortem
---

原文标题：An update on recent Claude Code quality reports<br>
原文链接：https://www.anthropic.com/engineering/april-23-postmortem

过去一个月，我们一直在调查关于 Claude 回复质量下降的用户反馈。我们将这些报告追溯到三项独立的变更，分别影响了 Claude Code、Claude Agent SDK 和 Claude Cowork。API 并未受到影响。

三个问题均已于 4 月 20 日（v2.1.116）修复。

在这篇文章中，我们将解释我们发现了什么、修复了什么，以及将如何改进以确保类似问题不再发生。

我们非常重视关于质量退步的反馈。我们从不会故意降低模型的性能，并且能够立即确认 API 和推理层未受影响。

经过调查，我们发现了三个不同的问题：

1. 3 月 4 日，我们将 Claude Code 的默认推理力度（reasoning effort）从 `high` 改为 `medium`，以减少部分用户在 `high` 模式下出现的极长延迟——长到足以让界面看起来像是卡住了。这是一个错误的权衡。在用户反馈他们更倾向于默认使用更高智能、并为简单任务选择较低力度之后，我们于 4 月 7 日回滚了这一变更。此问题影响 Sonnet 4.6 和 Opus 4.6。
2. 3 月 26 日，我们发布了一项变更，用于清除空闲超过一小时的会话中 Claude 的旧推理内容，以降低用户恢复这些会话时的延迟。一个 Bug 导致这种清理不是只发生一次，而是在会话剩余的每一轮都持续发生，使 Claude 看起来健忘且重复。我们于 4 月 10 日修复了这个问题。此问题影响 Sonnet 4.6 和 Opus 4.6。
3. 4 月 16 日，我们在 system prompt 中添加了一条减少冗余输出的指令。与其他提示词变更叠加后，它对代码质量产生了负面影响，并于 4 月 20 日被回滚。此问题影响 Sonnet 4.6、Opus 4.6 和 Opus 4.7。

由于每项变更以不同的时间表影响不同的流量切片，整体效果看起来像是广泛且不一致的质量下降。尽管我们从 3 月初就开始调查相关报告，但起初这些报告难以与用户反馈中的正常波动区分开来，我们内部的使用情况和 eval 也没有最初重现出这些问题。

这不是用户应该从 Claude Code 中获得的体验。截至 4 月 23 日，我们正在为所有订阅用户重置使用额度。

## Claude Code 默认推理力度的变更

当我们在 2 月将 Opus 4.6 引入 Claude Code 时，将默认推理力度设置为 `high`。

随后，我们收到用户反馈，称 Claude Opus 4.6 在高力度模式下偶尔会思考时间过长，导致界面看起来像是卡住了，并造成延迟过高和 token 用量过大。

一般而言，模型思考的时间越长，输出质量越好。推理力度是 Claude Code 让用户在更多思考与更低延迟及更少使用额度消耗之间进行权衡的方式。在为模型校准力度级别时，我们会综合考虑这一权衡，以便在测试时算力曲线上选取能为用户提供最佳选项范围的点。在产品层面，我们随后从这条曲线上选择一个默认点，并将该值作为 effort 参数发送至 Messages API；其他选项则通过 `/effort` 提供。

![推理力度设置说明图](https://www-cdn.anthropic.com/images/4zrzovbb/website/de3bcf9733b61f57234d8c45e663b1bd48677ea1-3840x2160.png)

在我们的内部 eval 和测试中，medium 力度对于大多数任务而言，以略低的智能表现换取了显著更低的延迟。它也不存在偶发极长尾延迟的问题，并有助于最大化用户的使用额度。因此，我们推出了将 medium 设为默认力度的变更，并通过产品内弹窗说明了原因。

![产品内弹窗说明推理力度变更](https://www-cdn.anthropic.com/images/4zrzovbb/website/459b2a8a0baa88937eebcbe4566dde4d6cc7f185-3794x2260.png)

推出后不久，用户开始反馈 Claude Code 感觉智能下降了。我们进行了多次设计迭代，使当前力度设置更加清晰，以提示用户他们可以更改默认值（启动时的提示、内联力度选择器，以及重新引入 ultrathink），但大多数用户仍保留了 medium 力度默认值。

在收到更多客户反馈后，我们于 4 月 7 日撤销了这一决定。现在所有用户对 Opus 4.7 默认使用 `xhigh` 力度，对所有其他模型默认使用 `high` 力度。

## 一项导致先前推理内容丢失的缓存优化

当 Claude 完成一项任务的推理时，推理内容通常保留在对话历史中，使 Claude 在每一轮后续对话中都能看到自己做出编辑和工具调用的原因。

3 月 26 日，我们发布了一项原本旨在提升该功能效率的改进。我们使用 prompt caching 使用户的连续 API 调用更便宜、更快速。Claude 在发出 API 请求时将输入 token 写入缓存，在一段时间不活跃后，提示词从缓存中被逐出，为其他提示词腾出空间。缓存利用率是我们仔细管理的指标（详见我们的[方法](https://x.com/trq212/status/2024574133011673516)）。

这个设计本应很简单：如果一个会话空闲超过一小时，我们可以通过清除旧的推理部分来降低用户恢复该会话的成本。由于该请求无论如何都会发生缓存未命中，我们可以从请求中删除不必要的消息，以减少发送到 API 的未缓存 token 数量。然后我们会恢复发送完整的推理历史。为此，我们使用了 `clear_thinking_20251015` API 头部，并配合 `keep:1`。

该实现存在一个 Bug。它不是只清除一次推理历史，而是在会话剩余的每一轮都进行清除。一旦会话越过空闲阈值，该进程剩余的每个请求都会告诉 API 只保留最近的一块推理内容，并丢弃之前的所有内容。问题会叠加：如果你在 Claude 正在执行工具调用的过程中发送了跟进消息，那会在出错标志下开启新的一轮，导致即使是当前轮次的推理内容也被丢弃。Claude 会继续执行，但对自己为何做出这些选择的记忆会越来越少。这就体现为用户报告的健忘、重复和奇怪的工具调用。

由于这会持续从后续请求中丢弃 thinking block，那些请求也会导致缓存未命中。我们认为这是导致用户反映使用额度消耗速度比预期快的独立报告的原因。

![缓存 Bug 导致推理内容丢失的示意图](https://www-cdn.anthropic.com/images/4zrzovbb/website/332d9c487bb73c8078686068dcbe1b616720a8dd-3016x1198.png)

两个不相关的实验让我们起初难以重现这个问题：一个与消息队列相关的仅内部服务器端实验；以及一个关于我们如何展示推理内容的正交性变更，它在大多数 CLI 会话中掩盖了这个 Bug，所以我们在测试外部构建版本时也未能发现它。

这个 Bug 处于 Claude Code 的上下文管理、Anthropic API 和扩展思维（extended thinking）的交叉点。它引入的变更通过了多次人工和自动代码审查，以及单元测试、端到端测试、自动化验证和 dogfooding。加之这个问题只在边缘情况（过时会话）下发生，且难以重现，我们花了一周多的时间才发现并确认根本原因。

作为调查的一部分，我们使用 Opus 4.7 对出问题的 Pull Request 进行了 [Code Review](https://code.claude.com/docs/en/code-review) 回测。当提供了收集完整上下文所需的代码仓库时，Opus 4.7 找到了这个 Bug，而 Opus 4.6 没有。为防止此类问题再次发生，我们目前正在落地对更多仓库的支持，作为代码审查的上下文。

我们于 4 月 10 日在 v2.1.101 中修复了这个 Bug。

## 一项旨在减少冗余输出的 system prompt 变更

我们最新的模型 Claude Opus 4.7 相较于前代有一个显著的行为特征：正如我们在[发布时所写](https://www.anthropic.com/news/claude-opus-4-7)，它往往相当冗长。这使它在处理困难问题时更加智能，但也会产生更多输出 token。

在发布 Opus 4.7 前几周，我们开始对 Claude Code 进行预先调整。每个模型的行为略有不同，我们会在每次发布之前花时间针对模型优化 harness 和产品。

我们有多种工具来减少冗余：模型训练、提示词工程，以及改善产品中的推理 UX。我们最终综合使用了这些方法，但 system prompt 中的一项新增内容对 Claude Code 的智能表现产生了过大的负面影响：

> *"长度限制：工具调用之间的文字保持在 ≤25 个词以内。最终回复保持在 ≤100 个词以内，除非任务需要更多细节。"*

经过多周的内部测试，在我们运行的评估集中未发现任何回归，我们对这项变更感到有把握，并于 4 月 16 日与 Opus 4.7 一同发布。

作为本次调查的一部分，我们使用更广泛的评估集运行了更多 ablation（从 system prompt 中逐行移除以了解每行的影响）。其中一项评估显示 Opus 4.6 和 4.7 均出现了 3% 的下降。我们立即作为 4 月 20 日发布的一部分回滚了该提示词。

## 展望未来

我们将采取若干不同举措来避免此类问题：我们将确保更大比例的内部员工使用完全相同的 Claude Code 公开构建版本（而非用于测试新功能的版本）；并将改进我们内部使用的 [Code Review](https://code.claude.com/docs/en/code-review) 工具，并将这一改进版本发布给客户。

我们还将对 system prompt 变更增加更严格的控制。我们将为 Claude Code 的每一项 system prompt 变更运行广泛的按模型 eval 套件，持续进行 ablation 以了解每行的影响，并构建了新工具使提示词变更更易于审查和审计。我们还在 CLAUDE.md 中新增了指导原则，以确保针对特定模型的变更仅适用于其目标模型。对于任何可能与智能表现存在权衡的变更，我们将增加浸泡期（soak period）、更广泛的 eval 套件和灰度发布，以便更早发现问题。

我们最近在 X 上创建了 @ClaudeDevs，以便深入解释产品决策及其背后的原因。我们将在 GitHub 的集中讨论串中分享相同的更新。

最后，我们要感谢我们的用户：那些使用 `/feedback` 命令向我们反馈问题（或在网上发布具体可复现示例）的人，正是他们最终帮助我们识别并修复了这些问题。今天我们正在为所有订阅用户重置使用额度。

我们对你们的反馈和耐心深表感谢。

## 引用

- 原文：[An update on recent Claude Code quality reports](https://www.anthropic.com/engineering/april-23-postmortem) — Anthropic Engineering
- [Claude Code Review 文档](https://code.claude.com/docs/en/code-review)
- [Claude Opus 4.7 发布说明](https://www.anthropic.com/news/claude-opus-4-7)
