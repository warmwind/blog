---
title: "现代化 Facebook 群组搜索，释放社区知识的力量"
pubDatetime: 2026-04-24T11:00:00+08:00
description: "Facebook 工程团队介绍如何通过混合检索架构与自动化模型评估，从根本上改造 Facebook 群组搜索，帮助用户更可靠地发现和验证社区内容。"
slug: modernizing-facebook-groups-search-community-knowledge-zh
originalTitle: "Modernizing the Facebook Groups Search to Unlock the Power of Community Knowledge"
originalUrl: https://engineering.fb.com/2026/04/21/ml-applications/modernizing-the-facebook-groups-search-to-unlock-the-power-of-community-knowledge/
---

原文标题：Modernizing the Facebook Groups Search to Unlock the Power of Community Knowledge<br>
原文链接：https://engineering.fb.com/2026/04/21/ml-applications/modernizing-the-facebook-groups-search-to-unlock-the-power-of-community-knowledge/

![现代化 Facebook 群组搜索](https://engineering.fb.com/wp-content/uploads/2026/04/Modernizing-FB-Groups-search-Hero-2.png)

**作者：** Shubhojeet Sarkar、Shengbo Guo、Guohao Zhang、Woon Jo、Laura Vig

---

我们从根本上改造了 Facebook 群组搜索，帮助用户更可靠地发现、筛选和验证最与自己相关的社区内容。

我们采用了全新的混合检索架构，并实施了自动化的基于模型的评估，以解决用户在搜索社区内容时遇到的主要痛点。

在这一全新框架下，我们在搜索参与度和相关性方面取得了切实的提升，且错误率没有增加。

世界各地的人们每天都依赖 Facebook 群组来发现有价值的信息。由于信息量巨大，用户旅程并非总是顺畅。在帮助人们围绕共同兴趣建立连接的同时，同样重要的是要为他们工程设计一条通往海量对话的路径，尽可能精确地呈现用户正在寻找的内容。我们发表了一篇论文，讨论了[我们如何通过重新架构 Facebook 群组范围搜索](https://arxiv.org/pdf/2509.13603)来解决这一问题。通过超越传统关键词匹配，采用**混合检索架构**并实施**自动化的基于模型的评估**，我们从根本上革新了人们发现、消费和验证社区内容的方式。

## 解决社区知识中的摩擦痛点

人们在搜索社区内容寻找答案时，面临三个摩擦痛点：发现、消费和验证。

### 发现：语言的鸿沟

历史上，发现依赖于基于关键词（词汇）的系统。这些系统寻找完全匹配的词语，在用户的自然语言意图与可用内容之间制造了鸿沟。例如，设想一个用户搜索"带糖霜的小个蛋糕"。如果社区使用"纸杯蛋糕"这个词，传统关键词系统可能返回零结果。由于特定措辞不匹配，用户就错失了高度相关的建议。

我们需要一个能够让搜索"意大利咖啡饮品"与"卡布奇诺"相关帖子有效匹配的系统，即使"咖啡"这个词从未在帖子中明确出现。

### 消费：努力的代价

即使人们找到了正确的内容，他们也面临"努力代价"。往往需要翻阅和筛选大量评论才能找到共识。想象一下，某人搜索"照顾虎尾兰的技巧"。为了得到清晰的答案，他们必须阅读数十条评论才能拼凑出浇水时间表。

### 验证：借助社区知识做决策

人们经常需要利用可信的社区专业知识来验证一个决定或评估一次潜在购买。例如，设想一位在 Facebook Marketplace 上浏览高价值商品（如经典款科尔维特）列表的买家。他们想在购买前获取真实的意见和建议，但这些智慧通常散落在各个群组讨论中。这位用户需要解锁专业群组的集体智慧来有效评估该商品，但手动挖掘这些验证信号并不容易。

![Facebook 群组搜索示例](https://engineering.fb.com/wp-content/uploads/2026/04/Modernizing-FB-Groups-search-image-1.png)

*用户搜索"照顾虎尾兰的技巧"，需要可信的教程建议。由现代化混合检索架构驱动的群组模块在 Facebook 搜索中突出显示关键技巧和社区最爱内容。*

## 解决方案：现代化的混合检索架构

我们设计了一种**混合检索架构**，为 Facebook 搜索上的讨论模块提供支持。该系统运行并行流水线，将倒排索引的精确性与稠密向量表示的概念理解相融合。我们通过重构基础设施的三个重要组件来解决传统搜索的局限性。

以下工作流程说明了我们如何对技术栈进行现代化改造以处理自然语言意图：

### 并行检索策略

我们通过将查询处理解耦为两条并行路径来现代化检索阶段，确保同时捕获精确词项和广义概念：

**查询预处理：** 在检索之前，用户查询会经过分词、规范化和改写处理。这对于确保倒排索引和嵌入模型都能接收到干净的输入至关重要。

**词汇路径（Unicorn）：** 我们利用 [Facebook 的 Unicorn 倒排索引](https://engineering.fb.com/2013/03/14/core-infra/under-the-hood-indexing-and-ranking-in-graph-search/)来获取包含完全匹配或近似匹配词项的帖子。这确保了涉及专有名词或特定引语查询的高精度。

与此同时，查询也被传入我们的搜索语义检索器（SSR）。这是一个**拥有 1.2 亿参数的 12 层模型**，将用户的自然语言输入编码为稠密向量表示。然后，我们在群组帖子的预计算 [Faiss](https://engineering.fb.com/2017/03/29/data-infrastructure/faiss-a-library-for-efficient-similarity-search/) 向量索引上执行近似最近邻（ANN）搜索。这使得系统能够基于高维概念相似性检索内容，而无需关键词重叠。

### 基于多任务多标签（MTML）架构的 L2 排序

将来自两种根本不同范式——稀疏词汇特征和稠密语义特征——的结果合并，需要复杂的排序策略。从关键词系统和嵌入系统检索到的候选项在排序阶段合并。在这里，模型同时摄入词汇特征（如 TF-IDF 和 BM25 分数）以及语义特征（余弦相似度分数）。

接下来，我们从单目标模型转向了 **MTML 超级模型**架构。这允许系统联合优化多个参与目标——具体是**点击、分享和评论**——同时保持即插即用的模块化。通过对这些信号进行加权，模型确保我们呈现的结果不仅在理论上相关，而且可能产生有意义的社区互动。

### 自动化离线评估

部署语义搜索引入了一个验证挑战：高维向量空间中的相似度分数并不总是直观的。为了在不受人工标注瓶颈限制的情况下大规模验证质量，我们将自动化评估框架集成到了构建验证测试（BVT）流程中。

我们使用具有多模态能力的 Llama 3 作为自动化评判者，对搜索结果相对于查询进行评分。与"好/坏"二元标签不同，我们的评估提示被设计为能够检测细微差别。我们明确在系统中引入了"较为相关"类别，定义为查询和结果共享共同领域或主题的情况（例如，不同运动项目在通用体育环境中仍然相关）。这使我们能够衡量结果多样性和概念匹配方面的改进。

![现代化混合检索架构](https://engineering.fb.com/wp-content/uploads/2026/04/Modernizing-FB-Groups-search-image-2.png)

*现代化的混合检索架构。*

## 影响与未来工作

这一混合架构的部署在我们的质量指标上带来了可衡量的改善，验证了将词汇精确性与神经理解相融合优于纯关键词方法。根据我们的离线评估结果，新的 **L2 模型 + EBR（混合）**系统在**搜索参与度**方面超越了基线——体现在与基线相比，每日在 Facebook 上执行搜索的用户数量的增加。

这些数据证实，通过整合语义检索，我们成功地呈现了更相关的内容，同时没有牺牲用户期望的精确性。虽然现代化检索技术栈是一个重要里程碑，但这仅是释放社区知识的开始。我们的路线图聚焦于将先进模型深度整合到搜索体验中：

**排序中的 LLM：** 我们计划在排序阶段直接应用大语言模型。通过在排序过程中处理帖子内容，我们旨在进一步完善超越向量相似性的相关性评分。

**自适应检索：** 我们正在探索 LLM 驱动的自适应检索策略，能够根据用户查询的复杂程度动态调整检索参数。

**阅读论文**

[Modernizing Facebook Scoped Search: Keyword and Embedding Hybrid Retrieval with LLM Evaluation](https://arxiv.org/pdf/2509.13603)

---

## 引用

- 原文：[Modernizing the Facebook Groups Search to Unlock the Power of Community Knowledge](https://engineering.fb.com/2026/04/21/ml-applications/modernizing-the-facebook-groups-search-to-unlock-the-power-of-community-knowledge/)
- 论文：[Modernizing Facebook Scoped Search: Keyword and Embedding Hybrid Retrieval with LLM Evaluation](https://arxiv.org/pdf/2509.13603)
