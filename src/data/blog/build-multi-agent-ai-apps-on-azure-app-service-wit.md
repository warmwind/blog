---
title: 在 Azure App Service 上使用 Microsoft Agent Framework 1.0 构建多代理 AI 应用
pubDatetime: 2026-04-13T00:00:00.000Z
description: Microsoft Agent Framework 刚刚发布 GA 版本 — 下面是如何在 Azure App Service 上部署多代理系统，使用统一框架来整合 AutoGen 和 Semantic Kernel。
category: 
tags: []
---

## Microsoft Agent Framework 刚刚发布 GA 版本 — 下面是如何在 Azure App Service 上部署多代理系统，使用统一框架来整合 AutoGen 和 Semantic Kernel。

几个月前，我们发布了一个[三部分系列](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)，展示了如何使用 Microsoft Agent Framework (MAF) 的预览包在 Azure App Service 上构建多代理 AI 系统（之前叫做 AutoGen / Semantic Kernel Agents）。该系列介绍了异步处理、请求-回复模式和客户端多代理编排 — 都在 App Service 上运行。

从那以后，**Microsoft Agent Framework 已经达到 1.0 GA 版本** — 将 AutoGen 和 Semantic Kernel 统一成单一的、生产就绪的代理平台。本文是使用 GA 版本的全新开始。我们将在稳定的 API 表面上重新构建我们的旅行规划器示例，指出来自预览版的重大更改，让您快速上手和运行。

所有代码都在配套仓库中：[seligj95/app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)。

## MAF 1.0 GA 中的变化

1.0 版本不仅仅是版本号的提升。以下是变化：

- **统一平台。** AutoGen 和 Semantic Kernel 代理功能已经合并到 `Microsoft.Agents.AI`。一个包，一个 API 表面。

- **稳定的 API 和长期支持。** 1.0 契约现在已锁定以供维修。不再有预览版的变动。

- **重大更改 — `Instructions` 在选项中移除了。** 在预览版中，您通过 `ChatClientAgentOptions.Instructions` 设置说明。在 GA 版本中，直接将它们传递给 `ChatClientAgent` 构造函数。

- **重大更改 — `RunAsync` 参数重命名。** `thread` 参数现在叫 `session`（类型 `AgentSession`）。如果您使用了命名参数，这是一个编译错误。

- **`Microsoft.Extensions.AI` 升级。** 框架从 `Microsoft.Extensions.AI` 的 9.x 预览版移到了稳定的 **10.4.1** 版本。

- **内置 OpenTelemetry 集成。** 构建器管道现在开箱即用地包含 `UseOpenTelemetry()` — 更多内容见博客 2。

我们的项目引用反映了 GA 堆栈：

```
<PackageReference Include="Microsoft.Agents.AI" Version="1.0.0" />
<PackageReference Include="Microsoft.Extensions.AI" Version="10.4.1" />
<PackageReference Include="Azure.AI.OpenAI" Version="2.1.0" />
```

## 为什么要在 Azure App Service 上运行 AI 代理？

如果您要使用 Microsoft Agent Framework 构建，您需要一个地方来运行您的代理。您可以选择 Kubernetes、容器或无服务器 — 但对于大多数代理工作负载，**Azure App Service 是最佳选择**。原因如下：

- **无需基础设施管理** — App Service 是完全托管的。无需配置集群，无需学习容器编排。部署您的 .NET 或 Python 代理代码，它就可以运行。

- **始终在线** — 代理工作流可能需要几分钟。App Service 的 Always On 功能（在高级层）确保您的后台工作者永远不会冷启动，所以代理已准备好立即处理请求。

- **WebJob 用于后台处理** — 长时间运行的代理工作流不应该在 HTTP 请求处理程序中运行。App Service 的内置 WebJob 支持为您提供了一个专用的后台工作者，与同一部署、配置和托管身份共享 — 不需要单独的计算资源。

- **到处都有托管身份** — 代码中零秘密。App Service 的系统分配的托管身份自动向 Azure OpenAI、Service Bus、Cosmos DB 和 Application Insights 进行身份验证。没有连接字符串，没有 API 密钥，没有轮换麻烦。

- **内置可观测性** — 与 Application Insights 和 OpenTelemetry 的本机集成意味着您可以在生产环境中准确看到您的代理在做什么（更多内容见第 2 部分）。

- **企业级就绪** — VNet 集成、用于安全推出的部署插槽、自定义域、自动扩展规则以及内置身份验证。所有您在代理 POC 成为生产服务时需要的东西。

- **经济有效** — 单一的 P0v4 实例（约 $75/月）同时托管您的 API 和 WebJob 工作者。与为相同工作负载运行单独的容器应用或 Kubernetes 集群相比。

底线：App Service 让您专注于构建代理，而不是管理基础设施。由于 MAF 支持 .NET 和 Python — 两者都是 App Service 上的一等公民 — 无论您的语言偏好如何，您都可以使用。

## 架构概览

该示例是一个**旅行规划器**，协调六个专门的代理来构建个性化的行程。用户填写一份表格（目的地、日期、预算、兴趣），系统返回一个完整的旅行计划，包括天气预报、货币建议、逐日行程安排和预算分解。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDE3LTFNNGx4Vw?image-dimensions=514x999&revision=3)

### 六个代理

- **货币转换器** — 调用 [Frankfurter API](https://www.frankfurter.dev/) 获取实时汇率

- **天气顾问** — 调用 [美国国家气象服务 API](https://www.weather.gov/documentation/services-web-api) 获取预报和打包建议

- **本地知识专家** — 文化见解、风俗习惯和隐藏的瑰宝

- **行程规划员** — 带有时间和成本的逐日安排

- **预算优化器** — 在各个类别中分配支出并建议节省

- **协调员** — 将所有内容组装成精美的最终计划

### 四阶段工作流

| 阶段 | 代理 | 执行 |
|------|------|------|
| 1 — 并行收集 | 货币、天气、本地知识 | `Task.WhenAll` |
| 2 — 行程 | 行程规划员 | 顺序（使用第 1 阶段上下文） |
| 3 — 预算 | 预算优化器 | 顺序（使用第 2 阶段输出） |
| 4 — 组装 | 协调员 | 最终合成 |

### 基础设施

- **Azure App Service (P0v4)** — 托管 API 和连续 WebJob 以供后台处理

- **Azure Service Bus** — 将 API 与繁重的 AI 工作分离（异步请求-回复）

- **Azure Cosmos DB** — 存储任务状态、结果和每个代理的聊天历史记录（24 小时 TTL）

- **Azure OpenAI (GPT-4o)** — 为所有代理 LLM 调用提供支持

- **Application Insights + Log Analytics** — 监控和诊断

## ChatClientAgent 深入探讨

每个代理的核心是来自 `Microsoft.Agents.AI` 的 `ChatClientAgent`。它使用说明、名称、描述和可选的工具集包装了 `IChatClient`（来自 `Microsoft.Extensions.AI`）。这是**客户端**编排 — 您控制聊天历史、生命周期和执行顺序。没有创建服务器端 Foundry 代理资源。

以下是示例中所有六个代理使用的 `BaseAgent` 模式：

```
// BaseAgent.cs — 带有工具的代理的构造函数
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

注意构建器管道：`.AsBuilder().UseOpenTelemetry(...).Build()`。这只需一行即可让每个代理选择进入框架的内置 OpenTelemetry 仪器。我们将在博客 2 中探讨该遥测的样子。

调用代理同样简单：

```
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

关键要点：

- `session: null` — 这是重命名的参数（在预览版中是 `thread`）。我们传递 `null` 因为我们自己管理聊天历史。

- 代理接收完整的 `chatHistory` 列表，所以上下文会在多个轮次中累积。

- 简单代理（本地知识、行程规划员、预算优化器、协调员）使用无工具构造函数；调用外部 API 的代理（货币、天气）使用接受带有工具的 `ChatOptions` 的构造函数。

## 工具集成

我们的两个代理 — **天气顾问**和**货币转换器** — 通过 MAF 工具调用管道调用真实的外部 API。使用 `Microsoft.Extensions.AI` 中的 `AIFunctionFactory.Create()` 注册工具。

以下是 `WeatherAdvisorAgent` 如何连接其工具的方式：

```
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

`GetWeatherForecastFunction` 返回一个 `Func<double, double, int, Task<string>>`，模型可以使用纬度、经度和天数调用。在幕后，它访问美国国家气象服务 API 并返回格式化的预报字符串。货币转换器遵循相同的模式与 Frankfurter API。

这是 GA API 最好的部分之一：您编写一个普通的 C# 方法，使用 `AIFunctionFactory.Create()` 包装它，框架会自动处理 JSON 模式生成、函数调用解析和响应路由。

## 多阶段工作流编排

`TravelPlanningWorkflow` 类协调所有六个代理。关键见解是编排*就是 C# 代码* — 没有 YAML，没有图形 DSL，没有特殊的运行时。您决定何时代理运行、它们接收什么上下文以及结果如何在阶段之间流动。

```
// 阶段 1：并行信息收集
var gatheringTasks = new[]
{
    GatherCurrencyInfoAsync(request, state, progress, cancellationToken),
    GatherWeatherInfoAsync(request, state, progress, cancellationToken),
    GatherLocalKnowledgeAsync(request, state, progress, cancellationToken)
};
await Task.WhenAll(gatheringTasks);
```

在阶段 1 完成后，结果存储在 `WorkflowState` 对象中 — 一个简单的字典支持的容器，保存每个代理的聊天历史和上下文数据：

```
// WorkflowState.cs
public Dictionary<string, object> Context { get; set; } = new();
public Dictionary<string, List<ChatMessage>> AgentChatHistories { get; set; } = new();
```

阶段 2-4 顺序运行，每个都从前一个阶段拉取上下文。例如，行程规划员接收在阶段 1 中收集的天气和本地知识：

```
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

这个模式 — 并行扇出后跟顺序上下文充实 — 简单、可测试且易于扩展。需要第七个代理？将其添加到适当的阶段并将其连接到 `WorkflowState`。

## 异步请求-回复模式

带有六个 LLM 调用的多代理工作流（其中一些涉及工具调用）可以轻松运行 30-60 秒。这远远超出了典型的 HTTP 超时预期，对于同步请求来说用户体验也不是很好。我们使用**异步请求-回复模式**来处理这个问题：

- API 接收旅行计划请求并立即将消息排队到 **Service Bus**。

- 它在 **Cosmos DB** 中存储初始任务记录，状态为 `queued`，并将 `taskId` 返回给客户端。

- **连续 WebJob**（在同一 App Service 计划上作为单独的进程运行）拾取消息、执行完整的多代理工作流，并将结果写回 Cosmos DB。

- 客户端轮询 API 的状态更新，直到任务达到 `completed`。

这个模式保持 API 的响应性，使繁重的工作可重试（Service Bus 处理重试和死信），并允许 WebJob 独立运行 — 您可以重启它而不影响 API。我们在[之前的系列](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)中详细介绍了这个模式，所以我们这里不会重复这些细节。

## 使用 `azd` 部署

该仓库已配备 Azure Developer CLI 以供一命令配置和部署：

```
git clone https://github.com/seligj95/app-service-multi-agent-maf-otel.git
cd app-service-multi-agent-maf-otel
azd auth login
azd up
```

`azd up` 通过 Bicep 配置以下资源：

- Azure App Service（P0v4 Windows）带连续 WebJob

- Azure Service Bus 命名空间和队列

- Azure Cosmos DB 帐户、数据库和容器

- Azure AI 服务（带 GPT-4o 部署的 Azure OpenAI）

- Application Insights 和 Log Analytics 工作区

- 带有所有必要角色分配的托管身份

部署完成后，`azd` 输出 App Service URL。在浏览器中打开它，填写旅行表格，实时观看六个代理协作完成您的旅行计划。

![](https://techcommunity.microsoft.com/t5/s/gxcuf89792/images/bS00NTEwMDE3LWw3VkNzVg?image-dimensions=709x999&revision=3)

## 下一步

我们现在有一个生产就绪的多代理应用在 App Service 上运行，使用 GA Microsoft Agent Framework。但您实际上如何*观察*这些代理在做什么？当六个代理在进行 LLM 调用、调用工具、在各个阶段之间传递上下文时 — 您需要对每一步的可见性。

在**下一篇文章**中，我们将深入探讨如何使用 **OpenTelemetry** 和 **Application Insights** 中的新 **Agents（预览版）**视图来检测这些代理 — 让您完全可见代理运行、令牌使用、工具调用和模型性能。您已经看到了构建器管道中的 `.UseOpenTelemetry()` 调用；博客 2 展示了该遥测从端到端的样子以及如何在 Azure 门户中启用新的 Agents 体验。

敬请期待！

## 资源

- [示例仓库 — app-service-multi-agent-maf-otel](https://github.com/seligj95/app-service-multi-agent-maf-otel)

- [Microsoft Agent Framework 1.0 GA 公告](https://devblogs.microsoft.com/semantic-kernel/microsoft-agent-framework-1-0-is-now-generally-available/)

- [Microsoft Agent Framework 文档](https://learn.microsoft.com/en-us/semantic-kernel/frameworks/agent/)

- [之前的系列 — 第 3 部分：App Service 上的客户端多代理编排](https://techcommunity.microsoft.com/blog/appsonazureblog/part-3-client-side-multi-agent-orchestration-on-azure-app-service-with-microsoft/4466728)

- [Microsoft.Extensions.AI 文档](https://learn.microsoft.com/en-us/dotnet/api/microsoft.extensions.ai)

- [Azure App Service 文档](https://learn.microsoft.com/en-us/azure/app-service/)

更新于 2026-04-09，版本 1.0