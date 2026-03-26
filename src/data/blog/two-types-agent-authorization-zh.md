---
title: "两种不同的 Agent 授权类型（中文翻译）"
pubDatetime: 2026-03-26T20:00:00+08:00
description: "LangChain Blog 文章《Two different types of agent authorization》中文翻译（含原文引用）。"
slug: two-types-agent-authorization-zh
---

> 原文标题：Two different types of agent authorization
> 原文链接：https://blog.langchain.com/two-different-types-of-agent-authorization/

# 两种不同的 Agent 授权类型

上周我们发布了 [LangSmith Fleet](https://blog.langchain.com/introducing-langsmith-fleet/)，作为构建、使用和管理 agent 的方式。此次发布的一个关键部分是引入了两种不同的 agent 授权类型。

Agent 授权指的是 agent 被授权做什么。当一个 agent 调用 Slack 工具时——它以谁的身份进行认证来拉取数据？

![Agent 授权类型](https://blog.langchain.com/content/images/2026/03/Fleet-agent-identity.png)

## 代表用户操作（On-behalf-of）

大多数人直到最近对 agent 的标准理解是：它们"代表"用户操作。

让我们想象一个拥有 Notion 和 Rippling 访问权限的入职引导 agent。当 Alice 与它交互时，它应该能在 Rippling 中查找 Alice 的信息，并查看 Alice 有权访问的所有 Notion 页面。Alice 不应该能用这个入职 agent 查看 Bob 在 Rippling 中的任何私人信息，也看不到 Bob 可能拥有的任何私人 Notion 页面。当 Bob 使用这个入职 agent 时，他应该能访问自己在 Rippling 中的所有信息和 Notion 中的所有私人页面，但不能访问 Alice 的。

为了实现这一点，你需要几样东西。你需要一种方式来知道谁在使用 agent——是 Alice 还是 Bob？然后你需要将这些用户 ID 映射到在运行时传递给工具的某些认证凭据。

## 然后 OpenClaw 出现了

"代表用户操作"一直是人们对 agent 的主要理解方式，直到 OpenClaw 的出现。在 OpenClaw 中，Alice 会创建一个 agent。也许她是唯一使用该 agent 的人（在这种情况下，这种授权区分不太重要）。但也许她会通过不同的渠道（如短信、邮件或 Twitter）将其暴露给其他人。

当其他人与该 agent 交互时，它不使用终端用户的凭据——而是使用 Alice 赋予它的授权。

有时这可能是 Alice 自己的凭据，但这可能并不理想。如果 agent 拥有 Alice 的凭据，它就能查找 Alice 有权访问的 Notion 中的任何内容。这可能包括她不希望其他人能够通过 agent 询问的私人文档。

这导致人们在 Notion、Rippling 等平台中专门为该 agent 创建专用账户，以便控制该 agent 能访问什么。与该 agent 交互的每个人实际上都在使用同一组凭据。

## LangSmith Fleet

在发布 LangSmith Fleet 时，我们看到人们想要这两种类型的 agent。有时他们想创建一个 agent 并让其他人用他们自己的凭据使用它，有时他们希望该 agent 拥有自己固定的凭据集。我们添加了两种不同类型的 agent，对应这两种授权类型：

- **Assistants**：代表终端用户操作
- **Claws**：拥有自己的固定凭据

我们还添加了渠道概念（首批支持 Slack、Gmail、Outlook 和 Teams）以及 agent 共享功能。Assistants 和 Claws 支持不同的渠道。为了让 Assistants 可共享，我们必须有一个从该渠道中的终端用户（例如他们的 Slack 用户 ID）到其 LangSmith ID 的映射。因此目前 Assistants 仅在我们支持该映射的渠道子集中可用。

渠道和这些不同的授权类型也凸显了人工审核（human-in-the-loop）的需求。如果你正在创建一个拥有固定凭据集的 agent，并通过渠道暴露它，你就是在将它开放给各种使用方式。如果该 agent 可以执行潜在危险或敏感的操作，你可能希望使用一些人工审核保障来确保这些操作受到把控。

## 示例

为了更具体，让我们看看我们创建的几个真实 agent 及其授权类型。

**入职引导 Agent**：Assistant 类型。拥有 Slack 和 Notion 的访问权限，在 Slack 中暴露。使用终端用户的 Slack 和 Notion 凭据。

**邮件 Agent**：Claw 类型。该 agent 响应收到的邮件。无论是谁发来的邮件，该 agent 都会查看我的日历以确定会议可用性，并尝试代我回复。发送邮件和日历邀请受人工审核保障约束。

**产品 Agent**：Claw 类型。该 agent 监控竞争对手并协助处理产品问题和路线图。它拥有自己的 Notion 账户，并通过自定义 Slack 机器人暴露。

## 未来工作

我们很高兴在 LangSmith Fleet 中推出这两种不同的 agent 类型。然而我们认为这只是 agent 授权的开始。关于一些潜在的未来方向，可以阅读 [WorkOS 的这篇关于 agent 授权的博客](https://workos.com/blog/agents-need-authorization-not-just-authentication)。

我们也很期待在此基础上推出更细粒度的记忆权限。根据 agent 类型（Assistants 或 Claws）的不同，你可能希望记忆的处理方式有所不同。例如，你可能不希望一个 assistant 记住关于 Alice 的敏感信息，然后在与 Bob 的对话中使用。目前，我们通过访问权限来管理这一点。当你共享一个 agent 时，你可以选择其他用户是否能编辑它，包括它的记忆。未来，我们将引入用户特定的记忆功能。

---

## 引用

- 原文：[Two different types of agent authorization](https://blog.langchain.com/two-different-types-of-agent-authorization/) — LangChain Blog，2026 年 3 月 23 日
- [Introducing LangSmith Fleet](https://blog.langchain.com/introducing-langsmith-fleet/)
- [Agents need authorization, not just authentication](https://workos.com/blog/agents-need-authorization-not-just-authentication) — WorkOS Blog
