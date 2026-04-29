---
title: 使用 Amazon Nova 2 Sonic 将文本 Agent 迁移为语音助手
pubDatetime: 2026-04-29T10:00:00+08:00
description: 本文探讨如何使用 Amazon Nova 2 Sonic 将传统文本 Agent 迁移为对话式语音助手，比较文本与语音 Agent 的设计要求，分析架构迁移路径，并提供工具复用与系统提示词适配的实用指南。
slug: migrating-text-agent-voice-assistant-nova-sonic-zh
originalTitle: "Migrating a text agent to a voice assistant with Amazon Nova 2 Sonic"
originalUrl: https://aws.amazon.com/blogs/machine-learning/migrating-a-text-agent-to-a-voice-assistant-with-amazon-nova-2-sonic/
tags:
  - AWS
  - Amazon Nova
  - Voice AI
  - Strands Agents
  - Agent
---

原文标题：Migrating a text agent to a voice assistant with Amazon Nova 2 Sonic<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/migrating-a-text-agent-to-a-voice-assistant-with-amazon-nova-2-sonic/

将文本 Agent 迁移为语音助手变得愈发重要，因为用户期待更快速、更自然的交互方式。客户不再满足于打字，而是希望能够实时说话和理解。金融、医疗、教育、社交媒体和零售等行业正在探索借助 [Amazon Nova 2 Sonic](https://aws.amazon.com/ai/generative-ai/nova/speech/) 实现大规模自然实时语音交互的解决方案。

本文探讨将传统文本 Agent 迁移为使用 Amazon Nova 2 Sonic 的对话式语音助手所需的工作。我们比较文本与语音 Agent 的需求，重点介绍不同使用场景的设计优先级，拆解 Agent 架构，并解答工具与子 Agent 复用、系统提示词适配等常见问题。本文将帮助您理清迁移过程，避免常见陷阱。

您还可以在 Nova 示例仓库中找到一个 [Skill](https://github.com/aws-samples/amazon-nova-samples/tree/main/skills/text-agent-to-strands-voice-agent)，它可与 Kiro 和 Claude Code 等 AI IDE 配合使用，自动将您的文本 Agent 转换为语音 Agent。

## 文本 Agent 与语音 Agent 并非同一问题

虽然从文本 Agent 迁移到语音助手看起来只是在保持业务逻辑不变的前提下添加语音界面，但从以下几个维度理解两者的差异至关重要。

| **维度** | **文本 Agent** | **语音 Agent** |
|---|---|---|
| 用户输入 | 文字输入：用户可自行控制阅读、滚动、复制粘贴节奏 | 口语音频流：实时传输，可随时打断（barge-in），停顿至关重要 |
| 响应风格 | 段落、列表、表格、链接：格式丰富，一次性呈现所有信息 | 简短口语短语，一次一个要点："需要我继续吗？"附带确认循环 |
| 延迟预算 | 中等延迟容忍：输入指示符可掩盖等待时间 | 极低延迟要求：沉默会让人感觉连线断了 |
| 轮次交替 | 严格的请求→响应模式：用户输入、按回车、等待 | 流畅、可重叠、可打断：需要语音活动检测（VAD）+ 轮次检测，必须支持 barge-in |
| 传输方式 | HTTP / REST / Server-Sent Events：无状态请求响应 | 双向流式传输：持久连接，双向实时音频 |

为了更好地应对这些挑战，让我们来分析文本 Agent 与语音助手之间的核心差异，以及这些差异如何影响设计与实现。

### 响应设计

文本 Agent 的目标是提供用户可按自己节奏阅读的段落内容，用户可以回滚、复制内容、按需点击链接。语音 Agent 运行在一种截然不同的媒介中——响应必须是对话式的、简洁的，并且专为听而非读而精心构建。

以一个返回账户信息的银行 Agent 为例：

**文本 Agent 响应：**

```
Here's your account summary:
- Checking (****4521): $3,245.67
- Savings (****8903): $12,450.00
- Credit Card (****2187): -$1,823.45 (payment due: March 15)

You can click on any account for detailed transactions.
```

**语音 Agent 响应：**

"您有三个账户。您的支票账户尾号 4521，余额为三千两百四十五美元。需要我逐一介绍，还是您想了解这个账户的详情？"

语音 Agent 将信息拆分为可消化的片段，并在继续前询问确认。它采用*自主对话风格*，主动引导用户，而不是一次性倾倒所有信息。

### 延迟预算

文本用户具有中等延迟容忍度，他们看到输入指示符会等待。语音用户几乎立即就能察觉到延迟——语音对话中的沉默会让人感觉连线断了。这从根本上改变了 Agent 的架构方式：

| **因素** | **文本 Agent** | **语音 Agent** |
|---|---|---|
| 可接受响应时间 | 中等延迟容忍：有加载指示符的情况下等待几秒是可以接受的 | 低延迟容忍：对话应在数百毫秒内响应，尽早播出首个音频；几秒的延迟，尤其是工具调用期间，会让人感觉无响应 |
| 工具调用容忍度 | 多个顺序调用可接受 | 每次调用都会带来可感知的静默 |
| 流式传输 | 锦上添花 | 不可或缺 |
| 异步工具处理 | 最好有 | 必须有 |

Amazon Nova 2 Sonic 支持[异步工具调用](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-async-tools.html)，因此对话可以在工具在后台运行时自然继续。它持续接收输入，可并行运行多个工具，并在用户中途更改请求时优雅地适应，在专注于仍然相关内容的同时交付所有结果。

### 轮次交替与打断

文本对话本质上是基于轮次的。用户输入、按回车、等待响应。语音对话是流动的——用户会打断（barge-in）、在句中暂停，并期望 Agent 能自然处理重叠的语音。像 Amazon Nova 2 Sonic 这样的原生语音转语音模型通过内置的语音活动检测（VAD）和轮次检测在内部处理这些问题。Nova 2 Sonic 无需每次都发送完整历史记录，就能管理对话上下文。

## 从架构视角看迁移

理解了这些差异之后，让我们从架构视角拆解迁移过程，将系统划分为三个主要组件并检视每个组件如何演变。

文本 Agent 的概念设计包含三个组件：

- 客户端应用（如 Web、移动端或 IoT 界面）
- 管理系统提示词、工具和对话上下文的文本编排器（Orchestrator）
- 连接到您系统的工具集成，例如 API、数据库、工作流、检索增强生成（RAG）管道或子 Agent

[![text-agent-architecture](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-1.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-1.png)

将此架构迁移为语音 Agent 时，这些组件保持不变，但每个组件都需要不同的更改以支持语音专属逻辑。

[![voice-to-text-agent](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-2.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-2.png)

### 客户端应用

Agent 客户端通常用于 Web 浏览器、移动应用或 IoT 设备的编程语言和系统实现，具体取决于部署场景。语音 Agent 客户端需要持久的双向连接（如 WebSocket 或 WebRTC），并处理音频编解码、客户端事件、barge-in 逻辑、噪声控制和转录显示。这比文本客户端复杂得多——文本客户端通常通过无状态 REST 或单向 HTTPS 流式传输接口与 Agent 通信。

因此，此组件通常需要重构甚至完全重写。例如，一个基于 [Streamlit](https://streamlit.io/) 前端构建的 PoC 很可能需要使用 [React](https://react.dev/) 等 JavaScript 框架重建，以支持双向连接。

要了解使用 WebSocket 的轻量级 React 语音 Agent Web 客户端应用示例，请参考[此示例](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech/amazon-nova-2-sonic/sample-codes/agentcore/strands/client)。

### 编排器

Agent 编排器是构建文本或语音 Agent 时的核心枢纽。它管理系统提示词、选择并路由工具或子 Agent，并维护对话上下文以保持交互的连贯性并与 Agent 角色保持一致。在文本 Agent 中，编排器处理客户端与推理模型之间的请求和响应，同时集成工具来触发业务逻辑。语音编排器遵循相同原则，但还需增加音频流式传输、语音活动检测（VAD）、自动语音识别（ASR）、推理和文本转语音（TTS）。Amazon Nova 2 Sonic 提供了一个集这些功能于一体的双向流式传输接口，因此用户可以从文本 Agent 迁移推理提示词和工具触发器，以便更顺畅地过渡到语音。

与传统文本 Agent 架构的一个关键区别是，Amazon Nova 2 Sonic 可以在**同一模型接口中接受文本和音频输入**。这意味着 Sonic 可以直接替换文本编排器中通常使用的独立文本推理模型。用户无需将独立的 ASR → LLM → TTS 组件串联起来，Sonic 将语音识别、推理、工具使用和语音合成统一到单个双向模型中。借此，团队可以复用现有提示词和工具，同时简化架构、降低延迟，并无需在语音栈中管理独立的文本推理模型。

以下代码片段展示了一个使用 [Strands Agents](https://strandsagents.com/) 和 [Amazon Nova 2 Lite](https://docs.aws.amazon.com/ai/responsible-ai/nova-2-lite/overview.html) 作为大语言模型（LLM）构建的文本 Agent 示例，以及使用 [Strands BidiAgent](https://strandsagents.com/docs/user-guide/concepts/bidirectional-streaming/agent/) 和 Nova 2 Sonic 通过 WebSocket 创建语音 Agent 编排器的示例。您会注意到，Strands 中文本和语音 Agent 的编码风格高度相似。虽然示例使用的是 Strands，但同样的方法适用于使用 LangChain、LangGraph 或 CrewAI 等其他框架构建的文本 Agent，因为文本编排器所需的关键输入是系统提示词和工具定义。

在运行以下各节的示例之前，请安装 Python 和所需依赖项（包括 strands-agents 和 Boto3），并确保您的 IAM 设置具有所需服务的必要权限。

```python
from strands import Agent, tool 
from strands.models import BedrockModel 
 
# ---- Mock tools will be used in both text and voice agents ---- 
@tool 
def authenticate_customer(account_id: str, date_of_birth: str) -> str: 
    """Verify customer identity and return an auth token.""" 
    # In real implementation, call your auth service / API 
    if account_id == "123456": 
        return "AUTH_TOKEN_ABC123" 
    return "Authentication failed" 
 
@tool 
def get_account_balance(auth_token: str) -> str: 
    """Return the customer's current account balance.""" 
    if auth_token == "AUTH_TOKEN_ABC123": 
        return "Your current checking account balance is $5,420." 
    return "Unauthorized request" 
 
@tool 
def get_recent_transactions(auth_token: str) -> str: 
    """Return recent transactions.""" 
    if auth_token == "AUTH_TOKEN_ABC123": 
        return "Recent transactions: $45 groceries, $120 utilities, $18 coffee." 
    return "Unauthorized request" 
```

使用 Strands Agents，您可以创建如下示例所示的以 Nova 2 Lite 为模型的文本 Agent 编排器：

```python
# ---- Nova 2 Lite model ---- 
model = BedrockModel(model_id="amazon.nova-2-lite-v1:0") 
 
# ---- Banking assistant text agent ---- 
bank_agent = Agent( 
    model=model, 
    system_prompt="""You are a banking assistant. Answer user questions about account balances, recent transactions accurately. Always validate user identity before providing sensitive information. 
""", 
    tools=[authenticate_customer, get_account_balance, get_recent_transactions], 
) 
```

使用 Strands BidiAgent，您可以用类似的编码风格，以 Nova 2 Sonic 模型构建语音 Agent 编排器并复用相同的工具：

```python
# voice_orchestrator.py — BidiAgent with sub-agents as tools 
from strands.experimental.bidi.agent import BidiAgent 
from strands.experimental.bidi.models.nova_sonic import BidiNovaSonicModel 

# ---- Nova 2 Sonic model ---- 
model = BidiNovaSonicModel( 
    region="us-east-1", 
    model_id="amazon.nova-2-sonic-v1:0", 
    provider_config={"audio": {"voice": "tiffany", "input_sample_rate": 16000, "output_sample_rate": 16000}}, 
) 

# ---- Banking assistant voice agent ---- 
agent = BidiAgent( 
    model=model, 
    system_prompt=""" You are a banking assistant. Speak naturally and answer questions about account balances, recent transactions. Confirm the customer's identity before sharing sensitive details. Use short, clear responses and acknowledge when retrieving data. 
""", 
    tools=[authenticate_customer, get_account_balance, get_recent_transactions], 
) 
await agent.run(inputs=[ws_input], outputs=[ws_output]) 
```

系统提示词是文本和语音 Agent 的基础。它定义了 Agent 的角色、语气和护栏，确保在书面和口头交互中响应的一致性、可靠性，以及与业务目标和用户期望的对齐。从文本迁移到语音时，需要针对实时音频调整系统提示词：保持简洁和对话性，考虑延迟和多轮上下文，并将复杂指导拆分为更小的步骤。

**文本提示词（原始版本）：**

*"You are a banking assistant. Answer user questions about account balances, recent transactions accurately. Always validate user identity before providing sensitive information."*

**语音适配版本：**

*"You are a banking assistant. Speak naturally and answer questions about account balances, recent transactions. Confirm the customer's identity before sharing sensitive details. Use short, clear responses and acknowledge when retrieving data."*

请注意，在使用 Nova 2 Sonic 的语音编排器中，您使用的是 Sonic 内置的推理能力来管理系统提示词、工具选择和会话上下文。您不再需要在编排器层面提供自己的 LLM 进行推理。

### 业务逻辑层

工具集成是将 Agent 助手与业务层连接的关键，使用的协议包括模型上下文协议（[MCP](https://modelcontextprotocol.io/docs/getting-started/intro)）、Agent 间协议（[A2A](https://github.com/a2aproject/A2A)）和标准 HTTP。在基于文本的 Agent 中，编排器向工具（如 REST API、[RAG](https://aws.amazon.com/what-is/retrieval-augmented-generation/) 系统或数据库）发送文本输入，并接收文本响应以生成面向用户的回复。

在 Strands Agents 示例中，文本 Agent 使用的相同工具可以无需任何代码更改地复用于语音 Agent。但是，为语音复用工具和子 Agent 不仅仅涉及实现细节。

如果您已经使用了多 Agent 架构，您的专属业务逻辑 Agent 通常可以经过一些更新后复用于语音。下图展示了一个银行助手，其中语音编排器调用子 Agent 处理身份验证和抵押贷款查询。

[![voice-multi-agents](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-3.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-image-3.png)

虽然这些子 Agent 不需要完全重写，但它们确实需要针对语音进行调优：

**缩短响应长度** —— 文本子 Agent 可能返回详细的段落。语音子 Agent 应返回 1-2 句话，使编排器能够自然地说出来。例如，将子 Agent 的系统提示词从"提供全面的答案"改为"用 1 到 2 个简洁的句子总结"。

**改善延迟** —— 为子 Agent 选择更小、更快的模型（例如，从 [Nova 2 Lite](https://docs.aws.amazon.com/ai/responsible-ai/nova-2-lite/overview.html) 开始，而不是更大的模型）。在语音对话中，每一个额外的推理跳转都会增加可感知的静默。对于 Nova 2 Lite，我们建议限制或避免使用思考模式以降低延迟。更多信息请参阅 [Amazon Nova Developer Guide for Amazon Nova 2](https://docs.aws.amazon.com/nova/latest/nova2-userguide/extended-thinking.html#how-extended-thinking-works)。

**减少工具结果的冗余** —— 一些子 Agent 被设计为返回大型原始负载，例如包含比请求更多数据的 JSON，让编排器来过滤响应。这并不理想，对于语音尤其如此。更大的负载会增加延迟、降低准确性，并可能暴露敏感数据。精简、有针对性的响应至关重要，尤其是对于对延迟敏感的语音体验。

**使用填充消息**，在较长的工具处理过程中保持对话的自然性。使用 Amazon Nova 2 Sonic，您可以进行[异步工具调用](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-async-tools.html)并自定义这些中间消息，确保用户在 Agent 完成任务期间保持参与。

这些调整大多涉及提示词和配置更改，而不是架构修改。子 Agent 的工具、业务逻辑和部署保持不变。虽然子 Agent 架构提供了清晰度、可复用性和可移植性，在将文本 Agent 迁移到语音时尤其有用，但每次子 Agent 调用都会因其自身的模型推理和工具调用而增加延迟。在语音对话中，这可能转化为可感知的子 Agent 推理停顿。

有关更多语音 Agent 架构模式和延迟管理最佳实践，请参阅[此博客](https://aws.amazon.com/blogs/machine-learning/)。

## 结论

将文本 Agent 迁移为语音助手并不是简单的包装工作。从响应设计到延迟预算再到轮次交替行为，交互模型从根本上是不同的。但借助结构良好的多 Agent 架构和 Amazon Nova 2 Sonic，业务逻辑层可以保持完整。

立即启动您的迁移项目，使用 Amazon Nova 2 Sonic 将您的文本 Agent 转换为语音助手。要查看使用 Amazon Nova 2 Sonic 的完整语音 Agent 工作示例，请参见 [Strands BidiAgent 中的 Amazon Nova 2 Sonic](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech/amazon-nova-2-sonic/sample-codes/agentcore/strands)。更多文档和资源请参阅：

- [Amazon Nova 2 Sonic](https://aws.amazon.com/ai/generative-ai/nova/speech/)
- [Amazon Nova 2 Sonic 示例代码和可重复模式](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech/amazon-nova-2-sonic)
- [Amazon Nova 2 Sonic 用户指南](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html)
- [Amazon Nova 2 Sonic 技术报告和模型卡](https://www.amazon.science/publications/amazon-nova-sonic-technical-report-and-model-card)

## 关于作者

![lana zhang](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-auther-lanaz.png)

[Lana Zhang](https://www.linkedin.com/in/lanazhang/) 是 AWS 全球专业组织的生成式 AI 高级专家解决方案架构师。她专注于 AI/ML，尤其擅长 AI 语音助手和多模态理解等使用场景。她与媒体娱乐、游戏、体育、广告、金融服务和医疗等多个行业的客户密切合作，帮助他们通过 AI 转型业务解决方案。

![Osman Ipek](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/ml-20642-author-ipeko.jpg)

[Osman Ipek](https://www.linkedin.com/in/uyguripek/) 是 Amazon AGI 团队专注于 Nova 基础模型的解决方案架构师。他通过实用的 AI 实施策略引导团队加速发展，专业领域涵盖语音 AI、NLP 和 MLOps。

## 引用

- [Amazon Nova 2 Sonic 官方页面](https://aws.amazon.com/ai/generative-ai/nova/speech/)
- [Amazon Nova 2 Sonic 异步工具调用文档](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-async-tools.html)
- [Strands BidiAgent 示例代码](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech/amazon-nova-2-sonic/sample-codes/agentcore/strands)
- [原文链接](https://aws.amazon.com/blogs/machine-learning/migrating-a-text-agent-to-a-voice-assistant-with-amazon-nova-2-sonic/)
