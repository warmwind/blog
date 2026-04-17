---
title: 使用 Sentence Transformers 训练和微调多模态嵌入与重排序模型
pubDatetime: 2026-04-17T10:00:00+08:00
description: 本文介绍如何使用 Sentence Transformers 在自定义数据上训练或微调多模态嵌入与重排序模型，以视觉文档检索为例进行详细讲解。
slug: train-multimodal-sentence-transformers-zh
originalTitle: "Training and Finetuning Multimodal Embedding & Reranker Models with Sentence Transformers"
originalUrl: https://huggingface.co/blog/train-multimodal-sentence-transformers
---

原文标题：Training and Finetuning Multimodal Embedding & Reranker Models with Sentence Transformers<br>
原文链接：https://huggingface.co/blog/train-multimodal-sentence-transformers

[Sentence Transformers](https://sbert.net/) 是一个 Python 库，用于使用和训练嵌入及重排序模型，适用于检索增强生成、语义搜索等应用。在我的[上一篇博客](https://huggingface.co/blog/multimodal-sentence-transformers)中，我介绍了新的多模态功能，展示了如何使用可处理文本、图像、音频和视频的嵌入与重排序模型。在本篇博客中，我将向你展示如何在自己的数据上**训练或微调**这些多模态模型。

作为实践示例，我将演示如何微调 [`Qwen/Qwen3-VL-Embedding-2B`](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B) 用于视觉文档检索（VDR），即针对给定的文本查询，从语料库中检索相关文档页面（以图像形式，保留图表、表格和布局）的任务。由此生成的 [`tomaarsen/Qwen3-VL-Embedding-2B-vdr`](https://huggingface.co/tomaarsen/Qwen3-VL-Embedding-2B-vdr) 展示了通过在自身领域进行微调可以获得多少性能提升。在我的评估数据上，微调后的模型 NDCG@10 达到 0.947，而基础模型仅为 0.888，并且优于我测试过的所有现有 VDR 模型，包括参数量高达其 4 倍的模型。

[![VDR 模型大小与 NDCG 对比](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot.png)](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot.png)

> **提示**：如果你刚开始接触 Sentence Transformers 中的多模态模型，建议先阅读[《使用 Sentence Transformers 的多模态嵌入与重排序模型》](https://huggingface.co/blog/multimodal-sentence-transformers)。如需训练纯文本嵌入、重排序或稀疏嵌入模型，请参阅文末的[历史博客](#历史博客)部分。

## 目录

- [为什么要微调？](#为什么要微调)
- [训练组件](#训练组件)
- [模型](#模型)
- [数据集](#数据集)
  - [视觉文档检索数据集](#视觉文档检索数据集)
  - [数据集格式](#数据集格式)
- [损失函数](#损失函数)
  - [CachedMultipleNegativesRankingLoss](#cachedmultiplenegativesrankingloss)
  - [MatryoshkaLoss](#matryoshkaloss)
- [训练参数](#训练参数)
- [评估器](#评估器)
- [训练器](#训练器)
- [结果](#结果)
  - [模型大小与 NDCG@10](#模型大小与-ndcg10)
  - [Matryoshka 维度与 NDCG@10](#matryoshka-维度与-ndcg10)
- [训练多模态重排序模型](#训练多模态重排序模型)
- [附加资源](#附加资源)
  - [历史博客](#历史博客)
  - [训练示例](#训练示例)
  - [文档](#文档)

## 为什么要微调？

通用多模态嵌入模型（如 [`Qwen/Qwen3-VL-Embedding-2B`](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B)）在多样化数据上训练，能够在广泛的语言和任务上表现良好：图文匹配、视觉问答、文档理解等。但这种通用性意味着该模型对于任何特定任务来说很少是最佳选择。

以视觉文档检索为例：给定一个文本查询，如"公司第三季度收入是多少？"，模型必须从数千个文档截图的语料库中找到最相关的文档截图。这需要理解文档布局、图表、表格和文本，这与例如将鞋子图片与产品描述进行匹配的技能截然不同。

通过在特定领域数据上微调，模型可以学习这些专业化的模式。在我的实验中，微调将 NDCG@10 从 0.888 提升到 0.947，超过了我测试过的所有近期多模态模型，包括参数量高达其 4 倍的模型。

## 训练组件

训练多模态 Sentence Transformer 模型涉及与训练纯文本模型相同的组件：

1. [**模型**](#模型)：要训练或微调的多模态模型。
2. [**数据集**](#数据集)：用于训练和评估的数据。
3. [**损失函数**](#损失函数)：量化模型性能并指导优化过程的函数。
4. [**训练参数**](#训练参数)（可选）：影响训练性能和跟踪/调试的参数。
5. [**评估器**](#评估器)（可选）：在训练前、中、后评估模型的工具。
6. [**训练器**](#训练器)：将模型、数据集、损失函数和其他组件整合在一起进行训练。

多模态训练流水线使用与纯文本训练相同的 [`SentenceTransformerTrainer`](https://sbert.net/docs/package_reference/sentence_transformer/trainer.html#sentence_transformers.sentence_transformer.trainer.SentenceTransformerTrainer)。关键区别在于，你的数据集包含图像（或其他模态）以及文本，而模型的处理器会自动处理图像预处理。

让我们逐一介绍每个组件，以视觉文档检索（将文本查询与文档截图进行匹配）作为贯穿始终的示例。

## 模型

最常见的方法是微调现有的多模态嵌入模型，或者从视觉语言模型（VLM）检查点开始。[`Transformer`](https://sbert.net/docs/package_reference/base/modules.html#sentence_transformers.base.modules.Transformer) 模块会自动从模型的处理器检测支持的模态。

要微调现有的多模态嵌入模型（例如已有 `modules.json` 文件的模型），可以传入 `processor_kwargs` 和 `model_kwargs` 来分别控制预处理和模型加载。`processor_kwargs` 直接传递给 [`AutoProcessor.from_pretrained(...)`](https://huggingface.co/docs/transformers/model_doc/auto#transformers.AutoProcessor.from_pretrained)（例如，图像分辨率范围：`max_pixels` 越大意味着质量越高但内存占用越多），而 `model_kwargs` 传递给相应的 [`AutoModel.from_pretrained(...)`](https://huggingface.co/docs/transformers/model_doc/auto#transformers.AutoModel.from_pretrained) 调用（例如，精度、注意力实现）：

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer(
    "Qwen/Qwen3-VL-Embedding-2B",
    model_kwargs={"attn_implementation": "flash_attention_2", "torch_dtype": "bfloat16"},
    processor_kwargs={"min_pixels": 28 * 28, "max_pixels": 600 * 600},
)
```

你也可以从尚未针对嵌入进行训练的全新 VLM 检查点开始。Sentence Transformers 会尝试识别架构，从处理器推断支持的模态，并设置适当的前向方法和池化。如果自动检测对某个特定模型效果不理想，可以编辑保存的 `sentence_bert_config.json` 中的配置来调整模态设置、前向方法和输出处理：

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("Qwen/Qwen3-VL-2B")
```

在两种情况下，[`Transformer`](https://sbert.net/docs/package_reference/base/modules.html#sentence_transformers.base.modules.Transformer) 模块都会检查处理器以确定可用的模态，并在需要时自动添加 [`Pooling`](https://sbert.net/docs/package_reference/sentence_transformer/modules.html#sentence_transformers.sentence_transformer.modules.Pooling)。你可以验证支持的模态：

```python
print(model.modalities)
# ['text', 'image', 'video', 'message']

print(model.supports("image"))
# True
```

<details>
<summary>替代方案：使用 Router 构建多模态模型</summary>

你不必使用单一 VLM 主干，而是可以使用 [`Router`](https://sbert.net/docs/package_reference/base/modules.html#sentence_transformers.base.modules.Router) 模块为不同模态组合独立的编码器。这让你可以组合任何现有的编码器，并根据检测到的模态将输入路由到适当的编码器：

```python
from sentence_transformers import SentenceTransformer
from sentence_transformers.sentence_transformer.modules import Dense, Pooling, Router, Transformer

# 为不同模态创建独立的编码器
text_encoder = Transformer("sentence-transformers/all-MiniLM-L6-v2")
text_pooling = Pooling(text_encoder.get_embedding_dimension(), pooling_mode="mean")
text_projection = Dense(text_encoder.get_embedding_dimension(), 768)

# SigLIP 直接输出池化后的嵌入，因此不需要单独的 Pooling 模块
image_encoder = Transformer("google/siglip2-base-patch16-224")

# 根据模态路由输入
router = Router(
    sub_modules={
        "text": [text_encoder, text_pooling, text_projection],
        "image": [image_encoder],
    },
)

model = SentenceTransformer(modules=[router])
```

> **警告**：由于基于 Router 的多模态模型对每个模态使用独立的编码器，它们的嵌入空间最初是不对齐的。需要训练才能对齐这些空间以实现有意义的跨模态相似度。上面展示的 `Dense` 投影层有助于将来自不同编码器的嵌入映射到共享空间。

当你希望使用轻量级专用编码器而非大型 VLM 时，这种方法非常有用。你还可以将基于 Router 的多模态性与基于任务的路由（例如，查询和文档使用不同的编码器）结合起来，使用 `route_mappings`。请参阅 [`Router`](https://sbert.net/docs/package_reference/base/modules.html#sentence_transformers.base.modules.Router) 文档以了解高级路由场景。

</details>

## 数据集

### 视觉文档检索数据集

在本示例中，我使用 [`tomaarsen/llamaindex-vdr-en-train-preprocessed`](https://huggingface.co/datasets/tomaarsen/llamaindex-vdr-en-train-preprocessed) 数据集，这是 [`llamaindex/vdr-multilingual-train`](https://huggingface.co/datasets/llamaindex/vdr-multilingual-train) 的预处理英语子集。该源数据集随 LlamaIndex 的[《视觉文档检索跨越语言边界》](https://huggingface.co/blog/vdr-2b-multilingual)博客文章发布，包含约 50 万个多语言查询-图像样本，这些样本从公开互联网 PDF 中收集，查询由 VLM（gemini-1.5-pro 和 Qwen2-VL-72B）合成生成。我的预处理版本过滤出 53,512 个英语样本，并将每个样本的 16 个基于 ID 的硬负样本中的 4 个解析为实际的文档截图图像，因此可以直接用于训练，无需进一步预处理：

```python
from datasets import load_dataset

train_dataset = load_dataset("tomaarsen/llamaindex-vdr-en-train-preprocessed", "train", split="train")
train_dataset = train_dataset.select_columns(["query", "image", "negative_0"])
eval_dataset = load_dataset("tomaarsen/llamaindex-vdr-en-train-preprocessed", "eval", split="train")
```

`train` 配置包含前 10,000 个样本，`eval` 配置包含接下来的 300 个样本（还提供包含全部 53,512 个样本的 `full` 配置）。对于训练，我选择 `query`、`image` 和 `negative_0` 来形成（锚点、正样本、硬负样本）三元组。包含额外的硬负样本可能会改善训练信号，但每增加一个负样本也会增加内存使用和训练时间，所以我坚持使用一个。对于评估，我保留每个查询的全部四个硬负样本，以构建更具挑战性的检索语料库（更多详情见[评估器](#评估器)部分）。

### 数据集格式

与纯文本训练一样，数据集格式必须与你选择的[损失函数](#损失函数)匹配。规则相同：

1. 如果你的损失函数需要*标签*，你的数据集必须有一个名为 **"label"** 或 **"score"** 的列。
2. 除 **"label"** 或 **"score"** 之外的所有列都被视为*输入*。这些列的数量必须与你选择的损失函数的有效输入数量相匹配。除标签列外，列名无关紧要，只有顺序重要。

对于多模态数据集，输入可以包含：

- **文本**：字符串。
- **图像**：PIL 图像、文件路径、URL 或 numpy/torch 数组。
- **音频**：文件路径、numpy/torch 数组、带有 `"array"` 和 `"sampling_rate"` 键的字典，或（如果安装了 `torchcodec`）`torchcodec.AudioDecoder` 实例。
- **视频**：文件路径、numpy/torch 数组、带有 `"array"` 和 `"video_metadata"` 键的字典，或（如果安装了 `torchcodec`）`torchcodec.VideoDecoder` 实例。
- **多模态字典**：将模态名称映射到值的字典，例如 `{"text": ..., "image": ...}`。键必须是 `"text"`、`"image"`、`"audio"` 或 `"video"`。

数据整理器会自动调用 `model.preprocess()`，该方法检测每个输入的模态并应用适当的预处理。不需要手动进行分词或图像处理。

> **提示**：许多与 Sentence Transformers 开箱即用的 Hugging Face 数据集都已标记 `sentence-transformers` 标签，你可以通过 [https://huggingface.co/datasets?other=sentence-transformers](https://huggingface.co/datasets?other=sentence-transformers) 轻松找到它们。

## 损失函数

### CachedMultipleNegativesRankingLoss

在本次训练中，我使用 [`CachedMultipleNegativesRankingLoss`](https://sbert.net/docs/package_reference/sentence_transformer/losses.html#cachedmultiplenegativesrankingloss)，这是检索任务的常见选择。它接受（查询，正样本）对以及任意数量的额外硬负样本列（从 0 到 n），只要每个样本具有相同数量的负样本。在训练过程中，损失将每个查询与其正样本的相似度推*高*，并将其与每个负样本的相似度推*低*。负样本来自两个来源：

1. **硬负样本**：数据集中明确提供的负样本列（在我们的三元组设置中只有 `negative_0`）。
2. **批内负样本**：同一批次中每个*其他*样本的正样本和硬负样本，以零额外成本重用为该查询的额外负样本。

每个查询的负样本越多，训练信号越强，因此更大的批次大小直接提高训练质量。此外，损失的"缓存"变体使用梯度缓存，使得在 GPU 内存有限的情况下也能实现大的有效批次大小。

`mini_batch_size` 参数控制缓存前向传递期间一次处理多少个样本。对于大型多模态模型，将其设置为较小的值（例如 1）非常重要，以避免内存不足错误，同时不牺牲大有效批次大小的优势：

```python
from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss

loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=1)
```

### MatryoshkaLoss

为了生成在多个维度上都能良好工作的嵌入，我用 [`MatryoshkaLoss`](https://sbert.net/docs/package_reference/sentence_transformer/losses.html#matryoshkaloss) 包装基础损失。这可以训练模型，使得将嵌入截断到更小的维度数量时仍然能保持良好性能：

```python
from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss, MatryoshkaLoss

loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=1)
loss = MatryoshkaLoss(model, loss, matryoshka_dims=[2048, 1536, 1024, 512, 256, 128, 64])
```

这对于多模态模型尤其有用，因为嵌入可能很大（Qwen3-VL 为 2048 维）。通过 Matryoshka 训练，你可以在部署时使用截断的嵌入（例如 256 或 128 维）以实现更快的搜索，而性能损失最小。正如我将在[结果](#结果)部分展示的，即使在 512 维时，微调后的模型也能实现接近峰值的性能。

## 训练参数

[`SentenceTransformerTrainingArguments`](https://sbert.net/docs/package_reference/sentence_transformer/training_args.html#sentencetransformertrainingarguments) 类允许你控制训练超参数。以下是用于 VDR 微调的配置：

```python
from sentence_transformers.sentence_transformer.training_args import SentenceTransformerTrainingArguments, BatchSamplers

run_name = "Qwen3-VL-Embedding-2B-vdr"
args = SentenceTransformerTrainingArguments(
    # 必填参数：
    output_dir=f"models/{run_name}",
    # 可选训练参数：
    num_train_epochs=1,
    per_device_train_batch_size=64,
    per_device_eval_batch_size=64,
    learning_rate=2e-5,
    warmup_ratio=0.1,
    fp16=False,
    bf16=True,
    batch_sampler=BatchSamplers.NO_DUPLICATES,
    # 可选跟踪/调试参数：
    eval_strategy="steps",
    eval_steps=0.1,
    save_strategy="steps",
    save_steps=0.1,
    save_total_limit=2,
    logging_steps=0.05,
    run_name=run_name,
)
```

关于（多模态）训练需要注意以下几点：

- `bf16=True`：由于更好的数值稳定性，bfloat16 通常优于 float16。
- `batch_sampler=BatchSamplers.NO_DUPLICATES`：使用 `MultipleNegativesRankingLoss` 或其缓存变体时，批次中没有重复样本可确保每个批内负样本都是真正不同的样本。
- `per_device_train_batch_size=64`：这对于 2B 参数的 VLM 来说可能看起来很大，但 `CachedMultipleNegativesRankingLoss` 与 `mini_batch_size=1` 通过梯度缓存处理内存限制。
- `eval_steps`、`save_steps` 和 `logging_steps`：将这些设置为分数（例如 0.1）意味着评估、保存和日志记录将在每个 epoch 的 10% 处发生，这对于监控训练进度很有用。

## 评估器

为了跟踪训练前、中、后的检索性能，我使用 [`InformationRetrievalEvaluator`](https://sbert.net/docs/package_reference/sentence_transformer/evaluation.html#informationretrievalevaluator)。它计算标准检索指标，如 NDCG@10、MAP 和 Recall@k：

```python
from sentence_transformers.sentence_transformer.evaluation import InformationRetrievalEvaluator

# 从评估数据集构建评估数据。
# 查询和语料库使用整数 ID：查询 0 的相关文档是语料库 0。
eval_queries = {qid: sample["query"] for qid, sample in enumerate(eval_dataset)}
eval_corpus = {did: sample["image"] for did, sample in enumerate(eval_dataset)}
num_eval = len(eval_dataset)

# 将硬负样本以偏移 ID（num_eval, 2*num_eval, ...）添加到语料库
# 这样它们就不会与正样本文档 ID（0..num_eval-1）冲突。
negative_columns = ["negative_0", "negative_1", "negative_2", "negative_3"]
for neg_idx, neg_col in enumerate(negative_columns):
    for did, sample in enumerate(eval_dataset):
        eval_corpus[num_eval * (neg_idx + 1) + did] = sample[neg_col]

# 每个查询的相关文档是相同索引处的正样本
eval_relevant_docs = {idx: [idx] for idx in range(len(eval_dataset))}

eval_evaluator = InformationRetrievalEvaluator(
    queries=eval_queries,
    corpus=eval_corpus,
    relevant_docs=eval_relevant_docs,
    batch_size=1,
    show_progress_bar=True,
    name="vdr-eval-hard",
)
```

评估器接受文本查询、图像语料库（包括硬负样本）以及哪些文档与哪些查询相关的映射。注意，语料库包含正样本和硬负样本文档截图的混合，使这成为一个具有挑战性的评估。使用 `batch_size=1` 可以防止大型 VLM 评估期间出现内存不足问题。

## 训练器

[`SentenceTransformerTrainer`](https://sbert.net/docs/package_reference/sentence_transformer/trainer.html#sentence_transformers.sentence_transformer.trainer.SentenceTransformerTrainer) 将所有内容整合在一起。以下是完整的训练脚本：

```python
from datasets import load_dataset

from sentence_transformers import SentenceTransformer
from sentence_transformers.sentence_transformer.evaluation import InformationRetrievalEvaluator
from sentence_transformers.sentence_transformer.losses import CachedMultipleNegativesRankingLoss, MatryoshkaLoss
from sentence_transformers.sentence_transformer.model_card import SentenceTransformerModelCardData
from sentence_transformers.sentence_transformer.trainer import SentenceTransformerTrainer
from sentence_transformers.sentence_transformer.training_args import (
    BatchSamplers,
    SentenceTransformerTrainingArguments,
)

# 1. 加载要微调的模型（可选提供模型卡片数据）
model = SentenceTransformer(
    "Qwen/Qwen3-VL-Embedding-2B",
    model_card_data=SentenceTransformerModelCardData(
        language="en",
        license="apache-2.0",
        model_name="Qwen3-VL-Embedding-2B model trained on Visual Document Retrieval query-document screenshot pairs",
    ),
    model_kwargs={"attn_implementation": "flash_attention_2", "torch_dtype": "bfloat16"},
    # 控制图像分辨率：值越小越省内存，值越大越保留细节
    processor_kwargs={"min_pixels": 28 * 28, "max_pixels": 600 * 600},
)

# 2. 加载用于微调的数据集：用于训练的 (query, positive, negative_0) 三元组，
# 评估时保留全部 4 个硬负样本
train_dataset = load_dataset("tomaarsen/llamaindex-vdr-en-train-preprocessed", "train", split="train")
train_dataset = train_dataset.select_columns(["query", "image", "negative_0"])
eval_dataset = load_dataset("tomaarsen/llamaindex-vdr-en-train-preprocessed", "eval", split="train")

# 3. 定义损失函数
loss = CachedMultipleNegativesRankingLoss(model, mini_batch_size=1)
loss = MatryoshkaLoss(model, loss, matryoshka_dims=[2048, 1536, 1024, 512, 256, 128, 64])

# 4. （可选）指定训练参数
run_name = "Qwen3-VL-Embedding-2B-vdr"
args = SentenceTransformerTrainingArguments(
    # 必填参数：
    output_dir=f"models/{run_name}",
    # 可选训练参数：
    num_train_epochs=1,
    per_device_train_batch_size=64,
    per_device_eval_batch_size=64,
    learning_rate=2e-5,
    warmup_ratio=0.1,
    fp16=False,  # 对于 VLM，BF16 优于 FP16，具有更好的数值稳定性
    bf16=True,  # 如果你的 GPU 支持 BF16（大多数现代 GPU 都支持），设置为 True
    batch_sampler=BatchSamplers.NO_DUPLICATES,  # MultipleNegativesRankingLoss 受益于无重复
    # 可选跟踪/调试参数：
    eval_strategy="steps",
    eval_steps=0.1,
    save_strategy="steps",
    save_steps=0.1,
    save_total_limit=2,
    logging_steps=0.05,
    run_name=run_name,  # 例如，如果安装了 Trackio 则使用
    # report_to=["codecarbon", "trackio"],  # 取消注释以启用日志记录（pip install codecarbon trackio）
)

# 5. （可选）创建评估器并评估基础模型
eval_queries = {qid: sample["query"] for qid, sample in enumerate(eval_dataset)}
eval_corpus = {did: sample["image"] for did, sample in enumerate(eval_dataset)}
num_eval = len(eval_dataset)
negative_columns = ["negative_0", "negative_1", "negative_2", "negative_3"]
for neg_idx, neg_col in enumerate(negative_columns):
    for did, sample in enumerate(eval_dataset):
        eval_corpus[num_eval * (neg_idx + 1) + did] = sample[neg_col]
eval_relevant_docs = {idx: [idx] for idx in range(len(eval_dataset))}

eval_evaluator = InformationRetrievalEvaluator(
    queries=eval_queries,
    corpus=eval_corpus,
    relevant_docs=eval_relevant_docs,
    batch_size=1,
    show_progress_bar=True,
    name="vdr-eval-hard",
)
eval_evaluator(model)

# 6. 创建训练器并开始训练
trainer = SentenceTransformerTrainer(
    model=model,
    args=args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    loss=loss,
    evaluator=eval_evaluator,
)
trainer.train()

# 7. （可选）在每个 Matryoshka 维度上进行评估
eval_evaluator(model)
for dim in [2048, 1536, 1024, 512, 256, 128, 64]:
    dim_evaluator = InformationRetrievalEvaluator(
        queries=eval_queries,
        corpus=eval_corpus,
        relevant_docs=eval_relevant_docs,
        truncate_dim=dim,
        batch_size=1,
        show_progress_bar=True,
        name=f"vdr-eval-hard-{dim}d",
    )
    dim_evaluator(model)

# 8. 保存训练后的模型
model.save_pretrained(f"models/{run_name}/final")

# 9. （可选）推送到 Hugging Face Hub
# 这会推送到你的个人命名空间，例如 {your_username}/Qwen3-VL-Embedding-2B-vdr
model.push_to_hub("Qwen3-VL-Embedding-2B-vdr")
```

训练脚本与纯文本训练脚本几乎完全相同。唯一的区别是：

1. 模型加载：我们传入 `model_kwargs` 用于精度和注意力实现，以及 `processor_kwargs` 用于图像分辨率范围。
2. 损失函数：我们使用 `CachedMultipleNegativesRankingLoss` 与 `mini_batch_size=1` 来处理大型 VLM 而不耗尽内存。
3. 评估器：评估器在语料库中使用图像，在查询中使用文本，从而实现跨模态检索评估。

其他所有内容（训练器、训练参数、数据集加载）与纯文本训练完全相同。

## 结果

### 模型大小与 NDCG@10

仅训练 1 个 epoch 后，微调后的 [tomaarsen/Qwen3-VL-Embedding-2B-vdr](https://huggingface.co/tomaarsen/Qwen3-VL-Embedding-2B-vdr) 模型在评估集（300 个查询，1500 个语料库文档，余弦相似度）上实现了 **0.947** 的 NDCG@10。这比基础 [Qwen/Qwen3-VL-Embedding-2B](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B) 模型的 0.888 有显著提升，并且优于所有现有的 VDR 模型：

[![VDR 模型大小与 NDCG 对比](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot.png)](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot.png)

<details>
<summary>按模型的完整 NDCG@10 数据（20 个模型）</summary>

| 模型 | 参数量 | NDCG@10 |
|:-----|:------:|:-------:|
| **tomaarsen/Qwen3-VL-Embedding-2B-vdr** | **2.1B** | **0.947** |
| Qwen/Qwen3-VL-Embedding-8B | 8.1B | 0.923 |
| nvidia/omni-embed-nemotron-3b | 4.7B | 0.915 |
| nvidia/llama-nemotron-embed-vl-1b-v2 | 1.7B | 0.912 |
| nomic-ai/nomic-embed-multimodal-7b | 8.3B | 0.912 |
| llamaindex/vdr-2b-multi-v1 | 2.2B | 0.912 |
| llamaindex/vdr-2b-v1 | 2.2B | 0.911 |
| nomic-ai/nomic-embed-multimodal-3b | 3.8B | 0.899 |
| Qwen/Qwen3-VL-Embedding-2B | 2.1B | 0.888 |
| LCO-Embedding/LCO-Embedding-Omni-7B | 8.9B | 0.888 |
| LCO-Embedding/LCO-Embedding-Omni-3B | 4.7B | 0.860 |
| BAAI/BGE-VL-v1.5-zs | 7.6B | 0.800 |
| BAAI/BGE-VL-v1.5-mmeb | 7.6B | 0.797 |
| BAAI/BGE-VL-MLLM-S2 | 7.6B | 0.792 |
| BidirLM/BidirLM-Omni-2.5B-Embedding | 2.5B | 0.775 |
| royokong/e5-v | 8.4B | 0.767 |
| BAAI/BGE-VL-MLLM-S1 | 7.6B | 0.710 |
| sentence-transformers/clip-ViT-L-14 | 428M | 0.611 |
| BAAI/BGE-VL-large | 428M | 0.467 |
| BAAI/BGE-VL-base | 150M | 0.335 |

</details>

微调后的 2B 模型甚至优于 8B 的 Qwen3-VL-Embedding 模型，展示了针对特定任务微调的强大能力。即使有更大的通用模型可用，在你自己的领域上进行微调通常也是值得考虑的！

### Matryoshka 维度与 NDCG@10

上面的比较使用的是完整尺寸的 2048 维嵌入。得益于 Matryoshka 训练，微调后的模型在截断到更少维度时也表现良好，让你可以在部署时权衡嵌入大小和检索质量：

[![Matryoshka 维度与 NDCG@10](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot_mrl.png)](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/multimodal-sentence-transformers/vdr_plot_mrl.png)

> **注意**：微调后的模型峰值在完整的 2048 维（0.948），但一直到 512（缩小 4 倍）时仍在峰值的 0.3% 以内，即使在 64 维（缩小 32 倍）时也能保留超过 92% 的峰值性能。Matryoshka 训练将最重要的信息集中在早期维度，因此适度的截断几乎不会损失性能。

<details>
<summary>按维度的完整 NDCG@10 数据</summary>

| 维度 | 基础模型 NDCG@10 | 微调后 NDCG@10 |
|:----:|:---------------:|:-------------:|
| 2048（完整） | 0.8961（100%） | 0.9480（100%） |
| 1536 | 0.8940（99.8%） | 0.9439（99.6%） |
| 1024 | 0.8941（99.8%） | 0.9464（99.8%） |
| 512 | 0.8760（97.8%） | 0.9451（99.7%） |
| 256 | 0.8347（93.2%） | 0.9372（98.9%） |
| 128 | 0.7888（88.0%） | 0.9058（95.5%） |
| 64 | 0.6852（76.5%） | 0.8758（92.4%） |

</details>

1024 和 2048 维之间的差距很小（0.946 vs. 0.948），所以我在配置中将模型保存时设置了 `truncate_dim=1024`。这意味着 `SentenceTransformer("tomaarsen/Qwen3-VL-Embedding-2B-vdr")` 默认生成 1024 维的嵌入，与完整的 2048 维相比，存储空间减少了一半。如果你想要不同的维度，可以在加载时传入 `truncate_dim=N` 来覆盖它。

## 训练多模态重排序模型

你还可以使用相同的训练基础设施微调多模态 Cross Encoder（重排序）模型。关键区别在于使用 [`CrossEncoderTrainer`](https://sbert.net/docs/package_reference/cross_encoder/trainer.html#sentence_transformers.cross_encoder.trainer.CrossEncoderTrainer) 和 Cross Encoder 专用的损失函数。本节提供简要概述；请参阅[完整训练示例](https://github.com/huggingface/sentence-transformers/tree/main/examples/cross_encoder/training/multimodal)以获取包含数据集准备和评估的完整可运行脚本。

以下是基于[涂鸦训练脚本](https://github.com/huggingface/sentence-transformers/blob/main/examples/cross_encoder/training/multimodal/training_doodles_any_to_any.py)的简化示例，该脚本训练一个重排序器来匹配图像与文本标题：

```python
from sentence_transformers.cross_encoder import CrossEncoder
from sentence_transformers.cross_encoder.losses import BinaryCrossEntropyLoss
from sentence_transformers.cross_encoder.modules import LogitScore, Transformer
from sentence_transformers.cross_encoder.trainer import CrossEncoderTrainer
from sentence_transformers.cross_encoder.training_args import CrossEncoderTrainingArguments

# 1. 从模块构建模型
transformer = Transformer(
    "Qwen/Qwen3.5-0.8B",
    transformer_task="any-to-any",
    model_kwargs={"torch_dtype": "bfloat16", "device_map": "auto", "attn_implementation": "flash_attention_2"},
    processing_kwargs={"chat_template": {"add_generation_prompt": True}},
)

# 扩展聊天模板以支持 "query" 和 "document" 角色
transformer.processor.chat_template = transformer.processor.chat_template.replace(
    'message.role == "user"', 'message.role in ["user", "query", "document"]'
)

# LogitScore：分数 = log(P("1")) - log(P("0"))
score_head = LogitScore(
    true_token_id=transformer.tokenizer.convert_tokens_to_ids("1"),
    false_token_id=transformer.tokenizer.convert_tokens_to_ids("0"),
)

model = CrossEncoder(
    modules=[transformer, score_head],
    num_labels=1,
    prompts={
        "image_to_text": "Given the image, judge whether the text matches it. Respond with 1 if they match, 0 if they don't.",
        "text_to_image": "Given the text, judge whether the image matches it. Respond with 1 if they match, 0 if they don't.",
    },
)

# 2. 定义损失
loss = BinaryCrossEntropyLoss(model)

# 3. 使用独立方向进行多数据集训练
trainer = CrossEncoderTrainer(
    model=model,
    args=args,
    train_dataset={"image_to_text": train_image_to_text, "text_to_image": train_text_to_image},
    eval_dataset={"image_to_text": eval_image_to_text, "text_to_image": eval_text_to_image},
    loss=loss,
    evaluator=[image_to_text_evaluator, text_to_image_evaluator],
)
trainer.train()
```

多模态重排序器有多种有效的架构选择，包括：

1. Any-to-Any + LogitScore：使用多模态语言模型生成一个 token，然后计算"1"与"0"的对数概率比。
2. 特征提取 + 池化 + Dense：仅使用多模态基础模型，提取最后一个 token 的隐藏状态并通过 Dense 层投影为分数，避免语言建模头的计算。

这两种方法都在[多模态 cross encoder 训练示例](https://github.com/huggingface/sentence-transformers/tree/main/examples/cross_encoder/training/multimodal)中进行了演示。

上面链接的两个脚本将训练数据分为两个数据集，每个方向一个（图像到文本和文本到图像），每个方向都有一个特定任务的提示，告诉模型如何在该方向上进行评分。然后将每个正样本对用随机采样的负样本扩展，使损失看到匹配和不匹配的平衡混合。

## 附加资源

### 历史博客

- [《使用 Sentence Transformers 的多模态嵌入与重排序模型》](https://huggingface.co/blog/multimodal-sentence-transformers)：多模态推理
- [《使用 Sentence Transformers v3 训练和微调嵌入模型》](https://huggingface.co/blog/train-sentence-transformers)：训练嵌入模型
- [《使用 Sentence Transformers v4 训练和微调重排序模型》](https://huggingface.co/blog/train-reranker)：训练重排序模型
- [《使用 Sentence Transformers v5 训练和微调稀疏嵌入模型》](https://huggingface.co/blog/train-sparse-encoder)：训练稀疏嵌入模型

### 训练示例

Sentence Transformers 仓库包含几个多模态训练示例：

- [视觉文档检索](https://github.com/huggingface/sentence-transformers/blob/main/examples/sentence_transformer/training/multimodal/training_visual_document_retrieval.py)：本博客文章中用于微调基于 VLM 的文档截图检索嵌入模型的训练脚本
- [多模态重排序器（Any-to-Any）](https://github.com/huggingface/sentence-transformers/blob/main/examples/cross_encoder/training/multimodal/training_doodles_any_to_any.py)：使用 LogitScore 训练多模态重排序器
- [多模态重排序器（特征提取）](https://github.com/huggingface/sentence-transformers/blob/main/examples/cross_encoder/training/multimodal/training_doodles_feature_extraction.py)：使用 Pooling + Dense 训练多模态重排序器

### 文档

此外，以下页面可能有助于了解更多关于 Sentence Transformers 训练的内容：

- [Sentence Transformer > 训练概述](https://sbert.net/docs/sentence_transformer/training_overview.html)
- [Sentence Transformer > 损失概述](https://sbert.net/docs/sentence_transformer/loss_overview.html)
- [Cross Encoder > 训练概述](https://sbert.net/docs/cross_encoder/training_overview.html)
- [Cross Encoder > 损失概述](https://sbert.net/docs/cross_encoder/loss_overview.html)
- [数据集概述](https://sbert.net/docs/sentence_transformer/dataset_overview.html)
- [API 参考](https://sbert.net/docs/package_reference/sentence_transformer/index.html)

## 引用

- 原文：[Training and Finetuning Multimodal Embedding & Reranker Models with Sentence Transformers](https://huggingface.co/blog/train-multimodal-sentence-transformers)
- [Sentence Transformers 官方文档](https://sbert.net/)
- [tomaarsen/Qwen3-VL-Embedding-2B-vdr 模型](https://huggingface.co/tomaarsen/Qwen3-VL-Embedding-2B-vdr)
