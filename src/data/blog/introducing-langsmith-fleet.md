---
title: 介绍 LangSmith Fleet：面向企业的 Agent 管理工作台
pubDatetime: 2026-03-20T00:49:42+08:00
description: LangChain 博客文章《Introducing LangSmith Fleet》的中文翻译（含原文引用）。
slug: introducing-langsmith-fleet
originalTitle: "Introducing LangSmith Fleet"
originalUrl: https://blog.langchain.com/introducing-langsmith-fleet/
---

> 原文标题：Introducing LangSmith Fleet  
> 原文链接：https://blog.langchain.com/introducing-langsmith-fleet/

![](https://blog.langchain.com/content/images/2026/03/Introducing-Fleet-2.png)

今天，我们发布 LangSmith Fleet——一个面向企业的工作台，用于创建、使用和管理你的整支 agent fleet。这些 agent 拥有自己的记忆，能够访问一组工具和 skills，并且可以接入你的团队每天使用的通信渠道。

LangSmith Fleet（此前名为 LangSmith Agent Builder）的一个关键部分，是它的 agent identity 与 agent sharing 模型。凭证模型控制 agent 以谁的身份执行操作；权限模型则让你控制工作台中每个 agent 可以被谁使用、编辑和分享。

[试用 Fleet](https://smith.langchain.com/agents?skipOnboarding=true&ref=blog.langchain.com)

## 从“构建 agent”到“管理你的 agent fleet”

就在六个月前，构建一个 agent 还必须依赖工程师。今天，你团队中的任何人都可以用一段简短提示描述任务，然后生成一个 agent 来处理这项工作。演进速度就是这么快。

我们在 10 月推出 Agent Builder，是为了让知识工作者能够用自然语言创建自己的 agent。此后，我们持续看到同一种模式：团队先从一两个用于简单任务（如调研或状态检查）的 agent 开始；随后使用场景不断扩展，他们开始让更多 agent 处理更多任务。这让人们能够把大量吞噬日常时间的重复性工作交给 agent，从而把精力集中到真正需要人类判断的部分。

当 agent 变得如此容易创建时，难点就转向了管理：谁拥有哪些 agent、它们如何跨工具完成身份认证、谁能审计它们的行为，以及如何在组织内安全地共享一个优秀的 agent。

这正是 LangSmith Fleet 要解决的问题。

- 用简单提示创建 agent
- 通过共享机制让中心化团队发布 agent，团队成员也能彼此分享
- 通过权限控制谁可以编辑、运行或克隆每个 agent
- 通过 agent identity 与 credentials 定义 agent 如何接入公司工具完成认证
- 通过 Inbox 让用户跟踪 agent 活动，并在人类介入的环节中批准操作
- 通过 observability 提供可审计记录，说明每个 agent 做了什么，以及为什么这么做

## 分层权限与共享

一个好的 agent 对整个团队都有价值。一个供应商录入 agent 可以服务运营团队；一个周报 agent 可以在周一早晨为每位客户经理节省三十分钟。但想把 agent 在企业内部共享出去，就必须控制：谁能修改它、谁能使用它，以及谁能拿到自己的副本再去做个性化定制。现在，Fleet 允许你为每个创建出来的 agent 配置这些能力。

Agent 共享有两个维度：谁可以访问，以及他们可以做什么。

谁：可以共享给单个用户，也可以共享给整个工作台。  
什么：有三种权限级别：

- Can clone：将该 agent 克隆成自己的版本并做定制
- Can run：使用该 agent，但不能修改其配置
- Can edit：拥有完整权限，可修改指令、工具和设置

你可以按需叠加这些权限。比如给核心团队 edit 权限，同时把 run-only 共享给更广泛的工作台成员。权限可以随时调整或撤销。

![](https://blog.langchain.com/content/images/2026/03/sharing-3.png)

## Agent identity 与 credentials

当多个人运行同一个 agent 时，它需要一种安全方式来与外部工具完成认证。有时，每个用户都应该分别完成认证；有时，共享服务账号更合理。现在这两种方式你都可以使用，并且可以针对每个 agent 单独配置。

“Claws” 无论由谁运行，都使用一组固定凭证。用户不需要为每个工具逐一登录。这一直是 Fleet 中的默认方式，适合例如 Linear Slack bot 这种场景：整个团队都用同一套凭证来搜索和创建 issue。

“Assistant” agents 则代表调用它的用户执行操作。每个用户都会为每个需要凭证的已连接工具，使用 Fleet 中的 OAuth 以自己的账号完成认证。agent 的行为范围受该用户自身权限约束。这适合例如 Notion 团队知识库之类的场景，因为不同用户对文档的访问权限并不相同。

![](https://blog.langchain.com/content/images/2026/03/agent-identity.png)

## 面向 Slack bots 的 agent identity

Fleet agents 已经可以响应 Slack 中的消息。借助 agent identity，现在每个 agent 还可以拥有自己的 Slack bot。

不再需要把所有内容都路由到同一个 Slack bot；现在，每个 agent 都可以通过自己定义的名称被触发。你可以为每项工作创建一个 bot，并赋予它一个 Slack handle：@vendor-intake、@weekly-sales-numbers、@onboarding-agent。你的团队可以在频道中 @mention 一个 agent，或者直接在私信里把任务交给它，而不需要切换上下文。

Agent identity 会与 permissions 和 credentials 协同工作。拥有自己 Slack bot 的 “Claw” 可以作为团队共享资源运作；而 “Assistant” agent 只对那些已为其工具完成认证的用户可用。

未来几周，我们会把同样的 agent identity 原则扩展到更多渠道中。

![](https://blog.langchain.com/content/images/2026/03/slackbot.png)

## Agent Inbox

当你的组织里有多个 agent 并行处理任务时，你需要一个统一位置来查看正在发生什么，并对此采取行动。Inbox 为你的所有 agent 提供 human-in-the-loop 的监督能力：你可以在一个中心位置查看、批准或拒绝所有 agent 的操作，而无需在多个标签页之间切换。它同时适用于 “Assistants” 和 “Claws”，具体取决于相应权限设置。

对于 “Claws”，只有拥有 edit 权限的用户才能在 Inbox 中查看 agent 操作。他们可以查看并回应每个 thread。这适合 IT 管理员跟踪 agent 活动，或团队负责人审查 agent 创建的 issue，并在操作发出前完成批准。

对于 “Assistants”，每个用户的操作都会保留在该用户自己的 Inbox 中，不会与他人混在一起。这正适合处理敏感个人任务的 agent，例如读取 Notion 中的私人文档。

![](https://blog.langchain.com/content/images/2026/03/inbox.png)

## Agent observability

LangSmith 已经为 Fleet 中每一个 agent 操作提供原生 tracing。每一次工具调用、每一次决策、每一份输出，都会被记录在结构化 trace 中，供你检查、搜索和导出。

对于企业而言，这就是审计轨迹。你可以准确看到某个 agent 做了什么、它为什么做出每个决策，以及它访问了哪些数据。这同时适用于你以代码构建的 agent，以及用 Fleet 创建出来的 agent。

当 tracing 与 agent identity 和 permissions 结合使用时，你就能得到一幅完整图景：是哪个 agent 在行动、它代表谁行动、使用了什么凭证，以及它在每一步具体做了什么。

## 从一个 agent 到一支企业级 fleet

大多数团队走的都是同一条路径：先由一个人构建出一个好用的 agent，然后一位同事试用它，接着整个团队开始在日常工作中运行 agent。Fleet 正是为这一过程而构建：它让你能够在组织中共享 agent，并看清它们的行为。

我们正在持续扩展 Fleet，未来几周还会在 agent sharing、identity，以及安全自治工作方面带来更多能力。

[试用 Fleet](https://smith.langchain.com/agents?skipOnboarding=true&ref=blog.langchain.com)

## 引用

- [Introducing LangSmith Fleet](https://blog.langchain.com/introducing-langsmith-fleet/)
