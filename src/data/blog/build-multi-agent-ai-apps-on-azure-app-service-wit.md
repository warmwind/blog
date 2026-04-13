---
title: 在 Azure App Service 上使用 Microsoft Agent Framework 1.0 构建多 Agent AI 应用
pubDatetime: 2026-04-13T10:00:00+08:00
description: Microsoft Agent Framework 1.0 GA 发布，本文介绍如何在 Azure App Service 上使用统一的 AutoGen 和 Semantic Kernel 框架部署多 Agent 系统。
slug: build-multi-agent-ai-apps-on-azure-app-service-with-maf
originalTitle: "Build Multi-Agent AI Apps on Azure App Service with Microsoft Agent Framework 1.0"
originalUrl: "https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017"
---

原文标题：Build Multi-Agent AI Apps on Azure App Service with Microsoft Agent Framework 1.0<br>
原文链接：https://techcommunity.microsoft.com/blog/appsonazureblog/build-multi-agent-ai-apps-on-azure-app-service-with-microsoft-agent-framework-1-/4510017

几个月前，我们发布了一个[三部分系列](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)，展示如何使用 Microsoft Agent Framework (MAF) 的预览包（之前称为 AutoGen / Semantic Kernel Agents）在 Azure App Service 上构建多 Agent AI 系统。该系列介绍了异步处理、请求-回复模式以及客户端多 Agent 编排——全部运行在 App Service 上。

从那时起，**Microsoft Agent Framework 已达到 1.0 GA**——将 AutoGen 和 Semantic Kernel 统一为一个生产就绪的 Agent 平台。本文是基于 GA 版本的全新起点。我们将在稳定的 API 表面上重建旅行规划器示例，指出与预览版相比的破坏性变更，帮助你快速上手。

所有代码都在配套仓库中：[seligj95/app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)。

## MAF 1.0 GA 中的变化

1.0 版本不仅仅是一次版本号的提升。以下是主要变化：

- **统一平台。** AutoGen 和 Semantic Kernel 的 Agent 能力已合并到 Microsoft.Agents.AI 中。一个包，一个 API 表面。

- **稳定的 API 和长期支持。** 1.0 的契约现已锁定，进入长期维护阶段。不再有预览版的频繁变动。

- **破坏性变更——Instructions 从选项中移除。** 在预览版中，你通过 `ChatClientAgentOptions.Instructions` 设置指令。在 GA 版本中，直接将指令传递给 `ChatClientAgent` 构造函数。

- **破坏性变更——RunAsync 参数重命名。** `thread` 参数现在更名为 `session`（类型为 `AgentSession`）。如果你使用了命名参数，这将导致编译错误。

- **Microsoft.Extensions.AI 升级。** 框架从 Microsoft.Extensions.AI 的 9.x 预览版升级到了稳定的 **10.4.1** 版本。

- **内置 OpenTelemetry 集成。** 构建器管道现在开箱即用地包含 `UseOpenTelemetry()`——更多内容见博客第 2 部分。

我们的项目引用反映了 GA 技术栈：

```xml
<PackageReference Include="Microsoft.Agents.AI" Version="1.0.0" />
<PackageReference Include="Microsoft.Extensions.AI" Version="10.4.1" />
<PackageReference Include="Azure.AI.OpenAI" Version="2.1.0" />
```

## 为什么选择 Azure App Service 来运行 AI Agent？

如果你正在使用 Microsoft Agent Framework 进行构建，你需要一个地方来运行你的 Agent。你可以选择 Kubernetes、容器或无服务器方案——但对于大多数 Agent 工作负载而言，**Azure App Service 是最佳选择**。原因如下：

- **无需基础设施管理**——App Service 是完全托管的。无需配置集群，无需学习容器编排。部署你的 .NET 或 Python Agent 代码，它就能直接运行。

- **Always On（始终在线）**——Agent 工作流可能需要数分钟。App Service 的 Always On 功能（在高级层上可用）确保你的后台工作进程永远不会冷启动，Agent 随时准备好处理请求。

- **WebJob 用于后台处理**——长时间运行的 Agent 工作流不应放在 HTTP 请求处理程序中。App Service 内置的 WebJob 支持为你提供专用的后台工作进程，与同一部署、配置和托管身份共享——无需单独的计算资源。

- **Managed Identity 无处不在**——代码中零密钥。App Service 的系统分配托管身份会自动向 Azure OpenAI、Service Bus、Cosmos DB 和 Application Insights 进行身份验证。没有连接字符串，没有 API 密钥，没有轮换烦恼。

- **内置可观测性**——与 Application Insights 和 OpenTelemetry 的原生集成意味着你可以在生产环境中准确看到 Agent 正在做什么（更多内容见第 2 部分）。

- **企业就绪**——VNet 集成、用于安全发布的部署槽、自定义域名、自动缩放规则以及内置身份验证。当你的 Agent POC 变成生产服务时，这些都是你需要的。

- **经济高效**——单个 P0v4 实例（约 $75/月）即可同时托管你的 API 和 WebJob 工作进程。与为相同工作负载运行单独的容器应用或 Kubernetes 集群相比，性价比高出不少。

总结：App Service 让你专注于构建 Agent，而非管理基础设施。由于 MAF 同时支持 .NET 和 Python——两者都是 App Service 上的一等公民——无论你偏好哪种语言，都能轻松使用。

## 架构概览

该示例是一个**旅行规划器**，协调六个专业化 Agent 来构建个性化的行程。用户填写一个表单（目的地、日期、预算、兴趣），系统返回一个综合旅行方案，包括天气预报、货币建议、逐日行程安排和预算分解。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDE3LTFNNGx4Vw?image-dimensions=514x999&revision=3)

### 六个 Agent

- **Currency Converter（货币转换器）**——调用 [Frankfurter API](https://www.frankfurter.dev/) 获取实时汇率

- **Weather Advisor（天气顾问）**——调用[美国国家气象服务 API](https://www.weather.gov/documentation/services-web-api) 获取天气预报和行李打包建议

- **Local Knowledge Expert（本地知识专家）**——文化洞察、风俗习惯和小众宝藏

- **Itinerary Planner（行程规划师）**——带有时间和费用的逐日安排

- **Budget Optimizer（预算优化器）**——在各类别中分配支出并建议节省方案

- **Coordinator（协调员）**——将所有内容整合成一份精美的最终方案

### 四阶段工作流

| 阶段 | Agent | 执行方式 |
|-------|--------|-----------|
| 1 — 并行收集 | Currency, Weather, Local Knowledge | Task.WhenAll |
| 2 — 行程 | Itinerary Planner | 顺序执行（使用阶段 1 的上下文） |
| 3 — 预算 | Budget Optimizer | 顺序执行（使用阶段 2 的输出） |
| 4 — 组装 | Coordinator | 最终合成 |

### 基础设施

- **Azure App Service (P0v4)**——托管 API 和用于后台处理的持续运行 WebJob

- **Azure Service Bus**——将 API 与繁重的 AI 工作解耦（异步请求-回复）

- **Azure Cosmos DB**——存储任务状态、结果和每个 Agent 的聊天历史（24 小时 TTL）

- **Azure OpenAI (GPT-4o)**——为所有 Agent LLM 调用提供支持

- **Application Insights + Log Analytics**——监控和诊断

## ChatClientAgent 深入解析

每个 Agent 的核心是来自 `Microsoft.Agents.AI` 的 `ChatClientAgent`。它用指令、名称、描述和可选的工具集包装了一个 `IChatClient`（来自 `Microsoft.Extensions.AI`）。这是**客户端**编排——你控制聊天历史、生命周期和执行顺序。不会创建服务器端的 Foundry Agent 资源。

以下是示例中所有六个 Agent 使用的 `BaseAgent` 模式：

```csharp
// BaseAgent.cs — 带有工具的 Agent 构造函数
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

注意构建器管道：`.AsBuilder().UseOpenTelemetry(...).Build()`。只需一行代码，即可让每个 Agent 接入框架内置的 OpenTelemetry 遥测。我们将在博客第 2 部分中探讨该遥测数据的具体表现。

调用 Agent 同样简单直接：

```csharp
// BaseAgent.cs — InvokeAsync
public async Task<ChatMessage> InvokeAsync(
    IList<ChatMessage> chatHistory,
    CancellationToken cancellationToken = default)
{
    var response = await Agent.RunAsync(
        chatHistory, session: null, options: null, cancellationToken);

    return response.Messages.LastOrDefault()
        ?? new ChatMessage(ChatRole.Assistant, "No response generated.");
}
```

需要注意的关键点：

- `session: null`——这是重命名后的参数（预览版中是 `thread`）。我们传递 `null` 是因为我们自己管理聊天历史。

- Agent 接收完整的 `chatHistory` 列表，因此上下文会跨轮次累积。

- 简单 Agent（Local Knowledge、Itinerary Planner、Budget Optimizer、Coordinator）使用无工具构造函数；调用外部 API 的 Agent（Currency、Weather）使用接受带有工具的 `ChatOptions` 的构造函数。

## 工具集成

我们的两个 Agent——**Weather Advisor** 和 **Currency Converter**——通过 MAF 工具调用管道调用真实的外部 API。工具使用 `Microsoft.Extensions.AI` 中的 `AIFunctionFactory.Create()` 进行注册。

以下是 `WeatherAdvisorAgent` 连接其工具的方式：

```csharp
// WeatherAdvisorAgent.cs
private static ChatOptions CreateChatOptions(
    IWeatherService weatherService, ILogger logger)
{
    var chatOptions = new ChatOptions
    {
        Tools = new List<AITool>
        {
            AIFunctionFactory.Create(
                GetWeatherForecastFunction(weatherService, logger))
        }
    };
    return chatOptions;
}
```

`GetWeatherForecastFunction` 返回一个 `Func<double, double, int, Task<string>>`，模型可以使用纬度、经度和天数来调用它。底层实现调用了美国国家气象服务 API 并返回格式化的预报字符串。Currency Converter 与 Frankfurter API 遵循相同的模式。

这是 GA API 最出色的部分之一：你编写一个普通的 C# 方法，用 `AIFunctionFactory.Create()` 包装它，框架就会自动处理 JSON Schema 生成、函数调用解析和响应路由。

## 多阶段工作流编排

`TravelPlanningWorkflow` 类协调所有六个 Agent。关键洞察在于，编排*就是 C# 代码*——没有 YAML，没有图 DSL，没有特殊的运行时。你来决定 Agent 何时运行、接收什么上下文，以及结果如何在各阶段之间流转。

```csharp
// 阶段 1：并行信息收集
var gatheringTasks = new[]
{
    GatherCurrencyInfoAsync(request, state, progress, cancellationToken),
    GatherWeatherInfoAsync(request, state, progress, cancellationToken),
    GatherLocalKnowledgeAsync(request, state, progress, cancellationToken)
};
await Task.WhenAll(gatheringTasks);
```

阶段 1 完成后，结果存储在 `WorkflowState` 对象中——一个简单的基于字典的容器，保存每个 Agent 的聊天历史和上下文数据：

```csharp
// WorkflowState.cs
public Dictionary<string, object> Context { get; set; } = new();
public Dictionary<string, List<ChatMessage>> AgentChatHistories { get; set; } = new();
```

阶段 2-4 顺序运行，每个阶段从前一阶段拉取上下文。例如，Itinerary Planner 接收在阶段 1 中收集的天气和本地知识信息：

```csharp
var localKnowledge = state.GetFromContext<string>("LocalKnowledge") ?? "";
var weatherAdvice = state.GetFromContext<string>("WeatherAdvice") ?? "";

var itineraryChatHistory = state.GetChatHistory("ItineraryPlanner");
itineraryChatHistory.Add(new ChatMessage(ChatRole.User,
    $"Create a detailed {days}-day itinerary for {request.Destination}..."
    + $"\n\nWEATHER INFORMATION:\n{weatherAdvice}"
    + $"\n\nLOCAL KNOWLEDGE & TIPS:\n{localKnowledge}"));

var itineraryResponse = await _itineraryAgent.InvokeAsync(
    itineraryChatHistory, cancellationToken);
```

这个模式——并行扇出后接顺序上下文充实——简单、可测试且易于扩展。需要第七个 Agent？将它添加到合适的阶段并连接到 `WorkflowState` 即可。

## 异步请求-回复模式

一个包含六次 LLM 调用的多 Agent 工作流（其中一些还涉及工具调用）很容易运行 30-60 秒。这远远超出了典型的 HTTP 超时预期，对于同步请求来说用户体验也不理想。我们使用**异步请求-回复模式**来解决这个问题：

- API 接收旅行计划请求后立即将消息排入 **Service Bus** 队列。

- 它在 **Cosmos DB** 中存储一条初始任务记录，状态为 `queued`，并将 `taskId` 返回给客户端。

- 一个**持续运行的 WebJob**（在同一 App Service 计划上作为独立进程运行）拾取消息，执行完整的多 Agent 工作流，并将结果写回 Cosmos DB。

- 客户端轮询 API 获取状态更新，直到任务状态变为 `completed`。

此模式保持了 API 的快速响应，使繁重的工作可以重试（Service Bus 处理重试和死信），并允许 WebJob 独立运行——你可以重启它而不影响 API。我们在[之前的系列](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)中详细介绍了这个模式，这里不再赘述。

## 使用 azd 部署

该仓库已集成 Azure Developer CLI，支持一条命令完成资源配置和部署：

```bash
git clone https://github.com/seligj95/app-service-multi-agent-maf-otel.git
cd app-service-multi-agent-maf-otel
azd auth login
azd up
```

`azd up` 通过 Bicep 配置以下资源：

- Azure App Service（P0v4 Windows）及持续运行的 WebJob

- Azure Service Bus 命名空间和队列

- Azure Cosmos DB 账户、数据库和容器

- Azure AI Services（带 GPT-4o 部署的 Azure OpenAI）

- Application Insights 和 Log Analytics 工作区

- 带有所有必要角色分配的 Managed Identity

部署完成后，`azd` 会输出 App Service URL。在浏览器中打开它，填写旅行表单，即可实时观看六个 Agent 协作完成你的旅行方案。

![img](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDE3LWw3VkNzVg?image-dimensions=709x999&revision=3)

## 下一步

我们现在有了一个生产就绪的多 Agent 应用，运行在 App Service 上并使用 GA 版本的 Microsoft Agent Framework。但你实际上如何*观测*这些 Agent 在做什么？当六个 Agent 在进行 LLM 调用、调用工具、在各阶段之间传递上下文时——你需要对每一步都有可见性。

在**下一篇文章**中，我们将深入探讨如何使用 **OpenTelemetry** 和 **Application Insights** 中全新的 **Agents（预览版）**视图来为这些 Agent 添加遥测——让你全面掌握 Agent 运行情况、Token 用量、工具调用和模型性能。你已经看到了构建器管道中的 `.UseOpenTelemetry()` 调用；博客第 2 部分将展示该遥测端到端的效果，以及如何在 Azure 门户中启用全新的 Agents 体验。

敬请期待！

## 资源

- [示例仓库 — app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)

- [Microsoft Agent Framework 1.0 GA 发布公告](https://devblogs.microsoft.com/semantic-kernel/microsoft-agent-framework-1-0-is-now-generally-available/)

- [Microsoft Agent Framework 文档](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/)

- [之前的系列 — 第 3 部分：App Service 上的客户端多 Agent 编排](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)

- [Microsoft.Extensions.AI 文档](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.ai)

- [Azure App Service 文档](https://learn.microsoft.com/en-us/azure/app-service/)
