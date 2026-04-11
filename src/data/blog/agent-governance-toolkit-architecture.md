---
title: Agent 治理工具包：架构深度探讨、策略引擎、信任和 AI Agent 的 SRE
pubDatetime: 2026-04-11T00:00:00+08:00
description: Microsoft 开源 Agent 治理工具包，为自主 AI Agent 引入运行时安全治理，应对 OWASP Agent AI 十大风险。
slug: agent-governance-toolkit-architecture
originalTitle: "Agent Governance Toolkit: Architecture Deep Dive, Policy Engines, Trust, and SRE for AI Agents"
originalUrl: "https://techcommunity.microsoft.com/blog/linuxandopensourceblog/agent-governance-toolkit-architecture-deep-dive-policy-engines-trust-and-sre-for/4510105"
---

原文标题：Agent Governance Toolkit: Architecture Deep Dive, Policy Engines, Trust, and SRE for AI Agents<br>
原文链接：https://techcommunity.microsoft.com/blog/linuxandopensourceblog/agent-governance-toolkit-architecture-deep-dive-policy-engines-trust-and-sre-for/4510105

上周，我们在 Microsoft 开源博客上宣布了 Agent 治理工具包，这是一个开源项目，为自主 AI Agent 带来运行时安全治理。在那个公告中，我们涉及了原因：AI Agent 正在生产中做出自主决策，几十年来保持系统安全的安全模式需要应用于这个新类别的工作负载。

在这篇文章中，我们将深入探讨如何做到这一点：架构、实现细节以及在生产中运行受治理的 Agent 需要什么。

## 问题：生产基础设施遇见自主 Agent

如果你管理生产基础设施，你已经知道了这个剧本：最小权限、强制访问控制、进程隔离、审计日志和级联故障断路器。这些模式几十年来一直保持生产系统的安全。

现在想象一个新类别的工作负载到达你的基础设施，AI Agent 自主执行代码、调用 API、读取数据库和生成子进程。它们推理该做什么，选择工具，并在循环中行动。在许多当前的部署中，他们在没有您对任何其他生产工作负载要求的安全控制的情况下执行所有这些操作。

正是这个差距促使我们构建了 Agent 治理工具包：一个开源项目，将操作系统、服务网格和 SRE 中的经过验证的安全概念应用于新兴的自主 AI Agent 世界。

用熟悉的术语来说，大多数 AI Agent 框架今天就像以 root 身份运行每个进程一样：没有访问控制、没有隔离、没有审计跟踪。Agent 治理工具包是 AI Agent 的内核、服务网格和 SRE 平台。

当 Agent 调用一个工具，比如 `DELETE FROM users WHERE created_at < NOW()` 时，通常没有策略层检查该操作是否在范围内。一个 Agent 与另一个通信时没有身份验证。没有资源限制防止 Agent 在一分钟内进行 10,000 次 API 调用。没有断路器来包含当事情出错时的级联失败。

## OWASP Agent 安全倡议

2025 年 12 月，OWASP 发布了 Agent AI 十大：第一个针对自主 AI Agent 特定风险的正式分类。该列表读起来像一个安全工程师的噩梦：目标劫持、工具滥用、身份滥用、记忆中毒、级联失败、恶意 Agent 等。

如果你曾经加固过一个生产服务器，这些风险会显得既熟悉又紧迫。Agent 治理工具包旨在通过确定性策略执行、密码身份、执行隔离和可靠性工程模式来帮助解决所有 10 这些风险。

注意：OWASP Agent 安全倡议已后来采用了 ASI 2026 分类（ASI01–ASI10）。工具包的 copilot-governance 包现在使用这些标识符，并向后兼容原始 AT 编号。

## 架构：九个包，一个治理堆栈

该工具包的结构是 v3.0.0 公开预览版 monorepo，具有九个独立可安装的包：

**Agent OS（策略引擎）**
无状态策略引擎，在执行前拦截 Agent 操作，具有可配置的模式匹配和语义意图分类

**Agent Mesh（身份和信任）**
密码身份（DID with Ed25519）、Inter-Agent Trust Protocol (IATP) 和 Agent 之间的信任网关通信

**Agent Hypervisor（执行隔离）**
受 CPU 特权级别启发的执行环，用于多步骤事务的 saga 编排和共享会话管理

**Agent Runtime（运行时监督）**
运行时监督、杀死开关、动态资源分配和执行生命周期管理

**Agent SRE（可靠性）**
SLO、错误预算、断路器、混沌工程和渐进式交付，为 AI Agent 调整的生产可靠性实践

**Agent Compliance（合规性）**
自动化治理验证，合规评级和监管框架映射（EU AI Act、NIST AI RMF、HIPAA、SOC 2）

**Agent Lightning（RL 治理）**
强化学习训练治理，带有策略执行的运行器和奖励塑形

**Agent Marketplace（插件生命周期）**
插件生命周期管理，采用 Ed25519 签名、信任分层能力门控和 SBOM 生成

**Integrations（集成）**
为 LangChain、CrewAI、AutoGen、Semantic Kernel、Google ADK、Microsoft Agent Framework、OpenAI Agents SDK 等 20+ 框架适配器

## Agent OS：策略引擎

Agent OS 在执行前拦截 Agent 工具调用：

```python
from agent_os import StatelessKernel, ExecutionContext, Policy

kernel = StatelessKernel()
ctx = ExecutionContext(
    agent_id="analyst-1",
    policies=[
        Policy.read_only(),                    # 无写操作
        Policy.rate_limit(100, "1m"),          # 最多 100 调用/分钟
        Policy.require_approval(
            actions=["delete_*", "write_production_*"],
            min_approvals=2,
            approval_timeout_minutes=30,
        ),
    ],
)

result = await kernel.execute(
    action="delete_user_record",
    params={"user_id": 12345},
    context=ctx,
)
```

策略引擎分两层工作：可配置的模式匹配（带有 SQL 注入、权限提升和提示注入的样本规则集，用户为其环境定制）和语义意图分类器，帮助检测危险目标，无论其措辞如何。当一个操作被分类为 `DESTRUCTIVE_DATA`、`DATA_EXFILTRATION` 或 `PRIVILEGE_ESCALATION` 时，引擎根据配置的策略来阻止它、将其路由以获得人工批准或降级 Agent 的信任级别。

重要提示：所有策略规则、检测模式和敏感度阈值都外化为 YAML 配置文件。工具包附带 `examples/policies/` 中的示例配置，必须在生产部署前进行审查和定制。没有内置规则集应被认为是详尽的。支持的策略语言：YAML、OPA Rego 和 Cedar。

内核在设计上是无状态的，每个请求都带有其自己的上下文。这意味着你可以将其部署在负载均衡器后面、作为 Kubernetes 中的 sidecar 容器或在无服务器函数中，无需管理任何共享状态。在 AKS 或任何 Kubernetes 集群上，它自然适应现有的部署模式。可用于 agent-os、agent-mesh 和 agent-sre 的 Helm 图表。

## Agent Mesh：Agent 的零信任身份

在服务网格架构中，服务在通信前通过 mTLS 证书证明其身份。AgentMesh 使用分散标识符（DID）和 Ed25519 密码学以及 Inter-Agent Trust Protocol (IATP) 向 AI Agent 应用相同的原则：

```python
from agentmesh import AgentIdentity, TrustBridge

identity = AgentIdentity.create(
    name="data-analyst",
    sponsor="alice@company.com",          # 人类责任
    capabilities=["read:data", "write:reports"],
)
# identity.did -> "did:mesh:data-analyst:a7f3b2..."

bridge = TrustBridge()
verification = await bridge.verify_peer(
    peer_id="did:mesh:other-agent",
    required_trust_score=700,  # 必须得分 >= 700/1000
)
```

一个关键功能是信任衰减：Agent 的信任评分随时间推移而减少，没有正向信号。一个上周被信任但从那以后沉默的 Agent 逐渐变成不受信任，模拟了信任需要持续证明而不是一次性授予的现实。

委托链执行范围缩小：具有读写权限的父 Agent 只能委托读取访问给子 Agent，永远不能升级。

## Agent Hypervisor：执行环

CPU 架构使用权限环（Ring 0 用于内核，Ring 3 用于用户空间）来隔离工作负载。Agent Hypervisor 将这个模型应用于 AI Agent：

| 信任级别 | 能力 | 限制 |
|---------|------|------|
| Ring 0 (内核) | 评分 ≥ 900 | 完全系统访问，可以修改策略 |
| Ring 1 (监督者) | 评分 ≥ 700 | 跨 Agent 协调，提升的工具访问 |
| Ring 2 (用户) | 评分 ≥ 400 | 标准工具访问，限制范围内 |
| Ring 3 (不受信任) | 评分 < 400 | 只读，沙盒执行 |

新的和不受信任的 Agent 从 Ring 3 开始，并通过赚取自己的方式往上，这正是生产工程师对所有其他工作负载应用的最小权限原则。

每个环强制实施 Agent 资源限制：最大执行时间、内存上限、CPU 节流和请求速率限制。如果一个 Ring 2 Agent 试图进行 Ring 1 操作，它会被阻止，就像用户空间进程试图访问内核内存一样。

这些环定义及其相关的信任评分阈值完全可以通过策略配置。组织可以定义自定义环结构、调整环的数量、为转换设置不同的信任评分阈值，以及配置 Agent 资源限制以匹配其安全需求。

超级监督器还为多步骤操作提供 saga 编排。当一个 Agent 执行一个序列、起草电子邮件 → 发送 → 更新 CRM，并且最后一步失败，补偿操作以反向的方式触发。从分布式事务模式中借用，这确保多 Agent 工作流即使在单个步骤失败时也能保持一致性。

## Agent SRE：Agent 的 SLO 和断路器

如果你实践 SRE，你通过 SLO 测量服务并通过错误预算管理风险。Agent SRE 将此扩展到 AI Agent：

当一个 Agent 的安全 SLI 下降到 99% 以下，意味着超过 1% 的其操作违反策略，系统会自动限制 Agent 的能力，直到其恢复。这是与 SRE 团队用于生产服务相同的错误预算模型，应用于 Agent 行为。

我们还构建了九个混沌工程故障注入模板：网络延迟、LLM 提供商故障、工具超时、信任评分操纵、内存损坏和并发访问竞争。因为确保你的 Agent 系统有弹性的唯一方法是有意破坏它。

Agent SRE 通过 Datadog、PagerDuty、Prometheus、OpenTelemetry、Langfuse、LangSmith、Arize、MLflow 等的适配器与你现有的可观测性堆栈集成。消息代理适配器支持 Kafka、Redis、NATS、Azure Service Bus、AWS SQS 和 RabbitMQ。

## 合规性和可观测性

如果你的组织已经映射到 CIS 基准、NIST AI RMF 或其他基础设施合规框架，OWASP Agent AI 十大是 AI Agent 工作负载的等效标准。工具包的 agent-compliance 包提供针对这些框架的自动化治理评级。

该工具包是与框架无关的，具有 20+ 适配器，可以挂接到每个框架的本地扩展点，因此向现有 Agent 添加治理通常只需几行配置，而不是完全重写。

该工具包将指标导出到任何与 OpenTelemetry 兼容的平台、Prometheus、Grafana、Datadog、Arize 或 Langfuse。如果你已经为基础设施运行了可观测性堆栈，Agent 治理指标会通过相同的管道流动。

关键指标包括：每秒策略决定、信任评分分布、环转换、SLO 燃烧率、断路器状态和治理工作流延迟。

## 入门

```bash
# 安装所有包
pip install agent-governance-toolkit[full]

# 或单独包
pip install agent-os-kernel agent-mesh agent-sre
```

该工具包可跨语言生态系统使用：Python、TypeScript（npm 上的 `@microsoft/agentmesh-sdk`）、Rust、Go 和 .NET（NuGet 上的 `Microsoft.AgentGovernance`）。

## Azure 集成

虽然该工具包是平台无关的，但我们已纳入集成，有助于在 Azure 上启用最快的生产路径：

**Azure Kubernetes Service (AKS)**：将策略引擎部署为与你的 Agent 旁边的 sidecar 容器。Helm 图表为 agent-os、agent-mesh 和 agent-sre 提供生产就绪的清单。

**Azure AI Foundry Agent Service**：为通过 Azure AI Foundry 部署的 Agent 使用内置中间件集成。

**OpenClaw Sidecar**：一个引人注目的部署场景是在一个容器内运行 OpenClaw（开源自主 Agent），并将 Agent 治理工具包部署为 sidecar。这给你对 OpenClaw 自主操作的策略执行、身份验证和 SLO 监视。在 Azure Kubernetes Service (AKS) 上，部署是一个标准 pod，具有两个容器：OpenClaw 作为主工作负载，治理工具包作为 sidecar，通过 localhost 通信。我们在存储库中有参考架构和 Helm 图表。

相同的 sidecar 模式适用于任何容器化的 Agent，OpenClaw 是一个特别引人注目的示例，因为对自主 Agent 安全的兴趣。

## 教程和资源

34+ 分步教程涵盖策略引擎、信任、合规性、MCP 安全、可观测性和跨平台 SDK 使用，可在存储库中找到。

```bash
git clone https://github.com/microsoft/agent-governance-toolkit
cd agent-governance-toolkit
pip install -e "packages/agent-os[dev]" -e "packages/agent-mesh[dev]" -e "packages/agent-sre[dev]"

# 运行演示
python -m agent_os.demo
```

## 接下来是什么

AI Agent 正在成为生产基础设施中的自主决策制定者，执行代码、管理数据库和协调服务。保持生产系统安全几十年的安全模式——最小权限、强制访问控制、进程隔离、审计日志——正是这些新工作负载需要的。我们已经构建了它们。它们是开源的。

我们在开放中构建这个，因为 Agent 安全太重要了，任何单个组织都无法单独解决：

**安全研究**：对抗性测试、红队结果和漏洞报告为每个人加强了该工具包。

**社区贡献**：来自社区的框架适配器、检测规则和合规性映射扩展了跨生态系统的覆盖范围。

我们致力于开放治理。我们今天在 Microsoft 下发布此项目，我们希望将其移入基础组织，如 AI 和数据基础 (AAIF)，其中它可以受益于跨行业的管理。我们正在与基础合作伙伴积极合作以实现这一目标。

Agent 治理工具包是 MIT 许可证下的开源。欢迎在 github.com/microsoft/agent-governance-toolkit 贡献。
