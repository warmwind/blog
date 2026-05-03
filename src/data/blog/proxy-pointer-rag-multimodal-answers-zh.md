---
title: Proxy-Pointer RAG：无需多模态嵌入即可实现多模态回答
pubDatetime: 2026-05-03T10:00:00+08:00
description: 本文介绍一种开源多模态 Proxy-Pointer RAG 流水线，通过将文档视为语义块的层级树，无需多模态嵌入即可实现可靠的图像返回。
slug: proxy-pointer-rag-multimodal-answers-zh
originalTitle: "Proxy-Pointer RAG: Multimodal Answers Without Multimodal Embeddings"
originalUrl: https://towardsdatascience.com/proxy-pointer-rag-multimodal-answers-without-multimodal-embeddings/
---

原文标题：Proxy-Pointer RAG: Multimodal Answers Without Multimodal Embeddings<br>
原文链接：https://towardsdatascience.com/proxy-pointer-rag-multimodal-answers-without-multimodal-embeddings/

![Generated using Gemini](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/Gemini_Generated_Image_n4hxxdn4hxxdn4hx-scaled-1.jpg)

人们常说，一图胜千言。然而，很少有企业聊天机器人能够可靠地返回与源文档相关的图片。

这是为什么呢？

原因在于，尽管这将是纯文本用户体验的重大提升，但要做到可靠且一致却相当困难。然而，这类需求的使用场景并不缺乏。从房地产项目的客户到查询最新机器参数的维修技师，用户都更希望在回答中直接看到目标相关的房产图片和维护表格，而不仅仅是获取源文档（宣传册、视频、手册）和网页的链接。

在本文中，我将介绍一种开源多模态 Proxy-Pointer RAG 流水线，该流水线之所以能实现这一目标，主要是因为它将文档视为语义块的层级树，而不是需要盲目切碎成 chunk 来回答查询的词袋。

这是我之前关于 Proxy-Pointer RAG 系列文章的续篇，此前我已详细探讨了架构原理和实现细节。在本文中，我们将探讨以下内容：

- 为什么多模态回答是一个难以解决的问题？目前有哪些可用的技术？
- Proxy-Pointer 如何以纯文本流水线——无需多模态嵌入——以完全可扩展且低成本的方式实现这一目标
- 一个可供你使用开源仓库尝试的工作原型及测试查询

让我们开始吧。

## 多模态与普通 RAG

当我们谈到多模态 RAG 时，它几乎总是意味着你可以用图片结合文本查询来搜索知识库。反过来的情况则很少。要理解其中的原因，让我们看看通常有哪些可行的实现方式：

### 图像说明生成

对图像运行 OCR/视觉模型，将图像转换为一段文字，然后与其他文本一起索引到 chunk 中。这种方式并不理想，因为滑动窗口分块可能导致图像说明被分割到多个 chunk 中。

核心问题是检索单元与语义单元之间的错位。传统 RAG 检索任意 chunk，而含义——尤其是图像——属于文档的连贯章节。

当检索到某个 chunk 时，LLM 可能只看到一段不完整的说明（例如，`(e.g., for Figure 5)`），导致很难判断这张图片是否真的与当前 chunk 相关，还是与未被检索到的相邻 chunk 相关。此外，合成器通常会收到来自不同文档、没有共同上下文的多个 chunk，其中可能包含多个不相关的图像说明。这使得 LLM 很难可靠地判断这些图像中哪些（如果有的话）与用户的查询相关。

### 多模态嵌入

另一种方法是使用多模态模型将图像和文本嵌入到共享的向量空间中。虽然这实现了跨模态检索，但也带来了不同的挑战。多模态嵌入优化的是相似性，而非基础性。视觉上或结构上相似的工件——例如不同公司的财务表格——在向量空间中可能几乎相同，即便其中只有一个与查询相关。

在没有文档结构上下文的情况下，系统根据相似性检索候选项，但无法自信地判断哪张图片实际上应该出现在回答中。结果是，LLM 不得不在多个合理但可能不正确的视觉内容之间进行选择——与其展示错误的图片，通常更安全的做法是什么都不返回。

Proxy-Pointer 通过将基于文本的分块替换为基于树的分块来解决这一问题。我们不按字符数分块，而是按章节边界（Sectional Boundaries）分块。如果一个章节包含 3 个段落和 2 张图片，则 chunk 不会越过该章节的边界延伸到下一章节。LLM 可以将每个章节视为完全独立的语义单元，并对其中的图片做出有把握的判断。

让我们看看这在实践中是如何运作的。

## 原型设置

我基于 5 篇 AI 研究论文（均采用 CC-BY 许可）构建了一个多模态聊天机器人，分别是 CLIP、Nemobot、GaLore、VectorFusion 和 VectorPainter。PDF 提取使用了 Adobe PDF Extract API。这些论文包含密集的文本，以及 Adobe 可提取的共 270 张图片（图形、表格、公式）。使用的嵌入模型是 `gemini-embedding-001`（维度从默认的 3072 降至 1536，使搜索更快并减少内存使用）。这是一个纯文本嵌入模型，不使用任何多模态嵌入模型。所有 LLM 用途（噪声过滤器、重排序器、合成器和最终视觉过滤器）均使用 `gemini-3.1-flash-lite-preview`。使用的向量索引为 `FAISS`。

## 多模态 Proxy-Pointer 架构

在我之前的深度分析中，我分享了 Proxy-Pointer RAG 通过索引"战略指针"（类似于 `Financials > Item 1A > Risk Factors` 这样的面包屑路径），而非原始 chunk，在金融 10-K 文档上能够实现 100% 准确率的证据。

对于多模态输出，我们在以下前提下修改流水线步骤——图像（图形、表格、公式、视频片段等）可以被提取为工件文件（.jpg、.png、.svg、.mp4 等），并与文档内容一起存储。如果源文档是网页或 XML，这非常简单。对于 PDF，虽然不完美，但像这里使用的 Adobe PDF Extract API 这样的提取器可以将表格和图形提取为工件。

在提取出的文档（本例中为 markdown）中，每个图形都以相对路径 `eg; !\[](figures/fileoutpart11.png)` 的形式嵌入在文本中，指向实际的文件名。以下是一个示例：

```
Furthermore, inspired by the Tangram puzzle which forms different objects using a set of basic elements, as illustrated in Fig. 2(b), we reform the synthesis task as a rearrangement of a set of strokes extracted from the reference image.

![](figures/fileoutpart1.png)

"The Starry Night"

![](figures/fileoutpart2.png)

"Self-Portrait"

![](figures/fileoutpart3.png)
```

这引出了 Proxy-Pointer 使用的以下关键洞察。在实践中，LLM 不需要实际看到图像就能判断相关性。它只需要知道某个特定文档章节中存在图像。由于 Proxy-Pointer 检索的是完整章节——而非碎片化的 chunk——LLM 可以依靠章节的完整上下文来判断相关性。这将图像选择转变为基于章节含义和用户查询的条件决策，而非基于多模态相似性匹配的开放式搜索问题。

这正是人类阅读的方式。我们不会跳去查看提到的每一张表格和图形——我们首先利用章节上下文和我们的查询来决定哪些值得看。

以下是索引流水线：

**骨架树（Skeleton Tree）**：和之前一样，我们用纯 Python 将 Markdown 标题解析成层级树。只不过现在，每个节点中嵌套了一个 figures 数组，记录该节点（章节）中找到的每个图形及其路径。该路径用于检索图像文件以供展示。其余字段如下所示，含义一目了然：

```
    {
      "title": "1 Introduction",
      "node_id": "0003",
      "line_num": 17,
      "figures": [
        {
          "fig_id": "fig_1",
          "filename": "figures/fileoutpart0.png"
        },
        {
          "fig_id": "fig_2",
          "filename": "tables/fileoutpart1.png"
        }
      ]
    },
```

接下来的 4 个步骤与之前基本相同：

**面包屑注入（Breadcrumb Injection）**：在嵌入之前，将完整的结构路径（`Galore > 3. Methodology > 3.1. Zero Convolution`）添加到每个 chunk 的前面。

**结构引导分块（Structure-Guided Chunking）**：在章节边界内切分文本，绝不跨章节。

**噪声过滤（Noise Filtering）**：使用 LLM 从索引中删除干扰章节（目录、词汇表、执行摘要、参考文献）。

**基于指针的上下文（Pointer-Based Context）**：使用检索到的 chunk 作为指针，加载完整的、未被打断的文档章节（现在文本中包含图像路径）供合成器使用。

多模态检索的更新检索流水线如下：

**第一阶段（广泛召回）**：FAISS 根据嵌入相似性返回前 200 个 chunk。这些 chunk 通过 `(doc_id, node_id)` 去重，确保查看的是唯一的文档章节，最终得到前 50 个候选节点的候选列表。此步骤与之前相同。

**第二阶段（锚点感知结构重排序）**：重排序器现在接收每个 50 个候选项的完整面包屑路径（与之前一样）+ 语义片段（150 个字符）。引入这一改进是因为，与金融 10-K 或技术手册不同，学术论文通常使用通用、非描述性的标题（如"3. Experiments"、"4. Optimization"或"5. Comparison"）。这需要 LLM 有一个微小的"语义提示"，以准确定位哪些模糊章节实际上包含用户询问的精度和相似度分数。

**第三阶段（合成与上下文感知图像选择）**：合成器 LLM 审阅最终的 `k=5` 个章节并形成文本回答。此外，它还对其中找到的图像做出视觉判断，决定哪些应该展示。它扫描章节中的图像路径，并选择最多 6 张看起来与查询最相关的图片。此外，合成器还为图片形成准确的展示标签，即使该表格或图形没有作者提供的显式说明。

上述流水线在我创建的 20 个问题基准测试中，经 Claude 评判，图像检索的准确率达到了 95%。我在下一节分享了部分结果，完整结果可在仓库中查看。此外，如果你希望进一步优化结果，下一步是可选的视觉过滤器。

**第四阶段（视觉过滤器——可选）**：为了进一步筛选所选图像，可以在 `config.py` 中启用可选的视觉选择步骤。在这里，LLM 被要求利用其视觉能力实际查看 6 张图片，结合用户查询和文本回答，去除任何看起来不相关的图片。这能产生精确、精心策划的图片，但会增加几秒钟的延迟。此选项未在基准测试结果中使用。

最后，创建了一个简单的 Streamlit UI 来可视化输出结果。

## 结果

我在一组 20 个问题上测试了该机器人，涵盖精确检索、跨文档推理、结构推理等。完整结果在我的 GitHub 仓库中可以找到。结果是：17 次完美检索，1 次未检索到图像，2 次部分检索。然而，这里最重要的观察是，没有出现来自与查询无关的文档的错误图片泄露到结果中的情况，从而不会侵蚀用户对机器人的信任。这得益于 Proxy-Pointer 的精准性。图像检索不足的情况是由我在下一节讨论的 LLM 不确定性和子节点原因造成的。

以下是部分结果的截图。为简洁起见，文本回答已截断：

**精确数据检索**
问题：GaLore 在不同 GLUE 任务上对 RoBERTa-Base 进行微调时使用了哪些超参数？

```
The hyperparameters used for fine-tuning RoBERTa-Base for GaLore across GLUE tasks include a training duration of 30 epochs, a maximum sequence length of 512, and a batch size of 32 f
Sources:
• Galore > D. Fine-Tuning Experiments > D.1. Details of Fine-Tuning on GLUE
• Galore > Epochs
• Galore > 5. Experiments

AI-Verified Evidence List:
• Galore - Table 7: Hyperparameters of fine-tuning RoBERTa base for GaLore (Galore/tables/fileoutpart157.png)
```

![精确数据检索结果](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/image-273-1024x554.png)

**跨文档推理**
问题：GaLore 和 CLIP-CITE 都面临高效模型训练的挑战。请从内存效率和知识保留两个维度比较 GaLore 的梯度投影方法与 CLIP-CITE 的微调策略。

```
Memory Efficiency

GaLore: Focuses on reducing the memory footprint of optimizer states (e.g., Adam) by projecting gradients into a low-rank subspace. By tracking only low-rank gradient statistics, it avoids storing full-rank matrices. It is more memory-efficient than LoRA
..contd
Sources:
• Galore > 4. GaLore for Memory-Efficient Training > 4.2. Memory-Efficient Optimization
• Galore > 5. Experiments > 5.4. Memory-Efficient Fine-Tuning
• CLIP > 4 Experiments > 4.3 Further Analysis

AI-Verified Evidence List:
• Galore - Table 1: Comparison between GaLore and LoRA (Galore/tables/fileoutpart39.png)
• CLIP - Table 5: Comparison performances and training efficiency (CLIP/tables/fileoutpart18.png)
```

![跨文档推理结果](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/image-274-1024x256.png)

**视觉查询**
问题：描述 VectorFusion 流水线的各个阶段：光栅图像如何首先被采样，然后转换为 SVG，最后使用潜在分数蒸馏进行微调？

```
The VectorFusion pipeline generates SVGs through three primary stages:

Raster Sampling: A raster image is sampled from a pretrained text-to-image diffusion model (e.g., Stable Diffusion) using a Runge-Kutta solver. To ensure iconographic aesthetics, the input text is appended with a prompt suffix 
..contd
Sources:
• VectorFusion > 4. Method: VectorFusion
• VectorFusion > 4. Method: VectorFusion > 4.1. A baseline: text-to-image-to-vector
• VectorFusion > 4. Method: VectorFusion > 4.2. Sampling vector graphics by optimization

AI-Verified Evidence List:
• VectorFusion - Figure 3: VectorFusion generates SVGs in three stages. (VectorFusion/figures/fileoutpart29.png)
• VectorFusion - Figure 5: Overview of VectorFusion's latent score distillation optimization procedure. (VectorFusion/figures/fileoutpart33.png)
```

![视觉查询结果](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/image-275-1024x254.png)

**视觉问题**
问题：Nemobot 中实现了哪些游戏？根据 Shannon 的游戏分类法，它们是如何分类的？

```
Nemobot implements a variety of games categorized according to Shannon's game taxonomy, which classifies machines based on their decision-making logic:

Category 1: Dictionary-Based Machines

Tic Tac Toe: Uses a dictionary-based system where the LLM agent dynamically generates optimal moves for game states, effectively compressing the state-action dictionary into its inference capabilities.
..contd

Sources:
• NemoBot > II. GAME PLAYING WITH LARGE LANGUAGE MODELS > A. Shannon's Taxonomy of AI Games with LLMs
• NemoBot > IV. EVALUATION OF NEMOBOT GAMES > A. Dictionary-Based Game: Tic Tac Toe
• NemoBot > I. INTRODUCTION

AI-Verified Evidence List:
• NemoBot - Table I: Nemobot games categorized according to Shannon's game taxonomy (NemoBot/tables/fileoutpart5.png)
```

![视觉问题结果](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/image-276-1024x554.png)

## 边缘情况与设计权衡

### LLM 不确定性

由于图像选择由 LLM 执行，即使 `temperature = 0.0`，对同一查询的重复运行也可能呈现略有不同的图像。根据我们的偏好，我们可能会觉得某些图片比其他的更相关。

### 子节点图形

针对特定查询（`eg; What is Vision Distillation Loss?`）很可能找到包含该特定概念的章节，并比宽泛查询（`eg; Compare Vectorfusion pipeline with Vectorpainter`）更好地展示精确的公式和图形。宽泛的查询可能检索到标题级节点（章节），而相关图形可能位于子节点中，不在 `k=5` 的上下文窗口范围内。然而，单独询问每条流水线可以正常工作，因为所有 5 个槽都分配给了同一篇论文，将足够的子节点——以及相关图形——纳入上下文。

### 脱离的图像路径

这种方法假设图像路径（例如 `!\[](figures/fileoutpart11.png)`）实际存在于检索到的章节中。如果某个图形在文本中被引用，但存储在未被检索到的单独章节（如附录）中，则不会被呈现。一个实用的解决方法是以可推导的方式命名图像文件——`table_1.jpg`、`figure_3.png`——这样合成器就可以从引用中构建路径，而不必依赖提取器生成的通用名称（如 `fileoutpart1.png`）。无论采用哪种方式，核心原则都成立：不需要多模态嵌入或视觉解释。完整的章节上下文足以让 LLM 做出智能的图像选择。

## 开源仓库

Proxy-Pointer 完全开源（MIT 许可），可在 Proxy-Pointer Github 仓库访问。多模态流水线正在同一仓库中添加，与现有的纯文本版本并存。

它专为 5 分钟快速启动而设计：

```
MultiModal/
├── src/
│   ├── config.py             # Model selection (Gemini 3.1 Flash Lite)
│   ├── agent/
│   │   └── mm_rag_bot.py     # MultiModal RAG Logic
│   ├── indexing/
│   │   ├── md_tree_builder.py # Structure Tree generator
│   │   └── build_md_index.py  # Vector index builder
│   └── extraction/
│       └── extract_pdf.py     # Adobe pdf Extraction to MD logic
├── data/                      # Unified Data Hub
│   ├── extracted_papers/      # Processed Markdown & Figures
│   └── pdf/                   # Original Source PDFs
├── results/                   # Benchmarking Hub
│   ├── test_log.json          # 20-query results & metrics
│   └── test_queries.json      # Benchmark questions
├── app.py                     # Streamlit Multimodal UI
└── run_test_suite.py          # Automated benchmark runner
```

## 核心要点

- **多模态 RAG 本质上不是视觉问题——它是检索对齐问题。** 挑战不在于提取或嵌入图像，而在于自信地将它们与正确的语义上下文关联起来。
- **基于 chunk 的检索会破坏视觉连贯性。** 滑动窗口分块会分割说明文字，并将图像与其真正的语义单元断开连接，使可靠选择变得困难。
- **多模态嵌入带来模糊性，而非清晰性。** 视觉上相似的工件（例如表格、图表）在同一向量空间中难以区分，使得在没有结构基础的情况下很难判断相关性。
- **结构是缺失的层。** 将文档视为层级语义单元，使图像能够从其章节中继承含义，从而实现有把握的选择。
- **Proxy-Pointer 重新定义了问题。** 它不是直接搜索图像，而是检索章节，并根据完整上下文有条件地选择图像——将一个困难的检索问题转变为更简单的过滤任务。
- **对视觉内容而言，准确性比文本更重要。** 展示错误的图像比完全省略更有害，这使得精确性在企业使用场景中至关重要。

## 结论

多模态回答长期以来被视为 RAG 系统演进的下一步。然而，尽管视觉模型和多模态嵌入取得了进展，可靠地在文本旁边返回相关图像仍然是一个未解决的问题。

原因微妙但根本：传统 RAG 流水线基于碎片化的 chunk 运作，而含义——尤其是视觉含义——存在于完整的文档结构层面。如果检索不与语义单元对齐，即使是最先进的模型也难以做出正确的视觉关联。

Proxy-Pointer 多模态 RAG 通过将基础从平面 chunk 升级为结构化上下文来弥补这一差距。通过检索完整章节，并将图像路径视为其中工件的指针，它实现了准确、可扩展且具有成本效益的多模态回答——无需依赖昂贵的多模态嵌入。

结果是朝前迈出了实际的一步：聊天机器人不再只是叙述，而是展示精确的证据——始终植根于正确的上下文。

克隆仓库。尝试你自己的文档。欢迎告诉我你的想法。

欢迎在 www.linkedin.com/in/partha-sarkar-lets-talk-AI 与我联系并分享你的评论。

本文使用的所有研究论文均可在 CLIP、Nemobot、GaLore、VectorFusion 和 VectorPainter 以 CC-BY 许可获取。代码和基准测试结果在 MIT 许可下开源。本文中使用的图像由 Google Gemini 生成。

## 引用

- 原文：[Proxy-Pointer RAG: Multimodal Answers Without Multimodal Embeddings](https://towardsdatascience.com/proxy-pointer-rag-multimodal-answers-without-multimodal-embeddings/)
