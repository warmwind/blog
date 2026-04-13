---
title: 在 App Service 上使用 OpenTelemetry 和 Application Insights 新 Agents 视图监控 AI Agent
pubDatetime: 2026-04-13T10:30:00+08:00
description: 使用 OpenTelemetry GenAI 语义约定为 AI Agent 添加可观测性，并通过 Application Insights 新的 Agents（预览版）视图获得对 Agent 运行、Token 用量和工具调用的全面可见性。
slug: monitor-ai-agents-on-app-service-with-opentelemetry
originalTitle: "Monitor AI Agents on App Service with OpenTelemetry and the New Application Insights Agents View"
originalUrl: "https://techcommunity.microsoft.com/blog/appsonazureblog/monitor-ai-agents-on-app-service-with-opentelemetry-and-the-new-application-insig/4510104"
---

原文标题：Monitor AI Agents on App Service with OpenTelemetry and the New Application Insights Agents View<br>
原文链接：https://techcommunity.microsoft.com/blog/appsonazureblog/monitor-ai-agents-on-app-service-with-opentelemetry-and-the-new-application-insig/4510104

> **系列第 2 篇（共 2 篇）：** 在[博客 1](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017) 中，我们使用 Microsoft Agent Framework (MAF) 1.0 GA 在 Azure App Service 上部署了一个多 Agent 旅行规划应用。本文将深入探讨如何使用 OpenTelemetry 为这些 Agent 添加遥测埋点，并点亮 Application Insights 中全新的 **Agents（预览版）** 视图。

> **📋 前置条件：** 本文假设你已经按照[博客 1](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017) 中的指引，将多 Agent 旅行规划应用部署到了 Azure App Service。如果你还没有部署，请先完成那篇文章中的步骤——你需要一个正在运行的 App Service，且已配置好 Agent、Service Bus、Cosmos DB 和 Azure OpenAI，本文中的监控步骤才能正常工作。

## 部署 Agent 只是成功了一半

在博客 1 中，我们介绍了如何在 Azure App Service 上部署多 Agent 旅行规划应用。六个各司其职的 Agent——Coordinator（协调者）、Currency Converter（汇率转换）、Weather Advisor（天气顾问）、Local Knowledge Expert（本地知识专家）、Itinerary Planner（行程规划）和 Budget Optimizer（预算优化）——协同工作，生成全面的旅行计划。架构上采用 ASP.NET Core API 作为前端，WebJob 处理异步任务，Azure Service Bus 负责消息传递，Azure OpenAI 提供智能能力。

但关键在于：将 Agent 部署到生产环境只是成功了一半。一旦它们开始运行，你需要回答这些问题：

- 哪个 Agent 消耗的 Token 最多？

- Itinerary Planner 的响应时间与 Weather Advisor 相比如何？

- Coordinator 在每个工作流中是否发起了过多的 LLM 调用？

- 当出问题时，流水线中是哪个 Agent 失败了？

传统 APM 能提供 HTTP 延迟和异常率，但这只是基本功。对于 AI Agent，你需要看到 *Agent 内部* 的情况——模型调用、工具调用、Token 消耗。而这正是 Application Insights 新的 **Agents（预览版）** 视图所提供的能力，底层由 OpenTelemetry 和 GenAI 语义约定驱动。

让我们来逐步拆解它的工作原理。

## Application Insights 中的 Agents（预览版）视图

Azure Application Insights 现在提供了一个专门的 **Agents（预览版）** 面板，为 AI Agent 量身打造了统一的监控体验。这不是一个通用仪表板——它原生理解 Agent 概念。无论你的 Agent 是用 Microsoft Agent Framework、Azure AI Foundry、Copilot Studio 还是第三方框架构建的，只要遥测数据遵循 [GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)，这个视图就能正常工作。

以下是开箱即用的功能：

- **Agent 下拉过滤器** ——由遥测数据中的 `gen_ai.agent.name` 值自动填充。在我们的旅行规划应用中，它会显示全部六个 Agent："Travel Planning Coordinator"、"Currency Conversion Specialist"、"Weather & Packing Advisor"、"Local Expert & Cultural Guide"、"Itinerary Planning Expert" 和 "Budget Optimization Specialist"。你可以将整个仪表板过滤到单个 Agent，也可以查看全部。

- **Token 用量指标** ——输入和输出 Token 消耗量的可视化，按 Agent 分类。一眼就能看出哪些 Agent 运行成本最高。

- **运维指标** ——每个 Agent 的延迟分布、错误率和吞吐量。在用户察觉之前发现性能回退。

- **端到端事务详情** ——点击任意 Trace 查看完整工作流：调用了哪些 Agent、它们调用了什么工具、每个步骤花了多长时间。"简单视图"以故事化的格式呈现 Agent 的执行步骤，非常易于跟踪理解。

- **Grafana 集成** ——一键导出到 Azure Managed Grafana，用于构建自定义仪表板和告警。

 

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLUlyYUJjcg?image-dimensions=999x651&revision=1)
关键洞察：这个视图并非魔法。它之所以能工作，是因为遥测数据使用了定义良好的语义约定进行结构化。接下来让我们看看这些约定。

> **📖 文档：** [Application Insights Agents（预览版）视图文档](https://learn.microsoft.com/en-us/azure/azure-monitor/app/agents-view)

## GenAI 语义约定——基石

整个 Agents 视图由 [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) 驱动。这是一组标准化的 Span 属性，以任何可观测性后端都能理解的方式描述 AI Agent 的行为。可以把它们看作你的埋点代码与 Application Insights 之间的"契约"。

让我们逐一了解关键属性及其重要性：

### `gen_ai.agent.name`

这是 Agent 的人类可读名称。在我们的旅行规划应用中，每个 Agent 在构造 MAF `ChatClientAgent` 时通过 `name` 参数设置此值——例如 `"Weather & Packing Advisor"` 或 `"Budget Optimization Specialist"`。正是这个属性填充了 Agents 视图中的 Agent 下拉菜单。没有它，Application Insights 将无法在遥测数据中区分不同的 Agent。它是 Agent 级别监控中最重要的属性。

### `gen_ai.agent.description`

Agent 功能的简要描述。例如，我们的 Weather Advisor 被描述为 *"Provides weather forecasts, packing recommendations, and activity suggestions based on destination weather conditions."*（基于目的地天气条件提供天气预报、打包建议和活动推荐。）这个元数据帮助运维人员和值班工程师快速了解 Agent 的职责，无需深入源代码。它会显示在 Trace 详情中，有助于在调试时理解上下文。

### `gen_ai.agent.id`

Agent 实例的唯一标识符。在 MAF 中，通常是自动生成的 GUID。`gen_ai.agent.name` 是面向人类的标签，而 `gen_ai.agent.id` 是机器层面的稳定标识。即使你重命名了 Agent，ID 也不会改变，这对于跨代码部署追踪 Agent 行为非常重要。

### `gen_ai.operation.name`

正在执行的操作类型。取值包括：`"chat"` 表示标准 LLM 调用，`"execute_tool"` 表示工具/函数调用。在我们的旅行规划应用中，当 Weather Advisor 通过 NWS 调用 `GetWeatherForecast` 函数，或者 Currency Converter 通过 Frankfurter API 调用 `ConvertCurrency` 时，这些工具调用会获得独立的 Span，其 `gen_ai.operation.name = "execute_tool"`。这让你可以将 LLM 思考时间与工具执行时间分开度量——这对于性能优化至关重要。

### `gen_ai.request.model` / `gen_ai.response.model`

发送请求时指定的模型和实际处理响应的模型（当服务提供商进行模型路由时，两者可能不同）。在我们的场景中，两者都是 `"gpt-4o"`，因为这是我们通过 Azure OpenAI 部署的模型。这些属性让你可以追踪各 Agent 的模型使用情况、发现意外的模型分配、将性能变化与模型更新关联起来。

### `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`

每次 LLM 调用的 Token 消耗量。这正是 Agents 视图中 Token 用量可视化的数据来源。Coordinator Agent 聚合来自所有五个专业 Agent 的结果，往往有更高的输出 Token 数，因为它需要综合生成完整的旅行计划。Currency Converter 执行的是针对性的 API 调用，总体 Token 用量较低。这些属性让你能够回答"哪个 Agent 花费最多？"这个问题——更重要的是，让你在 Token 用量出现异常飙升时设置告警。

### `gen_ai.system`

AI 系统或提供商。在我们的场景中，值为 `"openai"`（由 Azure OpenAI 客户端的埋点自动设置）。如果你使用了多个 AI 提供商——比如用 Azure OpenAI 做规划，用本地模型做分类——这个属性可以帮助你进行筛选和对比。

这些属性共同构建了一个远超通用 Tracing 的、丰富且结构化的 Agent 行为视图。正是它们让 Application Insights 能够呈现包含 Token 分解、延迟分布和端到端工作流视图的 Agent 专属仪表板。如果没有这些约定，你看到的只是一堆指向 OpenAI 端点的不透明 HTTP 调用。

> **💡 关键要点：** GenAI 语义约定将通用的分布式 Trace 转化为 *Agent 感知* 的可观测性。它们是你的代码与 Agents 视图之间的桥梁。任何遵循这些属性的框架——MAF、Semantic Kernel、LangChain——都能点亮这个仪表板。

## OpenTelemetry 埋点的两个层次

我们的旅行规划示例应用在两个不同的层级进行了埋点，分别捕获 Agent 行为的不同方面。让我们逐一查看。

### 第 1 层：IChatClient 级别的埋点

第一层使用 `Microsoft.Extensions.AI` 在 `IChatClient` 级别进行埋点。我们在这里用 OpenTelemetry 包装 Azure OpenAI 聊天客户端：

```
var client = new AzureOpenAIClient(azureOpenAIEndpoint, new DefaultAzureCredential());
// Wrap with OpenTelemetry to emit GenAI semantic convention spans
return client.GetChatClient(modelDeploymentName).AsIChatClient()
    .AsBuilder()
    .UseOpenTelemetry()
    .Build();
```

仅这一个 `.UseOpenTelemetry()` 调用就能拦截每次 LLM 调用，并发出包含以下属性的 Span：

- `gen_ai.system` —— AI 提供商（如 `"openai"`）

- `gen_ai.request.model` / `gen_ai.response.model` —— 使用了哪个模型

- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` —— 每次调用的 Token 消耗

- `gen_ai.operation.name` —— 操作类型（`"chat"`）

可以把这一层理解为"LLM 层"——它捕获的是 *模型在做什么*，与哪个 Agent 调用了它无关。这是以模型为中心的遥测数据。

### 第 2 层：Agent 级别的埋点

第二层利用 MAF 1.0 GA 内置的 OpenTelemetry 支持，在 Agent 级别进行埋点。这在所有 Agent 共同继承的 `BaseAgent` 类中实现：

```
Agent = new ChatClientAgent(
    chatClient,
    instructions: Instructions,
    name: AgentName,
    description: Description,
    tools: chatOptions.Tools?.ToList())
    .AsBuilder()
    .UseOpenTelemetry(sourceName: AgentName)
    .Build();
```

MAF Agent Builder 上的 `.UseOpenTelemetry(sourceName: AgentName)` 调用会发出另一组 Span：

- `gen_ai.agent.name` —— Agent 的人类可读名称（如 `"Weather & Packing Advisor"`）

- `gen_ai.agent.description` —— Agent 的功能描述

- `gen_ai.agent.id` —— 唯一的 Agent 标识符

- Agent 调用 Trace —— 表示一次 Agent 调用完整生命周期的 Span

这一层是"Agent 层"——它捕获的是 *哪个 Agent 在执行工作*，并提供支撑 Agents 视图下拉菜单和按 Agent 过滤所需的身份信息。

### 为什么两层都需要？

当两层都启用时，你能获得最丰富的遥测数据。Agent 级别的 Span 嵌套包裹着 LLM 级别的 Span，形成如下的 Trace 层次结构：

```
Agent: "Weather & Packing Advisor" (gen_ai.agent.name)
  └── chat (gen_ai.operation.name)
        ├── model: gpt-4o, input_tokens: 450, output_tokens: 120
        └── execute_tool: GetWeatherForecast
              └── chat (follow-up with tool results)
                    └── model: gpt-4o, input_tokens: 680, output_tokens: 350
```

这里有一个取舍：当两层都启用时，你可能会看到一些 Span 重复，因为 `IChatClient` 包装器和 MAF Agent 包装器都会为同一次底层 LLM 调用生成 Span。如果你觉得遥测数据太冗余，可以禁用其中一层：

- **仅保留 Agent 层**（从 `IChatClient` 中移除 `.UseOpenTelemetry()`）—— 保留 Agent 身份信息，但失去每次调用的 Token 明细。

- **仅保留 IChatClient 层**（从 Agent Builder 中移除 `.UseOpenTelemetry()`）—— 保留详细的 LLM 指标，但在 Agents 视图中失去 Agent 身份信息。

为了获得 Agents（预览版）视图的最完整体验，我们建议两层都保持启用。官方示例同时使用了两层，Agents 视图也能优雅地处理重叠的 Span。

> **📖 文档：** [MAF 可观测性指南](https://learn.microsoft.com/en-us/agent-framework/agents/observability)

## 将遥测数据导出到 Application Insights

生成 OpenTelemetry Span 的前提是，它们需要流向一个可以查询的地方。好消息是，**Azure App Service 与 Application Insights 有深度原生集成** —— App Service 可以自动为你的应用添加埋点、转发平台日志并开箱即用地展示健康指标。完整的监控功能概览请参阅[监控 Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/monitor-app-service?tabs=aspnetcore)。

对于我们的 AI Agent 场景，我们需要超越内置的平台遥测。前面章节中配置的 GenAI 语义约定 Span 需要流入 App Insights，这样 Agents（预览版）视图才能渲染它们。我们的旅行规划应用有两个宿主进程——ASP.NET Core API 和一个 WebJob——每个都需要略有不同的导出器配置。

### ASP.NET Core API —— Azure Monitor OpenTelemetry Distro

对于 API 项目，只需一行代码。[Azure Monitor OpenTelemetry Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore) 会处理一切：

```
// Configure OpenTelemetry with Azure Monitor for traces, metrics, and logs.
// The APPLICATIONINSIGHTS_CONNECTION_STRING env var is auto-discovered.
builder.Services.AddOpenTelemetry().UseAzureMonitor();
```

就这样。该 Distro 自动完成：

- 发现 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量

- 配置 Trace、Metric 和 Log 导出器到 Application Insights

- 设置合适的采样和批处理策略

- 注册标准的 ASP.NET Core HTTP 埋点

这是任何 ASP.NET Core 应用的推荐做法。一个 NuGet 包（`Azure.Monitor.OpenTelemetry.AspNetCore`），一行代码，零配置文件。

### WebJob —— 手动配置导出器

WebJob 是非 ASP.NET Core 宿主（它使用 `Host.CreateApplicationBuilder`），因此 Distro 的便捷方法不可用。我们需要显式配置导出器：

```
// Configure OpenTelemetry with Azure Monitor for the WebJob (non-ASP.NET Core host).
// The APPLICATIONINSIGHTS_CONNECTION_STRING env var is auto-discovered.
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("TravelPlanner.WebJob"))
    .WithTracing(t => t
        .AddSource("*")
        .AddAzureMonitorTraceExporter())
    .WithMetrics(m => m
        .AddMeter("*")
        .AddAzureMonitorMetricExporter());

builder.Logging.AddOpenTelemetry(o => o.AddAzureMonitorLogExporter());
```

有几点需要注意：

- `.AddSource("*")` —— 订阅 *所有* Trace Source，包括 MAF 的 `.UseOpenTelemetry(sourceName: AgentName)` 生成的 Source。在生产环境中，你可能会将其缩小到特定的 Source Name 以优化性能。

- `.AddMeter("*")` —— 类似地捕获所有 Metric，包括埋点层生成的 GenAI Metric。

- `.ConfigureResource(r => r.AddService("TravelPlanner.WebJob"))` —— 为所有遥测数据打上服务名称标签，以便在 Application Insights 中区分 API 和 WebJob 的遥测数据。

- 连接字符串仍然从 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量自动发现——无需显式传递。

两种方式的关键区别在于配置的繁琐程度，而非能力。两者都向 Application Insights 发送相同的 GenAI Span；无论使用哪种导出器配置，Agents 视图的工作方式完全相同。

> **📖 文档：** [Azure Monitor OpenTelemetry Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore)

## 基础设施即代码——配置监控基础设施

监控基础设施通过 Bicep 模块与应用的其他 Azure 资源一起配置。以下是各部分如何协同工作。

### Log Analytics Workspace

`infra/core/monitor/loganalytics.bicep` 创建 Application Insights 背后的 Log Analytics Workspace：

```
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}
```

### Application Insights

`infra/core/monitor/appinsights.bicep` 创建一个连接到 Log Analytics 的基于 Workspace 的 Application Insights 资源：

```
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
  }
}

output connectionString string = appInsights.properties.ConnectionString
```

### 将一切串联起来

在 `infra/main.bicep` 中，Application Insights 的连接字符串作为应用设置传递给 App Service：

```
appSettings: {
  APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.outputs.connectionString
  // ... other app settings
}
```

这是至关重要的粘合剂：当应用启动时，OpenTelemetry Distro（或手动配置的导出器）会自动发现这个环境变量，开始向你的 Application Insights 资源发送遥测数据。代码中没有连接字符串，没有配置文件——一切由基础设施驱动。

同一个连接字符串对 API 和 WebJob 都可用，因为它们运行在同一个 App Service 上。两个宿主进程的所有 Agent 遥测数据都流入同一个 Application Insights 资源，为你提供整个应用的统一视图。

## 实际操作演示

一旦应用部署完成并开始处理旅行计划请求，以下是在 Application Insights 中探索 Agent 遥测数据的方法。

### 第 1 步：打开 Agents（预览版）视图

在 Azure 门户中，导航到你的 Application Insights 资源。在左侧导航栏的 Investigations 部分下，找到 **Agents（预览版）**。点击即可打开统一的 Agent 监控仪表板。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLTdsbktXSQ?image-dimensions=999x651&revision=1)

### 第 2 步：按 Agent 过滤

页面顶部的 Agent 下拉菜单由遥测数据中的 `gen_ai.agent.name` 值填充。你会看到全部六个 Agent：

- Travel Planning Coordinator

- Currency Conversion Specialist

- Weather & Packing Advisor

- Local Expert & Cultural Guide

- Itinerary Planning Expert

- Budget Optimization Specialist

选择特定 Agent 可将整个仪表板——Token 用量、延迟、错误率——过滤到该 Agent。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLUpGT1hwZA?image-dimensions=740x470&revision=1)

### 第 3 步：查看 Token 用量

Token 用量面板显示所选时间范围内的总输入和输出 Token 消耗量。对比各 Agent 可找出消耗最大的。在我们的测试中，Coordinator Agent 始终使用最多的输出 Token，因为它需要聚合和综合来自所有五个专业 Agent 的结果。

### 第 4 步：深入 Trace 详情

点击 **"View Traces with Agent Runs"** 查看所有 Agent 执行记录。每一行代表一次工作流运行。你可以按时间范围、状态（成功/失败）和特定 Agent 进行过滤。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLU1NN1N3Rw?image-dimensions=817x999&revision=1)

### 第 5 步：端到端事务详情

点击任意 Trace 打开端到端事务详情。**"简单视图"** 将 Agent 工作流呈现为一个连贯的故事——展示每个步骤、哪个 Agent 处理了它、花了多长时间以及调用了什么工具。对于一个完整的旅行计划，你会看到 Coordinator 向每个专业 Agent 分派任务，对 NWS 天气 API 和 Frankfurter 汇率 API 的工具调用，以及最终的汇总步骤。

## Grafana 仪表板

Application Insights 中的 Agents（预览版）视图非常适合即席调查。若要进行持续监控和告警，Azure Managed Grafana 提供了专为 Agent 工作负载设计的预构建仪表板。

在 Agents 视图中，点击 **"Explore in Grafana"** 即可直接跳转到这些仪表板：

- **[Agent Framework Dashboard](https://aka.ms/amg/dash/af-agent)** —— 按 Agent 维度的指标，包括 Token 用量趋势、延迟百分位、错误率和吞吐量随时间的变化。适合固定到运维监控大屏。

- **[Agent Framework Workflow Dashboard](https://aka.ms/amg/dash/af-workflow)** —— 工作流级别的指标，展示多 Agent 编排的端到端性能。查看完整旅行计划的耗时、识别瓶颈 Agent 并追踪成功率。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLWl1YjBTSw?image-dimensions=999x514&revision=1)
这些仪表板查询的是 Log Analytics 中相同的底层数据，因此无需额外的埋点工作。只要你的遥测数据能点亮 Agents 视图，它同样能点亮 Grafana。

## 关键 NuGet 包汇总

以下是使这一切得以运作的 NuGet 包，摘自实际项目文件：

|Package|Version|Purpose|
|`Azure.Monitor.OpenTelemetry.AspNetCore`|1.3.0|ASP.NET Core 的 Azure Monitor OTEL Distro（API 项目）。一行代码即可配置 Trace、Metric 和 Log。|
|`Azure.Monitor.OpenTelemetry.Exporter`|1.3.0|非 ASP.NET Core 宿主的 Azure Monitor OTEL 导出器（WebJob）。Trace、Metric 和 Log 导出器。|
|`Microsoft.Agents.AI`|1.0.0|MAF 1.0 GA —— `ChatClientAgent`，通过 `.UseOpenTelemetry()` 实现 Agent 级别埋点。|
|`Microsoft.Extensions.AI`|10.4.1|`IChatClient` 抽象层，通过 `.UseOpenTelemetry()` 实现 LLM 级别埋点。|
|`OpenTelemetry.Extensions.Hosting`|1.11.2|OTEL 依赖注入集成，用于 `Host.CreateApplicationBuilder`（WebJob）。|
|`Microsoft.Extensions.AI.OpenAI`|10.4.1|`IChatClient` 的 OpenAI/Azure OpenAI 适配器。将 Azure OpenAI SDK 桥接到 M.E.AI 抽象层。|

## 总结

让我们回顾全局。在这个两篇系列文章中，我们从零开始，在 Azure App Service 上构建了一个完全可观测的、生产级的多 Agent AI 应用：

- **博客 1** 介绍了使用 MAF 1.0 GA 部署多 Agent 旅行规划应用——Agent、架构、基础设施。

- **博客 2**（本文）展示了如何使用 OpenTelemetry 为这些 Agent 添加埋点，解释了使 Agent 感知监控成为可能的 GenAI 语义约定，并完整演示了 Application Insights 中新的 Agents（预览版）视图。

整体模式非常简洁：

- 在 `IChatClient` 级别添加 `.UseOpenTelemetry()` 获取 LLM 指标。

- 在 MAF Agent 级别添加 `.UseOpenTelemetry(sourceName: AgentName)` 获取 Agent 身份信息。

- 通过 Azure Monitor Distro（一行代码）或手动导出器将数据导出到 Application Insights。

- 通过 Bicep 和环境变量传递连接字符串。

- 打开 Agents（预览版）视图，开始监控。

借助 MAF 1.0 GA 内置的 OpenTelemetry 支持和 Application Insights 新的 Agents 视图，你只需极少的代码就能获得生产级的 AI Agent 可观测性。GenAI 语义约定确保你的遥测数据是结构化的、可移植的，并且能被任何兼容的后端理解。由于一切都基于标准 OpenTelemetry，你不会被锁定在任何单一供应商——更换导出器，你的遥测数据就能发送到 Jaeger、Grafana、Datadog 或任何你需要的地方。

现在，去看看你的 Agent 在做什么吧。

## 资源

- **示例仓库：** [seligj95/app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)

- **App Insights Agents（预览版）视图：** [文档](https://learn.microsoft.com/en-us/azure/azure-monitor/app/agents-view)

- **GenAI 语义约定：** [OpenTelemetry GenAI Registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

- **MAF 可观测性指南：** [Microsoft Agent Framework Observability](https://learn.microsoft.com/en-us/agent-framework/agents/observability)

- **Azure Monitor OpenTelemetry Distro：** [为 .NET 启用 OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore)

- **Grafana Agent Framework Dashboard：** [aka.ms/amg/dash/af-agent](https://aka.ms/amg/dash/af-agent)

- **Grafana Workflow Dashboard：** [aka.ms/amg/dash/af-workflow](https://aka.ms/amg/dash/af-workflow)

- **博客 1：** [在 Azure App Service 上使用 MAF 1.0 GA 构建多 Agent AI 应用](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017)
