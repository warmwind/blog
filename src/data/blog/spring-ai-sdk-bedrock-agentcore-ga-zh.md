---
title: Amazon Bedrock AgentCore 的 Spring AI SDK 正式发布（GA）
pubDatetime: 2026-04-15T10:00:00+08:00
description: Amazon Bedrock AgentCore 的 Spring AI SDK 正式发布，Java 开发者可通过熟悉的 Spring 模式，使用注解驱动开发方式构建生产级 AI Agent，并无缝集成 AgentCore 的运行时、记忆、浏览器自动化和代码解释器等能力。
slug: spring-ai-sdk-bedrock-agentcore-ga-zh
originalTitle: "Spring AI SDK for Amazon Bedrock AgentCore is now Generally Available"
originalUrl: https://aws.amazon.com/blogs/machine-learning/spring-ai-sdk-for-amazon-bedrock-agentcore-is-now-generally-available/
---

原文标题：Spring AI SDK for Amazon Bedrock AgentCore is now Generally Available<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/spring-ai-sdk-for-amazon-bedrock-agentcore-is-now-generally-available/

智能体式 AI 正在改变组织使用生成式 AI 的方式，从提示-响应的交互模式，演进为能够规划、执行并完成复杂多步骤任务的自主系统。尽管智能体式 AI 领域的早期概念验证令业务干系人感到兴奋，但将其推向生产仍需解决可扩展性、治理和安全性方面的挑战。[Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) 是一个智能体式 AI 平台，旨在帮助您使用任意框架和任意模型，大规模构建、部署和运营 Agent。

Java 开发者希望使用熟悉的 Spring 模式构建 AI Agent，但生产部署需要从头构建极为复杂的基础设施。Amazon Bedrock AgentCore 提供了以下构建块：托管运行时基础设施（可扩展性、可靠性、安全性、可观测性）、短期和长期记忆、浏览器自动化、沙盒化代码执行以及评估能力。目前，将这些能力集成到 Spring 应用中需要编写自定义控制器以满足 AgentCore 运行时契约、处理服务端发送事件（SSE）流、实现健康检查、管理限速，以及连接 Spring 顾问、记忆仓库和工具定义。在编写任何 AI Agent 逻辑之前，这些基础设施工作就需要数周时间。

借助全新的 [Spring AI AgentCore SDK](https://github.com/spring-ai-community/spring-ai-agentcore)，您可以构建生产就绪的 AI Agent，并在高度可扩展的 AgentCore 运行时上运行它们。Spring AI AgentCore SDK 是一个开源库，通过注解、自动配置和可组合的顾问等熟悉的模式，将 Amazon Bedrock AgentCore 的能力引入 [Spring AI](https://spring.io/projects/spring-ai)。Spring AI 开发者只需添加一个依赖项、标注一个方法，SDK 便会处理其余的一切。

## 理解 AgentCore 运行时契约

[AgentCore 运行时](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-runtime.html)以按用量计费的方式管理 Agent 生命周期和扩展，这意味着您无需为闲置的计算资源付费。运行时负责将传入请求路由到您的 Agent 并监控其健康状态，但这要求您的 Agent 遵循一套契约。该契约要求实现暴露两个端点：`/invocations` 端点用于接收请求并以 JSON 或 SSE 流的形式返回响应；`/ping` 健康端点用于报告 Healthy 或 HealthyBusy 状态。长时间运行的任务必须发出繁忙信号，否则运行时可能会为了节省成本而将其缩减。SDK 自动实现这一契约，包括异步任务检测功能——在 Agent 处理过程中报告**繁忙状态**。

除契约外，SDK 还为生产工作负载提供了额外能力，例如：处理具有正确帧格式的 SSE 响应、针对大型响应的背压处理和连接生命周期管理；以及限速功能，用于保护 Agent 免受流量峰值冲击并限制单个用户的消费量。您专注于 Agent 逻辑，SDK 负责运行时集成。

在本文中，我们从一个聊天端点开始，逐步构建一个生产就绪的 AI Agent，依次添加流式响应、对话记忆以及用于网页浏览和代码执行的工具。最终，您将拥有一个完全功能的 Agent，可部署至 AgentCore 运行时或独立运行于您现有的基础设施上。

## 前置条件

在开始之前，您需要准备：

- Java 17 或更高版本（推荐 Java 25）
- Spring Boot 3.5 或更高版本
- 一个 AWS 账号
- [Maven](https://maven.apache.org/) 或 [Gradle](https://gradle.org/)

## 解决方案概述

Spring AI AgentCore SDK 基于三项设计原则构建：

- **约定优于配置**——合理的默认值与 AgentCore 期望保持一致（端口 8080、端点路径、内容类型处理），无需显式配置。
- **注解驱动开发**——单个 `@AgentCoreInvocation` 注解可将任意 [Spring Bean](https://docs.spring.io/spring-framework/reference/core/beans/factory-collaborators.html) 方法转化为兼容 AgentCore 的端点，并自动处理序列化、流式检测和响应格式化。
- **部署灵活性**——SDK 支持 [AgentCore 运行时](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-runtime.html)进行全托管部署，但您也可以在运行于 [Amazon EKS](https://aws.amazon.com/eks/)、[Amazon ECS](https://aws.amazon.com/ecs/) 或任何其他基础设施上的应用中单独使用各个模块（记忆、浏览器、代码解释器）。

下图展示了 SDK 各组件的交互方式。`@AgentCoreInvocation` 注解处理运行时契约，而 ChatClient 则组合了记忆顾问、浏览器工具和代码解释器。部署到 AgentCore 运行时是可选的。您可以将 SDK 模块作为独立功能使用。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ml-19946-image-1.jpeg)

## 创建您的第一个 AI Agent

以下章节将逐步引导您创建一个完整功能的 Agent：

### 步骤 1：添加 SDK 依赖

将 Spring AI AgentCore BOM 添加到您的 Maven 项目中，然后引入运行时 starter：

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springaicommunity</groupId>
            <artifactId>spring-ai-agentcore-bom</artifactId>
            <version>1.0.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>org.springaicommunity</groupId>
        <artifactId>spring-ai-agentcore-runtime-starter</artifactId>
    </dependency>
</dependencies>
```

### 步骤 2：创建 Agent

`@AgentCoreInvocation` 注解告知 SDK 此方法负责处理传入的 Agent 请求。SDK 会自动配置 `POST /invocations` 和 `GET /ping` 端点，处理 JSON 序列化，并自动报告健康状态。

```java
@Service
public class MyAgent {

   private final ChatClient chatClient;

   public MyAgent(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

   @AgentCoreInvocation
    public String chat(PromptRequest request) {
        return chatClient.prompt()
            .user(request.prompt())
            .call()
            .content();
    }
}

record PromptRequest(String prompt) {}
```

### 步骤 3：配置 Amazon Bedrock

在 `application.properties` 中设置您的模型和 AWS 区域：

```properties
spring.ai.bedrock.aws.region=us-east-1
spring.ai.bedrock.converse.chat.options.model=global.anthropic.claude-sonnet-4-5-20250929-v1:0
```

### 步骤 4：本地测试

启动应用并发送请求：

```bash
mvn spring-boot:run

curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is Spring AI?"}'
```

这就是一个完整的、兼容 AgentCore 的 AI Agent。无需自定义控制器，无需协议处理，无需健康检查实现。

### 步骤 5：添加流式响应

若要在生成响应时以流的形式传输，只需将返回类型改为 `Flux<String>`。SDK 会自动切换为 SSE 输出：

```java
@AgentCoreInvocation
public Flux<String> streamingChat(PromptRequest request) {
    return chatClient.prompt()
        .user(request.prompt())
        .stream()
        .content();
}
```

SDK 负责处理 SSE 帧格式、Content-Type 请求头、换行符保留和连接生命周期。您的代码保持专注于 AI 交互。

### 步骤 6：为 Agent 添加记忆

现实世界中的 Agent 必须记住用户在对话早期说过的内容（短期记忆），以及它随时间积累的知识（长期记忆）。SDK 通过 Spring AI 的顾问模式集成了 [AgentCore 记忆](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-memory.html)——顾问是在请求到达模型之前用上下文丰富提示的拦截器。

短期记忆（STM）使用滑动窗口保留最近的消息。长期记忆（LTM）通过四种策略跨会话持久化知识：

AgentCore 异步整合这些策略，无需开发者显式干预即可提取相关信息。添加记忆依赖并启用自动发现——在自动发现模式下，SDK 会自动检测可用的长期记忆策略和命名空间，无需手动配置：

```properties
agentcore.memory.memory-id=${AGENTCORE_MEMORY_ID}
agentcore.memory.long-term.auto-discovery=true
```

然后注入 `AgentCoreMemory` 并将其组合到您的 chat client 中：

```java
// 添加到 MyAgent 构造函数
private final AgentCoreMemory agentCoreMemory;

public MyAgent(ChatClient.Builder builder, AgentCoreMemory agentCoreMemory) {
    this.agentCoreMemory = agentCoreMemory;
    this.chatClient = builder.build();
}

// 更新 chat 方法以包含记忆顾问
@AgentCoreInvocation
public String chat(PromptRequest request, AgentCoreContext context) {
    String sessionId = context.getHeader(AgentCoreHeaders.SESSION_ID);

   return chatClient.prompt()
        .user(request.prompt())
        .advisors(agentCoreMemory.advisors)
        .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, "user:" + sessionId))
        .call()
        .content();
}
```

`agentCoreMemory.advisors` 列表包含 STM 和所有已配置的 LTM 顾问。有关详细配置选项，请参阅[记忆文档](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-memory.html)。

### 步骤 7：使用工具扩展 Agent

AgentCore 提供了专用工具，SDK 通过 `ToolCallbackProvider` 接口将其作为 Spring AI 工具回调暴露出来。

**浏览器自动化**——Agent 可以使用 [AgentCore 浏览器](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-browser.html)导航网站、提取内容、截图并与页面元素交互：

```xml
<dependency>
    <groupId>org.springaicommunity</groupId>
    <artifactId>spring-ai-agentcore-browser</artifactId>
</dependency>
```

**代码解释器**——Agent 可以使用 [AgentCore 代码解释器](https://docs.aws.amazon.com/bedrock/latest/userguide/agent-code-interpreter.html)在安全沙盒中编写并运行 Python、JavaScript 或 TypeScript。沙盒包含 numpy、pandas 和 matplotlib。生成的文件通过 artifact store 捕获。

```xml
<dependency>
    <groupId>org.springaicommunity</groupId>
    <artifactId>spring-ai-agentcore-code-interpreter</artifactId>
</dependency>
```

两种工具均通过 Spring AI 的 `ToolCallbackProvider` 接口集成。以下是集成了记忆、浏览器和代码解释器的最终版 `MyAgent`：

```java
@Service
public class MyAgent {

   private final ChatClient chatClient;
   private final AgentCoreMemory agentCoreMemory;

   public MyAgent(
            ChatClient.Builder builder,
            AgentCoreMemory agentCoreMemory,
            @Qualifier("browserToolCallbackProvider") ToolCallbackProvider browserTools,
            @Qualifier("codeInterpreterToolCallbackProvider") ToolCallbackProvider codeInterpreterTools) {
        this.agentCoreMemory = agentCoreMemory;
        this.chatClient = builder
            .defaultToolCallbacks(browserTools, codeInterpreterTools)
            .build();
    }

   @AgentCoreInvocation
   public Flux<String> chat(PromptRequest request, AgentCoreContext context) {
        String sessionId = context.getHeader(AgentCoreHeaders.SESSION_ID);

       return chatClient.prompt()
            .user(request.prompt())
            .advisors(agentCoreMemory.advisors)
            .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, "user:" + sessionId))
            .stream()
            .content();
    }
}
```

模型会平等地看到所有工具，并根据用户的请求决定调用哪个工具。虽然本文重点介绍使用 Amazon Bedrock 访问基础模型（FM），但 Spring AI 支持包括 OpenAI 和 Anthropic 在内的多种大型语言模型（LLM）提供商，因此您可以选择最适合自身需求的模型。例如，一个差旅费用管理 Agent 可以使用浏览器工具查询航班选项，使用代码解释器分析消费模式并生成图表，所有这一切都在单次对话中完成：

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ml-19946-image-2.png)

## 部署您的 Agent

SDK 支持两种部署模式：

**AgentCore 运行时**——对于全托管基础设施，将您的应用打包为 ARM64 容器，推送至 [Amazon Elastic Container Registry（Amazon ECR）](https://aws.amazon.com/ecr/)，并创建一个引用该镜像的 AgentCore 运行时。运行时负责扩缩容和健康监控。`examples/terraform` 目录提供了基础设施即代码（IaC）示例，支持 IAM 和 OAuth 认证选项。

**独立部署**——在运行于 Amazon Elastic Kubernetes Service（Amazon EKS）、Amazon Elastic Container Service（Amazon ECS）、Amazon Elastic Compute Cloud（Amazon EC2）或本地环境的应用中使用 AgentCore 记忆、浏览器或代码解释器。通过这种方式，团队可以逐步采用 AgentCore 能力。例如，先向现有的 Spring Boot 服务添加记忆功能，之后再迁移到 AgentCore 运行时。

## 认证与授权

AgentCore 运行时支持两种认证方式：基于 IAM 的 SigV4（用于 AWS 服务间调用）和 OAuth2（用于面向用户的应用）。当您的 Spring AI Agent 部署到 AgentCore 运行时时，认证在基础设施层处理。您的应用通过 `AgentCoreContext` 接收已认证用户的身份信息。细粒度的授权可以在您的 Spring 应用中使用标准 Spring Security 模式以这些原则实现。对于独立部署，您的 Spring 应用负责使用 Spring Security 提供认证和授权。在这种情况下，对 AgentCore 服务（记忆、浏览器、代码解释器）的调用使用标准 AWS SDK 凭证机制进行保护。

## 通过 AgentCore Gateway 连接 MCP 工具

Spring AI Agent 可以通过 AgentCore Gateway 访问组织内部工具，后者提供了带出站认证和语义工具注册表的 Model Context Protocol（MCP）支持。要使用 Gateway，将您的 Spring AI MCP 客户端端点配置为指向 AgentCore Gateway，并使用 IAM SigV4 或 OAuth2 进行认证：

```properties
spring.ai.mcp.client.toolcallback.enabled=true
spring.ai.mcp.client.initialized=false
spring.ai.mcp.client.streamable-http.connections.gateway.url=${GATEWAY_URL}
```

这使 Agent 能够发现和调用企业工具，而 Gateway 负责下游服务的凭证管理。有关动手实践示例，请参阅"使用 Spring AI 和 Amazon Bedrock AgentCore 构建 Java AI Agent"workshop，该 workshop 演示了与 AgentCore Gateway 的 MCP 集成。

## 下一步是什么？

SDK 还在持续演进。即将推出的集成包括：

- **可观测性**——将 Spring AI 的追踪、指标和日志与 Amazon CloudWatch 以及使用 OpenTelemetry 的外部可观测性工具（如 LangFuse、Datadog 和 Dynatrace）集成。基础的 AgentCore 可观测性今天已可用。
- **评估**——Agent 响应的测试与质量评估框架。
- **高级身份管理**——为 Spring AI Agent 简化安全上下文检索。

## 清理资源

如果您在跟随本文操作时创建了资源，请将其删除以避免持续产生费用：

1. 删除您创建的所有 AgentCore 运行时 Agent。
2. 从 Amazon ECR 删除容器镜像。
3. 移除为 Agent 部署创建的 IAM 角色和策略。
4. 如果您使用了 Terraform 示例，运行 `terraform destroy` 以删除所有资源。

## 总结

在本文中，我们展示了如何使用 Spring AI AgentCore SDK 在 Java 中构建生产就绪的 AI Agent。从一个带注解的方法出发，我们依次添加了流式响应、持久化记忆、浏览器自动化和代码执行——所有这一切都通过熟悉的 Spring 模式实现。SDK 基于 Apache 2.0 许可证开源。要开始使用：

- 探索 [GitHub 上的 Spring AI AgentCore SDK](https://github.com/spring-ai-community/spring-ai-agentcore)。仓库中包含可用作起点的示例应用：
  - `simple-spring-boot-app`——具备基本请求处理的最小化 Agent
  - `spring-ai-sse-chat-client`——使用服务端发送事件的流式响应
  - `spring-ai-memory-integration`——短期和长期记忆用法
  - `spring-ai-extended-chat-client`——带有按用户记忆隔离的 OAuth 认证
  - `spring-ai-browser`——网页浏览和截图能力
- 阅读 [Amazon AgentCore 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html)，了解运行时、记忆、浏览器和代码解释器服务的详细信息。
- 尝试 [Amazon Bedrock 控制台](https://console.aws.amazon.com/bedrock/)以启用模型访问并探索可用的基础模型。
- 如需深度实践，请尝试"使用 Spring AI 和 Amazon AgentCore 构建 Java AI Agent" workshop。在大约四小时内，您将逐步构建一个完整的差旅费用管理助手——依次添加人设、记忆、知识检索、网页浏览、代码执行、MCP 工具集成，并将其无服务器部署到带认证和可观测性的 AgentCore 运行时。不需要人工智能与机器学习（AI/ML）相关经验。

欢迎您的反馈与贡献。请留言分享您的使用体验，或在 [GitHub 仓库](https://github.com/spring-ai-community/spring-ai-agentcore)上提交 Issue。

## 引用

- 原文：[Spring AI SDK for Amazon Bedrock AgentCore is now Generally Available](https://aws.amazon.com/blogs/machine-learning/spring-ai-sdk-for-amazon-bedrock-agentcore-is-now-generally-available/)
- [Spring AI AgentCore SDK GitHub](https://github.com/spring-ai-community/spring-ai-agentcore)
- [Amazon Bedrock AgentCore 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/agentcore.html)
