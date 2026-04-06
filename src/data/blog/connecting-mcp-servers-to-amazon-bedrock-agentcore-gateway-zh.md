---
title: Connecting MCP Servers to Amazon Bedrock AgentCore Gateway Using Authorization Code Flow
pubDatetime: 2026-04-06T12:00:00+08:00
description: AWS 博客文章《Connecting MCP Servers to Amazon Bedrock AgentCore Gateway Using Authorization Code Flow》的中文翻译
slug: connecting-mcp-servers-to-amazon-bedrock-agentcore-gateway-zh
originalTitle: Connecting MCP Servers to Amazon Bedrock AgentCore Gateway Using Authorization Code Flow
originalUrl: https://aws.amazon.com/blogs/machine-learning/connecting-mcp-servers-to-amazon-bedrock-agentcore-gateway-using-authorization-code-flow/
---

> **原文标题**: Connecting MCP Servers to Amazon Bedrock AgentCore Gateway Using Authorization Code Flow  
> **原文链接**: https://aws.amazon.com/blogs/machine-learning/connecting-mcp-servers-to-amazon-bedrock-agentcore-gateway-using-authorization-code-flow/

## 使用 AgentCore Gateway 作为 MCP 服务器端点

Amazon Bedrock AgentCore Gateway 为管理 AI Agent 如何连接到整个组织的工具和 MCP 服务器提供了一个集中层。它将身份验证、可观测性和策略执行整合到单个端点中，无需单独配置和保护每个 MCP 服务器连接。

在这篇文章中，我们演示了如何配置 AgentCore Gateway 以使用授权代码流连接到受 OAuth 保护的 MCP 服务器。

随着组织扩展其 AI Agent 部署，每个团队依赖的 MCP 服务器数量增长迅速。开发人员正在采用 Amazon Bedrock AgentCore Gateway 作为访问多个 MCP 服务器的单个端点。团队不再需要为每个 IDE 单独配置每个 MCP 服务器，而是指向一个 Gateway URL 以实现对其整个 MCP 工具集的一致访问。

随着团队超越定制 MCP 服务器并采用生产级第三方服务器（如来自 AWS、GitHub、Salesforce 和 Databricks 的服务器），这种模式正在加速发展。许多这些 MCP 服务器通过联合受其主要身份提供程序保护，而其他则由其自己的授权服务器保护。随着每个组织的 MCP 服务器数量增长，在 IDE 级别管理连接、身份验证和路由变得不可行。AgentCore Gateway 集中管理这种复杂性，为团队提供 MCP 访问的单个控制平面，同时为开发人员提供无摩擦的体验。

## 概述

许多企业 MCP 服务器需要 OAuth 2.0 授权，其中 Agent 必须代表用户进行身份验证，然后才能调用工具。AgentCore Gateway 现在通过 Amazon Bedrock AgentCore Identity 支持 OAuth 2.0 授权代码流。有了这个，您的 Agent 可以安全地访问受保护的 MCP 服务器，而无需在应用程序代码中嵌入凭据或手动管理令牌生命周期。

## 关键术语

## 授权代码流工作原理

为了支持授权代码授予类型，我们为目标创建提供两种方式。

### 方法一：隐式同步（在目标创建期间）

在此方法中，管理员用户在 CreateGatewayTarget、UpdateGatewayTarget 或 SynchronizeGatewayTargets 操作期间完成授权代码流。这允许 AgentCore Gateway 提前发现并缓存 MCP 服务器的工具。

### 方法二：预先提供工具模式

使用此方法，管理员用户在 CreateGatewayTarget 或 UpdateGatewayTarget 操作期间直接提供工具模式，而不是让 AgentCore Gateway 从 MCP 服务器动态获取它们。AgentCore Gateway 解析提供的模式并缓存工具定义。当人类干预在创建/更新操作期间不可能时，这是推荐的方法。当您不想暴露 MCP 服务器目标提供的所有工具时，此方法很有益。

**注意**：因为此方法预先提供工具模式，所以不支持 SynchronizeGatewayTargets 操作。您可以通过更新目标配置在方法 1 和方法 2 之间切换目标。

这意味着 AgentCore Gateway 用户可以调用 list/tools，而不会被提示向 MCP 服务器身份验证服务器进行身份验证，因为这会获取缓存的工具。授权代码流仅在 Gateway 用户在该 MCP 服务器上调用工具时被触发。当多个 MCP 服务器附加到单个 Gateway 时，这特别有益。用户可以浏览完整的工具目录（缓存的工具），而不需要向每个 MCP 服务器进行身份验证，只完成他们调用其工具的特定服务器的流程。

## URL 会话绑定

URL 会话绑定验证发起 OAuth 授权请求的用户与授予同意的用户相同。当 AgentCore Identity 生成授权 URL 时，它还返回一个会话 URI。用户完成同意后，浏览器重定向回带有会话 URI 的回调 URL。然后应用程序负责调用 CompleteResourceTokenAuth API，呈现用户的身份和会话 URI。AgentCore Identity 验证启动流程的用户与完成流程的用户相同，然后再将授权代码交换为访问令牌。这有助于避免用户意外共享授权 URL，而其他人完成同意的情况，这会将访问令牌授予错误的一方。授权 URL 和会话 URI 仅在 10 分钟内有效，进一步限制了滥用窗口。会话绑定在管理员目标创建（隐式同步）和工具调用期间应用。

## 解决方案概述

在这篇文章中，我们展示了如何使用方法 1（在目标创建期间由管理员发起的同步）和方法 2（在目标创建期间预先提供工具模式）将 GitHub MCP 服务器附加到 Amazon Bedrock AgentCore Gateway。配套代码位于此仓库中。

## 前提条件

您必须按照此文章遵循以下先决条件。

## 在 MCP 服务器目标创建期间隐式同步

在本节中，我们将介绍在 MCP 服务器目标创建期间隐式同步如何工作。确保 AgentCore Gateway 执行角色具有 GetWorkloadAccessTokenForUserId 和 CompleteResourceTokenAuth 权限。首先，让我们开始了解流程。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-5.png)

请注意，对目标的后续更新或同步不会重用访问令牌。相反，AgentCore Identity 将从授权服务器获取新的访问令牌。

## 目标创建

首先，让我们开始创建 Amazon Bedrock AgentCore Gateway 和目标，看看隐式同步如何在 MCP 服务器目标创建期间工作。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-6.png)

创建 AgentCore Gateway 时，您必须使用 MCP 版本 2025-11-25 或更高版本。保持其他所有内容为默认值，并选择 **MCP 服务器目标**。提供 MCP 服务器端点，对于 OAuth 客户端，选择在前提条件部分期间创建的 AgentCore Identity OAuth 客户端。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-7.png)

在其他配置下，确保选择**授权代码授予 (3LO)**。如果 AgentCore Gateway 没有使用 MCP 版本 2025-11-25 或更高版本创建，授权代码授予 (3LO) 选项将被禁用。在这里，您还必须提供返回 URL。在会话绑定过程中完成授权代码流后，用户将被返回到此 URL，包括隐式同步和工具调用期间。您可以在调用期间覆盖返回 URL 值。有关更多信息，请参阅 Amazon Bedrock AgentCore 开发人员指南中的示例：授权代码授予。在配置目标时，您可以提供范围和附加参数，如受众。这些参数在 AgentCore Identity 向授权服务器的 /authorize 端点发出请求时包含。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-8.png)

创建目标后，目标将处于**需要授权**状态。此时，管理员用户需要完成授权请求，可以直接从 AWS 控制台或通过直接导航到授权 URL。需要注意的是，如果从 AWS 控制台完成流程，会话绑定会自动处理。如果从另一个上下文启动，管理员负责直接调用 CompleteResourceTokenAuth API。有关更多信息，请参阅 GitHub 中的代码示例。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-9.png)

这是从 AWS 控制台启动时同意流程的外观。

几秒钟后，您将看到目标处于**就绪**状态，授权状态为**已授权**。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-10.png)

## 在 MCP 服务器目标创建期间预先提供模式

在本节中，我们介绍如何在 MCP 服务器目标创建期间预先提供模式。当人类干预在创建/更新操作期间不可能时，这是推荐的方法。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-11.png)

在此步骤中，我们创建一个 Amazon Bedrock AgentCore Gateway 和目标，并在 MCP 服务器目标创建期间预先提供模式。该过程保持相同。在目标创建选择期间，选择**使用预定义的列表工具**并粘贴 GitHub 工具定义。您可以从 GitHub 仓库复制工具定义。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-12.png)

在这种情况下，目标立即准备好，授权状态为**不需要授权**。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-13.png)

## 演示

成功创建目标后，无论是使用隐式同步方法还是预先提供模式，AgentCore Gateway 用户都可以使用 MCP 协议发现和调用工具。在本节中，我们查看来自 AgentCore Gateway 的 tools/list 和 tools/call 流。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/02/flash-3089-image-14.png)

现在让我们查看端到端流程的演示，其中我们将 tools/list 和 tools/call 请求发送到 AgentCore Gateway。

## 引用

- [原文 - Connecting MCP Servers to Amazon Bedrock AgentCore Gateway Using Authorization Code Flow](https://aws.amazon.com/blogs/machine-learning/connecting-mcp-servers-to-amazon-bedrock-agentcore-gateway-using-authorization-code-flow/)
