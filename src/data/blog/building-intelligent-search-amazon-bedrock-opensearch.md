---
title: 使用 Amazon Bedrock 和 Amazon OpenSearch 构建智能搜索以实现混合 RAG 解决方案
pubDatetime: 2026-04-07T00:00:00+08:00
description: 使用 Amazon Bedrock 和 Amazon OpenSearch 构建混合 RAG 解决方案的完整技术指南
slug: building-intelligent-search-amazon-bedrock-opensearch
originalTitle: "Building Intelligent Search with Amazon Bedrock and Amazon OpenSearch for hybrid RAG solutions"
originalUrl: https://aws.amazon.com/blogs/machine-learning/building-intelligent-search-with-amazon-bedrock-and-amazon-opensearch-for-hybrid-rag-solutions/
---

原文标题：Building Intelligent Search with Amazon Bedrock and Amazon OpenSearch for hybrid RAG solutions<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/building-intelligent-search-with-amazon-bedrock-and-amazon-opensearch-for-hybrid-rag-solutions/

# 使用 Amazon Bedrock 和 Amazon OpenSearch 构建智能搜索以实现混合 RAG 解决方案

代理生成式 AI 助手代表了人工智能的重大进步，由大型语言模型 (LLM) 驱动的动态系统，可以进行开放式对话并处理复杂任务。与基础聊天机器人不同，这些实现具有广泛的智能，能够维持多步骤对话，同时适应用户需求并执行必要的后端任务。

这些系统通过 API 调用和数据库查询实时检索特定业务数据，将这些信息合并到 LLM 生成的响应中，或使用预定义标准将其与响应一起提供。LLM 功能与动态数据检索的这种组合称为检索增强生成 (RAG)。

例如，处理酒店预订的代理助手会首先查询数据库，找到与客人特定需求相匹配的房产。助手随后会进行 API 调用以检索有关房间可用性和当前价格的实时信息。检索到的数据可以通过两种方式处理：LLM 可以处理它以生成全面的响应，或者可以将其与 LLM 生成的摘要一起显示。两种方法都可以让客人获得精确、当前的信息，这些信息被整合到他们与助手的持续对话中。

在这篇文章中，我们展示如何实现一个生成式 AI 代理助手，该助手使用语义和基于文本的搜索，利用 Amazon Bedrock、Amazon Bedrock AgentCore、Strands Agents 和 Amazon OpenSearch。

### RAG 系统中的信息检索方法

一般来说，在代理生成式 AI 实现中支持 RAG 功能的信息检索主要涉及对后端数据源的实时查询或与 API 的通信。随后，这些响应会被纳入实现所执行的后续步骤中。从高级系统设计和实现的角度来看，这一步不是特定于生成式 AI 解决方案的：数据库、API 和依赖于与其集成的系统已经存在了很长时间。某些信息检索方法随着代理 AI 实现而出现，最值得注意的是基于语义搜索的数据查询。它们根据搜索短语的含义而不是关键字或模式的词汇相似度来检索数据。向量嵌入被预先计算并存储在向量数据库中，在查询时能够实现高效的相似性计算。向量相似性搜索 (VSS) 的核心原理涉及使用数学距离度量（如余弦相似度或欧几里得距离）在这些数值表示之间找到最接近的匹配。这些数学函数在搜索大规模数据时特别有效，因为向量表示是预先计算的。双编码器模型通常在这个过程中使用。它们分别将查询和文档编码为向量，能够在规模上进行高效的相似性比较，而无需模型一起处理查询-文档对。当用户提交查询时，系统将其转换为向量，并在高维空间中搜索位置最接近的内容向量。这意味着即使精确关键字不匹配，搜索也可以根据概念语义相似性找到相关结果。此外，在搜索术语在词汇上但在语义上与数据集中的条目不接近的情况下，语义相似性搜索将"偏好"语义上相似的条目。

例如，给定向量化数据集：["building materials"、"plumbing supplies"、"2×2 multiplication result"]，搜索字符串 "2×4 lumber board" 最有可能产生 "building materials" 作为顶部匹配候选。将语义搜索与 LLM 驱动的代理相结合，支持解决方案的面向用户和后端数据检索组件之间的自然语言对齐。LLM 处理用户提供的自然语言输入，而语义搜索功能允许根据 LLM 根据最终用户-代理通信节奏制定的自然语言输入进行数据检索。

### 挑战：仅靠语义搜索是不够的

考虑一个真实场景：客户正在搜索酒店房产，并想要找到"迈阿密佛罗里达州一家拥有海景的豪华酒店"。语义搜索擅长理解"豪华"和"海景"等概念，但在精确位置匹配方面可能会遇到困难。搜索可能会根据语义相似性返回高度相关的豪华海滨房产，但这些房产可能位于加州、加勒比地区或任何其他有海滨的地方，而不是特定地在迈阿密。这种限制之所以产生，是因为语义搜索优先考虑概念相似性而不是精确属性匹配。在用户需要语义理解（豪华、海景）和精确过滤（迈阿密、佛罗里达州）的情况下，仅依靠语义搜索会产生次优结果。这就是混合搜索变得至关重要的地方。它将自然语言描述的语义理解与位置、日期或特定元数据等结构化属性上的基于文本的过滤的精确性相结合。为了解决这个问题，我们引入了一种混合搜索方法，执行以下两个操作：

- 语义搜索以理解自然语言描述并找到语义上相似的内容
- 基于文本的搜索以促进对结构化属性（如位置、日期或标识符）的精确匹配

当用户提供搜索短语时，LLM 首先分析查询以识别特定属性（如位置）并将其映射到可搜索的值（例如，"Northern Michigan" → "MI"）。这些提取的属性随后与语义相似性评分一起用作过滤器，确保结果在概念上相关并精确匹配用户的要求。下表提供了语义搜索流的简化视图，并提供了清晰的文本酒店描述以供参考：

向量存储数据：

hotel-1
描述：Artisan Loft 酒店位于 Big City 繁华的西南环路的 Green 街和 Randolph 街的拐角处，占据一座经过精心翻新的 1920 年代砖砌仓库，彰显邻里工业遗产。客人发现自己距离著名的 Restaurant Row 仅几步之遥，享誉盛名的餐饮场所和时尚精品店遍布周边街区。

描述向量：[…]

位置：Big City, USA

hotel-2
描述：坐落在 Big Sur 险峻悬崖之上，俯瞰戏剧性海岸线，Cypress Haven 从地景中涌现，仿佛从地球本身雕刻而出。这个私密的 42 间客房避难所与其周围环境无缝融合，拥有生活屋顶花园、落地窗和当地石材及回收红木等天然材料。每个宽敞的套房都配有一个私人露台，悬挂在太平洋上方，客人可以在日式雪松浴缸中浸泡时观赏迁徙的鲸鱼。

描述向量：[…]

位置：Beach City, USA

hotel-3
描述：坐落在伯克郡外几个世纪老的枫树林中，Woodland Haven Lodge 提供一个亲密的逃离处，奢华与正念简单性相遇。这座改建的 19 世纪庄园拥有 28 个精心安排的客房，分布在主楼和四个独立小屋中，每个都配有环绕式门廊和落地窗，框住周围的林地。

描述向量：[…]

位置：Quiet City, USA

hotel-4
描述：Central City 繁华市中心的 Skyline Oasis 酒店坐落其中，是奢华和现代性的灯塔。这个 45 层玻璃钢塔提供城市标志性天际线和附近 Central River 的惊人全景。Skyline Oasis 拥有 500 间装修考究的客房和套房，迎合商务旅客和寻求高端城市体验的游客。酒店拥有屋顶无边泳池、米其林星级餐厅和最先进的健身中心。其黄金位置使客人可步行距离到达 Central City 的主要景点，包括现代艺术博物馆、Central City 歌剧院和充满活力的河滨区。

描述向量：[…]

位置：Central City, USA

搜索短语
寻找靠近海洋的酒店

搜索结果
hotel-2

搜索示例：

- 搜索短语："寻找靠近海洋的酒店"
- 语义搜索结果：hotel-2（Cypress Haven）

混合搜索示例：

- 搜索短语："寻找在市中心 Central City 有不错餐厅的酒店"
- 混合搜索结果：hotel-4（考虑语义相关性和精确位置的最佳匹配）

有关混合搜索实现的更多详细信息，请参阅 Amazon Bedrock Knowledge Bases 混合搜索博客文章。

### 引入基于代理的解决方案

考虑一个酒店搜索场景，其中用户有不同的需求。一个用户可能会问"找我一个舒适的酒店"，需要对"舒适"的语义理解。另一个可能要求"在迈阿密找酒店"，需要精确的位置过滤。第三个可能想要"迈阿密的豪华海滨酒店"，同时需要两种方法。使用固定工作流的传统 RAG 实现无法动态适应这些不同的要求。我们的场景需要定制搜索逻辑，可以组合多个数据源并根据查询特征动态调整检索策略。基于代理的方法提供了这种灵活性。LLM 本身通过分析每个查询并选择适当的工具来确定最优搜索策略。

### 为什么选择代理？

基于代理的系统提供卓越的适应性，因为 LLM 确定解决问题所需的操作序列，实现动态决策路由、智能工具选择和通过自我评估进行的质量控制。以下部分展示了如何实现一个生成式 AI 代理助手，使用 Amazon Bedrock、Amazon Bedrock AgentCore、Strands Agents 和 Amazon OpenSearch 进行语义和基于文本的搜索。

### 架构概述

图 1 展示了可用于智能搜索助手的现代无服务器架构。它结合了 Amazon Bedrock 中的基础模型、Amazon Bedrock AgentCore（用于代理编排）和 Amazon OpenSearch Serverless（用于混合搜索功能）。

客户端交互层：客户端应用程序通过 Amazon API Gateway 与系统交互，为用户请求提供安全、可扩展的入口点。当用户问"为我找一个 Northern Michigan 的海滨酒店"时，请求通过 API Gateway 流向 Amazon Bedrock AgentCore。

使用 Amazon Bedrock AgentCore 的代理编排：Amazon Bedrock AgentCore 充当编排引擎，管理完整的代理生命周期并协调用户、LLM 和可用工具之间的交互。AgentCore 实现了代理循环——推理、操作和观察的连续循环——其中代理：

1. 使用 Bedrock 的基础模型分析用户的查询
2. 根据查询要求决定调用哪些工具
3. 使用提取的参数执行适当的混合搜索工具
4. 评估结果并确定是否需要额外操作
5. 用综合信息响应用户

在整个过程中，Amazon Bedrock Guardrails 强制执行内容安全和政策遵从，维持适当的响应。

使用 OpenSearch Serverless 的混合搜索：该架构将 Amazon OpenSearch Serverless 集成为向量存储和搜索引擎。OpenSearch 存储向量化嵌入（用于语义理解）和结构化文本字段（用于精确过滤）。这种方法支持我们的混合搜索方法。当代理调用混合搜索工具时，OpenSearch 执行结合以下内容的查询：

- 使用向量相似度的语义匹配以实现概念理解
- 基于文本的过滤以实现精确约束，如位置或便利设施

监控和安全：该架构包括 Amazon CloudWatch 用于监控系统性能和使用模式。AWS IAM 在组件间管理访问控制和安全策略。

为什么选择这个架构？此无服务器设计提供了几个关键优势：

- 低延迟响应以实现实时对话交互
- 自动扩展以处理不同的工作负载，无需手动干预
- 成本效益通过按使用量付费，没有空闲基础设施
- 生产就绪具有内置监控、日志记录和安全功能

AgentCore 编排功能与 OpenSearch 混合搜索功能的结合允许我们的助手根据用户意图动态调整其搜索策略，这是刚性 RAG 管道无法实现的。

### 使用 Strands 和 Amazon Bedrock AgentCore 的实现

为了构建混合搜索代理，我们使用 Strands，一个开源 AI 代理框架，简化了使用工具调用功能开发 LLM 驱动应用的过程。Strands 允许我们将混合搜索功能定义为代理可以根据用户查询智能调用的"工具"。有关 Strands 架构和模式的详细信息，请参阅 Strands 文档。

以下是我们如何定义混合搜索工具的方式：

```python
from strands import tool

@tool
def hybrid_search(query_text: str, country: str = None, city: str = None):
    """
    Performs hybrid search combining semantic understanding with location filtering.
    The agent calls this when users provide both descriptive preferences and location.
    
    Args:
        query_text: Natural language description of what to search for
        country: Optional country filter
        city: Optional city filter
    """
    # Generate embeddings for semantic search
    vector = generate_embeddings(query_text)
    
    # Build hybrid query combining vector similarity and text filters
    query = {
        "bool": {
            "must": [
                {"knn": {"embedding_field": {"vector": vector, "k": 10}}}
            ],
            "filter": []
        }
    }
    
    # Add location filters if provided
    if country:
        query["bool"]["filter"].append({"term": {"country": country}})
    if city:
        query["bool"]["filter"].append({"term": {"city": city}})
    
    # Execute search in OpenSearch
    response = opensearch_client.search(index="hotels", body=query)
    
    return format_results(response)
```

一旦定义了工具，我们就将它们与 Amazon Bedrock AgentCore 集成以进行部署和运行时编排。Amazon Bedrock AgentCore 使您能够使用任何框架和模型在规模上安全地部署和运行高度有效的代理。它提供专用基础设施来安全扩展代理和控制以操作可信代理。

有关将 Strands 与 Amazon Bedrock AgentCore 集成的详细信息，请参阅 AgentCore-Strands 集成教程。

### 混合搜索实现深度探讨

我们 AI 助手解决方案的关键区分因素是其先进的混合搜索功能。虽然许多 RAG 实现仅依赖语义搜索，但我们的架构超越了这一点。我们利用了 OpenSearch 的全部潜力，实现了语义、基于文本和混合搜索，全部在一个高效的查询中。以下部分探讨了此实现的技术详细信息。

两步实现：我们的混合搜索实现建立在两个基本组件之上：优化的数据存储和多功能查询处理。

#### 1. 优化的数据存储

数据存储方法对于高效的混合搜索至关重要。

- 数据分类：我们系统地将数据分为两种主要类型：语义搜索候选：这包括详细描述、上下文和解释 – 从超越关键字的含义理解中受益的内容。文本搜索候选：这包括元数据、产品标识符、日期和其他结构化字段。
- 向量嵌入：对于我们的语义数据，我们使用 AWS Bedrock 的嵌入模型。这些将文本转换为高维向量，有效捕获语义含义。
- 文本数据优化：文本数据以原始格式存储，优化用于快速传统查询。
- 统一索引结构：我们的 OpenSearch 索引设计用于同时容纳向量嵌入和文本字段，实现灵活的查询功能。

#### 2. 多功能搜索功能

基于优化的数据存储，我们开发了代理可以有效利用的全面搜索功能：

- 自适应搜索类型：我们的搜索功能设计用于根据代理的需要执行语义、文本或混合搜索。
- 语义搜索实现：对于以含义为重点的查询，我们使用 Amazon Bedrock 生成查询嵌入并在向量空间中执行 k-NN（k-最近邻）搜索。
- 文本搜索功能：当需要精确匹配时，我们使用 OpenSearch 的强大文本查询功能，包括精确和模糊匹配选项。
- 混合搜索执行：这是我们在统一查询中结合向量相似度与文本匹配的地方。使用 OpenSearch 的布尔查询，我们可以根据需要调整语义和文本相关性之间的平衡。
- 结果集成：无论搜索类型如何，我们的系统巩固和排序结果基于整体相关性，结合语义理解与精确文本匹配。

混合搜索实现的参考伪代码：

```python
def hybrid_search(query_text, country, city, search_type="hybrid"):
    """
    Hybrid search combining semantic and text-based search with location filtering
    """

   # 1. Generate embeddings for semantic search
    if search_type in ["semantic", "hybrid"]:
        vector = generate_embeddings(query_text)
    
    # 2. Build search query based on type
    if search_type == "semantic":
        query = build_semantic_query(vector)
    elif search_type == "text":
        query = build_text_query(country, city)
    else:  # hybrid search
        query = build_hybrid_query(vector, country, city)
    
    # 3. Execute search
    response = search_opensearch(query)
    
    # 4. Process and return results
    return format_results(response)

# Example usage:
results = hybrid_search(
    query_text="luxury hotel",
    country="USA",
    city="Miami"
)
```

OpenSearch 支持多种查询类型，包括基于文本的搜索、向量搜索（knn）和结合两种方法的混合方法。有关可用查询类型及其实现的详细信息，请参阅 OpenSearch 查询文档。

### 混合方法的意义

混合方法显著增强了我们 AI 助手的功能：

- 它支持高度准确的信息检索，考虑上下文和内容。
- 它适应各种查询类型，保持一致的性能。
- 它为用户问询提供更相关和全面的响应。

在 AI 驱动搜索的领域中，我们的混合方法代表了显著的进步。它提供了灵活性和准确性的水平，大大提升了我们助手有效检索和处理信息的能力。

### 现实生活用例

混合搜索可以适用的一些用例包括：

- 房地产和房产：房产搜索结合生活方式偏好理解（"家庭友好"）与精确位置和便利设施过滤。
- 法律和专业服务：案例法律研究结合概念法律相似性与精确司法管辖区和日期过滤以进行全面法律研究。
- 医疗保健和医疗：护理团队询问"需要与 John Doe 相似治疗协议的患有慢性病的患者"——结合治疗复杂性的语义理解与精确医疗记录匹配。
- 媒体和娱乐：内容发现系统结合精确类型过滤与语义情节理解
- 电子商务和零售：自然语言产品发现具有过滤精度 – "舒适冬靴"找到语义匹配同时应用精确尺寸或价格或品牌过滤。

这些用例演示了混合搜索如何桥接自然语言理解与精确数据过滤之间的差距，实现更直观和准确的信息检索。

### 结论

Amazon Bedrock、Amazon Bedrock AgentCore、Strands Agents 和 Amazon OpenSearch Serverless 的集成代表了构建智能搜索应用程序的重大进步，该应用程序结合了 LLM 的力量与复杂的信息检索技术。这个架构混合了语义、基于文本和混合搜索功能，比传统方法提供更准确和背景相关的结果。通过使用 Amazon Bedrock AgentCore 实现基于代理的系统，具有状态管理和 Strands 工具抽象，开发人员可以创建动态的对话式 AI 助手，智能地根据用户查询确定最适合的搜索策略。混合搜索方法结合向量相似度与精确文本匹配，在信息检索中提供灵活性和准确性，使 AI 系统能够更好地理解用户意图并提供更全面的响应。当组织继续构建 AI 解决方案时，此架构提供了可扩展、安全的基础，利用 AWS 服务的全部潜力，同时维持复杂现实应用所需的适应性。

## 关于作者

（作者信息在原文中）
