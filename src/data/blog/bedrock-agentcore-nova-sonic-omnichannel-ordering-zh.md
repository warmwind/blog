---
title: 使用 Amazon Bedrock AgentCore 和 Amazon Nova 2 Sonic 构建全渠道点单系统
pubDatetime: 2026-04-21T11:00:00+08:00
description: 使用 Amazon Bedrock AgentCore 和 Amazon Nova 2 Sonic 构建全渠道语音点单系统，支持多端实时语音交互、基于位置的推荐以及无缝后端服务集成。
slug: bedrock-agentcore-nova-sonic-omnichannel-ordering-zh
originalTitle: "Omnichannel ordering with Amazon Bedrock AgentCore and Amazon Nova 2 Sonic"
originalUrl: https://aws.amazon.com/blogs/machine-learning/omnichannel-ordering-with-amazon-bedrock-agentcore-and-amazon-nova-2-sonic/
tags:
  - AWS
  - Bedrock
  - AgentCore
  - Agent
  - 语音AI
---

原文标题：Omnichannel ordering with Amazon Bedrock AgentCore and Amazon Nova 2 Sonic<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/omnichannel-ordering-with-amazon-bedrock-agentcore-and-amazon-nova-2-sonic/

![全渠道点单系统封面图](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20200-1120x630.png)

## 简介

构建一个能够跨移动应用、网站和语音界面运行的语音点单系统（即[全渠道](https://en.wikipedia.org/wiki/Omnichannel)方案）面临着真实的挑战。您需要处理双向音频流、在多轮对话中维护上下文、在不紧耦合的情况下集成后端服务，并能扩展以应对流量高峰。

在本文中，我们将展示如何使用 [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/)（一个 Agent 平台，用于安全、大规模地使用任意框架和基础模型构建、部署和运营高效的 AI Agent）以及 [Amazon Nova 2 Sonic](https://aws.amazon.com/nova/models/) 构建一个完整的全渠道点单系统。您将部署处理身份验证、处理订单并提供基于位置推荐的基础设施。该系统使用自动扩展的托管服务，降低了构建语音 AI 应用程序的运维开销。完成后，您将拥有一个能够在多个客户触点处理语音点单的工作系统。AI 编排层连接到一个包含示例菜单数据的样本后端架构，让您在实施此类项目时有一个良好的起点。本项目被划分为多个模块，如果您希望复用某些组件来与现有的后端 API 集成，可以灵活选择。

本文将介绍以下内容：

- 使用 [AWS Cloud Development Kit（AWS CDK）](https://aws.amazon.com/cdk/) 部署多渠道语音 AI 点单基础设施
- 使用 Strands 框架结合 Amazon Nova 2 Sonic 实现用于实时语音处理的 Agent，并托管在 AgentCore Runtime 上
- 通过 AgentCore Gateway 使用 [Model Context Protocol（MCP）](https://modelcontextprotocol.io/docs/getting-started/intro) 将 AI Agent 连接到后端服务
- 使用包括基于路线的取货推荐在内的真实点单场景测试您的系统

Amazon Nova 2 Sonic 是一个可通过 Amazon Bedrock 使用的语音到语音基础模型，您可以将其用于实时语音交互。与 Amazon Bedrock AgentCore 结合使用时，您可以在所有客户触点上实现自然的语音点单体验。

## 方案概述

本方案架构将前端、AI Agent 和后端服务分离为独立组件。这种分离使您能够独立开发和扩展每个组件。MCP 是连接 AI 应用程序与外部数据源、工具和工作流的开放标准，它在 Agent 和后端服务之间提供标准化通信。

本方案将部署：

- [**Amazon Cognito**](https://aws.amazon.com/cognito/) – 处理用户身份验证并提供临时 AWS 凭证，用于安全的 API 访问。只要符合 OAuth 2.0 规范，您可以将其替换为您选择的身份提供商（IDP）。
- [**Amazon Bedrock AgentCore Runtime**](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html) – 以 microVM 隔离方式托管您的 AI Agent。每个用户会话在隔离的虚拟机中运行，即使在高负载下也能确保客户会话安全且高性能。它防止一个客户的会话影响另一个客户的性能或访问其数据。
- [**Amazon Bedrock AgentCore Gateway**](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) – 为开发者提供一种安全的方式来大规模构建、部署、发现和连接工具，在 Agent 和业务逻辑之间提供标准化通信而无需紧耦合，使您无需重写集成代码即可修改后端或添加新工具。
- [**Amazon API Gateway**](https://aws.amazon.com/api-gateway/) – 通过[表述性状态传输（REST）](https://aws.amazon.com/what-is/restful-api/#what-is-rest--1hfzuqn)端点和基于 [AWS Identity and Access Management（IAM）](https://aws.amazon.com/iam/) 的授权暴露后端服务。
- [**AWS Lambda**](https://aws.amazon.com/lambda/) – 执行菜单检索、订单处理和位置服务的业务逻辑。
- [**Amazon DynamoDB**](https://aws.amazon.com/dynamodb/) – 以个位数毫秒延迟存储客户档案、订单、菜单项目和购物车。
- [**AWS Location Services**](https://aws.amazon.com/location/) – 提供用于取货推荐的基于位置的功能。
- [**AWS Amplify**](https://aws.amazon.com/amplify/) – 托管前端应用程序。

## 架构图

下图展示了方案架构，包含三个关键部分：

[![全渠道架构图](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/15/ML-20200-image-1-2.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/15/ML-20200-image-1-2.png)

**A 部分：后端基础设施**

本部分使用基础设施即代码将一个样本餐厅架构作为后端服务进行部署。它为客户信息、订单、菜单、购物车和位置置备数据存储，还设置了用于地址处理和地图的基于位置的服务、用于业务逻辑的 Lambda 函数、用于外部访问的 API 层，以及用户身份验证和授权服务。资源按适当的依赖顺序进行部署。

**B 部分：AgentCore Gateway**

本部分部署 AgentCore Gateway 基础设施。它置备必要的 IAM 服务权限，创建 AgentCore Gateway 服务，并配置 API 集成，将后端端点作为 Agent 可访问的工具暴露出来。

**C 部分：AgentCore Runtime 和 ECR 镜像**

本部分部署 AgentCore Runtime 环境。它置备用于容器存储的 Amazon ECR、用于源文件上传的 Amazon S3、用于构建自动化的 AWS CodeBuild，以及所需的 IAM 权限。AgentCore Runtime 服务配置为使用 WebSocket 协议。

**D 部分：AWS Amplify**

本部分使用 AWS Amplify 部署前端应用程序。它置备带有部署配置的 Amplify 托管服务，并从后端输出生成必要的前端配置。构建后的 Web 应用程序完成部署，并在完成后可通过 Amplify URL 访问。

## **用户请求流程：**

- 用户从浏览器或移动设备访问托管在 AWS Amplify 上的 Web 应用程序。
- 用户使用用户名和密码向 Amazon Cognito 进行身份验证，并获取 JWT 令牌（访问令牌和 ID 令牌）。
- 前端使用 ID 令牌与 Cognito 身份池交换临时 AWS 凭证（访问密钥、私钥、会话令牌）。
- 前端向 AgentCore Runtime 打开经过 SigV4 签名的 WebSocket 连接，并将访问令牌作为第一条消息发送以进行身份验证。
- 托管在 AgentCore Runtime 中的 Agent 通过调用 Cognito GetUser API 验证访问令牌，并提取客户的验证姓名、电子邮件和 customerId。
- AgentCore Runtime 在 Amazon Bedrock 上初始化 Nova 2 Sonic 模型，并使用经过验证的客户上下文构建个性化系统提示。
- AgentCore Runtime 使用 SigV4 身份验证作为 MCP 客户端连接到 AgentCore Gateway，并发现可用工具。
- 用户说出订单。Agent 通过 Nova 2 Sonic 处理语音输入，并通过 AgentCore Gateway 使用 MCP 异步调用工具。
- AgentCore Gateway 将后端 REST API 作为 MCP 工具暴露，使 Agent 能够按名称发现并调用它们。当 Agent 调用工具时，AgentCore Gateway 将请求作为 REST API 调用转发到 API Gateway，后者将其路由到相应的 Lambda 函数。Lambda 函数查询 DynamoDB 表和 AWS Location Services。
- Nova 2 Sonic 生成包含工具结果的上下文语音响应，并通过 WebSocket 连接流式传输回用户。

## 前提条件

在开始之前，请验证您已具备以下条件：

- 一个 [AWS 账户](https://signin.aws.amazon.com/signin?redirect_uri=https%3A%2F%2Fportal.aws.amazon.com%2Fbilling%2Fsignup%2Fresume&client_id=signup)
- 在部署此方案的同一 AWS 区域，在 Amazon Bedrock 中具有 Amazon Nova 2 Sonic 的[基础模型（FM）](https://aws.amazon.com/what-is/foundation-models/) 访问权限
- [Node.js](https://nodejs.org/) 20.x 或更高版本（AWS CDK 部署所需）
- [Python](https://www.python.org/downloads/) 3.13 或更高版本（Agent 运行时和部署脚本所需）
- 已配置凭证的 [AWS 命令行接口（AWS CLI）](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) 2.x
- [AWS CDK CLI 2.x](https://docs.aws.amazon.com/cdk/v2/guide/getting-started.html)：`npm install -g aws-cdk`（基础设施部署所需）
- 在目标账户/区域中完成 CDK 引导：`npx cdk bootstrap`
- [Boto3](https://aws.amazon.com/sdk-for-python/) 1.38.0 或更高版本（支持 `bedrock-agentcore-control` 服务所需）。使用 `python3 -m pip install --upgrade boto3 botocore --break-system-packages` 安装
- 其他 Python 包：`python3 -m pip install email-validator pyyaml --break-system-packages`
- 从 [aws-samples GitHub 仓库](https://github.com/aws-samples/sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic)下载的配套代码

## 使用 AWS CDK 部署方案资源

克隆 [GitHub 仓库](https://github.com/aws-samples/sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic)并进入项目目录。

```
git clone https://github.com/aws-samples/sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic

cd sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic
```

运行部署脚本。两个参数都是必需的。电子邮件地址将用于接收初始 Cognito 测试用户的临时密码。

```
./deploy-all.sh --user-email <your-email> --user-name "<Your Name>"
```

脚本首先运行预检，以验证 Node.js、Python、AWS CLI、CDK、凭证、CDK 引导和 Bedrock Nova 2 Sonic 模型访问权限均已就绪。如果任何检查失败，它将报告缺失的内容，并在可能的情况下提供自动安装选项。

预检通过后，脚本将运行五个步骤。步骤 1 到 3 完全自动化。步骤 4（合成数据）将提示您输入：用于搜索附近餐厅的中心点位置（如城市、邮编或地址）、要搜索的食物类型（如披萨、汉堡、咖啡馆、三明治、墨西哥卷饼）、是否将相同地址用作客户住所，以及在将生成的数据写入 DynamoDB 之前的确认。步骤 5（密码设置）将提示您选择是否更改通过电子邮件发送给您的临时 Cognito 密码。如果选择是，您将输入来自邮件的临时密码，并设置符合 Cognito 策略（8 个以上字符，包含大写、小写、数字、符号）的新永久密码。

完成后，脚本将输出您用于访问应用程序的前端 URL（例如 `https://main.<app-id>.amplifyapp.com`）。

[![全渠道 CDK 输出](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-2.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-2.png)

## 了解无服务器数据管理

API Gateway 创建了一个 REST API，通过八个经过 IAM 身份验证的端点和 Lambda 集成将前端连接到后端服务。

您的后端使用五个 DynamoDB 表来支持完整的点单工作流。**客户表**存储档案（姓名、电子邮件、电话、忠诚度等级、积分），用于个性化推荐。**订单表**存储带有位置数据的订单历史记录，并使用全局二级索引按位置查询，以识别热门商品。**菜单表**存储具有定价和可用性的特定位置商品，这些信息因餐厅而异。**购物车表**存储临时购物车，带有 24 小时 TTL 用于自动清理。**位置表**存储餐厅数据（坐标、营业时间、税率），用于订单计算和推荐。DynamoDB 按需容量可随流量自动扩展。

## 了解基于位置的服务

Location Services 提供基于位置的功能，帮助客户找到方便的取货地点。该系统部署三个资源：用于地理编码和地址搜索的**地点索引**（Esri）、用于计算驾车路线和绕行时间的**路线计算器**（Esri），以及针对驾车优化的交互式可视化**地图**（VectorEsriNavigation 样式）。

Lambda 函数提供三项功能：**最近位置搜索**使用 GPS 坐标和哈弗辛公式按距离排序找到最近的餐厅。**基于路线的搜索**使用实际驾车时间（而非直线距离）识别在指定绕行时间内（默认 10 分钟）的餐厅。**地址地理编码**在 GPS 不可用时将街道地址转换为坐标。

这些功能支持上下文感知推荐，例如"我发现了一个距您路线仅 2 分钟的地点"或"您常去的地点在 5 英里外"。

## 了解使用 Amazon Bedrock AgentCore 的语音 AI 处理

您的 AI Agent 通过 Amazon Bedrock AgentCore 处理语音交互。每个用户会话在隔离的 microVM 中运行，即使在高负载下也能确保客户会话安全且高性能。它防止一个客户的会话影响另一个客户的性能或访问其数据。AgentCore 提供自动扩展、内置监控和对实时语音的 WebSocket 支持。

Agent 使用 Strands 框架定义系统提示、工具和对话流程。Nova 2 Sonic 提供：

- 具有背景噪声容忍度的多口音语音识别
- 根据用户语气和情感调整语音响应
- 低延迟响应时间的双向流式传输
- 异步工具调用，并行获取数据而不阻塞对话
- 支持自然换轮的打断处理
- 跨多轮对话的上下文感知

语音处理流程：音频从前端（16 kHz PCM）通过 WebSocket 流式传输到 AgentCore Runtime。Nova 2 Sonic 转录语音，Agent 确定意图并选择工具，通过 MCP 异步调用它们，AgentCore Gateway 将 MCP 调用转换为 REST API 调用。Lambda 函数执行业务逻辑并返回结果，Agent 将其整合到响应中。Nova 2 Sonic 生成语音输出并流式传输回前端。

这一架构将对话点单的延迟降至最低。

## 用户身份验证

该方案使用 Amazon Cognito 用户池和身份池实现安全的基于角色的访问控制。用户池管理身份验证和用户组。身份池提供与 IAM 角色关联的临时 AWS 凭证。用户使用用户名和密码登录 Cognito 用户池，接收 JSON Web Token（JWT）令牌（访问令牌和 ID 令牌）。前端使用 ID 令牌与 Cognito 身份池交换临时 AWS 凭证（访问密钥、私钥、会话令牌）。这些凭证使用 Signature Version 4（SigV4）对 AgentCore Runtime 的 WebSocket 连接和 API Gateway 请求进行签名。这一架构确保只有经过身份验证的用户才能访问应用程序和点单 API。

## WebSocket 连接流程

以下序列图说明了上一节中的身份验证凭证如何建立直接从浏览器到 AgentCore 的连接。利用临时 AWS 凭证，前端向 AgentCore Runtime 打开经过 SigV4 签名的 WebSocket 连接，并发送访问令牌进行身份验证。然后浏览器流式传输 16kHz PCM 音频，并通过同一连接接收语音响应、转录和工具调用通知。这避免了对服务端代理的需求。

[![全渠道身份验证和连接流程](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-3.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-3.png)

## 语音交互与动态点单

以下序列图说明了客户点单查询的流程，展示了自然语言请求如何被处理以提供同步响应：

[![全渠道语音交互和动态点单流程](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-4.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ML-20200-image-4.png)

该图展示了客户查询（"我想点餐"）通过异步工具调用的处理方式。Agent 通过 AgentCore Gateway 并行调用多个工具（`GetCustomerProfile`、`GetPreviousOrders`、`GetMenu`），AgentCore Gateway 将其转换为 API Gateway REST 调用。Lambda 函数查询 DynamoDB 并将结果通过 Gateway 返回。Nova 2 Sonic 随后生成包含所有工具结果的上下文响应，在整个对话过程中创造个性化的客户体验。

## 点单演练

在浏览器中打开前端 URL，并使用 AppUser 凭证登录。身份验证后，点击麦克风按钮开始与点单 Agent 的语音对话。Agent 会叫出您的姓名问候您，从浏览器获取您的位置，并在后台调取您之前的订单。您可以自然地说话。询问重复过去的订单、浏览菜单、找到沿途的附近取货地点，或从头开始构建新订单。Agent 会实时以语音响应，处理菜单问题、将商品加入购物车，并确认您的订单，包括总价和预计取货时间。整个对话通过单个 WebSocket 连接全程免提进行。Agent 异步调用后端工具，因此数据获取期间不会出现停顿。以下视频演示了从问候到确认订单的完整点单会话。

## 清理

如果您决定停止使用该方案，可以按照以下步骤删除它及其关联资源：

**删除堆栈：**

`./cleanup-all.sh`

## 结论

在本文中，我们展示了如何使用 Amazon Cognito 进行身份验证、Amazon Bedrock AgentCore 进行 Agent 托管、API Gateway 进行数据通信、DynamoDB 进行存储，以及 Location Services 进行路线优化，来构建全渠道点单系统。三层架构将前端、Agent 和后端组件分离，实现独立开发和扩展。该系统通过 MCP 集成支持菜单管理、购物车功能、忠诚度计划、订单处理和基于位置的服务。Amazon Nova 2 Sonic 以低延迟、异步工具调用和打断处理提供语音交互。并行工具调用减少等待时间，语音识别支持多种口音，个性化推荐使用订单历史，基于路线优化的取货地点帮助客户找到便捷的停靠点。按使用量付费的定价模式随使用量增长控制成本，而通过 MCP 集成，您可以通过添加新的 Lambda 函数来调整方案，无需修改 Agent 代码。要开始使用，请访问 [GitHub](https://github.com/aws-samples/sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic) 上的方案仓库，并为您的点单平台自定义该方案。有关更多信息，请参阅 Amazon Bedrock 文档和 Amazon Nova 2 Sonic 简介。

## 其他资源

如需了解有关 Amazon Bedrock AgentCore、Amazon Nova Sonic 和其他方案的更多信息，请参阅以下资源：

- [介绍 Amazon Nova 2 Sonic：面向对话式 AI 的新一代语音到语音模型](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-2-sonic-next-generation-speech-to-speech-model-for-conversational-ai/)
- [Amazon Bedrock AgentCore 入门](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-get-started-toolkit.html)
- [Model Context Protocol 规范](https://modelcontextprotocol.io/)
- [AWS Location Services 文档](https://docs.aws.amazon.com/location/)
- [AgentCore CLI](https://github.com/aws/agentcore-cli) – 虽然我们的方案使用 CDK，但您也可以使用 AgentCore CLI，它提供了一个命令行工具，用于在 Amazon Bedrock AgentCore 上创建、配置、部署和管理 Agent。

## 引用

- 原文：[Omnichannel ordering with Amazon Bedrock AgentCore and Amazon Nova 2 Sonic](https://aws.amazon.com/blogs/machine-learning/omnichannel-ordering-with-amazon-bedrock-agentcore-and-amazon-nova-2-sonic/)
- [Amazon Bedrock AgentCore 文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agents-tools-runtime.html)
- [示例代码仓库](https://github.com/aws-samples/sample-omnichannel-ordering-with-amazon-bedrock-agentcore-and-nova-sonic)
