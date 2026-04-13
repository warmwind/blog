---
title: 在 App Service 上使用 OpenTelemetry 和新的 Application Insights Agents 视图监控 AI 代理
pubDatetime: 2026-04-13T00:00:00.000Z
description: 使用 OpenTelemetry GenAI 语义约定检测您的 AI 代理，并在 Application Insights 中启用新的 Agents（预览版）体验，以获得对代理运行、令牌使用和工具调用的完全可见性。
category: 
tags: []
---

## 使用 OpenTelemetry GenAI 语义约定检测您的 AI 代理，并在 Application Insights 中启用新的 Agents（预览版）体验，以获得对代理运行、令牌使用和工具调用的完全可见性。

> **第 2 部分，共 2 部分：** 在[博客 1](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017) 中，我们使用 Microsoft Agent Framework (MAF) 1.0 GA 在 Azure App Service 上部署了多代理旅行规划器。本文深入探讨了如何使用 OpenTelemetry 检测这些代理，并启用 Application Insights 中全新的 **Agents（预览版）**视图。

> **📋 前置条件：** 本文假设您已按照[博客 1](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017) 中的指导将多代理旅行规划器部署到 Azure App Service。如果您还没有部署应用程序，请首先从那里开始 — 您需要一个正在运行的 App Service，其中包含代理、Service Bus、Cosmos DB 和 Azure OpenAI 的配置，本文中的监控步骤才能正常工作。

## 部署代理只是解决方案的一半

在博客 1 中，我们介绍了在 Azure App Service 上部署多代理旅行规划应用程序。六个专门的代理 — 协调员、货币转换器、天气顾问、本地知识专家、行程规划员和预算优化器 — 协同工作生成全面的旅行计划。该架构使用由 WebJob 支持的 ASP.NET Core API 来处理异步处理、Azure Service Bus 来处理消息传递，以及 Azure OpenAI 作为大脑。

但这里是关键点：在生产环境中部署代理只是解决方案的一半。一旦它们运行，您需要回答这样的问题：

- 哪个代理消耗的令牌最多？

- 行程规划员的运行时间与天气顾问相比如何？

- 协调员每个工作流是否进行了太多 LLM 调用？

- 当出现问题时，管道中的哪个代理失败了？

传统的 APM 提供 HTTP 延迟和异常率。那是基本的。对于 AI 代理，您需要看到*代理内部* — 模型调用、工具调用、令牌支出。这正是 Application Insights 新的 **Agents（预览版）**视图所提供的，由 OpenTelemetry 和 GenAI 语义约定提供支持。

让我们深入了解它是如何工作的。

## Application Insights 中的 Agents（预览版）视图

Azure Application Insights 现在包括一个专用的 **Agents（预览版）**刀片，提供为 AI 代理量身定制的统一监控。这不仅仅是一个通用仪表板 — 它原生理解代理概念。无论您的代理是使用 Microsoft Agent Framework、Azure AI Foundry、Copilot Studio 还是第三方框架构建的，只要您的遥测遵循 [GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)，此视图就会亮起。

以下是开箱即用的功能：

- **代理下拉过滤器** — 一个由遥测中的 `gen_ai.agent.name` 值填充的下拉菜单。在我们的旅行规划器中，这显示所有六个代理："Travel Planning Coordinator"（旅行规划协调员）、"Currency Conversion Specialist"（货币转换专家）、"Weather & Packing Advisor"（天气与打包顾问）、"Local Expert & Cultural Guide"（本地专家和文化指南）、"Itinerary Planning Expert"（行程规划专家）和"Budget Optimization Specialist"（预算优化专家）。您可以将整个仪表板过滤到一个代理或查看所有代理。

- **令牌使用指标** — 输入和输出令牌消耗的可视化，按代理分类。立即查看哪些代理运行成本最高。

- **运营指标** — 每个代理的延迟分布、错误率和吞吐量。在用户注意到之前发现性能下降。

- **端到端交易详情** — 点击任何跟踪查看完整的工作流：调用了哪些代理、它们调用了什么工具、每个步骤花了多长时间。"简单视图"以易于理解的故事格式呈现代理步骤。

- **Grafana 集成** — 一键导出到 Azure Managed Grafana 以创建自定义仪表板和告警。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLUlyYUJjcg?image-dimensions=999x651&revision=1)

关键见解：这个视图不是魔法。它的工作原理是因为遥测使用明确定义的语义约定进行结构化。让我们接下来看看这些。

> **📖 文档：** [Application Insights Agents（预览版）视图文档](https://learn.microsoft.com/en-us/azure/azure-monitor/app/agents-view)

## GenAI 语义约定 — 基础

整个 Agents 视图由 [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) 支持。这是一组标准化的 span 属性，描述 AI 代理行为的方式使得任何可观测性后端都能理解。将它们视为您的检测代码与 Application Insights 之间的"契约"。

让我们逐步了解关键属性及其重要性：

### `gen_ai.agent.name`

这是代理的人类可读名称。在我们的旅行规划器中，每个代理在构建 MAF `ChatClientAgent` 时通过 `name` 参数设置这个 — 例如 `"Weather & Packing Advisor"`（天气与打包顾问）或 `"Budget Optimization Specialist"`（预算优化专家）。这是填充 Agents 视图中的代理下拉菜单的内容。没有这个属性，Application Insights 就无法在遥测中区分一个代理和另一个代理。这是代理级别监控中最重要的属性。

### `gen_ai.agent.description`

代理功能的简要说明。例如，我们的天气顾问被描述为*"基于目的地天气条件提供天气预报、打包建议和活动建议。"* 这个元数据帮助运营人员和随时待命的工程师快速理解代理的角色，无需深入源代码。它出现在跟踪详情中，有助于在调试时理解您正在查看的内容。

### `gen_ai.agent.id`

代理实例的唯一标识符。在 MAF 中，这通常是自动生成的 GUID。虽然 `gen_ai.agent.name` 是人类友好的标签，但 `gen_ai.agent.id` 是机器稳定的标识符。如果您重命名一个代理，ID 保持不变，这对于在代码部署中跟踪代理行为非常重要。

### `gen_ai.operation.name`

正在执行的操作类型。值包括用于标准 LLM 调用的 `"chat"` 和用于工具/函数调用的 `"execute_tool"`。在我们的旅行规划器中，当天气顾问通过 NWS 调用 `GetWeatherForecast` 函数，或当货币转换器通过 Frankfurter API 调用 `ConvertCurrency` 时，那些工具调用会获得自己的 span，其中 `gen_ai.operation.name = "execute_tool"`。这让您可以分别测量 LLM 思考时间和工具执行时间 — 这对性能优化至关重要。

### `gen_ai.request.model` / `gen_ai.response.model`

用于请求的模型和实际提供响应的模型（当提供商进行模型路由时这些可能会有所不同）。在我们的情况下，两者都是 `"gpt-4o"`，因为这是我们通过 Azure OpenAI 部署的。这些属性让您跟踪代理中的模型使用情况，发现意外的模型分配，并将性能变化与模型更新关联起来。

### `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`

每个 LLM 调用的令牌消耗。这是为 Agents 视图中的令牌使用可视化提供支持的。协调员代理聚合来自所有五个专家代理的结果，往往具有更高的输出令牌计数，因为它正在合成完整的旅行计划。货币转换器进行有针对性的 API 调用，总体上使用更少的令牌。这些属性让您回答"哪个代理让我花费最多？"这个问题 — 更重要的是，让您在令牌使用意外增加时设置告警。

### `gen_ai.system`

AI 系统或提供商。在我们的情况下，这是 `"openai"`（由 Azure OpenAI 客户端检测设置）。如果您使用多个 AI 提供商 — 比如说，用于规划的 Azure OpenAI 和用于分类的本地模型 — 此属性让您过滤和比较。

这些属性一起创建了对代理行为的丰富结构化视图，远超过一般跟踪。它们是 Application Insights 可以呈现代理特定仪表板的原因，其中包含令牌分解、延迟分布和端到端工作流视图。没有这些约定，您只会看到对 OpenAI 端点的不透明 HTTP 调用。

> **💡 关键要点：** GenAI 语义约定是将通用分布式跟踪转换为*代理感知*可观测性的内容。它们是您的代码与 Agents 视图之间的桥梁。任何发出这些属性的框架 — MAF、Semantic Kernel、LangChain — 都可以启用此仪表板。

## OpenTelemetry 检测的两个层次

我们的旅行规划器示例在两个不同的层级上进行检测，每个捕获代理行为的不同方面。让我们看看这两者。

### 第 1 层：IChatClient 级别检测

第一层使用 `Microsoft.Extensions.AI` 在 `IChatClient` 级别进行检测。这是我们使用 OpenTelemetry 包装 Azure OpenAI 聊天客户端的地方：

```
var client = new AzureOpenAIClient(azureOpenAIEndpoint, new DefaultAzureCredential());
// 使用 OpenTelemetry 包装以发出 GenAI 语义约定 span
return client.GetChatClient(modelDeploymentName).AsIChatClient()
    .AsBuilder()
    .UseOpenTelemetry()
    .Build();
```

这一个 `.UseOpenTelemetry()` 调用拦截每个 LLM 调用并发出具有以下内容的 span：

- `gen_ai.system` — AI 提供商（例如 `"openai"`）

- `gen_ai.request.model` / `gen_ai.response.model` — 使用了哪个模型

- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens` — 每个调用的令牌消耗

- `gen_ai.operation.name` — 操作类型（`"chat"`）

把这个看作"LLM 层" — 它捕获*模型在做什么*，不管哪个代理调用了它。这是以模型为中心的遥测。

### 第 2 层：代理级别检测

第二层使用 MAF 1.0 GA 的内置 OpenTelemetry 支持在代理级别进行检测。这发生在所有我们的代理继承的 `BaseAgent` 类中：

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

MAF 代理构建器上的 `.UseOpenTelemetry(sourceName: AgentName)` 调用发出一组不同的 span：

- `gen_ai.agent.name` — 人类可读的代理名称（例如 `"Weather & Packing Advisor"`）

- `gen_ai.agent.description` — 代理的功能

- `gen_ai.agent.id` — 唯一的代理标识符

- 代理调用跟踪 — 表示代理调用的完整生命周期的 span

这是"代理层" — 它捕获*哪个代理在执行工作*并提供为 Agents 视图下拉菜单和每代理过滤提供支持的身份信息。

### 为什么两个层次都需要？

当两个层都激活时，您获得最丰富的遥测。代理级别的 span 嵌套在 LLM 级别的 span 周围，创建看起来像这样的跟踪层级：

```
Agent: "Weather & Packing Advisor" (gen_ai.agent.name)
└── chat (gen_ai.operation.name)
├── model: gpt-4o, input_tokens: 450, output_tokens: 120
└── execute_tool: GetWeatherForecast
└── chat (follow-up with tool results)
└── model: gpt-4o, input_tokens: 680, output_tokens: 350
```

有一个权衡：当两个层都激活时，您可能会看到一些 span 重复，因为 `IChatClient` 包装器和 MAF 代理包装器都为同一个底层 LLM 调用发出 span。如果您发现遥测太冗长，可以禁用一个层：

- **仅代理层**（从 `IChatClient` 中移除 `.UseOpenTelemetry()`） — 您获得代理身份但失去每个调用的令牌分解。

- **仅 IChatClient 层**（从代理构建器中移除 `.UseOpenTelemetry()`） — 您获得详细的 LLM 指标但在 Agents 视图中失去代理身份。

为了获得 Agents（预览版）视图的最完整体验，我们建议保持两个层都激活。官方示例使用两者，Agents 视图被设计为优雅地处理重叠的 span。

> **📖 文档：** [MAF 可观测性指南](https://learn.microsoft.com/en-us/agent-framework/agents/observability)

## 将遥测导出到 Application Insights

发出 OpenTelemetry span 仅在您可以查询它们的地方才有用。好消息是 **Azure App Service 和 Application Insights 具有深度原生集成** — App Service 可以自动检测您的应用程序、转发平台日志并开箱即用地显示健康指标。如需完整的监控功能概览，请参阅[监控 Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/monitor-app-service?tabs=aspnetcore)。

对于我们的 AI 代理场景，我们超越了内置的平台遥测。我们需要我们在前面章节中配置的 GenAI 语义约定 span 流入 App Insights，以便 Agents（预览版）视图可以呈现它们。我们的旅行规划器有两个主机进程 — ASP.NET Core API 和一个 WebJob — 每个都需要略微不同的导出器设置。

### ASP.NET Core API — Azure Monitor OpenTelemetry Distro

对于 API，这很简单。[Azure Monitor OpenTelemetry Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore) 处理所有事情：

```
// 使用 Azure Monitor 配置 OpenTelemetry 以进行跟踪、指标和日志。
// APPLICATIONINSIGHTS_CONNECTION_STRING 环境变量会自动发现。
builder.Services.AddOpenTelemetry().UseAzureMonitor();
```

就这样。distro 自动：

- 发现 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量

- 配置跟踪、指标和日志导出器到 Application Insights

- 设置适当的采样和批处理

- 注册标准 ASP.NET Core HTTP 检测

这是任何 ASP.NET Core 应用程序的推荐方法。一个 NuGet 包（`Azure.Monitor.OpenTelemetry.AspNetCore`），一行代码，零配置文件。

### WebJob — 手动导出器设置

WebJob 是一个非 ASP.NET Core 主机（它使用 `Host.CreateApplicationBuilder`），所以 distro 的便利方法不可用。而是我们显式配置导出器：

```
// 使用 Azure Monitor 为 WebJob（非 ASP.NET Core 主机）配置 OpenTelemetry。
// APPLICATIONINSIGHTS_CONNECTION_STRING 环境变量会自动发现。
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

需要注意几点：

- `.AddSource("*")` — 订阅*所有*跟踪源，包括由 MAF 的 `.UseOpenTelemetry(sourceName: AgentName)` 发出的源。在生产环境中，您可能会将此缩小到特定源名称以获得性能。

- `.AddMeter("*")` — 类似地捕获所有指标，包括由检测层发出的 GenAI 指标。

- `.ConfigureResource(r => r.AddService("TravelPlanner.WebJob"))` — 使用服务名称标记所有遥测，以便您可以在 Application Insights 中区分 API 和 WebJob 遥测。

- 连接字符串仍然从 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量自动发现 — 无需显式传递。

这两种方法之间的关键区别是仪式，而不是能力。两者都向 Application Insights 发送相同的 GenAI span；无论您使用哪种导出器设置，Agents 视图的工作方式都相同。

> **📖 文档：** [Azure Monitor OpenTelemetry Distro](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore)

## 基础设施即代码 — 配置监控堆栈

监控基础设施通过 Bicep 模块与应用程序的其余 Azure 资源一起配置。以下是它如何整合在一起。

### Log Analytics 工作区

`infra/core/monitor/loganalytics.bicep` 创建支持 Application Insights 的 Log Analytics 工作区：

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

`infra/core/monitor/appinsights.bicep` 创建连接到 Log Analytics 的基于工作区的 Application Insights 资源：

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

### 将所有内容连接在一起

在 `infra/main.bicep` 中，Application Insights 连接字符串作为应用程序设置传递给 App Service：

```
appSettings: {
  APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.outputs.connectionString
  // ... 其他应用程序设置
}
```

这是关键胶水：当应用程序启动时，OpenTelemetry distro（或手动导出器）自动发现这个环境变量并开始向您的 Application Insights 资源发送遥测。没有代码中的连接字符串，没有配置文件 — 这一切都是基础设施驱动的。

相同的连接字符串对 API 和 WebJob 都可用，因为它们在同一 App Service 上运行。来自两个主机进程的所有代理遥测流入单一 Application Insights 资源，为您提供整个应用程序的统一视图。

## 实际操作

一旦应用程序被部署并处理旅行计划请求，以下是如何在 Application Insights 中探索代理遥测。

### 第 1 步：打开 Agents（预览版）视图

在 Azure 门户中，导航到您的 Application Insights 资源。在左侧导航中，在"Investigations"（调查）部分下查找 **Agents（预览版）**。这会打开统一的代理监控仪表板。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLTdsbktXSQ?image-dimensions=999x651&revision=1)

### 第 2 步：按代理过滤

页面顶部的代理下拉菜单由遥测中的 `gen_ai.agent.name` 值填充。您将看到所有六个代理：

- Travel Planning Coordinator（旅行规划协调员）

- Currency Conversion Specialist（货币转换专家）

- Weather & Packing Advisor（天气与打包顾问）

- Local Expert & Cultural Guide（本地专家和文化指南）

- Itinerary Planning Expert（行程规划专家）

- Budget Optimization Specialist（预算优化专家）

选择特定代理以将整个仪表板过滤 — 令牌使用、延迟、错误率 — 到仅该代理。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLUpGT1hwZA?image-dimensions=740x470&revision=1)

### 第 3 步：查看令牌使用

令牌使用磁贴显示您选定时间范围内的总输入和输出令牌消耗。比较代理以找到您最大的支出者。在我们的测试中，协调员代理一直使用最多的输出令牌，因为它聚合并合成来自所有五个专家的结果。

### 第 4 步：钻取跟踪

点击 **"View Traces with Agent Runs"**（查看具有代理运行的跟踪）查看所有代理执行。每行代表一个工作流运行。您可以按时间范围、状态（成功/失败）和特定代理过滤。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLU1NN1N3Rw?image-dimensions=817x999&revision=1)

### 第 5 步：端到端交易详情

点击任何跟踪以打开端到端交易详情。**"简单视图"**将代理工作流呈现为一个故事 — 显示每个步骤、哪个代理处理了它、花费了多长时间以及调用了什么工具。对于完整的旅行计划，您将看到协调员向每个专家分派工作，对 NWS 天气 API 和 Frankfurter 货币 API 的工具调用，以及最后的聚合步骤。

## Grafana 仪表板

Application Insights 中的 Agents（预览版）视图非常适合临时调查。对于持续监控和告警，Azure Managed Grafana 提供专门为代理工作负载设计的预构建仪表板。

从 Agents 视图，点击 **"Explore in Grafana"**（在 Grafana 中探索）直接跳转到这些仪表板：

- **[Agent Framework 仪表板](https://aka.ms/amg/dash/af-agent)** — 每代理指标，包括令牌使用趋势、延迟百分位数、错误率和随时间推移的吞吐量。将此固定到您的操作墙。

- **[Agent Framework 工作流仪表板](https://aka.ms/amg/dash/af-workflow)** — 工作流级别的指标，显示多代理编排的端到端性能。查看完整旅行计划花费的时间、识别瓶颈代理并跟踪成功率。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDIzLWl1YjBTSw?image-dimensions=999x514&revision=1)

这些仪表板查询 Log Analytics 中相同的底层数据，所以无需额外的检测。如果您的遥测启用了 Agents 视图，它也启用了 Grafana。

## 关键包摘要

以下是使这一切工作的 NuGet 包，来自实际项目文件：

| 包 | 版本 | 用途 |
|---|---|---|
| `Azure.Monitor.OpenTelemetry.AspNetCore` | 1.3.0 | ASP.NET Core 的 Azure Monitor OTEL Distro（API）。用于跟踪、指标和日志的一行设置。 |
| `Azure.Monitor.OpenTelemetry.Exporter` | 1.3.0 | 非 ASP.NET Core 主机的 Azure Monitor OTEL 导出器（WebJob）。跟踪、指标和日志导出器。 |
| `Microsoft.Agents.AI` | 1.0.0 | MAF 1.0 GA — `ChatClientAgent`，用于代理级别检测的 `.UseOpenTelemetry()`。 |
| `Microsoft.Extensions.AI` | 10.4.1 | `IChatClient` 抽象，带有用于 LLM 级别检测的 `.UseOpenTelemetry()`。 |
| `OpenTelemetry.Extensions.Hosting` | 1.11.2 | OTEL 依赖注入集成，用于 `Host.CreateApplicationBuilder`（WebJob）。 |
| `Microsoft.Extensions.AI.OpenAI` | 10.4.1 | 用于 `IChatClient` 的 OpenAI/Azure OpenAI 适配器。将 Azure OpenAI SDK 桥接到 M.E.AI 抽象。 |

## 总结

让我们缩放视图。在这个两部分系列中，我们从零开始到一个完全可观测的、生产级的多代理 AI 应用程序在 Azure App Service 上运行：

- **博客 1** 涵盖了使用 MAF 1.0 GA 部署多代理旅行规划器 — 代理、架构、基础设施。

- **博客 2**（本文）展示了如何使用 OpenTelemetry 检测这些代理，解释了使代理感知监控成为可能的 GenAI 语义约定，并讲解了 Application Insights 中新的 Agents（预览版）视图。

该模式很直接：

- 在 `IChatClient` 级别添加 `.UseOpenTelemetry()`，用于 LLM 指标。

- 在 MAF 代理级别添加 `.UseOpenTelemetry(sourceName: AgentName)`，用于代理身份。

- 通过 Azure Monitor distro（一行）或手动导出器导出到 Application Insights。

- 通过 Bicep 和环境变量连接字符串。

- 打开 Agents（预览版）视图并开始监控。

通过 MAF 1.0 GA 的内置 OpenTelemetry 支持和 Application Insights 的新 Agents 视图，您获得了最少代码的生产级代理可观测性。GenAI 语义约定确保您的遥测是结构化的、可移植的，并被任何兼容后端理解。由于这完全是标准 OpenTelemetry，您不会被锁定到任何单一供应商 — 交换导出器，您的遥测就会转到 Jaeger、Grafana、Datadog 或任何您需要的地方。

现在去看看您的代理在做什么吧。

## 资源

- **示例仓库：** [seligj95/app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)

- **App Insights Agents（预览版）视图：** [文档](https://learn.microsoft.com/en-us/azure/azure-monitor/app/agents-view)

- **GenAI 语义约定：** [OpenTelemetry GenAI 注册表](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

- **MAF 可观测性指南：** [Microsoft Agent Framework 可观测性](https://learn.microsoft.com/en-us/agent-framework/agents/observability)

- **Azure Monitor OpenTelemetry Distro：** [为 .NET 启用 OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=aspnetcore)

- **Grafana Agent Framework 仪表板：** [aka.ms/amg/dash/af-agent](https://aka.ms/amg/dash/af-agent)

- **Grafana 工作流仪表板：** [aka.ms/amg/dash/af-workflow](https://aka.ms/amg/dash/af-workflow)

- **博客 1：** [使用 MAF 1.0 GA 在 Azure App Service 上部署多代理 AI 应用](https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017)

更新于 2026-04-09，版本 1.0