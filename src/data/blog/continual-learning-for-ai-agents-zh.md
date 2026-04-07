---
title: "AI Agent 的持续学习"
pubDatetime: 2026-04-06T10:00:00+08:00
description: "Harrison Chase 介绍 AI Agent 持续学习的三个层次：模型层、Harness 层和 Context 层，以及如何利用 Trace 驱动各层改进。"
slug: continual-learning-for-ai-agents-zh
originalTitle: "Continual Learning for AI Agents"
originalUrl: https://blog.langchain.com/continual-learning-for-ai-agents/
---

原文标题：Continual Learning for AI Agents<br>
原文链接：https://blog.langchain.com/continual-learning-for-ai-agents/

# AI Agent 的持续学习

![封面图](https://blog.langchain.com/content/images/2026/04/HFEylQUaIAAA88g.jpeg)

*作者：Harrison Chase*

关于 AI 持续学习的讨论大多聚焦于一件事：更新模型权重。但对于 AI Agent 而言，学习可以发生在三个不同的层次：**模型（Model）**、**Harness** 和 **Context**。理解它们之间的区别，会改变你对构建持续改进系统的思考方式。

## Agentic 系统的三个主要层次

- **Model（模型）：** 模型权重本身。
- **Harness：** 围绕模型的 Harness，驱动 Agent 的所有实例运行。具体指驱动 Agent 的代码，以及始终作为 Harness 一部分的指令和工具。
- **Context：** 存在于 Harness 之外的额外上下文（指令、Skills），可用于配置 Harness。

![Agentic 系统三层架构图](https://blog.langchain.com/content/images/2026/04/Screenshot-2026-04-04-at-8.22.30---AM.png)

### 应用示例

**示例 #1 - 编码 Agent（Claude Code）：**
- Model：claude-sonnet 等
- Harness：Claude Code
- 用户 Context：CLAUDE.md、/skills、mcp.json

**示例 #2 - OpenClaw：**
- Model：多种模型
- Harness：Pi + 其他脚手架
- Agent Context：SOUL.md、来自 clawhub 的 Skills

当我们谈论持续学习时，大多数人会立刻想到模型。但实际上，AI 系统可以在上述三个层次中的**每一个**层次上进行学习。

## 模型层的持续学习

当大多数人谈论持续学习时，最常指的就是：更新模型权重。

更新模型权重的技术包括 SFT、RL（如 GRPO）等。

这里的核心挑战是**灾难性遗忘（catastrophic forgetting）**——当模型在新数据或新任务上更新时，它往往会在之前已掌握的知识上出现退化。这仍然是一个开放的研究问题。

当人们为特定 Agentic 系统训练模型时（例如，你可以将 OpenAI 的 Codex 模型视为专门为其 Codex Agent 训练的），他们基本上是为整个 Agentic 系统进行训练。理论上你可以在更细粒度的层面做这件事（例如，为每个用户设置一个 LoRA），但实际上这大多是在 Agent 层面完成的。

## Harness 层的持续学习

如前所述，Harness 指的是驱动 Agent 的代码，以及始终作为 Harness 一部分的指令和工具。

随着 Harness 越来越流行，已有多篇论文讨论如何优化 Harness。

其中最近的一篇是 [**Meta-Harness: End-to-End Optimization of Model Harnesses**](https://yoonholee.com/meta-harness/)。

其核心思想是：Agent 在一个循环中运行。你先让它在一批任务上运行，然后评估结果。接着将所有日志存储到文件系统中。然后运行一个编码 Agent 来分析这些 Trace，并对 Harness 代码提出改进建议。

![Meta-Harness 优化流程图](https://blog.langchain.com/content/images/2026/04/Screenshot-2026-04-04-at-9.29.46---AM.png)

与模型层的持续学习类似，这通常在 Agent 层面完成。理论上你可以在更细粒度的层面做这件事（例如，为每个用户学习不同的代码 Harness）。

## Context 层的持续学习

"Context"存在于 Harness 之外，可用于配置 Harness。Context 包括指令、Skills，甚至工具。

同类型的 Context 也存在于 Harness 内部（例如，Harness 可能有基础系统提示词、Skills）。区别在于它是 Harness 的一部分还是配置的一部分。

### 在不同层级学习 Context

Context 的学习可以在多个不同层级进行。

Context 学习可以在 Agent 层级完成——Agent 拥有持久化的"记忆"，并随时间更新自身配置。一个很好的例子是 [OpenClaw](https://docs.openclaw.ai/concepts/soul)，它有自己的 SOUL.md，会随时间不断更新。

Context 学习更常见的是在租户层级（用户、组织、团队等）进行。在这种情况下，每个租户拥有自己的 Context，并随时间更新。示例包括：
- [Hex 的 Context Studio](https://hex.tech/product/context-studio/)
- [Decagon 的 Duet](https://decagon.ai/blog/introducing-duet)
- [Sierra 的 Explorer](https://sierra.ai/blog/explorer)

你也可以混合搭配！因此你可以让一个 Agent 同时拥有 Agent 级别的 Context 更新、用户级别的 Context 更新**以及**组织级别的 Context 更新。

### 更新方法

这些更新可以通过两种方式完成：

- **事后通过离线任务完成。** 与 Harness 更新类似——对近期的一批 Trace 进行分析以提取洞察，然后更新 Context。这就是 OpenClaw 所称的["Dreaming"](https://docs.openclaw.ai/concepts/memory-dreaming)。
- **在 Agent 运行的热路径中完成。** Agent 可以决定（或用户可以提示它）在执行核心任务的同时更新自己的记忆。

![Context 更新方式示意图](https://blog.langchain.com/content/images/2026/04/Screenshot-2026-04-04-at-9.28.14---AM.png)

这里还需要考虑另一个维度：记忆更新的显式程度。是用户主动提示 Agent 去记住，还是 Agent 基于 Harness 中的核心指令自行记忆？

## 对比

![三层持续学习对比图](https://blog.langchain.com/content/images/2026/04/e0f61fc1-9e93-4008-9042-c0551f05aeee.jpeg)

## Trace 是核心

上述所有流程都由 Trace 驱动——即 Agent 完整执行路径的记录。[LangSmith](https://docs.langchain.com/langsmith/home) 是一个（除其他功能外）帮助收集 Trace 的平台。

你可以用多种不同方式使用这些 Trace。

如果你想更新模型，可以收集 Trace，然后与 [Prime Intellect](https://www.primeintellect.ai/) 合作来训练自己的模型。

如果你想改进 Harness，可以使用 [LangSmith CLI](https://docs.langchain.com/langsmith/langsmith-cli) 和 [LangSmith Skills](https://github.com/langchain-ai/langsmith-skills) 让编码 Agent 访问这些 Trace。这种模式就是 [Deep Agents](https://github.com/langchain-ai/deepagents)（一个开源、模型无关的通用基础 Harness）在 Terminal Bench 上改进的方式。

如果你想随时间学习 Context（无论是在 Agent、用户还是组织层面），那么你的 Agent Harness 需要支持这一能力。Deep Agents 以生产就绪的方式支持这一功能。[文档](https://docs.langchain.com/oss/python/deepagents/memory)包含用户级记忆、后台学习等示例。

## 引用

- [Continual Learning for AI Agents - LangChain Blog](https://blog.langchain.com/continual-learning-for-ai-agents/)
- [LangSmith 平台](https://docs.langchain.com/langsmith/home)
- [Meta-Harness: End-to-End Optimization of Model Harnesses](https://yoonholee.com/meta-harness/)
- [Deep Agents GitHub](https://github.com/langchain-ai/deepagents)
