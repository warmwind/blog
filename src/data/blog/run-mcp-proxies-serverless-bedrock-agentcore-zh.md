---
title: 在 Amazon Bedrock AgentCore Runtime 上无服务器运行自定义 MCP 代理
pubDatetime: 2026-05-01T11:00:00+08:00
description: 本文演示如何在 Amazon Bedrock AgentCore Runtime 上部署无服务器 MCP 代理，为 MCP 流量添加可编程控制层，支持输入验证、日志记录、访问控制等自定义逻辑。
slug: run-mcp-proxies-serverless-bedrock-agentcore-zh
originalTitle: "Run custom MCP proxies serverless on Amazon Bedrock AgentCore Runtime"
originalUrl: https://aws.amazon.com/blogs/machine-learning/run-custom-mcp-proxies-serverless-on-amazon-bedrock-agentcore-runtime/
---

原文标题：Run custom MCP proxies serverless on Amazon Bedrock AgentCore Runtime<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/run-custom-mcp-proxies-serverless-on-amazon-bedrock-agentcore-runtime/

当 AI Agent 通过 Model Context Protocol（MCP）连接到工具时，它们可以访问从数据库查询和 API 调用到文件操作和第三方服务集成等各种能力。在生产环境中，这些交互需要符合组织安全策略的适当治理、控制和可观测性。这包括在工具输入到达后端系统之前对其进行净化、生成特定格式的审计追踪，或在协议层级编辑敏感数据。这些要求由内部治理标准、行业法规和每个生产环境的具体情况决定。本文展示如何在 Amazon Bedrock AgentCore Runtime 上部署无服务器 MCP 代理，为你提供一个可编程层来实施这些控制。

Amazon Bedrock AgentCore Gateway 为代理工具集成提供集中治理和控制，包括语义工具发现、托管凭证和策略执行。对于需要在 Gateway 请求路径中嵌入自定义逻辑的组织，Gateway 支持 Lambda 拦截器。这些拦截器允许你以 AWS Lambda 函数的形式在每次工具调用时运行验证、转换或过滤代码。这使你能够将自定义逻辑与 Gateway 配置一起保持独立和受管。

然而，一些组织已经投资了与内部库或本地合规系统紧密耦合的自定义 MCP 过滤逻辑。他们希望在 AgentCore Runtime 上重用该逻辑，而无需将其重构为 Lambda 函数。其他组织在多个系统或混合环境中运营，在这些环境中以独立 MCP 服务器的形式运行控制比特定系统拦截器具有更高的可移植性。在这些情况下，运行在 AgentCore Runtime 上的无服务器 MCP 代理可以提供一种补充模式。

AgentCore Runtime 是用于部署 AI Agent 和 MCP 服务器的完全托管计算环境。它提供具有自动扩展功能的无服务器基础设施、通过 Amazon CloudWatch 和 OpenTelemetry 的内置可观测性，以及用于身份验证和授权的 AgentCore Identity。由于 Runtime 原生支持 MCP 协议，它允许你托管 MCP 服务器，包括向 MCP 流量添加自定义控制的 MCP 代理。

我们展示如何在 AgentCore Runtime 上构建和部署一个无状态 MCP 代理，该代理允许你向 MCP 流量添加可编程控制。代理在 Runtime 上作为无服务器工作负载运行，在启动时从上游 MCP 服务器发现工具，使用你的自定义逻辑重新暴露它们，并透明地转发请求。上游 MCP 服务器可以是你选择的任何 MCP 兼容端点，包括运行在 AgentCore Runtime 上的 MCP 服务器、自托管 MCP 服务器或第三方 MCP 服务。你还可以将此代理连接到 Amazon Bedrock AgentCore Gateway。这让你可以利用 Gateway 的托管工具发现、凭证管理以及跨 MCP 服务器、Lambda 函数和 SaaS 集成的策略执行。

使用开源 GitHub 实现作为基础，我们带你了解架构，解释每一层的授权工作原理，使用自动化脚本部署代理，并使用示例代理测试端到端流程。在最后，你将拥有一个使用 AgentCore Runtime 向 MCP 流量添加自定义控制的可用部署模式。

## 解决方案概述

自定义 MCP 代理在 AgentCore Runtime 上运行，充当 MCP 客户端和上游 MCP 服务器之间的中间层。MCP 客户端与代理的交互方式与其他 MCP 服务器相同；代理应用你的专有逻辑并将请求转发给上游服务器。这种分离允许你在协议层引入自定义控制，而无需修改上游 MCP 服务器或客户端。

### 架构组件

解决方案涉及三个通过 MCP 协同工作的逻辑层：MCP 客户端、AgentCore Runtime 上的 MCP 代理，以及上游 MCP 服务器。请求流按顺序移动这些层：客户端将 MCP 请求发送到代理，代理应用你的自定义逻辑并将请求转发给上游 MCP 服务器，上游服务器处理请求并通过相同路径返回响应。

上游 MCP 服务器可以托管在任何地方，包括在 AgentCore Runtime 上、你自己的基础设施上，或作为第三方服务。在本文中，我们使用 AgentCore Gateway 作为上游 MCP 服务器，因为它提供了一个现成的、MCP 兼容的工具端点，具有已注册的目标，让你可以在不需要单独设置 MCP 服务器的情况下完成整个流程。代理模式适用于其他 MCP 兼容的上游端点，我们在整篇文章中讨论了替代方案，包括运行在 AgentCore Runtime 上的上游 MCP 服务器。

下图显示了架构，包括请求流和身份验证流：

![图 1：显示请求流和身份验证流的架构图。本次演练使用 AgentCore Gateway 作为上游 MCP 服务器。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20371-1.png)

Runtime 中的 MCP 客户端将自定义 MCP 代理视为其工具服务器，向其发送标准 MCP 请求以发现和调用工具。从客户端的角度来看，代理与其他 MCP 服务器没有区别。AgentCore Runtime 为客户端工作负载提供托管计算、自动扩展和内置可观测性。

MCP 代理充当客户端和上游 MCP 服务器之间的中间层。它接收来自客户端的 MCP 请求，应用你的自定义逻辑，并将请求转发给上游服务器。代理在 Runtime 中作为独立的 MCP 服务器运行，使用与客户端本身相同的无服务器托管基础设施。

代理作为标准 MCP 客户端连接到上游 MCP 服务器。上游服务器将代理视为已认证的 MCP 客户端，与其他已授权的调用者没有区别。上游服务器处理对下游服务和 MCP 工具的访问。

工具本身——无论是作为 MCP 服务器、AWS Lambda 函数还是第三方 SaaS 集成托管——都在上游服务器注册和管理。对于寻求完全托管工具集成路径的组织，AgentCore Gateway 为开发人员提供了一种直接且安全的方式来大规模构建、部署、发现和连接工具。

### MCP 代理的工作原理

我们使用 FastMCP 实现代理，在启动时从上游 MCP 服务器发现工具，并在运行时转发每个客户端请求。代理不定义自己的工具，也不预先知道上游服务器暴露的内容。

当代理进程启动时，它向上游服务器发送标准 MCP tools/list 请求。服务器返回可用工具的完整目录。对于每个工具，代理使用相同的名称和描述动态注册一个本地 FastMCP 工具。每个工具都由一个处理程序函数支持，该函数将 tools/call 请求转发给上游服务器并返回响应。连接到代理的 MCP 客户端看到相同的工具目录，并获得与直接连接到上游服务器相同的结果。

由于代理是一个你拥有和部署的标准 Python MCP 服务器，你可以在转发工具调用之前或收到响应之后插入自定义逻辑。上游服务器处理工具执行，而代理在前面添加一个可编程层，而不替换上游服务器的原生能力。

### 组件之间的授权

授权在架构的每一层独立执行，在整个流程中创建不同的信任边界。

- **Agent 到 MCP 代理**：当 Agent 连接到 MCP 代理时，它使用 AgentCore Identity 进行身份验证和授权。代理使用 AgentCore Identity 提供的能力，包括 Agent 身份的集中管理和安全凭证存储。你可以使用与 AgentCore Runtime 中其他工作负载相同的身份框架来控制哪些 Agent 和主体可以调用代理。
- **代理到上游 MCP 服务器**：代理必须向其连接的上游 MCP 服务器进行身份验证。身份验证方法取决于上游服务器的要求。AgentCore Identity 通过 AWS Identity and Access Management（IAM）使用 AWS Signature Version 4（SigV4）以及使用 OAuth 2.0 客户端凭证的基于 JSON Web Token（JWT）的授权，为托管在 AgentCore Runtime 上的工作负载提供入站授权。使用基于 JWT 的授权时，你使用发现 URL、允许的受众和允许的客户端配置上游服务器。AgentCore Identity 在每个请求上验证 bearer token。代理通过 OAuth 2.0 客户端凭证授权获取 token，并将其作为 Authorization: Bearer 头包含在内。

对于基于 IAM 的授权，代理使用它从 AgentCore Runtime 继承的 IAM 执行角色，通过 AWS SigV4 签署请求。具体权限因上游服务器类型而异。如果上游 MCP 服务器托管在 AgentCore Runtime 上，你可以将 bedrock-agentcore:InvokeAgentRuntime 权限限定范围以控制哪些调用者可以访问它。或者，如果上游服务器是 AgentCore Gateway（如本次演练），你可以将 bedrock-agentcore:InvokeGateway 权限限定到特定的 Gateway 和调用者身份。这确保只有受信任的代理才能访问工具目录。

附带的 GitHub 项目使用基于 IAM 的授权作为默认方法。部署脚本还支持基于 JWT 的授权用于此集成。

- **上游服务器到工具**：上游 MCP 服务器使用 AgentCore Identity 凭证提供商向下游工具进行身份验证，这些提供商透明地管理 OAuth 2.0 token、API 密钥和凭证轮换。无论请求是来自代理还是直接客户端，出站授权的操作方式都相同。

此架构中的每一层都独立进行身份验证。你通过代理在 MCP 协议层注入自定义逻辑，而上游服务器继续处理工具执行及其自身的授权。结果是一个自定义控制和上游能力在独立、定义明确的层中运行的架构。

## 前提条件

要实施解决方案，你必须具备以下条件：

- 安装了 Python 3.12 或更高版本的 Linux 或 macOS 开发环境，可以是本地机器或云实例。
- 安装了 AWS Command Line Interface（AWS CLI）并配置了 IAM 主体凭证，该主体具有创建 IAM 角色、与 Amazon Elastic Container Registry（Amazon ECR）交互以及调用 Amazon Bedrock AgentCore API 的权限。如果你没有 AWS 账户，请参阅如何创建和激活新的 Amazon Web Services 账户？
- 在你的开发环境上安装了 AgentCore starter toolkit。此工具将代理打包并部署到 AgentCore Runtime。如果你没有 AgentCore starter toolkit，请参阅用 Python 开始使用 Amazon Bedrock AgentCore starter toolkit。
- 在你的开发环境上安装了 Docker。AgentCore CLI 使用 Docker 构建在 AgentCore Runtime 上运行的容器镜像。
- 代理将连接到的上游 MCP 服务器端点。在本次演练中，我们使用至少注册了一个目标的 Amazon Bedrock AgentCore Gateway。如果你没有 AgentCore Gateway，请参阅创建 Amazon Bedrock AgentCore gateway。创建后记下 Gateway MCP 端点 URL，你将使用此 URL 配置代理。
- （如果你的上游服务器使用 OAuth 入站授权）具有已配置域名和使用客户端凭证授权（带客户端密钥）的应用客户端的 Amazon Cognito 用户池。如果你使用带有 OAuth 授权的 AgentCore starter toolkit 创建了 Gateway，这些资源会在 Gateway 创建期间自动配置。

## 部署解决方案

完成以下步骤以在你的 AWS 账户中部署项目：

1. 首先克隆 GitHub 仓库并查看项目结构。
2. 打开 deploy_config.json 并为你的环境设置值：

![图 2：显示部署设置的配置截图](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20371-2.png)

将 gateway_endpoint 中的值替换为你的上游 MCP 服务器（本示例中为 AgentCore Gateway）的 MCP 端点 URL。将 region 设置为部署上游服务器的 AWS 区域。gateway_api_id 字段是可选的。如果你的上游服务器是 AgentCore Gateway 并且你提供了其 Amazon Resource Name（ARN），部署脚本会将 IAM 权限限定到该特定资源。如果你将其留空为 null，脚本将授予调用账户中所有 Gateway 的权限。

auth_mode 字段确定代理如何向上游服务器进行身份验证，默认为 "iam" 用于基于 IAM 的身份验证。如果你将 auth_mode 设置为 "jwt" 用于基于 OAuth 的身份验证，则必须使用你 Cognito 用户池中的值配置 Cognito 字段（cognito_user_pool_id、cognito_client_id 和 cognito_domain）。然后在运行部署脚本时通过 --cognito-client-secret 标志传递 Cognito 客户端密钥。使用 IAM 身份验证时，将所有 Cognito 字段留空为 null。

3. 从项目根目录运行自动部署脚本 setup_and_deploy.py。它自动化了完整的部署工作流，按顺序执行以下步骤：
   - 验证前提条件——检查 AWS CLI、Python 和 Docker 是否可用，以及 AWS 凭证是否已配置。
   - 创建 IAM 执行角色——创建具有允许 bedrock-agentcore.amazonaws.com 扮演它的信任策略的角色。该角色包括调用 Gateway、向 Amazon CloudWatch Logs 写入日志以及从 Amazon ECR 拉取镜像的权限。
   - 使用 AgentCore CLI 配置代理——使用 MCP 协议运行 agentcore configure，指向 mcp_proxy/main.py 的代理入口点。在此步骤中，CLI 提示你选择 ECR 仓库并确认身份验证模式。
   - 将代理启动到 AgentCore Runtime——运行 agentcore launch 并将上游服务器端点作为环境变量（GATEWAY_ENDPOINT）传递。AgentCore Runtime 构建容器镜像，将其推送到 Amazon ECR，并启动代理。

4. 检查 MCP 代理状态：agentcore status --agent mcp_proxy。记录输出中的代理 ARN，你将在稍后用于调用代理的测试客户端代理中使用此 ARN。

## 如何配置代理身份验证方法

MCP 代理和上游服务器之间的身份验证模式取决于上游服务器的入站授权配置方式。AgentCore Identity 为托管在 AgentCore 上的工作负载支持 IAM 和 JWT 入站身份验证。GitHub 上的代理代码在单个函数 _send_gateway_request 中实现了每种模式，该函数负责向上游服务器发出出站 HTTP 调用。

### IAM 授权

代理使用 AWS SigV4 签署每个发往上游服务器的出站请求。由于代理在 AgentCore Runtime 上运行，它继承了你在部署期间指定的 IAM 执行角色。部署脚本授予此角色 bedrock-agentcore:InvokeGateway 权限，并将 Resource 字段限定到 Gateway。不需要额外的凭证或 token。代理使用运行时的 boto3 会话自动签署请求。

### OAuth 授权

如果你的上游服务器使用 JWT 授权器，代理将使用通过 OAuth 2.0 客户端凭证授权获取的 bearer token 替换 SigV4 签名。此模式内置于代理中，无需更改代码。你需要在部署配置中将 auth_mode 设置为 jwt 并提供你的 Cognito 用户池详细信息。

当你选择 JWT 时，脚本会收集 Cognito 用户池 ID、应用客户端 ID、应用客户端密钥和域前缀。这些值在 agentcore launch 步骤期间作为环境变量传递给 AgentCore Runtime 容器。你也可以直接在 deploy_config.json 中设置这些值以跳过交互提示。

在启动时，代理读取 AUTH_MODE 环境变量。当设置为 jwt 时，代理使用 HTTP 身份验证通过客户端凭证请求访问 token。token 缓存在内存中，并在接近过期时自动刷新。每个发往上游 MCP 服务器的出站请求都包含该 token 作为 Authorization: Bearer 头，而不是 SigV4 签名头。

代理的其余部分（工具发现、工具转发和 FastMCP 服务器）无论身份验证模式如何都以相同方式运行。唯一的区别是 _send_gateway_request 如何验证其出站调用。

## 测试解决方案

仓库包含 test_agent.py，这是一个 Strands Agents 脚本，它连接到在 AgentCore Runtime 上运行的 MCP 代理并使用发现的工具。

该代理通过调用已部署代理的 AgentCore Runtime 端点连接到代理，而不是上游服务器。它发送 MCP JSON-RPC 请求以发现工具并调用它们。以下屏幕录制演示了一个 CLI 会话，其中代理从代理发现工具并使用它们以交互方式回答问题。

在此示例中，上游服务器（AgentCore Gateway）暴露了执行算术运算的工具，代理充当使用这些工具进行基本数学运算的计算器。

![图 3：显示 CLI 交互的测试屏幕录制](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20371-3.gif)

## 自定义机会

代理架构允许你拦截和转换客户端和上游 MCP 服务器之间的 MCP 流量。以下示例演示了两种常见的自定义模式：

### 令牌化

工具调用参数可能包含不应以明文形式到达后端系统的个人身份信息（PII）。代理的转发流程为你提供了一个自然的拦截点来添加令牌化。

流程如下：当客户端调用工具时，main.py 中的代理的 _make_tool_handler 函数以 kwargs 字典形式接收参数，将它们传递给 _send_gateway_request，该函数将它们包装在 JSON-RPC 载荷中，以 SigV4 签名发送给上游 MCP 服务器，然后将响应格式化返回给客户端。相关代码路径如下：

```python
def _make_tool_handler(tool_name: str):
    """创建将调用转发到 gateway 的工具处理程序函数。"""
    def handler(**kwargs) -> str:
        # --- 令牌化：扫描 kwargs 中的 PII 并用令牌替换 ---
        result = _send_gateway_request(
            "tools/call", {"name": tool_name, "arguments": kwargs}
        )
        content = result.get("content", [])
        # --- 去令牌化：在返回之前反转 content 中的令牌 ---
        if content and isinstance(content, list):
            texts = [c.get("text", str(c)) for c in content if isinstance(c, dict)]
            return "\n".join(texts) if texts else json.dumps(result)
        return json.dumps(result)
    return handler
```

你可以在处理程序闭包内的两个地方添加令牌化。在调用 _send_gateway_request 之前，你扫描 kwargs 值中的 PII 模式并用可逆令牌替换它们（参阅 AWS 上的令牌化提高数据安全性和减少审计范围的指导）。_send_gateway_request 返回后，你在将响应内容返回给客户端之前反转其中的令牌。这使 PII 不会到达后端目标，同时为代理保留了端到端数据流。

### 工具级访问控制

即使上游服务器暴露了完整目录，你也可能希望限制特定调用者可以调用哪些工具。你可以通过在 _make_tool_handler 创建的处理程序函数开头添加策略检查来实现这一点。代理在构造处理程序时已经将工具名称作为参数接收。在将 tools/call 请求转发给上游服务器之前，处理程序根据访问策略评估调用者的身份。身份可以从入站请求头或 MCP 会话上下文中提取。如果调用者没有该工具的授权，处理程序将返回错误响应而不联系上游服务器。你还可以在 register_gateway_tools 函数中过滤 tools/list 响应，只暴露与给定策略匹配的工具。这样，未授权的工具就不会出现在客户端的工具目录中。

## 清理

如果你不再需要超出此解决方案测试范围的资源，请删除已创建的资源以避免持续费用。AgentCore CLI 提供了一个 destroy 命令，用于删除代理及其关联资源。从项目根目录运行以下命令：

- 删除 AgentCore Runtime 代理及其 ECR 镜像：

```
agentcore destroy --agent <agent-name> --delete-ecr-repo --force
```

- 删除内联 IAM 策略和执行角色：

```
aws iam delete-role-policy --role-name <your-MCPProxy-Server-Role> --policy-name <your-Gateway-Access-Policy>
aws iam delete-role --role-name <your-MCPProxy-Server-Role>
```

如果你专门为本次演练创建了 AgentCore Gateway 且不再需要它，请删除 Gateway 及其目标：

```
agentcore gateway delete-mcp-gateway --name <your-Gateway> --force
```

将代理名称、角色名称和 Gateway 名称替换为你在部署期间使用的值。

## 结论

本文演示了如何在 Amazon Bedrock AgentCore Runtime 上构建和部署无服务器 MCP 代理，该代理向 MCP 流量添加自定义控制。代理在启动时从上游 MCP 服务器动态发现工具，将它们作为标准 MCP 服务器重新暴露，并在运行时转发工具调用。这为你提供了一个可编程层，你可以在其中应用自定义逻辑，如输入验证、日志记录、速率限制或响应丰富。

我们使用 AgentCore Gateway 作为上游服务器演练了端到端工作流，并介绍了如何为配置了 IAM 或 JWT 入站授权的 gateway 调整代理。代理是无状态的，在 AgentCore Runtime 上作为标准容器运行。你可以将其连接到其他 MCP 兼容的上游服务器，链接多个上游端点，或添加特定于你工作负载的中间件逻辑。完整的源代码、部署脚本和测试代理在 GitHub 上可用。

要开始，请克隆仓库，配置你的上游 MCP 服务器端点，并运行自动化部署脚本。要了解有关在 AgentCore 上构建和部署代理以及使用 Strands Agents 框架的更多信息，请浏览 Amazon Bedrock AgentCore 文档和 Strands Agents SDK。

## 引用

- 原文：[Run custom MCP proxies serverless on Amazon Bedrock AgentCore Runtime](https://aws.amazon.com/blogs/machine-learning/run-custom-mcp-proxies-serverless-on-amazon-bedrock-agentcore-runtime/)
