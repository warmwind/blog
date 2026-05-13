---
title: 使用 Strands 和 Exa 构建支持网络搜索的 Agent
pubDatetime: 2026-05-13T11:00:00+08:00
description: 介绍如何将 Exa 集成到 Strands Agents SDK 中，通过语义搜索和结构化内容提取为 AI Agent 提供实时、准确的网络信息，并展示一个完整的深度研究助手示例。
slug: strands-exa-web-search-agents-zh
originalTitle: "Building web search-enabled agents with Strands and Exa"
originalUrl: https://aws.amazon.com/blogs/machine-learning/building-web-search-enabled-agents-with-strands-and-exa/
tags:
  - AWS
  - Strands
  - Agent
  - 翻译
---

原文标题：Building web search-enabled agents with Strands and Exa<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/building-web-search-enabled-agents-with-strands-and-exa/

*本文由 Exa 的 Ishan Goswami 和 Nitya Sridhar 共同撰写。*

如果你正在构建用于研究、事实核查或竞争情报的网络搜索 AI Agent，获取及时可靠的信息至关重要。大多数通用搜索 API 并非为 Agent 工作流设计。它们返回充斥 HTML 标签的页面和为人类浏览优化的简短摘录，而非 Agent 可直接使用的结构化数据。因此，开发者往往需要构建额外的层——自定义爬虫、解析器和排序逻辑——将这些内容转化为 Agent 工作流中可用的形式。

[Strands Agents SDK](https://strandsagents.com/) 的 Exa 集成通过直接内置到工具接口中的 AI 原生搜索与检索层解决了这一问题。Exa 提供干净、结构化的内容，格式直接适用于 LLM 上下文窗口，无需后处理来剥离标记或重新格式化输出。结合 Strands Agents SDK 模型驱动架构（模型自主决定何时调用工具以及如何使用工具输出），Agent 可以将实时网络知识纳入其推理循环。

实际上，你的 Agent 通过两个工具访问这一集成：`exa_search`，支持按类别（如新闻、研究论文和代码库）进行语义搜索；以及 `exa_get_contents`，可从选定的 URL 获取完整内容。在本文中，你将学习如何在 Strands Agents 中配置 Exa 集成，了解它暴露的两个核心工具，并通过真实用例了解 Agent 如何利用网络搜索完成多步骤任务。

## Strands Agents

Strands Agents SDK 是 AWS 开源的、采用模型驱动方式构建 AI Agent 的框架。开发者不需要编写规定每一步骤的硬编码工作流，而只需提供一个模型、一个系统提示词和一个工具列表。模型自己决定下一步该做什么：调用哪些工具、以什么顺序调用，以及何时任务完成。Strands Agents 的核心是 Agent 循环。在每次迭代中，模型接收完整的对话历史，包括所有先前的工具调用及其结果。如果模型需要更多信息，它会请求一个工具；Strands Agents 执行该工具并将结果反馈回来。循环持续进行，直到模型给出最终答案。跨迭代积累上下文，正是使 Agent 能够处理超出单次 LLM 调用能力的多步骤任务的关键。Strands Agents SDK 内置了 40 多个预置工具，涵盖文件 I/O、Shell 执行、网络搜索、AWS API、内存、代码执行等。它还支持模型上下文协议（MCP），因此 MCP 服务器暴露的工具无需额外集成工作即可供 Agent 使用。添加新工具（包括 Exa 网络搜索工具）遵循相同的模式：将其放入 `tools=[]` 列表，模型即可从工具签名中学会如何使用它们。

## Exa

Exa 是专为 LLM 和 AI Agent 构建的网络规模搜索引擎。Exa 理解查询的含义，而不仅仅是关键词。像"构建气候解决方案的初创公司"这样的查询会返回真实的气候初创公司，即使那些页面从未使用过这个确切的短语。模型基于语义相似性进行匹配，而非字符串重叠。结果以干净、结构化的内容返回，无广告或 SEO 噪音，随时可供 LLM 直接使用。

## Strands Agents 与 Exa：集成概述

Exa 集成通过 `strands-agents-tools` 包提供。它赋予你的 Agent 两种能力：搜索网络获取相关内容，以及从特定 URL 提取完整页面文本。下图展示了深度研究助手示例的可视化流程，我们将在本文后半部分深入介绍。

![Strands Agents 深度研究工作流图示](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/04/ml-19612-image-1-752x1024.png)

两个工具都针对 AI 使用进行了优化，返回结构化内容，Agent 可直接基于这些内容进行推理。

- `exa_search`：使用多种模式（包括 auto、fast 和 deep）搜索网络。你的 Agent 可以通过类别、域名、日期和文本内容等过滤器来精炼结果。
- `exa_get_contents`：从 Agent 发现的 URL（无论是来自先前的搜索还是其自身推理）获取完整页面内容。该工具首先检查缓存结果以加速重复请求。如果需要新鲜内容，它可以自动回退到实时爬取，以获取页面最新版本。

### 使用 `exa_search` 搜索网络

`exa_search` 工具赋予你的 Agent 超越基本查询字符串的网络搜索控制能力。该工具支持四种搜索模式。默认模式 `auto` 是大多数用例的推荐起点。

- **即时（~200ms）** — 专为实时应用设计，如自动补全、实时建议和语音 Agent。
- **快速（~450ms）** — 在速度上进行优化的同时仍访问 Exa 的优质索引。适用于 Agent 进行数十次搜索调用的 Agentic 工作流。
- **自动（~1s）【推荐】** — 在延迟和高质量结果之间取得平衡。推荐用于大多数用例。
- **深度（~3-6s）** — 跨查询变体并行搜索以实现最大覆盖率。最适用于完整性比速度更重要的研究任务。

除搜索模式外，`exa_search` 还赋予你的 Agent 对结果过滤和范围的精细控制。你可以将搜索范围缩小到特定内容类别，如新闻文章、公司网站、GitHub 仓库、PDF、人物档案或财务报告。当你的 Agent 已知道需要哪种类型的来源时，类别过滤效果最佳。例如，在查询具有技术性时过滤到研究论文，或在时效性优先时过滤到新闻来源。你还可以在单次调用中请求内联搜索结果和摘要：

```python
agent.tool.exa_search( query="recent advances in AI safety research", num_results=10, summary={"query": "key research areas and findings"}) .
```

响应包含标题、URL，以及聚焦于你指定查询的每个结果的综合摘要。你的 Agent 无需完整阅读每个页面即可建立对主题的基础性理解。

### 使用 `exa_get_contents` 提取内容

一旦你的 Agent 找到了相关 URL（无论来自先前的搜索还是其自身推理），`exa_get_contents` 工具就会获取完整的页面内容。你传入一个 URL 列表，它返回提取的文本，随时可供 Agent 处理。Exa 维护一个内容缓存，对已爬取的页面立即提供结果。对于不在缓存中的页面，或者当你的 Agent 需要页面最新版本时，该工具支持实时爬取。你可以通过实时爬取模式控制此行为。可配置的超时参数控制等待实时爬取完成的时长。你还可以控制返回的文本量。例如，从页面获取最多 5000 个字符的纯文本：

```python
agent.tool.exa_get_contents(urls=["https://example.com/blog-post"], highlight={"maxCharacters": 5000})
```

### 前提条件

要跟随本文中的示例操作，你需要：

- Python 3.10 或更高版本
- 具有 Amazon Bedrock 访问权限的 AWS 账户
- 一个 [Exa API 密钥](https://dashboard.exa.ai/api-keys)
- 已安装 `strands-agents` 和 `strands-agents-tools` 包：
  - `pip install strands-agents strands-agents-tools`

## 配置

Exa 工具遵循 Strands Agents 框架中所有其他工具相同的模式，因此如果你使用过其他 Strands 工具，体验完全相同。Strands Agents SDK 内置了一个涵盖文件操作、网络搜索、代码执行、AWS 服务、内存管理等功能的预置工具库。Exa 工具属于该库的一部分。导入它们并通过 `tools` 参数传递给 Agent 构造函数。然后，Agent 底层的 LLM 会在其推理循环中自主决定何时调用每个工具。由于集成直接与 Exa REST API 通信，你不需要安装或管理独立的 SDK。唯一新增的依赖项是 `strands-agents-tools` 包。要将 Exa 与 Strands Agents 集成，请按以下步骤操作：

#### 1. 设置 Exa API 密钥

Exa 需要 API 密钥进行身份验证。在运行 Agent 之前，请使用你的密钥设置 `EXA_API_KEY` 环境变量。你可以从 [Exa 仪表板](https://dashboard.exa.ai/api-keys)获取密钥：

`export EXA_API_KEY="your_exa_api_key_here"`

#### 2. 导入并注册工具

在你的 Agent 代码中，从 `strands_tools.exa` 导入 `exa_search` 和 `exa_get_contents`，并将它们加入 Agent 的工具列表：

```python
from strands import Agent
from strands_tools.exa import exa_search, exa_get_contents
agent = Agent(tools=[exa_search, exa_get_contents])
```

#### 3. 调用 Agent

工具注册完成后，你的 Agent 即可在其推理流程中自然地交错进行搜索和内容提取：

```python
response = agent( "Search for the most recent trends in AI agents and provide a concise summary of key developments")
```

Agent 配置完成后，你可以开始将 Exa 工具用于不同的搜索场景。

## 示例：使用 Exa 构建深度研究 Agent

为了了解两个工具如何协同工作，以下示例构建了一个[深度研究助手](https://github.com/strands-agents/samples/tree/main/python/03-integrate/tools/exa)，在多步骤工作流中演示两个 Exa 工具的配合使用。给定一个研究问题，Agent 会跨不同来源类型进行四次有针对性的搜索，从最有价值的结果中提取完整内容，并将所有内容综合成一份结构化的研究简报。整个工作流在单次 Agent 调用中执行完成，多次工具调用作为推理循环的一部分依次发生。关键设计思路在于，不同的来源类型需要不同的搜索参数，但不需要不同的工具。两个 Exa 工具在整个工作流中被反复使用，每步使用不同的参数配置：`category` 用于定向新闻、PDF 或代码库；日期过滤器用于控制时效性；JSON Schema 用于结构化提取；实时爬取用于保证内容新鲜度。

## 快速开始

1. 在 [Exa 仪表板](https://dashboard.exa.ai/api-keys)注册 Exa API 密钥
2. 克隆[示例仓库](https://github.com/strands-agents/samples/tree/main/python/03-integrate/tools/exa)并运行深度研究助手
3. 修改系统提示词以定向你的领域：替换类别过滤器、日期范围和 JSON Schema 以匹配你的用例

### 配置 Agent

配置需要一个模型、一个系统提示词和两个 Exa 工具：

```python
from strands import Agent
from strands.models.bedrock import BedrockModel
from strands_tools.exa import exa_search, exa_get_contents

def create_research_agent() -> Agent:
    model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-6",
        region_name="us-west-2",
        max_tokens=20000,
    )
    return Agent(
        model=model,
        system_prompt=load_system_prompt(),
        tools=[exa_search, exa_get_contents],
    )
```

系统提示词定义了研究工作流，引导 Agent 完成六个步骤：四次跨不同来源类型的有针对性搜索、一次深度内容提取，以及最终的综合过程。Agent 自主决定何时以及如何调用每个工具、如何解读结果，以及何时推进到下一步，这一切都是其推理循环的一部分。每个步骤都指示 Agent 使用为该类内容调优的不同参数调用 Exa 工具。

**第 1 步：概述搜索** — 使用 `auto` 模式进行广泛扫描以建立基础性理解。系统提示词指示 Agent 使用这些参数调用 `exa_search`：

```
- type: "auto"
- num_results: 5
- text: {"maxCharacters": 2000}
- highlights: {"maxCharacters": 4000}
- summary: {"query": "What are the key concepts, main points, and important details?"}
- subpages: 2
- subpage_target: ["overview", "about", "introduction"]
- max_age_hours: 168
```

**第 2 步：新闻搜索** — 聚焦于 30 天日期窗口内的新闻来源。日期边界在 Python 中计算并注入到提示词中。`max_age_hours` 设置缓存内容的最大可接受时效（小时数）。

```
- category: "news"
- num_results: 5
- start_published_date: <运行时注入：今天减去30天>
- text: {"maxCharacters": 1500}
- summary: {"query": "What are the key announcements, developments, and news?"}
- max_age_hours: 24
```

**第 3 步：研究论文** — 为了学术深度，搜索定向 `research paper` 类别，并通过引导性 `query` 提取关键发现、方法论和结论作为简洁摘录。

```
- category: "research paper"
- num_results: 5
- text: {"maxCharacters": 2000}
- summary: {
    "query": "Extract the research findings, methodology, and conclusions",
    "schema": {
      "type": "object",
      "properties": {
        "title": {"type": "string", "description": "Paper title"},
        "main_findings": {"type": "string", "description": "Key findings and results"},
        "methodology": {"type": "string", "description": "Research methodology used"},
        "conclusions": {"type": "string", "description": "Main conclusions"}
      },
      "required": ["main_findings", "conclusions"]
    }
  }
```

**第 4 步：GitHub 项目** — 通过 `github` 类别发现开源实现。

```
- category: "github"
- num_results: 5
- highlights: {"maxCharacters": 4000}
```

**第 5 步：深度挖掘** — Agent 从发现转向提取。使用 `exa_get_contents` 获取先前步骤中最有价值的 2-3 个 URL 的完整内容。这一步使用强制实时爬取（`"always"` 而非 `"fallback"`）以获取新鲜内容，更高的字符限制（4000）用于全面提取，子页面爬取用于跟进参考文献、引用和方法论页面的链接。

```
- urls: <前几步搜索中最有价值的 2-3 个 URL>
- text: {"maxCharacters": 4000}
- highlights: {"maxCharacters": 4000}
- summary: {"query": "Extract all important details, insights, and actionable information"}
- subpages: 3
- subpage_target: ["references", "citations", "bibliography", "methodology"]
- max_age_hours: 0
```

**第 6 步：综合** — 这最后一步不调用任何工具。从前面步骤收集的所有内容汇聚成一份结构化研究简报，包含以下各节：执行摘要、主题概述、最新进展、关键研究与论文、工具与实现、深度洞见，以及包含 URL 的完整来源列表。

多步骤工作流相比单次搜索调用或基础搜索 API 封装具有几大优势：

- **有据可查的答案** — 最终简报中的每个论断都可追溯到来源 URL，减少幻觉。
- **高效的 token 使用** — 在搜索和提取阶段的摘要使内容保持简洁，LLM 处理的是提炼后的知识，而非原始页面内容。
- **自主深度** — Agent 无需人工引导，即可跨越多种来源类型（新闻、论文、代码仓库、完整页面）进行迭代，覆盖单次搜索无法触及的范围。

## 使用 Amazon Bedrock AgentCore Observability 进行追踪

一个包含多次工具调用的 6 步流程，如果没有结构化追踪就很难调试。[Amazon Bedrock AgentCore Observability](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html) 基于 OpenTelemetry 构建，只需少量代码改动即可为完整的 Agent 运行提供埋点追踪。每次工具调用和 LLM 调用都成为一个具有父子关系的 Span。在 CloudWatch GenAI 可观测性仪表板中，每次研究运行都显示为完整追踪。你可以查看 Agent 各个 Span 的平均 Span 延迟。

![Agent 指标——错误与延迟仪表板](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/04/ml-19612-image-2.png)

你可以深入查看单个 Span，检查：

- 每次 `exa_search` 或 `exa_get_contents` 调用的**工具调用参数**，验证 Agent 在每个步骤中使用了正确的类别、日期范围和内容限制

![追踪详情——工具调用 JSON 负载](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/04/ml-19612-image-3.png)

- **每步延迟**，识别新闻搜索还是深度提取是瓶颈所在
- **每次 LLM 调用的 Token 消耗**，展示各搜索步骤与综合步骤之间的 Token 分配情况

![追踪详情——系统提示词与 Agent 初始化](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/04/ml-19612-image-4.png)

Agentic 工作流是非确定性的。相同的查询可能产生不同的搜索结果、深度挖掘时选择不同的 URL，以及产生不同的综合输出。追踪数据将调试从猜测变为检查。最终响应和研究简报的示例如下截图所示：

![追踪详情——最终综合输出](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/04/ml-19612-image-5.png)

## 使用 Exa 工具的最佳实践

在将 Exa 工具集成到 Agent 中时，一些最佳实践可以帮助你在质量、延迟和成本之间取得最佳平衡。以下建议将帮助你充分发挥 Exa 工具在 Agent 工作流中的价值。更多关于搜索类型、内容模式和高级过滤的信息，请参阅 [Exa 最佳实践文档](https://exa.ai/docs/reference/search-best-practices)。

- **从 `auto` 开始，然后按需调整**：`auto` 搜索类型能很好地处理大多数查询。当错过相关来源代价较大的研究任务时切换到 `deep`；当 Agent 进行大量连续搜索且累积延迟比单次查询完整性更重要时，切换到 `fast` 或 `instant`。
- **控制内容大小以管理 Token 预算**：在 `highlights` 字段上设置 `maxCharacters`（默认 maxCharacters 为 4,000）。

## 清理资源

本操作指南不会创建任何持久的 AWS 资源。如果你不再需要 Exa API 密钥，请从 [Exa 仪表板](https://dashboard.exa.ai/api-keys)撤销它。

## 结论

[Strands Agents SDK](https://strandsagents.com) 和 [Exa](https://exa.ai/docs) 提供了一条构建基于当前、准确网络信息的 AI Agent 的路径。Exa 的搜索提供语义理解，类别过滤将结果缩小到正确的内容类型，带有 JSON Schema 的 AI 摘要返回 Agent 所需的精确结构，实时爬取提供内容新鲜度。Strands Agents 集成通过[两个工具和几行配置代码](https://github.com/strands-agents/tools/blob/main/src/strands_tools/exa.py)暴露了这些能力。

正如深度研究助手所展示的，你可以构建一个多步骤研究 Agent，跨越新闻、学术论文和代码仓库进行搜索，从最佳结果中提取完整页面内容，并将所有内容综合成一份有据可查的简报——全部由单个系统提示词驱动。Agent 使用[类别过滤器](https://exa.ai/docs/reference/search-best-practices)定向来源类型，通过日期范围控制时效性，通过 JSON Schema 规整输出，通过实时爬取管理内容新鲜度。你可以在将其接入 Agent 之前，直接在 [Exa 仪表板](https://dashboard.exa.ai)测试搜索、内容和答案端点。整个工作流通过 [Amazon Bedrock AgentCore Observability](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html) 实现完全可追踪，将非确定性的 Agent 行为转化为可检查、可调试的 Span。这一模式不仅适用于研究，还适用于竞争情报、技术支持、市场分析以及其他 Agent 需要实时网络信息的领域。试试[深度研究助手示例](https://github.com/strands-agents/samples/tree/main/python/03-integrate/tools/exa)，用你自己的研究问题进行测试。[获取 Exa API 密钥](https://dashboard.exa.ai/api-keys)开始构建，探索 [Amazon Bedrock 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)深入了解底层平台，并在 [Strands Agents GitHub 仓库](https://github.com/strands-agents/sdk-python)分享你的反馈。

## 关于作者

**Madhu Samhitha Vangara** 是 AWS 全球 GenAI 专家解决方案架构师，专注于 Amazon Bedrock AgentCore 和 Strands Agents 的 Agentic AI GTM。她深刻理解企业商业价值，此前曾在 Juniper Networks、VMware、Barclays 和 IGCAR 有丰富的行业经验。她在 AWS re:Invent、NVIDIA GTC、AI Summit 等 AI 会议上发表演讲，专注于多 Agent 系统、Agent 可观测性、LLM、合作伙伴生态系统和生产级 Agentic AI。她拥有 UMass Amherst 计算机科学硕士学位。工作之余，她是一名受过专业训练的印度古典舞蹈演员和艺术爱好者。

**Manoj Selvakumar** 是 AWS 专注于 Agentic AI 系统的 GenAI 专家解决方案架构师。他帮助初创企业和大型企业使用 Strands Agents SDK 和 Amazon Bedrock AgentCore 架构生产 AI Agent，在多 Agent 编排、上下文工程和推理优化方面具有专业知识。他与客户的合作涵盖长时间运行任务模式、内存管理以及分布式部署的生产扩展。他通过开源示例、合作伙伴集成和社区赋能推动 Strands Agents 的技术采用和生态系统增长。

**Asheesh Goja** 是 Lambda 超级智能客户的 CTO。此前，他曾担任 AWS 首席 Gen AI 解决方案架构师。更早之前，他在 Cisco 和 UPS 工作，领导推动新兴技术采用的相关举措。他的专业知识涵盖构思、联合设计、孵化和创投产品开发。他持有包括实时 C++ DSL、IoT 设备以及计算机视觉和 Edge AI 原型在内的广泛硬件和软件专利组合。作为生成式 AI 和 Edge AI 的积极贡献者，他通过技术博客和在行业会议及论坛的演讲分享见解。

**Mani Khanuja** 是 AWS 的技术 AI 领导者和首席生成式 AI 解决方案架构师，拥有 20 余年从零构建 AI 平台和推动企业 AI 战略的经验。她直接与客户合作，从架构到规模化生产部署构建生成式 AI 战略。她目前的重点是安全高效地扩展自主 AI Agent：开发具有个性化功能的有状态、记忆驱动的 Agent，推进 AI 治理框架，并将前沿研究转化为真实的企业系统。她是《Applied Machine Learning and High-Performance Computing on AWS》的作者，也是 Re:Invent、Grace Hopper Celebration、AI Engineer Summit 和全球 AWS Summits 的知名技术演讲者。她居住在加利福尼亚州海豹滩，在海岸线进行长跑保持活跃状态。

**Ishan Goswami** 是 Exa 的创始开发者关系工程师，领导开发者关系工作。他构建和发布集成、开源演示应用、MCP 服务器和插件，使 Exa 易于在任何 AI 应用或工作流中使用。在加入 Exa 之前，Ishan 联合创办了一家文本转视频初创公司。他构建的应用被数百万人使用，开源项目获得了数千 GitHub Star。

**Nitya Sridhar** 是 Exa 的市场营销主管，负责领导产品发布、技术博客、增长活动等工作。她与工程和 GTM 团队密切合作，向全球开发者和企业推广 Exa，专注于清晰的技术叙事，将新产品功能转化为社区可以使用的故事。

## 引用

- 原文：[Building web search-enabled agents with Strands and Exa](https://aws.amazon.com/blogs/machine-learning/building-web-search-enabled-agents-with-strands-and-exa/)
- [Strands Agents SDK](https://strandsagents.com/)
- [Exa 文档](https://exa.ai/docs)
- [Amazon Bedrock AgentCore Observability](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html)
- [深度研究助手示例](https://github.com/strands-agents/samples/tree/main/python/03-integrate/tools/exa)
