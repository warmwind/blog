---
title: "用 Agent Skills 弥合知识鸿沟"
pubDatetime: 2026-03-26T20:00:00+08:00
description: "Google Developers Blog《Closing the knowledge gap with agent skills》中文翻译（含原文引用）。探索如何通过 agent skills 这种轻量级方式弥合大语言模型的知识鸿沟，Gemini 3.1 Pro 的成功率从 28.2% 跃升至 96.6%。"
slug: closing-knowledge-gap-agent-skills-zh
originalTitle: "Closing the knowledge gap with agent skills"
originalUrl: https://developers.googleblog.com/closing-the-knowledge-gap-with-agent-skills/
---

> 原文标题：Closing the knowledge gap with agent skills
> 原文链接：https://developers.googleblog.com/closing-the-knowledge-gap-with-agent-skills/

# 用 Agent Skills 弥合知识鸿沟

![Gemini API Skills Banner](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_API_Skills_Banner_v2.original.png)

*作者：Philipp Schmid（开发者关系工程师）、Mark McDonald（开发者关系工程师）*

大语言模型（LLM）拥有固定的知识——它们是在某个特定时间点上训练出来的。而软件工程实践节奏极快、变化频繁，新的库每天都在发布，最佳实践也在快速演进。

这就留下了一道语言模型自身无法填补的**知识鸿沟**。在 Google DeepMind，我们在几个方面看到了这一问题：我们的模型在训练时并不了解自身，也不一定意识到最佳实践的细微变化（如 thought circulation）或 SDK 的更新。

已有许多解决方案——从网页搜索工具到专用 MCP 服务——但近期，**agent skills** 作为一种极其轻量但可能非常有效的方式浮现出来，用于弥合这一鸿沟。

虽然作为模型构建者，我们可以实施一些策略，但我们更想探索任何 SDK 维护者都能实现的方案。请继续阅读，了解我们如何构建 Gemini API 开发者 skill 以及它带来的性能提升。

## 我们构建了什么

为了帮助使用 Gemini API 进行开发的 coding agent，我们构建了一个 skill，它：

- 解释 API 的高层功能集
- 描述各语言当前可用的模型和 SDK
- 演示各 SDK 的基础示例代码
- 列出文档入口（作为信息源）

这是一组基础的原始指令，引导 agent 使用我们最新的模型和 SDK，但同样重要的是——它还引用了文档，鼓励 agent 从信息源获取最新内容。

该 skill 已在 [GitHub](https://github.com/google-gemini/gemini-skills/) 上发布，你也可以直接安装到项目中：

```shell
# 使用 Vercel skills 安装
npx skills add google-gemini/gemini-skills --skill gemini-api-dev --global

# 使用 Context7 skills 安装
npx ctx7 skills install /google-gemini/gemini-skills gemini-api-dev
```

## Skill 测试器

我们创建了一个包含 117 个 prompt 的评估工具（evaluation harness），这些 prompt 会生成使用 Gemini SDK 的 Python 或 TypeScript 代码，用于评估 skill 的性能表现。

这些 prompt 覆盖了不同类别的评估，包括 agentic coding 任务、聊天机器人构建、文档处理、流式内容生成，以及一系列特定的 SDK 功能。

我们在两种模式下运行了这些测试：一种是"原始模式"（直接提示模型），另一种是启用 skill 的模式。启用 skill 时，模型会获得与 Gemini CLI 相同的系统指令，以及两个工具：`activate_skill` 和 `fetch_url`（用于下载文档）。

如果一个 prompt 使用了我们的旧版 SDK，则视为失败。

## Skills 有效——但需要推理能力

顶层结果：

![Gemini API Skill 基准测试 - 按模型](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_API_Skill_Benchmark_-_Model.original.png)

- 最新的 Gemini 3 系列模型在添加 `gemini-api-dev` skill 后取得了优异成绩，尤其是从未启用 skill 时的低基线大幅提升（3.0 Pro 和 Flash 均为 6.8%，3.1 Pro 为 28%）。
- 较早的 2.5 系列模型也有所受益，但远不及新模型。**使用具有强推理能力的现代模型确实很重要。**

## 各评估类别表现均良好

对于表现最佳的模型（`gemini-3.1-pro-preview`），添加 skill 几乎在所有领域都很有效。

![Gemini API Skill 基准测试 - 按领域](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_API_Skill_Benchmark_-_Domain.original.png)

_SDK Usage_ 的通过率最低，为 95%。这没有一个突出的原因；失败的 prompt 涵盖了一系列任务，其中包括一些困难或不清晰的请求，但值得注意的是，它们包含了**明确请求使用 Gemini 2.0 模型**的 prompt。

以下是 _SDK Usage_ 类别中一个在所有模型上都失败的示例：

> 当我使用 Python API 和 gemini 2.0 flash 模型时，如果输出较长，返回的内容会变成一个输出块数组，而不是完整的一段。我猜它在做某种流式输入。如何关闭这个功能，一次性获取完整输出？

## Skill 的局限

这些初步结果相当令人鼓舞，但我们从 [Vercel 的研究](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)中了解到，通过 `AGENTS.md` 进行直接指令有时比使用 skills 更有效，因此我们也在探索其他方式来提供 SDK 的实时知识，例如直接使用 MCP 获取文档。

Skill 的简洁性是一个巨大优势，但目前没有很好的 skill 更新机制，除了要求用户手动更新之外。从长远来看，这可能导致旧的 skill 信息残留在用户的工作区中，弊大于利。

尽管存在这些小问题，我们仍然很期待在工作流中使用 skills。Gemini API skill 还比较新，但我们会在推送模型更新时持续维护它，也会探索不同的改进方向。关注 [Mark](https://x.com/m4rkmc) 和 [Phil](https://x.com/_philschmid) 以获取我们调优 skill 的最新动态，别忘了试用并给我们反馈！

---

## 引用

- 原文：[Closing the knowledge gap with agent skills](https://developers.googleblog.com/closing-the-knowledge-gap-with-agent-skills/) — Google Developers Blog
- [Gemini Skills GitHub 仓库](https://github.com/google-gemini/gemini-skills/)
- [Agent Skills](https://agentskills.io/)
- [Gemini API 文档](https://ai.google.dev/gemini-api/docs/thinking#signatures)
- [Vercel 博客：AGENTS.md 在 Agent 评估中优于 Skills](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals)
