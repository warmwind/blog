---
title: "ADK Go 1.0 发布——Go 语言 AI Agent 的生产级时代到来"
pubDatetime: 2026-04-01T10:00:00+08:00
description: "Google Developers Blog《ADK Go 1.0 Arrives!》中文翻译（含原文引用）。Google 发布 Agent Development Kit for Go 1.0，带来 OpenTelemetry 集成、Plugin 系统、Human-in-the-Loop 确认流程、YAML 配置以及 A2A 跨语言协议等生产级特性。"
slug: adk-go-1-arrives-zh
originalTitle: "ADK Go 1.0 Arrives!"
originalUrl: https://developers.googleblog.com/adk-go-10-arrives/
---

> 原文标题：ADK Go 1.0 Arrives!
> 原文链接：https://developers.googleblog.com/adk-go-10-arrives/

# ADK Go 1.0 Arrives!

![ADK Go 1.0 发布](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/ADK_Go_Blog_Banner-Gemini_Generated_2750x1536.original.png)

*作者：Toni Klopfenstein，Developer Relations Engineer*

AI Agent 正在从实验性脚本向生产级服务转变。对于开发者而言，这一转变需要系统具备可观测性、安全性和可扩展性。

在 Golang 诞生于 Google 的 19 年之后，我们很高兴延续高性能工程的传统，发布 **Agent Development Kit for Go 1.0**。这些更新在现有 ADK Go 架构的基础上进行了扩展，支持复杂的多 Agent 系统——从逐步执行和并发的 `SequentialAgents`、`ParallelAgents` 到迭代式的 `LoopAgents`。

让我们来看看最新的 ADK Go 特性，包括：

- 使用 OpenTelemetry 集成实现深度 Tracing
- 通过 Plugin 系统实现自修复逻辑
- 通过 Human-in-the-Loop 确认流程为敏感操作添加安全护栏
- 通过 YAML 配置定义 Agent，提升可移植性

## 用 OpenTelemetry 窥探黑盒内部

部署 Agent 最大的障碍在于其内在的非确定性。当 Agent 失败时，你需要知道*原因*。是工具故障？模型幻觉？还是隐性的 API 调用延迟？

ADK Go 1.0 引入了原生 **OpenTelemetry (OTel)** 集成。只需接入一个 OTel `TraceProvider`，每次模型调用和工具执行循环都会生成结构化的 Trace 和 Span，帮助调试复杂的 Agent 逻辑。

```go
// ADK Go 中的 OTel 初始化
telemetryProviders, err := telemetry.New(ctx, telemetry.WithOtelToCloud(true),
)
if err != nil {
	log.Fatal(err)
}
defer telemetryProviders.Shutdown(ctx)

// 注册为全局 OTel Provider
telemetryProviders.SetGlobalOtelProviders()

// 使用 Telemetry 支持初始化 Runner
r, _ := runner.New(runner.Config{
    Agent:      myAgent,
    Telemetry:  telemetry.NewOTel(tp),
})
```

这使你可以在 Cloud Trace 等工具中，将 Agent 的"思维链"与现有应用指标一起可视化。

## 无膨胀的可扩展性：新 Plugin 系统

我们认为核心 Agent 逻辑应该保持简洁清晰。全新的 **Plugin 系统**允许你注入横切关注点——如日志记录、安全过滤和自我修正——而无需修改 Agent 的主要指令。

我们最喜欢的新增功能之一是 **Retry and Reflect Plugin**。它拦截工具错误，将错误反馈给模型，让 Agent 自行修正参数并重试。这是框架内置的"自修复"代码，减少了人工干预的需要。

```go
// 向 Runner 添加 Plugin
r, _ := runner.New(runner.Config{
    Agent: myAgent,
    SessionService: mySessionService,
    PluginConfig: runner.PluginConfig{
    	Plugins: []*plugin.Plugin{
            // 自动重试失败的工具调用并进行反思
            retryandreflect.MustNew(retryandreflect.WithMaxRetries(3)),
            // 为每一轮对话提供集中式日志
            loggingplugin.MustNew(""),
        },
    },
})
```

## 信任，但要验证：Human-in-the-Loop (HITL)

安全不仅关乎代码，更关乎控制。遵循 **Safe AI Framework (SAIF)** 指导方针，ADK Go 现在支持强大的**请求确认**流程。

对于敏感操作——如金融交易或生产数据库变更——你现在可以将工具标记为 `RequireConfirmation`。Agent 会暂停执行，生成确认事件，并等待人工信号后再继续。

```go
// Human-in-the-Loop 工具配置
myTool, _ := functiontool.New(functiontool.Config{
    Name:                "delete_database",
    Description:         "Deletes a production database instance.",
    RequireConfirmation: true, // 触发 HITL 审批流程
}, deleteDBFunc)
```

## 通过 YAML 配置 Agent

作为 1.0 版本的一部分，ADK Go 现在支持通过 YAML 配置文件直接定义 Agent，确保功能对等和跨语言一致性。这意味着开发者可以通过 `adk` 命令行工具管理和运行 Agent，无需为每次配置更改编写样板 Go 代码。

```yaml
# agent_config.yaml
name: customer_service
description: An agent that handles customer questions for an airline.
instruction: >
  You are a customer agent that helps users booking flights.
  You are always helpful.
tools:
  - name: "google_search"
  - name: "builtin_code_executor"
sub_agents:
  - "policy_agent"
  - "booking_agent"
```

这使你的团队可以快速迭代 Agent 人设和子 Agent 层级结构，而无需重新构建核心二进制文件，更容易将配置与业务逻辑分离。

## 多语言的未来：A2A 协议稳定性

没有一个 Agent 是孤岛。**Agent2Agent (A2A)** 协议已经过优化，支持 Go、Java 和 Python Agent 之间的无缝通信。ADK Go 通过自动管理事件排序和响应聚合来简化这种编排。这确保了即使在部分响应流期间，来自远程 Agent 的数据也能被可靠处理。通过处理这些多 Agent 协议细节，A2A 让你的 Agent 可以专注于任务委托和洞察共享。

## 下一步？

立即通过 [Quickstart Guide](https://google.github.io/adk-docs/get-started/go/) 开始，深入 [GitHub 仓库](https://github.com/google/adk-go) 构建下一代生产级 AI。

别忘了加入我们在 [Reddit](https://www.reddit.com/r/agentdevelopmentkit/) 或 [ADK Community Google Group](https://groups.google.com/g/adk-community?e=48417069) 的社区，分享你正在构建的东西。我们期待听到你的声音！

**Go Agent 的未来已经到来。让我们一起构建。**

## 引用

- 原文：[ADK Go 1.0 Arrives!](https://developers.googleblog.com/adk-go-10-arrives/) — Google Developers Blog
- [Agent Development Kit for Go GitHub (v1.0.0)](https://github.com/google/adk-go/tree/v1.0.0)
- [OpenTelemetry](https://opentelemetry.io/)
- [Safe AI Framework (SAIF)](https://saif.google/)
- [Agent2Agent Protocol](https://a2a-protocol.org/)
- [ADK Go Quickstart Guide](https://google.github.io/adk-docs/get-started/go/)
