---
title: 使用自动化 Schema 生成加速智能文档处理
pubDatetime: 2026-05-13T10:30:00+08:00
description: 介绍如何利用视觉嵌入、自动聚类以及 Strands Agents 实现的 Agentic Schema 生成，将未分类的文档集合自动转化为结构化 Schema，从而在无需手动标注的情况下启动智能文档处理流程。
slug: automate-schema-generation-idp-zh
originalTitle: "Automate schema generation for intelligent document processing"
originalUrl: https://aws.amazon.com/blogs/machine-learning/automate-schema-generation-for-intelligent-document-processing/
tags:
  - AWS
  - IDP
  - Agent
  - 翻译
---

原文标题：Automate schema generation for intelligent document processing<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/automate-schema-generation-for-intelligent-document-processing/

在使用智能文档处理（IDP）技术从文档中提取信息之前，你需要为每种文档类别定义一个 Schema，用于描述需要提取的内容。但如果你手头有成千上万份文档，且对其中存在哪些类别一无所知，该如何创建 Schema？在规模化场景下完成这项工作需要大量手工劳动，使得下游的 IDP 落地举步维艰。

在本文中，我们将介绍多文档发现功能是如何解决这一问题的。它作为自动化预处理步骤，分析未知文档，按类型进行聚类，并生成可供 [IDP Accelerator](https://aws.amazon.com/blogs/machine-learning/accelerate-intelligent-document-processing-with-generative-ai-on-aws/) 直接使用的 Schema。你将了解这一新功能如何利用视觉嵌入实现自动聚类，以及如何利用 Agent 生成 Schema。我们还将带你亲手在自己的文档集合上运行该解决方案。

## IDP Accelerator

[IDP Accelerator](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws) 是一个可扩展的、无服务器的、开源的自动化文档处理与信息提取解决方案。要将该方案定制适配到你自己的文档类型，需要一个[配置文件](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws/blob/main/docs/configuration.md)，在其中指定类别和字段。最小配置示例请参见 IDP Accelerator 的 [GitHub 仓库](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws/blob/main/docs/configuration.md#minimal-configuration-example)。

如果你对自己的文档类型缺乏深入了解，创建这份 Schema 可能非常困难。IDP Accelerator 内置了一个[发现模块（Discovery Module）](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws/blob/main/docs/discovery.md)，可以从单个示例文档生成类别配置。但前提是你必须已经知道自己的文档类别，并能为每个类别提供一份有代表性的示例文档。本文介绍的多文档发现功能取消了这一前提条件，大幅加速了将 IDP Accelerator 应用于未标注文档集合的过程。

## 解决方案概述

下面的视频展示了该解决方案在 IDP Accelerator Console 中的效果。

<video width="640" height="360" controls preload="metadata">
  <source type="video/mp4" src="https://d2908q01vomqb2.cloudfront.net/artifacts/DBSBlogs/ml-20447/multidoc_discovery.mp4">
</video>

多文档发现功能自动化地将未分类文档集合转化为结构化 Schema，随时可供下游 IDP 流程使用。该解决方案集成在 IDP Accelerator 现有发现模块中，是"单文档"发现功能旁边新增的"多文档"能力。[AWS Step Functions](https://aws.amazon.com/step-functions/) 状态机和 [AWS Lambda](https://aws.amazon.com/lambda/) 函数提供编排和无服务器计算。该方案处理来自 [Amazon S3](https://aws.amazon.com/s3/) 存储桶或 Zip 文件上传的文档。通过 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 提供的模型生成 Schema，并自动整合到 IDP Accelerator 的配置文件中。下图展示了完整的工作流程。

![架构图：多文档发现作业管道，从 S3 获取原始文档，经过嵌入、聚类、使用 Strands Agents 的 Schema 生成以及 Schema 分析，最终生成质量报告](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-2.png)

发现作业首先使用 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 上提供的嵌入模型，将 [Amazon S3](https://aws.amazon.com/s3/) 中的每份文档转化为向量嵌入，然后将相似文档分组成簇。基于 [Strands Agents](https://strandsagents.com/) 和 Amazon Bedrock LLM 构建的 Agent 分析每个簇，识别文档类型并生成 Schema。最后，反思步骤在你最终审核之前，从整体上审视所有 Schema，以发现重叠和不一致之处。

## 技术细节

我们将逐步介绍整个流程的每个环节，重点说明关键决策和实现细节。

### 嵌入生成

工作流为每份文档创建一个嵌入，将视觉特征转化为数值表示。对于多页文档，仅使用第一页。当前工作流使用视觉嵌入而非基于 OCR 的文本，原因是视觉嵌入能捕捉布局、格式和结构特征，即使在文本内容相似的情况下也能区分文档类型。该解决方案以 [Cohere Embed v4](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed-v4.html)（通过 Amazon Bedrock 提供）作为发现作业的默认嵌入模型。嵌入步骤自动处理常见的痛点与障碍，如图像压缩、重试逻辑和速率限制。

### 文档聚类

多文档发现功能使用[轮廓系数（silhouette score）](https://en.wikipedia.org/wiki/Silhouette_(clustering))来学习文档集合中有多少种文档类型。在此语境中，轮廓系数用于衡量各簇之间的分离程度，以及每个簇内部文档的紧凑程度。通过 k-means 聚类，Agent 默认测试 k 从 2 到 20 的值，并选择轮廓系数最高的分组。其中 k 代表文档集合中不同文档类型的数量。为了形成有意义的簇，每个簇至少需要包含两份文档。如有必要，k 的上限会降至 20 以下，以满足这一约束。

### 嵌入与聚类的基准测试

为了验证嵌入和聚类方案，我们在 IDP Accelerator CloudFormation 堆栈部署的测试集存储桶中，使用 Cohere Embed v4 对 [OCR-benchmark 数据集](https://huggingface.co/datasets/getomni-ai/ocr-benchmark)的子集进行了实验。要找到你的存储桶名称，请前往 CloudFormation 控制台，选择你的 IDP Accelerator 堆栈，打开"输出"选项卡，查找键名 `S3TestSetBucketName`。

该数据集包含单页文档类型。部署的子集共有 293 份文档，涵盖 9 种文档类型：银行支票、商业租赁协议、信用卡账单、送货单、设备检验单、术语表、请愿表格、房地产文件和班次排班表。

为了评估 k-means 聚类能否使用 Cohere 嵌入模型正确识别这些分组，我们以轮廓系数作为选择最优 k 值的指标进行了测试。我们运行了流程的前两个阶段（嵌入和聚类），并分析了 k 从 2 到 20 时的轮廓系数分布。下图展示了这些 k 值下的轮廓系数分布。最高轮廓系数出现在 k=9 时，与数据集中实际的文档类型数量完全吻合。

![折线图：轮廓系数随簇数量（k=2-20）的变化，在 k=9 时达到约 0.43 的峰值，由红色虚线垂直标注](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-3.png)

TSNE 图（t-分布随机邻域嵌入图，一种将高维数据降至 2D 空间同时保留数据点间关系的可视化技术）展示了这些嵌入在二维空间中的可视化效果，图例中显示了簇的分类情况。

![文档嵌入的 t-SNE 散点图，展示 9 种文档类型形成的清晰、分离良好的簇，验证了嵌入质量对文档分类的有效性](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-4.png)

聚类达到了完美的调整兰德指数（ARI）和归一化互信息（NMI），均为 1.0。ARI 衡量聚类与真实分组的匹配程度，NMI 量化预测簇与实际簇之间的信息共享量。每个簇以 100% 的纯度一一对应到真实的文档类别。这些结果表明，高质量的多模态嵌入可以实现完全无监督的文档分类。嵌入准确地分离了多种不同的文档类型，如银行支票、房地产表格和信用卡账单，无需任何标注训练数据。

**注意：** 在此基准数据集上的性能并不能保证在你的特定文档数据上取得类似结果，因为数据集的特征会直接影响结果质量。

### Agentic Schema 生成

在识别出簇之后，流程进入 Agentic 阶段。对于每个簇，系统会调用一个 [Strands Agent](https://strandsagents.com/latest/) 来确定文档类型并生成 Schema。我们选择 Strands Agents 是因为其模型驱动的方式，它赋予模型充分的灵活性来自主推理每个 Schema。Agent 需要在簇内不同位置策略性地可视化文档，以在生成 Schema 之前充分了解其多样性。例如，它会检查一份靠近簇中心的文档、一份位于外围的文档和一份处于中间位置的文档。更确定性的、固定采样方式在这里行不通，因为聚类质量高度依赖于你的具体文档。为此，Agent 配备了两个专用工具：

- 簇分析工具（Cluster Analysis Tool）——按文档距簇中心的距离排序检索文档 ID，使 Agent 能够跨越簇内变化范围进行策略性采样。
- 文档查看工具（Document Viewer Tool）——获取并压缩文档图像用于视觉检查，自动处理模型上下文窗口的尺寸限制。

Agent 的系统提示词编码了关于 JSON Schema 规范和 [IDP Accelerator 配置](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws/tree/main/config_library)要求的领域专业知识。它指示 Agent：

- 策略性地采样文档，若确信已获得足够覆盖则提前停止。
- 生成包含适当元数据、类型定义和描述的 JSON Schema。
- 添加 IDP Accelerator 专属注解，如 `x-aws-idp-document-type` 和 `x-aws-idp-evaluation-method`。`x-aws-idp-evaluation-method` 由基于 [Stickler](https://github.com/awslabs/stickler) 的评估扩展使用。
- 为地址、行项目和税务信息等常见结构创建可复用的 `$defs`。
- 根据字段类型应用适当的评估方法：字符串用 `EXACT`，数字用 `NUMERIC_EXACT`，复杂或嵌套对象用 `LLM`。

工具、提示词和模型共同赋予 Agent 推理其自身采样策略的能力。这些 Agent 并行运行，因此无需等待上一个簇完成后再开始下一个。

### Schema 分析

在每个 Agent 独立生成 Schema 之后，Schema 分析步骤会从整体上评估输出结果之间的差异性。它评估发现的文档分组是否界定清晰，Schema 是否完整且一致，并查找文档类型间的冗余或重复。基于这些发现，它提出具体建议，如合并簇或细化字段定义。它生成一份总结报告，包含对各类别的人类可读概述。这份质量报告在 IDP Accelerator 的发现作业详情中可见。

## 在你的文档上运行作业

要在自己的文档上运行多文档发现工作流，请按照以下步骤在 IDP Accelerator Console 中操作。

**步骤 1：创建新配置**

首先在 IDP Accelerator Console 中创建一个全新的配置：

1. 导航到**配置（Configuration）**部分，选择**查看/编辑配置（View/Edit Configuration）**。
2. 选择**文档 Schema（Document Schema）** > **清空所有（Wipe All）**，创建一个新的空配置。
3. 选择**另存为版本（Save as Version）**，提供一个描述性的**版本名称（Version Name）**，然后选择**另存为版本（Save as Version）**。

![AWS IDP 文档处理配置控制台截图，显示"文档 Schema"选项卡，带有"另存为新版本"模态对话框，已输入版本名称"multi-doc-discovery-config"](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-5.png)

**步骤 2：运行多文档发现**

配置就绪后，启动发现流程：

1. 导航到**发现（Discovery）**部分，选择**多文档（Multiple Documents）**选项。
2. 选择你刚创建的配置版本。
3. 配置你的文档来源：
   a. 选择 **S3 路径（S3 Path）**或 **Zip 上传（Zip Upload）**。
   b. 选择你的来源存储桶。
   c. 指定文档所在的 S3 前缀。

**注意：** 你的文档必须添加到 IDP Accelerator 现有的存储桶之一（发现存储桶、测试存储桶或输入存储桶）才能使用"来源存储桶"选项。

4. 选择**开始发现（Start Discovery）**以触发状态机。

![AWS IDP 发现控制台"多文档"选项卡的截图，显示"启动多文档发现"表单，配置了 S3 路径来源、"multi-doc-discovery-config"版本，以及一个空的发现作业表格](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-6.png)

**步骤 3：监控发现作业并查看结果**

追踪发现作业进度：

- **多文档发现作业（Multi-Document Discovery Jobs）**表格中将出现一条新记录，显示执行状态、当前步骤和元数据。
- 作业完成后，选择**来源（Source）**字段查看结果：

![AWS IDP 发现作业详情页截图，显示一个已完成的多文档发现作业，15 分钟内发现了 9 个簇，BankCheck 类别已展开显示其生成的 JSON Schema](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-7.png)

- 滚动到发现作业详情页底部，访问**质量报告（Quality Report）**：

![AWS IDP 发现作业结果截图，显示最后两个发现的类别（MedicalEquipmentInspectionChecklist 和 DeliveryNote），以及带有全部 9 个文档簇概览表格和 Schema 质量评估开头的质量审查报告](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/01/ml-20447-8.png)

发现的类别及其 JSON Schema 将自动整合到你的配置文件中。

## 最佳实践

在大规模运行多文档发现作业之前，有几点最佳实践值得注意。由于工作流当前仅处理每个 PDF 的第一页，请确保你的输入文件是单文档文件。尚不支持多文档合并包。获得初步结果后，在确定 Schema 之前，请仔细审查质量报告摘要，以发现簇重叠或文档分布不均等问题。

## 后续步骤

下一步取决于工作流在文档中发现了什么：

- 如果 Schema 看起来干净，质量报告显示低重叠：你可以开始在文档上大规模运行 IDP。这些 Schema 会自动添加到 IDP Accelerator 配置的 classes 字段中。
- 如果质量报告标记了重叠的簇：审查建议并利用它们来优化生成的 Schema。这可能包括将相似的 Schema 合并为单一类别，或调整字段定义以减少重叠。
- 如果 Schema 质量在各簇间参差不齐：检查你的文档集合是否存在文档类型分布极度不均的情况。在更均衡的子集上运行发现作业有助于 Agent 生成更可靠的簇和 Schema。

## 结论

在本文中，我们展示了多文档发现功能如何解决这一矛盾：在能够处理文档之前需要 Schema，但在生成 Schema 之前需要先处理文档。该方案结合了视觉嵌入、自动聚类以及使用多模态 LLM 的 Agentic Schema 生成。它将一个不透明的未知文档集合转化为结构化的、可供审核的文档类别和 Schema。你已经了解了工作流如何处理嵌入生成、簇调优以及并行分类和 Schema 生成。你也看到了反思步骤如何为 Agent 生成的输出提供透明的分析，供人工审核。

我们希望听到多文档发现功能在你的文档集合上的实际效果。请在下方评论区分享你的结果、问题或建议。如果遇到问题或希望贡献代码，请在 [GitHub 仓库](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws)提交 issue 或 pull request。

## 关于作者

**Grace Lang** 是 AWS 生成式 AI 创新中心的深度学习架构师，专注于为客户设计和交付生产级生成式 AI 解决方案。

**Bob Strahan** 是 AWS 生成式 AI 创新中心的首席解决方案架构师。

**David Kaleko** 是 AWS 生成式 AI 创新中心的高级应用科学家，领导面向 AWS 客户的前沿生成式 AI 实施策略应用研究。他拥有哥伦比亚大学粒子物理学博士学位。

**Spencer Romo** 是生成式 AI 创新中心（GenAIIC）的高级数据科学家，专注于智能文档处理，在计算机视觉、NLP 和信号处理方面具有深厚专业知识。他在遥感领域的创新工作已获得多项专利。他常驻德克萨斯州奥斯汀，与客户密切合作以交付有影响力的 AI 解决方案。工作之余，他参加 24 小时 Lemons 赛车系列赛，将他对工程的热情与低预算赛车运动相结合。

## 引用

- 原文：[Automate schema generation for intelligent document processing](https://aws.amazon.com/blogs/machine-learning/automate-schema-generation-for-intelligent-document-processing/)
- [IDP Accelerator GitHub 仓库](https://github.com/aws-solutions-library-samples/accelerated-intelligent-document-processing-on-aws)
- [Amazon Bedrock](https://aws.amazon.com/bedrock/)
- [Strands Agents](https://strandsagents.com/)
