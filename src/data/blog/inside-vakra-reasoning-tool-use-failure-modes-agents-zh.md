---
title: "深入 VAKRA：Agent 的推理、工具使用与失败模式分析"
pubDatetime: 2026-04-16T10:00:00+08:00
description: "IBM Research 在 Hugging Face 发布的 VAKRA 基准测试深度分析，揭示了当前 AI Agent 在企业级多步骤工具调用、多跳推理及政策约束任务中的关键失败模式。"
slug: inside-vakra-reasoning-tool-use-failure-modes-agents-zh
originalTitle: "Inside VAKRA: Reasoning, Tool Use, and Failure Modes of Agents"
originalUrl: https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis
---

原文标题：Inside VAKRA: Reasoning, Tool Use, and Failure Modes of Agents<br>
原文链接：https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis

![VAKRA 封面](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/oGFhvAEhWZLctvTLeUoZ6.png)

<p align="center">
  <a href="https://huggingface.co/datasets/ibm-research/VAKRA">VAKRA 数据集</a> |
  <a href="https://ibm-research-vakra.hf.space/">排行榜</a> |
  <a href="https://www.ibm.com/new/announcements/introducing-vakra-benchmark">发布博客</a> |
  <a href="https://github.com/IBM/vakra">GitHub</a> |
  <a href="https://github.com/IBM/vakra?tab=readme-ov-file#submitting-to-the-live-leaderboard">提交到排行榜</a>
</p>

我们近期推出了 **VAKRA**，这是一个基于工具执行的可执行基准测试，用于评估 AI Agent 在企业级环境中的推理与行动能力。

与测试孤立技能的传统基准不同，VAKRA 通过完整的执行轨迹来衡量 **跨 API 和文档的组合推理能力**，评估 Agent 能否可靠地完成多步骤工作流。

**VAKRA** 提供了一个可执行的环境，Agent 可以在其中与超过 **8,000 个本地托管的 API** 进行交互，这些 API 由跨越 **62 个领域** 的真实数据库支撑，同时还包含领域对齐的文档集合。任务可能需要将结构化 API 交互与非结构化检索相结合，构成 **3 到 7 步推理链**，并在自然语言工具使用约束下进行。

如下所示，模型在 VAKRA 上的表现较差——在本文中，我们将介绍 VAKRA 任务的更多[数据集细节](#task-description)，并对不同任务上观察到的[失败模式进行分析](#evaluation-framework)。

![VAKRA 排行榜](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/S4hPFdAe7AlrHHS_aAqni.png)

---

## 任务描述

如下所示，**VAKRA** 基准测试包含四个任务，每个任务测试一组不同的 *能力*。

图 1：VAKRA 基准测试中每种能力的代表性示例

![VAKRA 核心能力图](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/l05VRsxYKcKNxq_zrdnkS.png)

#### 能力一：使用商业智能 API 进行 API 链式调用

该能力包含跨 54 个领域的 2,077 个测试实例，需要使用来自 SLOT-BIRD 和 SEL-BIRD 集合的工具（Elder et al., 2026）。与 Elder et al. 的设置相比，SLOT-BIRD 和 SEL-BIRD 中的工具集通过纳入更多领域得到了扩展。每个领域限制为一个工具集合，任务涉及链式调用 1 到 12 个工具以得出最终答案。

```json
{
  "query": "Which football team has a build-up play speed of 31, build-up plan dribbling of 53, and build-up play passing of 32?",
  "tool_calls": [
    {
      "name": "get_data",
      "arguments": {"tool_universe_id": "486ea46224d1-aeb8037c5e78"},
      "label": "retrieved_data_1"
    },
    {
      "name": "select_data_equal_to",
      "arguments": {"data_label": "retrieved_data_1", "key_name": "play_speed", "value": 31},
      "label": "FILTERED_DF_0"
    },
    {
      "name": "select_data_equal_to",
      "arguments": {"data_label": "FILTERED_DF_0", "key_name": "play_dribble", "value": 53},
      "label": "FILTERED_DF_1"
    },
    {
      "name": "select_data_equal_to",
      "arguments": {"data_label": "FILTERED_DF_1", "key_name": "play_passing", "value": 32},
      "label": "FILTERED_DF_2"
    },
    {"name": "get_team_name", "arguments": {"data_label": "FILTERED_DF_2", "n": 1}}
  ],
  "answer": "FC Barcelona"
}
```

图 2：来自 SEL-BIRD 集合的数据样本

如上所示，每个实例都有一个关联的 JSON 数据源，答案必须从中推导出来。支持该任务的 MCP 服务器包含一个特殊工具，名为 `get_data(tool_universe_id=id)`，必须在每个实例的开始调用。该工具初始化数据源，返回数据的轻量级预览（见下方图 3），并将完整数据集存储在服务端以避免大量数据传输。这防止了通过 MCP 协议进行大量数据的低效传输。该调用还会根据 `tool_universe_id` 配置 MCP 服务器以暴露相应的工具集，并将数据源与该实例的领域特定数据库对齐。

SLOT-BIRD 集合提供了一组全局的 7 个工具用于通用数据操作（例如过滤、排序），其灵感来自 Tableau 和 Google Analytics 等系统。SEL-BIRD 集合通过引入更专业的工具来扩展这一点：一些工具与 SLOT-BIRD 共享，而另一些则通过将分类参数展平为单独的函数来派生（例如，带有参数 `ascending: bool = False` 的 `sort_data` 变为 `sort_data_ascending` 和 `sort_data_descending`）。此外，SLOT-BIRD 中的通用 `retrieve_data` 函数被替换为特定于查询的 getter。数据中的每个键对于给定实例都有一个关联的 `get` 函数（`get_KEY_NAME`），平均每个实例有 4 个 get 函数。

```json
{
  "handle": "retrieved_data_1",
  "num_records": 2,
  "key_details": [
    {"name": "team_name", "dtype": "str", "first_3_values": ["FC Barcelona", "Manchester City"]},
    {"name": "play_speed", "dtype": "int32", "first_3_values": [31, 40]},
    {"name": "play_dribble", "dtype": "int32", "first_3_values": [53, 30]},
    {"name": "play_passing", "dtype": "int32", "first_3_values": [32, 16]}
  ]
}
```

图 3：从 `get_data` 函数获取的数据预览

#### 能力二：使用仪表板 API 进行工具选择

该能力包含跨 17 个领域的 1,597 个实例，需要使用扩展的 REST-BIRD 集合（Elder et al.）中的工具。这些工具使用端点式接口，提供高度特定的、与查询对齐的端点，封装了大部分计算。它们作为运行在 FastAPI 服务器上的 REST API 提供，由 MCP 服务器封装。该任务需要从领域特定工具集中选择正确的 API（如图 1 中的示例所示）。每个领域包含最少 6 个到最多 328 个工具（平均 116 个工具）。与之前的任务类似，`get_data` 工具配置 MCP 服务器以仅暴露相关的领域特定 API。

OpenAI API 规范将工具列表输入限制为最多 128 个工具。这一限制要求使用该 API 的 Agent 构建者通过候选筛选机制直接管理工具列表的长度。在我们代码库中的基线 Agent 中，一个简单的候选筛选功能处理了这一挑战。

#### 能力三：使用仪表板 API 进行多跳推理

基准测试的能力三部分包含来自 38 个主题领域的 869 个测试实例。这些实例再次依赖 REST-BIRD API 集合，但在挑战中增加了多跳推理（参见图 1 中的示例）。多跳问题需要提取和组合多个支撑证据才能得出答案。本节中的实例需要 1 到 5 个逻辑跳跃来回答一个查询。测试数据集中查询的问题类型分布如下图 4 所示。

![多跳与混合跳跃类型分布](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/-KsUUjAJU-Pspy6wUHDJO.png)

图 4：能力三（MultiHop）的 API 跳跃类型分布和能力四（MultiHop MultiSource Reasoning）的混合跳跃类型分布

#### 能力四：多跳、多源推理与政策遵守

能力四包含跨 41 个领域的 644 个实例，也基于 REST-BIRD API 集合。上方图 4 显示了无政策约束的测试查询中混合跳跃的分布。它包含最复杂的查询，具有以下特征：

**多源（Multi-Source）**：该部分为每个领域增加了文档索引。该能力中的查询可能需要来自这些文档索引以及 API 调用的信息。与能力三类似，该任务也有多跳查询。所需的信息源适用于每个跳跃层面，因此，例如，一个问题可能需要三个逻辑跳跃，信息源为：API - RAG（文档检索）- API。为了强制执行正确的推理，数据生成期间对信息源进行了去污染处理，即给定跳跃所需的信息只在一个来源中可用。例如，如果某个跳跃要通过 API 回答，则通过删除可能包含回答该问题所需信息的文档来构建文档索引。

**多轮（Multi-Turn）**：该数据集部分还在设置中添加了多轮对话。每个实例是一个包含多个轮次的对话。数据以上下文-响应对的形式发布，其中上下文编码当前对话历史，Agent 只负责回答当前轮次。

**工具使用政策（Tool-usage Policies）**：这些实例的一个子集包含 Agent 需要遵守的工具使用政策。这些政策采用纯文本指令的形式，描述 Agent 被允许访问的知识源及其适用条件。例如：

```
If a user's query pertains to Technology & Software, which is/are about Topics focusing on codebases,
software platforms, applications, and user interactions in tech, make sure you try answering them by
only using document retrievers. Do not use other types of tools.
```

项目代码库中的基线 Agent 通过在提示中添加以下内容来强制执行这些政策："You are a helpful assistant with access to tools.\n Tool Usage Constraint: {additional_instructions}."。当然，Agent 构建者可以自由选择任何约束执行机制。

---

## 评估框架

VAKRA 在工具环境中评估 Agent，其中成功取决于执行连贯的多步骤工作流的能力和答案的正确性。我们引入了一个以执行为中心的评估框架，不仅评估最终输出，还评估包含工具调用、输入和中间结果的完整工具执行轨迹。

#### 评估指标

VAKRA 评估器对每个样本的两个关键输入进行操作：预测的最终响应和相应的工具调用轨迹。预测轨迹中的工具调用在与真实轨迹相同的环境中执行，以验证中间工具输出。

评估遵循瀑布式流水线（图 6），后续阶段以前期成功为条件：

- 对于能力四任务，首先以编程方式验证政策遵守情况（此步骤不适用于其他能力）。
- 然后将预测的工具调用序列与真实序列进行比较。
- 只有轨迹有效的样本才进入最终响应评估。

图 6：瀑布式评估流水线

![瀑布式评估流水线](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/LP13FH1OviGtRUGs6OSqF.png)

**工具序列比较**：由于存在可执行环境，Agent 可以探索环境，有时通过调用与我们标识的不同 API 集合来返回答案。为了支持替代但有效的工具调用和推理路径，正确性通过执行每个预测工具并将工具响应集合与真实响应进行比较来评估（而不是强制执行严格的逐步匹配）。

具体来说，我们首先进行程序化检查，验证真实工具响应中存在的所有信息是否都能被预测工具响应恢复。在涉及部分匹配、语义等价或表示差异（例如顺序、聚合或格式）的情况下，此检查可能是不确定的。在这种情况下，我们应用改编自 CRAG 框架（Yang et al., 2024）的基于 LLM 的二次评估，以确定预测轨迹是否尽管通过不同的工具调用序列也获取了所有必要信息。此步骤使用改编后的提示来确定预测轨迹是否捕获了所有必要信息，即使是通过不同的工具调用序列获得的。

**最终响应评估**：对于通过前一项检查的轨迹，使用基于 LLM 的裁判对最终响应进行评估。此步骤确保响应（i）以预测的工具输出为基础，并且（ii）与真实答案在事实上保持一致，同时考虑到措辞或结构上的潜在变化。

这种设计确保 Agent 不仅因产生正确答案而获奖励，还因通过有效且完整的推理过程获得答案而获奖励。

每种能力被等权重加权以获得最终排行榜分数。

为了获得能力分数，能力一到三中的每个样本被等权重加权。

对于能力四，异质查询被赋予更高的权重。

---

## 错误分析

我们现在对四种 VAKRA 能力进行详细的错误分析。为了便于分析，我们采用分阶段错误分类，将每个失败分配到第一个断点处。具体来说，我们依次评估：（i）是否选择了正确的工具，（ii）是否提供了所需的参数而没有遗漏或幻觉，（iii）参数值是否正确，以及（iv）最终响应是否准确且以工具输出为基础。

#### 失败阶段隔离

由于单个样本可能在不同步骤中出现多个错误，我们将每个实例按顺序分类到最早的失败阶段（例如，工具选择错误优先于参数错误）。这避免了重复计算，并允许将错误类别解释为数据集的不相交分数。虽然可以使用更细粒度的指标（例如，工具使用的精确率/召回率）（Elder et al., 2026），但我们发现这种表述提供了一个简单且可解释的 Agent 失败细分。

![错误分析图](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/cTXZ1LmNP-tkPIe5ghj_t.png)

基准测试的这一部分中的实例需要选择和排序多个工具来解决单个任务。该能力有 2,077 个样本。这对所有模型来说都具有挑战性，但 GPT-OSS-120B 在这一基准测试段表现最佳。

- GPT-OSS-120B 以大幅优势优于其他模型，主要原因是对工具模式的理解更好。
- 这一部分基准测试中的工具涉及大量参数，其中许多是可选的，GPT-OSS-120B 与其他模型相比在选择正确的参数填充方面特别健壮。
- 总体而言，在正确完成所有工具调用后合成正确答案在这一部分的挑战较小，很可能是因为工具调用排序使工具选择问题与仪表板 API 能力相比不那么容易被猜测。

图 7：SEL-BIRD 与 SLOT-BIRD 错误类型分析

![SEL-BIRD vs SLOT-BIRD 错误分析](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/Ckd7lRTEYbTM9gVXUvwDI.png)

商业智能（BI）API 能力包含两组 API，来自 SLOT-BIRD 和 SEL-BIRD 工具集合。SEL 部分有 600 个样本，而 SLOT 部分有 1,477 个样本。这两个集合归在 BI API 能力下，但具有略微不同的特征。SLOT-BIRD 集合的工具数量较少，但需要填充大量参数值，而 SEL-BIRD 集合工具集更大，每个工具的参数更少。这种侧重点反映在模型使用这两个工具集合时产生的相对错误中。

- 使用 SLOT-BIRD 时，除 GPT-OSS-120b 外的所有模型在生成正确的工具参数名称方面都犯了大量错误。这在很大程度上是 GPT-OSS-120b 在这一基准测试段总体表现如此出色的原因。
- 参数较少时，相同的模型在使用 SEL-BIRD 工具集合时几乎没有此类错误，但它们在选择正确工具方面犯了更多错误，这反映了从更大（且动态）工具集中选择的难度增加。

![仪表板 API 错误类型分析](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/joxNk95eg1BtTQ7SRDbgI.png)

- 如上所示，对于工具选择能力中的 1,597 个样本，Gemini-3-flash-preview 在所有测试模型中在所有错误类别上均优于其他模型。
- 不出所料，由于仪表板 API 实例要求模型从大量工具选项中选择，但每个工具只需要少量参数，因此工具选择和参数值选择方面的错误数量较多。
- 在幻觉或跳过所需参数方面似乎几乎没有问题。然而，即使正确完成了所有工具调用，模型（尤其是 Gemini-3-flash-preview 和 Claude-Sonnet-4-5）仍然难以从工具响应中合成正确答案，这从图中右侧的大幅下降可以看出。

#### 多跳推理：跳跃深度对模型性能的影响

图 8：不同跳跃深度下各模型的准确率比较

![多跳推理准确率](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/JGR1iJ0DgZulV_gQ4Wx-Z.png)

多跳推理通过要求模型成功回答多个隐式耦合问题来增加原始任务的难度，每个问题都需要选择并调用正确的 API。不出所料，所有模型在只有单个逻辑跳跃的问题上表现最好，在 2 跳和再次在 3+ 跳问题上看到性能下降。

#### 多跳多源推理：混合跳跃对模型性能的影响

图 9：不同交互类型（API、文档检索器、混合）下各模型的准确率

![多源推理准确率](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/d8Cqz2tApdRe6ePcaZbYf.png)

数据集的最后一段除了其他段的工具/API 来源外，还包含文档来源。这导致需要单次或多次 API 调用、单次或多次文档搜索或 API 调用和文档搜索组合的实例。

- 与之前一样，在需要单次 API 调用（1 跳 API）的实例与需要多次 API 调用（2 跳 API）的实例之间存在明显的性能差异，包含文档检索器使任务更具挑战性（RAG 跳跃和混合）。
- 有趣的是，我们发现对于需要单次文档检索器调用（1 跳 RAG）的问题，GPT-OSS-120B 尝试直接从参数知识中返回答案，但当问题看起来需要多跳时，它会回答问题。我们推测，由于 1 跳 RAG 的问题非常以维基百科实体为中心，模型跳过了工具调用（我们在 1 跳 API 上没有看到这个问题，因为特定于后端数据库的实体/事实可能更频繁地出现在问题中）。
- 同样有趣的是，与其他混合跳跃模式相比，Gemini-3-flash-preview 在 2 跳 API-RAG 上的性能急剧提升。这可能是因为 Gemini-3-flash-preview 在仪表板 API（工具选择能力）上表现相对较强，因此，一旦使用工具调用识别出正确的中间答案，检索查询很可能更加成功。

#### 政策对模型性能的影响

图 10：不同政策类型下各模型的准确率

![政策效果图](https://cdn-uploads.huggingface.co/production/uploads/677629b4931b3b2eb8d5820a/P5L7b-vzkQKYqO63EHccb.png)

政策在多跳、多源推理的基础上引入了额外的难度层。当政策与回答所需的来源一致时，即它们不影响模型回答问题所需的工具列表，我们称之为"不更新答案"——如图 10 所示，除 Granite-4.0-h-Small-32B 外的所有模型在限制访问最相关信息源的政策约束下（即"政策更新答案"）都经历了明显的性能下降。

总体而言，我们发现模型要么违反约束，要么无法检索足够的信息——它们有时理解政策但无法正确回答问题，或者表现出之前分析的失败模式之一。

总的来说，受工具使用政策约束的设置表明，虽然模型可以对工具和来源进行推理，但它们难以将外部约束融入推理中——这往往是可靠的真实世界部署的关键要求。

---

## 结论

VAKRA 揭示了表面级工具能力与强大的端到端 Agent 可靠性之间的关键差距。尽管现代模型越来越能够选择 API 和执行孤立的工具调用，但 VAKRA 表明，这些能力本身不足以支撑真实世界部署。在实践中，模型在被要求在执行约束下进行组合推理时往往会崩溃——这种约束跨越 API、文档、对话上下文和政策要求。

---

## 挑战你的 Agent——试试 VAKRA

认为你的 Agent 很稳健？来接受测试吧。

在 VAKRA 上运行它，看看它在哪里崩溃——工具选择、多跳推理还是政策约束。

- 提交到排行榜：https://github.com/IBM/vakra?tab=readme-ov-file#submitting-to-the-live-leaderboard
- 探索数据集：https://huggingface.co/datasets/ibm-research/VAKRA
- 查看代码：https://github.com/IBM/vakra

试试它，告诉我们你的 Agent 学到了什么。

---

## 引用

- 原文：[Inside VAKRA: Reasoning, Tool Use, and Failure Modes of Agents](https://huggingface.co/blog/ibm-research/vakra-benchmark-analysis) — IBM Research on Hugging Face
- [VAKRA 数据集](https://huggingface.co/datasets/ibm-research/VAKRA)
- [VAKRA 排行榜](https://ibm-research-vakra.hf.space/)
- [VAKRA GitHub 代码库](https://github.com/IBM/vakra)
