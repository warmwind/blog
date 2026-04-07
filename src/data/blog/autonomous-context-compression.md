---
title: 自主式 Context Compression：上下文压缩实践
pubDatetime: 2026-03-14T01:00:00+08:00
description: LangChain 博客文章《Autonomous context compression》的中文翻译（含原文引用）。
slug: autonomous-context-compression
originalTitle: "Autonomous context compression"
originalUrl: https://blog.langchain.com/autonomous-context-compression/
---

原文标题：Autonomous context compression  <br>
原文链接：https://blog.langchain.com/autonomous-context-compression/

![](https://blog.langchain.com/content/images/2026/03/Screenshot-2026-03-06-at-3.40.34---PM.png)

阅读时长：4 分钟  
发布日期：2026 年 3 月 11 日

TL;DR：我们在 [Deep Agents SDK](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com)（Python）和 [CLI](https://docs.langchain.com/oss/python/deepagents/cli/overview?ref=blog.langchain.com) 中新增了一个工具，使模型能够在合适的时机压缩自己的上下文窗口。

## 动机

[上下文压缩](https://blog.langchain.com/context-management-for-deepagents/) 是一种减少智能体工作记忆中信息量的操作。较早的消息会被替换为摘要，或替换为对智能体进展的压缩表示，以保留与任务相关的信息。这个操作通常是必要的，因为上下文窗口是有限的，同时还能减少 [context rot](https://research.trychroma.com/context-rot?ref=blog.langchain.com)。

Agent harness 通常通过固定 token 阈值来控制压缩（deepagents 使用 [model profiles](https://docs.langchain.com/oss/python/langchain/models?ref=blog.langchain.com#model-profiles)，在任意模型上下文上限的 85% 时触发压缩）。这种设计并不理想，因为压缩有“好时机”和“坏时机”：

- 当你正处在复杂重构中途时，不适合压缩；
- 当你开始一个新任务，或判断先前上下文将失去相关性时，更适合压缩。

许多交互式编码工具都提供了 `/compact` 命令或类似能力，让用户在合适时机手动触发上下文压缩。我们在 deepagents 的最新版本中更进一步：向智能体暴露了一个工具，让它可以自行触发上下文压缩。这样无需应用用户了解上下文窗口的限制或输入特定命令，就能实现更机会主义的压缩。

这个工具目前在 [Deep Agents CLI](https://docs.langchain.com/oss/python/deepagents/cli/overview?ref=blog.langchain.com) 中默认启用，在 deepagents SDK 中为可选启用。

我们普遍看好这样一种思路：在可能的情况下，harness 应该“少干预”，并利用底层推理模型的进步。这是 [the bitter lesson](http://www.incompleteideas.net/IncIdeas/BitterLesson.html?ref=blog.langchain.com) 的一个实例：我们能否给智能体更多对自身上下文的控制权，从而避免手工调优 harness？

## 我们应该在什么时候压缩？

有多种情况可能值得执行上下文压缩。

在清晰的任务边界上：

- 用户表示要切换到一个新任务，而早先上下文大概率不再相关；
- 智能体完成了一个交付物，且用户确认任务完成。

在从大量上下文中提取结果之后：

- 智能体通过消费大量上下文获得了事实、结论、摘要或其他结果（例如研究任务）。

在即将消费大量新上下文之前：

- 智能体即将生成一篇长草稿；
- 智能体即将读取大量新上下文。

在进入复杂多步骤流程之前：

- 智能体即将开始一次长时间重构、迁移、多文件编辑或事故响应；
- 智能体已经产出了计划，并即将开始执行步骤。

当已经做出会覆盖先前上下文的决策时：

- 出现了使先前上下文失效的新需求；
- 存在大量支线或死胡同，可以收敛为摘要。

穷举所有可能场景并不现实，但我们的观察是：人和 LLM 都能识别这些场景，并在合适时机压缩，从而避免在上下文窗口接近上限时再进行压缩。你可以在其 [system prompt](https://github.com/langchain-ai/deepagents/blob/537ed6cf153f9f6e50546c9d8674c32587540942/libs/deepagents/deepagents/middleware/summarization.py?ref=blog.langchain.com#L91) 中查看我们为这个工具提供给模型的指引。

## 调用该工具时会发生什么？

该工具的参数化方式与现有 Deep Agents [summarization middleware](https://docs.langchain.com/oss/python/deepagents/harness?ref=blog.langchain.com#summarization) 相同：我们会保留最近消息（可用上下文的 10%），并对更早的内容做摘要。最近消息（包括对压缩工具的调用及相应响应）会保留在最近上下文中。

参见 [示例 trace](https://smith.langchain.com/public/0ff5b066-7377-4922-9269-927e29bd4aba/r?ref=blog.langchain.com)。

![](https://blog.langchain.com/content/images/2026/03/image-3.png)

## 如何使用

该工具以独立 middleware 的形式实现，因此你可以通过将它加入 `create_deep_agent` 的 middleware 列表来启用：

```python
from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.middleware.summarization import (
    create_summarization_tool_middleware,
)

backend = StateBackend  # if using default backend

model = "openai:gpt-5.4"
agent = create_deep_agent(
    model=model,
    middleware=[
        create_summarization_tool_middleware(model, backend),
    ],
)
```

更多细节见 SDK [文档](https://www.notion.so/271808527b178055914cc7e4fdd77897?pvs=21&ref=blog.langchain.com)。

在 CLI 中，当你准备好裁剪上下文或切换到新任务时，直接调用 `/compact`。

## 我们使用这一功能的经验

我们将这个功能调得比较保守。Deep Agents 在其虚拟文件系统中 [保留完整会话历史](https://docs.langchain.com/oss/python/deepagents/harness?ref=blog.langchain.com#summarization)，因此在摘要后仍可恢复上下文，但错误的上下文压缩步骤会造成干扰。我们测试了：

- 自定义评测套件：我们使用（我们自己的）[LangSmith traces](https://docs.langchain.com/langsmith/observability?ref=blog.langchain.com)，向适合压缩和不适合压缩的线程注入后续提示；
- Terminal-bench-2：我们没有观察到任何自主压缩实例；
- 我们自己在 [Deep Agents CLI](https://docs.langchain.com/oss/python/deepagents/cli/overview?ref=blog.langchain.com) 中的编码任务。

在实践中，智能体触发压缩总体上较为保守；但一旦触发，往往会选择那些明显能改善工作流的时机。

自主上下文压缩是一个小功能，但它指向了智能体设计中的更广泛方向：让模型对自身工作记忆有更多控制权，减少 harness 中僵硬、手工调优的规则。如果你在构建长时运行或交互式智能体，可以在 Deep Agents SDK 或 CLI 中尝试它，并告诉我们你的反馈，以及你希望它下一步支持哪些模式。

## 引用

- 原文：Autonomous context compression  
  https://blog.langchain.com/autonomous-context-compression/
- Deep Agents SDK 文档：  
  https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com
- Deep Agents CLI 文档：  
  https://docs.langchain.com/oss/python/deepagents/cli/overview?ref=blog.langchain.com
