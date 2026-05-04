---
title: 配置 Amazon Bedrock AgentCore Gateway 安全访问私有资源
pubDatetime: 2026-05-04T11:00:00+08:00
description: 介绍如何通过托管 VPC 资源模式和自管 Lattice 资源模式，配置 Amazon Bedrock AgentCore Gateway 的 VPC 出口，使 AI Agent 能够安全访问私有网络中的 API、MCP 服务器及其他内部资源。
slug: agentcore-gateway-vpc-private-access-zh
originalTitle: "Configuring Amazon Bedrock AgentCore Gateway for secure access to private resources"
originalUrl: https://aws.amazon.com/blogs/machine-learning/configuring-amazon-bedrock-agentcore-gateway-for-secure-access-to-private-resources/
tags:
  - AI
  - AWS
  - AgentCore
  - VPC
  - Security
---

原文标题：Configuring Amazon Bedrock AgentCore Gateway for secure access to private resources<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/configuring-amazon-bedrock-agentcore-gateway-for-secure-access-to-private-resources/

生产环境中的 AI Agent 通常需要访问位于 [Amazon Virtual Private Cloud (Amazon VPC)](https://aws.amazon.com/vpc/) 边界之后的内部 API、数据库和私有资源。为每条 Agent 到工具的路径管理私有连接会增加运营开销并拖慢部署速度。Amazon Bedrock AgentCore [VPC 连接](https://docs.aws.amazon.com/bedrock/latest/userguide/usingVPC.html)旨在部署 AI Agent 和 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/docs/getting-started/intro) 服务器，而无需将网络流量暴露在公共互联网上。此能力扩展到 [Amazon Bedrock AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) 的托管 Amazon VPC 出口，使你可以连接到整个 AWS 环境中私有网络内的端点。

本文将介绍如何配置 Amazon Bedrock AgentCore Gateway，使用 [Resource Gateway](https://docs.aws.amazon.com/vpc/latest/privatelink/resource-gateway.html)（一种在你的 Amazon VPC 中直接配置弹性网络接口（ENI）的托管构件，每个子网一个）访问私有端点。你将探索两种实现模式（托管模式和自管模式），并演练三个实际场景：连接到私有 [Amazon API Gateway](https://aws.amazon.com/api-gateway/) 端点、与 [Amazon Elastic Kubernetes Service](https://aws.amazon.com/eks/)（Amazon EKS）上的 MCP 服务器集成，以及访问私有 REST API。

## 关键术语

在本文中使用了以下术语。在继续阅读之前先了解这些术语，以便理解每个组件如何融入 AgentCore Gateway VPC 出口架构。

**Resource VPC（资源 VPC）：** 你的私有资源所在的 Amazon VPC。例如，包含你私有托管的 MCP 服务器或 API 端点的 VPC。这是 AgentCore Gateway 需要访问的 Amazon VPC。资源 VPC 可以与 AgentCore Gateway 账户位于同一 AWS 账户，也可以位于不同账户。

**AgentCore Gateway 账户：** 你创建和管理 AgentCore Gateway 资源的 AWS 账户。该账户可能与资源 VPC 所在账户相同，也可能不同。

**Resource Gateway（资源网关）：** [Resource gateway](https://docs.aws.amazon.com/vpc/latest/privatelink/resource-gateway.html) 充当进入你的资源 VPC 的私有入口点。创建时，它会在你指定的每个子网中配置一个 ENI，每个 ENI 都位于你的 VPC 内部。从 AgentCore Gateway 到你的私有资源的流量通过这些 ENI 到达。

**Resource Configuration（资源配置）：** [VPC 资源的资源配置](https://docs.aws.amazon.com/vpc/latest/privatelink/resource-configuration.html)定义了 AgentCore Gateway 允许通过 Resource Gateway 访问的特定资源，通过域名或 IP 地址标识。与其授予对整个 Amazon VPC 的访问权，资源配置将连接范围限定到单个端点。

**Service Network Resource Association（服务网络资源关联）：** 服务网络资源关联将资源配置连接到 AgentCore 服务网络，从而允许 AgentCore Gateway 服务调用你的私有端点。无论使用哪种模式，AgentCore 都会代表你创建和管理此关联。

## AgentCore Gateway VPC 出口如何工作？

AgentCore Gateway VPC 出口支持两种模式，具体取决于你希望对底层网络基础设施拥有多大控制权，以及你希望如何为跨 VPC 连接进行架构设计。

### 托管 VPC 资源模式

在此模式下，AgentCore Gateway 代表你处理所有事务。你只需在目标配置中提供 VPC ID、子网 ID 和安全组，AgentCore 就会自动在你的账户中创建和管理 VPC Resource Gateway。此模式可与现有网络架构集成，无论你使用 [VPC 对等](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html)进行同区域或跨区域连接，还是使用带有 [AWS Transit Gateway](https://aws.amazon.com/transit-gateway/) 的枢纽辐射模型进行多 VPC 和混合环境。

下图展示了 AgentCore Gateway 使用托管 VPC 资源模式连接到私有 [Amazon API Gateway](https://aws.amazon.com/api-gateway/) 的架构。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/image-1-12.png)

当你使用托管 VPC 资源配置创建 AgentCore Gateway 目标时，AgentCore Gateway 发起请求并将其路由到资源所有者 VPC 内的 Resource Gateway。Resource Gateway 通过在你的子网中配置的 ENI 转发流量，受你配置的安全组管控。从 ENI，请求到达 [execute-api VPC 端点](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html)。在托管 VPC 资源模式下，AgentCore 代表你创建和管理 Resource Gateway，你只能以只读方式查看它。

### 自管 Lattice 资源模式

在此模式下，你需要在 AgentCore Gateway 上创建目标时先创建并管理 VPC Lattice Resource Gateway 和资源配置，然后再引用它。这让你可以掌控资源配置，包括每个 ENI 的 IPv4 地址数量、子网放置和安全组规则。更重要的是，它让你能够查看资源配置本身，包括查看、通过 [AWS Resource Access Manager (AWS RAM)](https://aws.amazon.com/ram/) 共享（跨账户连接所需）、查看与其关联的关联关系，以及在你选择时撤销这些关联。

下图展示了 AgentCore Gateway 使用自管 Lattice 资源模式连接到私有 REST API 端点的架构。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/image-2-9.png)

在自管 Lattice 资源模式下，你需要在配置 AgentCore Gateway 目标之前预先创建 Resource Gateway 和资源配置。当你调用 [CreateGatewayTarget](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateGatewayTarget.html) 时，传入资源配置 ID，将 AgentCore Gateway 目标与你的私有端点关联。在调用时，Resource Gateway 通过在你的子网中配置的 ENI 转发请求，受你配置的安全组管控。从 ENI，请求到达 execute-api VPC 端点。与托管 VPC 资源模式不同，你拥有并管理 Resource Gateway 和资源配置。

使用下表确定哪种模式适合你的架构。选择托管 VPC 资源模式可简化设置，或选择自管 Lattice 资源模式以获得对 Resource Gateway 生命周期、跨账户连接和关联可见性的控制。

| **维度** | **AgentCore 托管 VPC 资源** | **自管 Lattice 资源** |
|----------|---------------------------|----------------------|
| 设置复杂性 | 简单；提供 VPC ID、子网 ID 和安全组 ID，AgentCore 处理其余部分 | 高级；你需要自行创建和管理 Amazon VPC Lattice Resource Gateway 和资源配置，然后将资源配置 ID 传递给每个目标 |
| IPv4 消耗 | 每个托管资源网关每个 ENI 消耗 1 个 IP 地址，不可配置 | 与 Amazon Bedrock AgentCore 一起使用时，每个子网消耗一个 IP 地址。如果还附加到其他 VPC Lattice 服务网络，则根据资源网关上的 ipv4AddressesPerEni 值消耗额外 IP |
| 跨账户 | 不原生支持；使用枢纽辐射架构（VPC 对等或 AWS Transit Gateway）用于跨账户/跨 VPC 场景 | 支持 AWS Resource Access Manager (AWS RAM)，无需 VPC 对等或 Transit Gateway 即可实现直接跨账户连接 |
| 复用现有 ENI | AgentCore 自动在账户中复用托管 VPC 资源配置匹配的一个 Resource Gateway（及其 ENI）（按 Amazon VPC、子网集、安全组集、标签和 IP 地址类型匹配） | 你将多个资源配置附加到你拥有的单个 Resource Gateway；resourceConfigurationIdentifier 解析到该 Resource Gateway 的目标共享其 ENI |
| Resource Gateway 生命周期管理 | Amazon Bedrock AgentCore 代表你创建、复用和删除 Resource Gateways | 你拥有资源网关和资源配置的完整生命周期 |
| 治理和可见性 | 资源配置在 Amazon Bedrock AgentCore 服务账户中管理，在你的 Amazon VPC 控制台中不可见。底层 Resource Gateway 以只读模式在你的账户中可见 | 完全可见 Amazon VPC Lattice 控制台中的资源配置、服务网络关联和连接的域。你可以审计连接并以细粒度级别撤销访问 |
| 定价 | 仅按 GB 数据处理费用（通过 Resource Gateway 处理的数据） | 1) 服务网络关联的每小时费用 2) 按 GB 数据处理费用 |

## 开始使用 AgentCore Gateway VPC 出口

在本文中，重点介绍托管 VPC 资源模式。如果你想探索自管 Lattice 资源产品，请参阅[代码示例](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/02-AgentCore-gateway/16-vpc-egress)。在开始之前，本文假设你已基本熟悉 Amazon VPC、[AWS Command Line Interface](https://aws.amazon.com/cli/)（AWS CLI）、Amazon Bedrock AgentCore 和 Amazon Bedrock AgentCore Gateway。请确保以下内容已就位。

- [AWS Command Line Interface](https://aws.amazon.com/cli/)（AWS CLI）
- [AWS 凭证](https://docs.aws.amazon.com/cli/v1/userguide/cli-chap-configure.html)
- 公共证书颁发机构

目前 AgentCore Gateway 信任公开签名的 TLS 证书；它不信任由私有 CA 签名的证书，因此与你的后端的握手会失败。如果你的端点受私有或自签名证书保护，请在 [GitHub](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/02-AgentCore-gateway/16-vpc-egress) 上找到解决方案示例。

- [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/) 权限

你的 IAM 主体需要针对 bedrock-agentcore.amazonaws.com 的 iam:CreateServiceLinkedRole 权限，以便 AgentCore 在服务关联角色尚不存在时代表你创建它。有关所需的 IAM 策略，请参阅 Gateway [服务关联角色](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/service-linked-roles.html#gateway-service-linked-role)。

- 设置安全组

Resource Gateway 安全组控制 Resource Gateway ENI 可以向 Amazon VPC 内部资源发送什么出站流量。如果你在调用 [CreateGatewayTarget](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateGatewayTarget.html) API 时没有提供安全组，则使用默认安全组。

- AgentCore Gateway

本演练假设你已有一个现有的 AgentCore Gateway。如果你还没有创建，请运行：

```
aws bedrock-agentcore create-gateway \
 --name my-gateway \
 --role-arn arn:aws:iam:::role/AgentCoreGatewayRole
```

记录响应中的 `gatewayId`。在后续步骤创建 AgentCore Gateway 目标时需要用到它。

- 有关深入示例，请参阅 GitHub [代码库](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/02-AgentCore-gateway/16-vpc-egress)。

### 私有 Amazon API Gateway

在本节中，你将创建一个 AgentCore Gateway 目标，将路由指向私有 Amazon API Gateway。使用以下参数调用 [CreateGatewayTarget](https://docs.aws.amazon.com/bedrock-agentcore-control/latest/APIReference/API_CreateGatewayTarget.html) API。在 openApiSchema 字段中，提供你的私有 Amazon API Gateway 端点 URL（`https://{api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}`）。在 managedVpcResource 块中，提供你的 VPC ID、子网 ID 和安全组 ID。

```
 aws bedrock-agentcore-control create-gateway-target \
 --region us-west-2 \
 --cli-input-json '{
 "gatewayIdentifier": "",
 "name": "private-apigw",
 "description": "Private API Gateway",
 "targetConfiguration": {
 "mcp": {
 "openApiSchema": {
 "inlinePayload": "..."
 }
 }
 },
 "credentialProviderConfigurations": [...],
 "privateEndpoint": {
 "managedVpcResource": {
 "vpcIdentifier": "",
 "subnetIds": ["", ""],
 "endpointIpAddressType": "IPV4",
 "securityGroupIds": [""]
 }
 }
 }'
```

运行命令后，AgentCore Gateway 使用其服务关联角色在你的 VPC 中配置一个 Resource Gateway，为你指定的每个子网创建一个 ENI。

下图展示了网络流的架构图。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/image-3-8.png)

AgentCore Gateway 发起请求并将其路由到资源所有者 VPC 内配置的 Resource Gateway。流量通过你的私有子网内的 ENI，你的安全组规则控制什么内容能到达下一跳。从那里，请求到达 execute-api VPC 端点，为你的 Amazon API Gateway 内部端点提供私有连接。端点 URL 格式 `https://{api-id}-{vpce-id}.execute-api.{region}.amazonaws.com/{stage}` 是你在 CreateGatewayTarget 调用的 openApiSchema 字段中提供的内容。

### Amazon EKS 上的私有 MCP 服务器

在本节中，你将创建一个 AgentCore Gateway 目标，将路由指向在 Amazon EKS 上运行的私有 MCP 服务器。使用以下参数调用 CreateGatewayTarget API。在 mcpServer 块中，提供你的内部 MCP 服务器端点 URL。在 managedVpcResource 块中，提供你的 VPC ID、子网 ID 和安全组 ID。

```
 aws bedrock-agentcore-control create-gateway-target \
 --region us-west-2 \
 --cli-input-json '{
 "gatewayIdentifier": "",
 "name": "private-apigw",
 "description": "Private API Gateway",
 "targetConfiguration": {
 "mcp": {
 "mcpServer": {
 "endpoint": "https://internal.example.com/csm/mcp"
 }
 }
 },
 "credentialProviderConfigurations": [...],
 "privateEndpoint": {
 "managedVpcResource": {
 "vpcIdentifier": "",
 "subnetIds": ["", ""],
 "endpointIpAddressType": "IPV4",
 "securityGroupIds": [""]
 }
 }
 }'
```

运行此命令后，AgentCore 在你的 VPC 中配置一个 Resource Gateway，为你指定的每个子网创建一个 ENI。下图展示了端到端流量路径的架构图。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/image-4-8.png)

AgentCore Gateway 向你的内部端点发送 HTTPS 请求。Amazon Route 53 私有托管区将该域名解析到内部网络负载均衡器（[Network Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html)，NLB）。请求通过 Resource Gateway 进入资源所有者 VPC，经过受你的安全组管控的 ENI，到达 NLB。NLB 使用 [AWS Certificate Manager (ACM) 公共证书](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html)在 443 端口终止 TLS，然后通过 80 端口将请求以 HTTP 方式转发到在 Amazon EKS 上运行的 [NGINX Ingress Controller](https://docs.nginx.com/nginx-ingress-controller/)，由其路由到适当的 Pod。

### 私有 REST API 目标

在本节中，你将创建一个 AgentCore Gateway 目标，将路由指向私有 REST API 端点。这适用于在你的 Amazon VPC 内运行的任何 REST API，例如容器化微服务。CreateGatewayTarget API 调用遵循与前几节相同的模式。在 openApiSchema 字段中，提供描述 REST API 的 OpenAPI schema。在 `managedVpcResource` 块中，提供你的 VPC ID、子网 ID 和安全组 ID。AgentCore Gateway 在你的 VPC 中配置 Resource Gateway 后，下图展示了端到端流量路径的架构图。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/29/image-5-8.png)

AgentCore Gateway 向你的内部端点发送 HTTPS 请求。Amazon Route 53 私有托管区将该域名解析到内部应用负载均衡器（[Application Load Balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)，ALB）。请求通过 Resource Gateway 进入资源所有者 VPC，经过受你的安全组管控的 ENI，到达内部 ALB。ALB 使用 AWS Certificate Manager (ACM) 公共证书在 443 端口终止 TLS，然后通过 8000 端口将请求以 HTTP 方式转发到包含你的后端服务器的目标组。

## 清理

为避免持续产生费用，请删除本演练中创建的所有资源。有关参考，请参阅 AgentCore Gateway VPC 出口[定价页面](https://aws.amazon.com/bedrock/agentcore/pricing/)。此外，Amazon EKS 集群、负载均衡器和 API Gateway 端点在运行时会产生费用。验证你的资源已被删除以停止计费。如果你按照 GitHub [示例](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/02-AgentCore-gateway/16-vpc-egress)操作，请确保在每个 Jupyter Notebook 结尾运行清理部分。

如果你使用了托管 VPC 资源模式，删除 Gateway 目标将删除关联的 Amazon VPC Resource Gateway。

```
aws bedrock-agentcore delete-gateway-target \
 --gateway-identifier \
 --target-id
```

## 结论

随着 AI Agent 承担越来越复杂的任务，它们需要安全访问驱动你业务的工具和服务——其中许多都位于私有网络中。AgentCore Gateway VPC 出口允许你的 Agent 访问私有 MCP 服务器、内部 API、数据库和本地系统，而无需将它们暴露到公共互联网。托管 VPC 资源模式直接与你现有的 VPC 集成，只需极少配置。自管 Lattice 资源模式提供细粒度控制，但需要额外设置。两种模式都通过不离开 AWS 网络的 Resource Gateway 路由流量。

## 后续步骤

- 识别你环境中一个会从 AI Agent 访问中受益的内部 API 或 MCP 服务器
- 审查你现有的 Amazon VPC 架构，确定哪种模式（托管 VPC 资源或自管 Lattice 资源）符合你的需求
- 查阅 Amazon Bedrock AgentCore Gateway [文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-vpc-egress.html)了解其他配置选项
- 探索 Amazon VPC Lattice Resource Gateway [文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/vpc-egress-private-endpoints.html)了解跨账户场景
- 探索更多集成模式和高级配置，请参阅 [GitHub 示例](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/02-AgentCore-gateway/16-vpc-egress)

## 引用

- 原文：[Configuring Amazon Bedrock AgentCore Gateway for secure access to private resources](https://aws.amazon.com/blogs/machine-learning/configuring-amazon-bedrock-agentcore-gateway-for-secure-access-to-private-resources/)
- [Amazon Bedrock AgentCore Gateway 文档](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html)
- [Resource Gateway 文档](https://docs.aws.amazon.com/vpc/latest/privatelink/resource-gateway.html)
- [AgentCore Gateway VPC 出口定价](https://aws.amazon.com/bedrock/agentcore/pricing/)
