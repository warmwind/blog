---
title: "Middleware 如何让你自定义 Agent Harness"
pubDatetime: 2026-03-30T20:00:00+08:00
description: "LangChain Blog 文章《How Middleware Lets You Customize Your Agent Harness》中文翻译（含原文引用）。"
slug: how-middleware-lets-you-customize-your-agent-harness-zh
originalTitle: "How Middleware Lets You Customize Your Agent Harness"
originalUrl: https://blog.langchain.com/how-middleware-lets-you-customize-your-agent-harness/
---

原文标题：How Middleware Lets You Customize Your Agent Harness<br>
原文链接：https://blog.langchain.com/how-middleware-lets-you-customize-your-agent-harness/

# Middleware 如何让你自定义 Agent Harness

**作者：** Sydney Runkle
**发布日期：** 2026 年 3 月 26 日
**阅读时间：** 5 分钟

![Hero Image](https://blog.langchain.com/content/images/size/w760/format/webp/2026/03/30.png)

---

## 引言

Agent harness 将语言模型连接到其环境中，使其能够执行实际操作。在构建特定应用解决方案时，"Agent Middleware"允许开发者在扩展 LangChain 和 Deep Agent 框架的同时，保持针对特定用例的自定义能力。

## 什么是 Agent Harness？

Agent 代表一个围绕模型组织的系统，需要连接到环境、数据源、记忆系统和工具。Agent harness 就是促成这些连接的组件。

其基础结构很直接："一个 LLM，在循环中运行，调用工具。"LangChain 的 `create_agent` 提供了这一核心抽象。

![Agent Loop Diagram](https://blog.langchain.com/content/images/2026/03/agent_loop.png)

## 为什么要自定义 Agent Harness？

不同的应用需要不同的方法。虽然基本自定义——如系统提示词和工具选择——可以直接集成到 `create_agent` 中，但修改核心执行循环需要更深层的架构变更。

Middleware 解决了需要"在模型执行前始终运行某个步骤"或"始终检查工具输出中的某些内容"的场景。

## 什么是 Agent Middleware？

Middleware 暴露了一系列 hook，使你能在每个执行阶段前后运行自定义逻辑：

![Middleware Diagram](https://blog.langchain.com/content/images/2026/03/middleware.png)

**可用的 Hook：**

- **`before_agent`**：在调用时执行一次，用于加载记忆、连接资源或验证输入
- **`before_model`**：在每次模型调用前触发，用于裁剪历史或防止 PII 泄露
- **`wrap_model_call`**：包裹端到端的模型执行过程，用于缓存、重试和动态工具管理
- **`wrap_tool_call`**：包裹工具执行过程，用于注入上下文、拦截结果或进行工具门控
- **`after_model`**：在模型响应后、工具执行前运行——适用于 human-in-the-loop 工作流
- **`after_agent`**：在完成时执行一次，用于持久化结果、发送通知或清理资源

Middleware 组件可以灵活组合，允许策略性地搭配使用。LangChain 为常见模式提供了预构建的 middleware，同时开发者可以通过继承 `AgentMiddleware` 来实现自定义。

## Middleware 示例

### 业务逻辑与合规

像 PII 脱敏这样的确定性策略不能仅依赖于提示词。**PIIMiddleware** 实现了 `before_model` 和 `after_model` hook，在模型输入、输出和工具响应中对敏感信息进行掩码、删除或哈希处理。

### 动态 Agent 控制

运行时重塑能力包括基于状态注入工具、在任务中途切换模型以及更新提示词。**LLMToolSelectorMiddleware** 在 `wrap_model_call` 中运行一个快速语言模型，从注册表中识别相关工具，减少上下文开销。

### 上下文管理

**SummarizationMiddleware** 实现了 `before_model` hook，当对话历史超过 token 阈值时进行摘要。扩展变体使用 `wrap_tool_call` hook 将冗长的工具交互卸载到文件系统存储中。

### 生产就绪

**ModelRetryMiddleware** 实现了 `wrap_model_call` hook，用重试处理器包裹 API 调用，支持配置重试次数、退避因子和初始延迟，用于处理速率限制问题。

### 工具集

**ShellToolMiddleware** 实现了 `before_agent` 和 `after_agent` hook，在 agent 循环周围初始化和销毁 shell 资源，同时注册 shell 工具供模型使用。

## Deep Agents 案例研究

Deep Agents 是一个完全构建在 `create_agent` 之上的综合 agent harness，具有一套有主见的 middleware 栈。关键组件包括：

- `FilesystemMiddleware`：基于文件的上下文管理和长期记忆
- `SubagentMiddleware`：上下文隔离的子 agent
- `SummarizationMiddleware`：长时间运行任务的溢出管理
- `SkillsMiddleware`：渐进式能力披露

可以在 Deep Agents 之上叠加额外的 middleware 以进一步自定义。

## 为什么 Agent Middleware 很重要

随着模型的进步，某些 middleware 功能——摘要、工具选择、输出裁剪——最终可能会集成到模型本身中。然而，基本的自定义需求仍然存在：确定性策略执行、生产环境护栏和业务特定逻辑仍然属于 harness 层。

自 LangChain v1 以来，middleware 使团队能够专业化分工、将业务逻辑与核心代码解耦，并促进组织级别的逻辑复用。

## 开始使用

**基础方式：** 使用 [`create_agent`](https://docs.langchain.com/oss/python/langchain/agents) 尝试 middleware

**健壮的基础：** 使用 [`create_deep_agent`](https://docs.langchain.com/oss/python/deepagents/quickstart) 尝试 middleware

**自定义开发：** [贡献指南](https://docs.langchain.com/oss/python/integrations/middleware)

---

## 引用

- 原文：[How Middleware Lets You Customize Your Agent Harness](https://blog.langchain.com/how-middleware-lets-you-customize-your-agent-harness/) — LangChain Blog, Sydney Runkle, 2026-03-26
- [LangChain create_agent 文档](https://docs.langchain.com/oss/python/langchain/agents)
- [Deep Agents 快速入门](https://docs.langchain.com/oss/python/deepagents/quickstart)
- [Middleware 贡献指南](https://docs.langchain.com/oss/python/integrations/middleware)
