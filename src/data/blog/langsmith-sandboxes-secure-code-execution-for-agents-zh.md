---
title: "LangSmith Sandboxes：为 Agents 提供安全代码执行"
pubDatetime: 2026-03-19T10:05:00+08:00
description: "LangChain 博客《Introducing LangSmith Sandboxes: Secure Code Execution for Agents》中文翻译（含原文引用）。"
slug: langsmith-sandboxes-secure-code-execution-for-agents-zh
originalTitle: "Introducing LangSmith Sandboxes: Secure Code Execution for Agents"
originalUrl: https://blog.langchain.com/introducing-langsmith-sandboxes-secure-code-execution-for-agents/
---

> 原文标题：Introducing LangSmith Sandboxes: Secure Code Execution for Agents  
> 原文链接：https://blog.langchain.com/introducing-langsmith-sandboxes-secure-code-execution-for-agents/

# LangSmith Sandboxes：为 Agents 提供安全代码执行

![](https://blog.langchain.com/content/images/2026/03/LangSmith-Sandboxes.png)

通过 LangSmith SDK，只需一行代码就能启动一个 sandbox。现已开放 Private Preview。

阅读时长：3 分钟  
发布时间：2026 年 3 月 17 日

今天，我们发布 LangSmith Sandboxes Private Preview：这是一套用于运行不受信任代码的安全、可扩展环境。

当 agent 能执行代码时，它们会变得有用得多。它们可以分析数据、调用 API，并从零构建应用。但如果让 LLM 在没有与你基础设施隔离的情况下运行任意代码，风险很高。Sandboxes 提供短暂存在、被锁定的环境，让 agent 能安全运行代码，同时你还能控制它们可以访问什么，以及它们可以消耗多少资源。

借助 LangSmith Sandboxes，你可以通过 LangSmith SDK 用一行代码启动一个 sandbox。添加你的 API key，引入 SDK，就可以开始。

我们已经在内部使用 Sandboxes 为 [Open SWE](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com) 等项目提供支持，现在我们把同样的基础能力开放出来，供你构建自己的系统。

[加入候补名单](https://www.langchain.com/langsmith-sandboxes-waitlist?ref=blog.langchain.com)

## 为什么需要 Sandboxes？

像 Cursor、Claude Code 和 OpenClaw 这样的 coding agent，已经展示了给 agent 提供编写和运行代码能力有多实用。但如果没有隔离，agent 就可能在你的本地环境中执行[破坏性或恶意操作](https://www.clawsecure.ai/blog/41-percent-openclaw-skills-vulnerabilities?ref=blog.langchain.com)。

传统容器的设计目标，是运行已知、经过审查的应用代码。agent 生成的代码不同：它不受信任，也不可预测。Web server 处理的是一组已知操作；而 agent 可能会尝试任何事情，包括恶意命令。

如果你要自己构建安全的代码执行环境，通常意味着要启动容器、锁定网络访问、把输出回传给 agent，并在完成后全部清理掉。然后你还要处理资源限制，因为会运行代码的 agent 一旦不受约束，就可能迅速吃掉 CPU、内存和磁盘。随着越来越多的 agent 变成 coding agent，这个问题只会愈发严重。

以下是几个需要这类能力的工作负载示例：

- 一个 coding assistant，它会在响应前先运行并验证自己的输出
- 一个类似 CI 的 agent，它会 clone 仓库、安装依赖、运行测试套件，然后再开 PR（例如 [Open SWE](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com)）
- 一个数据分析 agent，它会对数据集执行 Python 脚本并返回结果

## LangSmith Platform 的一部分

LangSmith Sandboxes 使用与 LangSmith 其余部分相同的 SDK 和基础设施。如果你已经在使用 Python 或 JavaScript client 做 tracing 或 deployment，那么无需额外增加新组件，就可以启动 sandboxes。

Sandboxes 还可直接与 LangSmith Deployment 集成，因此你可以把 sandbox 绑定到 agent thread 上。它们也原生集成了 LangChain 的开源框架 [Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com)，以及 [Open SWE](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com)。

## 当前已发布的能力

### Runtime Configuration

- **自带 Docker image。** 使用我们的默认镜像，或指向你自己的私有 registry。让每个 sandbox 从一开始就拥有你需要的文件系统和工具链。
- **Sandbox Templates。** 一次性定义 image、CPU 和内存配置，之后每次启动 sandbox 都可复用。结合 BYOD image，可以构建完全自定义的环境。
- **共享访问。** 让多个 agents 访问同一个 sandbox，这样你无需在隔离环境之间传递 artifact。
- **池化与自动扩缩容。** 预先准备一组 warm sandboxes，避免 agent 遇到 cold start。随着需求增长，额外的 sandboxes 会自动启动。

### Execution

- **长时运行会话。** 即便 agent 任务持续数分钟或数小时，也不会超时。Sandboxes 通过 WebSockets 支持持久命令，并提供实时输出流，让你能看到运行过程。
- **跨交互保留持久状态。** 你的 agent 可以在多个 threads 之间复用同一个 sandbox，而不会丢失上下文。文件、已安装包和环境状态都能在多次运行之间保留。
- **Tunnels。** 将 sandbox 端口暴露到你的本地机器上，这样你可以在部署前预览 agent 的输出。

### SDK 与集成

- **框架无关。** 你可以将 LangSmith Sandboxes 与 LangChain OSS、其他框架，或者完全不使用框架的方案搭配使用。
- **Python 与 JavaScript SDKs。** LangSmith SDK 在这两种语言里都提供一等支持的 client。
- **[Deep Agents](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com) 集成。** 只需最少配置，就能把 sandboxes 直接接入 agentic workflows。

### Security

- **Auth Proxy。** Sandboxes 通过 Authentication Proxy 访问外部服务，因此 secrets 永远不会进入 runtime，凭证完全不会落到 sandbox 内。
- **MicroVM 隔离。** 每个 sandbox 都运行在硬件虚拟化的 microVM 中，而不仅仅是 Linux namespaces。不同 sandboxes 之间具有内核级隔离。

## 接下来会发布什么

除了今天已经发布的内容，我们还在积极推进 Sandboxes 的更多能力。当前重点探索的方向包括：

- **共享卷。** 让 agents 能在多个 sandboxes 之间共享状态。Agent 1 写入一个 volume，Agent 2 接着它的进度继续工作。
- **二进制授权。** 控制 sandbox 内部哪些二进制可以运行。agent 容易出现意料之外的行为，例如安装软件包、导出凭证，或在非预期任务上消耗算力。Binary authorization 可以像管理企业笔记本那样限制执行范围，包括哪些程序能运行、哪些域名可访问、哪些网络调用被允许。
- **完整执行追踪。** 目前，sandbox 调用会和你的 agent 运行一起被 tracing。我们正在推进对虚拟机内所有活动的追踪，包括每个进程和每次网络调用。这同时也可作为审计日志，为你提供 sandbox 做了什么、何时执行的完整记录。

我们很希望了解，对于你的工作流来说，哪些能力最重要。欢迎加入我们的 [Slack 社区](https://www.langchain.com/join-community?ref=blog.langchain.com) 分享想法。

## 开始使用

LangSmith Sandboxes 现在已通过 Private Preview 提供。如果你正在构建需要安全代码执行的 agents，可以注册并试用。

[加入候补名单](https://www.langchain.com/langsmith-sandboxes-waitlist?ref=blog.langchain.com)

## 引用

- [Introducing LangSmith Sandboxes: Secure Code Execution for Agents](https://blog.langchain.com/introducing-langsmith-sandboxes-secure-code-execution-for-agents/)
- [Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview?ref=blog.langchain.com)
- [Open SWE](https://github.com/langchain-ai/open-swe?ref=blog.langchain.com)
