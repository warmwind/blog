---
title: "追踪每一个 Token：Microsoft Foundry Agents 的粒度成本和使用指标"
pubDatetime: 2026-04-09T00:00:00+08:00
description: "使用 Azure 服务实现 AI 代理的可观测性和精细成本追踪"
slug: tracking-every-token
originalTitle: "Tracking Every Token: Granular Cost and Usage Metrics for Microsoft Foundry Agents"
originalUrl: https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/tracking-every-token-granular-cost-and-usage-metrics-for-microsoft-foundry-agent/4503143
---

原文标题：Tracking Every Token: Granular Cost and Usage Metrics for Microsoft Foundry Agents<br>
原文链接：https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/tracking-every-token-granular-cost-and-usage-metrics-for-microsoft-foundry-agent/4503143

当组织扩大他们对 AI 代理的使用时，一个问题不断浮现：每个代理实际成本是多少？不是在订阅级别。不是在资源组级别。而是按代理、按模型、按请求。

本文介绍了一个解决方案，该方案通过将三个 Azure 服务（Microsoft AI Foundry、Azure API 管理 (APIM) 和 Application Insights）结合起来，创建了一个可观测、计量的 AI 网关，具有粒度级 Token 遥测功能，包括自定义维度，使您能够追踪每一个成本产生的代理。

#### 问题：AI 成本可能是一个黑匣子

Foundry 的内置监控和成本视图最终由遥测提供支持，该遥测在 REST API 级别捕获 LLM 使用情况。此外，要计算按代理成本，您需要：

- 将 API 调用映射到特定的代理
- 从嵌套在 JSON 响应中的模型特定 Token 定价获取成本
- 跨多个完成聚合 Token 信息（例如，当代理链接调用时）
- 以易于审计和监控的方式存储这些数据

#### 为什么构建此解决方案

此解决方案是为了缩小"我们部署了代理"和"我确切知道每个代理花费了多少"之间的可观测性差距而构建的。设计目标是：

1. 按代理捕获粒度成本（按模型、按完成）
2. 提供易于查询的存储，用于成本审计和历史分析
3. 实现近实时的警报和异常检测
4. 保持所有内容本地化和可审计，遵守监管和合规要求

#### 工作原理

该架构故意简单——三个服务，一个数据流。重要的是使用标准：

Azure API 管理充当 AI 网关。对 Foundry 托管代理的每个请求都通过 APIM 路由，它日志记录请求/响应详细信息，包括完整的 LLM 使用数据。

笔记本旨在进行测试和快速迭代——调用代理、检查响应、查看 Token 使用情况。然后您可以快速将这种反馈转移到生产中。

Application Insights 通过 OpenTelemetry 接收此遥测。该解决方案发送两种类型的数据：

- customMetrics——提示 Token、完成 Token、总成本的累计计数器
- traces——具有 `custom_dimensions` 的结构化日志条目，包含代理名称、模型、完成和成本

- traces——存储您的应用程序的追踪/日志消息（加上自定义属性/度量）

#### 演示粒度成本和使用指标

这就是解决方案闪耀的地方。一旦遥测流动，您可以回答详细问题。

每个请求的详细信息

查询 `traces` 表以查看每个单独的代理调用，具有完整的 Token 和成本详细信息：

```
traces | where message == "llm.usage" | extend cd = parse_json(replace_string(tostring(customDimensions), '"', '"')) | project timestamp, tostring(customDimensions.agent_name), tostring(customDimensions.model), tostring(customDimensions.prompt_tokens), tostring(customDimensions.completion_tokens), tostring(customDimensions.cost)
```

这为您提供了一个逐项审计追踪——每个请求、每个代理、每个 Token。

按代理的聚合指标

按代理、模型和时间段分组来查看聚合消费：

```
customMetrics
| where name in ("prompt_tokens", "completion_tokens", "total_cost")
| extend agent_name = tostring(customDimensions.agent_name)
| summarize Total = sum(value) by agent_name, name
```

成本异常检测

监控超过阈值的完成（例如，意外昂贵的 Token 使用）：

```
traces
| where message == "llm.usage"
| extend cost = todouble(customDimensions.cost)
| extend agent = tostring(customDimensions.agent_name)
| where cost > 10  // Alert if any completion costs > $10
| project timestamp, agent, cost, customDimensions
```

#### 部署说明

1. 使用 APIM 的标准部署流程，将您的 Foundry 代理作为后端设置。
2. 配置策略以日志记录请求/响应，包括完整的 LLM 使用数据。
3. 将 APIM 连接到 Application Insights，并开始使用 KQL 查询成本数据。
4. 根据需要建立警报和自定义仪表板。

#### 为什么这很重要

透明的成本追踪对于在生产中管理 AI 代理至关重要。这种方法提供了：

- 完整的可观测性，无需特殊的代理检测
- 易于审计的 Token 级详细信息
- 按需扩展的灵活查询
- 标准 Azure 服务，无需自定义基础设施

对于任何在生产中运行 AI 代理的组织来说，这都是必不可少的实践。

#### 参考资源

- Microsoft AI Foundry 文档：https://learn.microsoft.com/ai-foundry
- Azure API 管理：https://learn.microsoft.com/azure/api-management
- Application Insights KQL 查询：https://learn.microsoft.com/azure/azure-monitor/logs/kusto-query-language
- 原文链接：https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/tracking-every-token-granular-cost-and-usage-metrics-for-microsoft-foundry-agent/4503143
