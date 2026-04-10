---
title: "使用 Sentence Transformers 的多模态嵌入与重排序模型"
pubDatetime: 2026-04-10T12:00:00+08:00
description: "了解如何使用新的多模态 Sentence Transformers v5.4 进行跨模态搜索和检索"
slug: multimodal-embedding-reranker-sentence-transformers
originalTitle: "Multimodal Embedding & Reranker Models with Sentence Transformers"
originalUrl: "https://huggingface.co/blog/multimodal-sentence-transformers"
---

> 原文标题：Multimodal Embedding & Reranker Models with Sentence Transformers
> 原文链接：https://huggingface.co/blog/multimodal-sentence-transformers

# 使用 Sentence Transformers 的多模态嵌入与重排序模型

**使用相同的熟悉 API 编码和比较文本、图像、音频和视频**。在这篇博客文章中，我将展示如何使用这些新的多模态功能进行嵌入和重排序。

多模态嵌入模型将来自不同模态的输入映射到共享的嵌入空间，而多模态重排序模型对混合模态对的相关性进行评分。这开启了如视觉文档检索、跨模态搜索和多模态 RAG 管道等用例。

## 目录

- 什么是多模态模型？
- 安装
- 多模态嵌入模型
- 多模态重排序模型
- 检索和重排序
- 输入格式和配置
- 支持的模型
- 其他资源

## 什么是多模态模型？

传统的嵌入模型将文本转换为固定大小的向量。多模态嵌入模型通过将来自不同模态（文本、图像、音频或视频）的输入映射到共享的嵌入空间来扩展这一功能。这意味着您可以使用您已经熟悉的相同相似性函数比较文本查询与图像文档（或反之）。

类似地，传统的重排序（交叉编码器）模型计算文本对之间的相关性得分。多模态重排序器可以对一个或两个元素都是图像、组合文本-图像文档或其他模态的对进行评分。

例如，您可以比较文本查询与图像文档、查找与描述匹配的视频剪辑，或构建跨模态的 RAG 管道。

## 安装

多模态模型需要一些额外的依赖项。根据您需要的模态安装额外依赖项（有关更多详细信息，请参阅安装）：

```
# 对于图像支持
pip install -U "sentence-transformers[image]"
# 对于音频支持
pip install -U "sentence-transformers[audio]"
# 对于视频支持
pip install -U "sentence-transformers[video]"
# 混合搭配
pip install -U "sentence-transformers[image,video,train]"
```

基于 VLM 的模型（如 Qwen3-VL-2B）需要至少约 8 GB VRAM 的 GPU。对于 8B 变体，预计需要约 20 GB。如果您没有本地 GPU，请考虑使用云 GPU 服务或 Google Colab。在 CPU 上，这些模型会非常慢；纯文本或 CLIP 模型更适合 CPU 推理。

## 多模态嵌入模型

### 加载模型

加载多模态嵌入模型的工作方式与加载纯文本模型完全相同：

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
```

`revision` 参数目前是必需的，因为这些模型的集成拉取请求仍在待处理中。一旦合并，您将能够在不指定 revision 的情况下加载它们。

模型自动检测它支持的模态，因此无需额外配置。如果要控制图像分辨率或模型精度等内容，请参阅处理器和模型 kwargs。

### 编码图像

加载多模态模型后，`model.encode()` 接受文本旁边的图像。图像可以作为 URL、本地文件路径或 PIL Image 对象提供（有关所有接受的格式，请参阅支持的输入类型）：

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
# 从 URL 编码图像
img_embeddings = model.encode([
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg",
])
print(img_embeddings.shape)
# (2, 2048)
```

### 跨模态相似性

由于模型将两者都映射到同一空间，您可以计算文本嵌入和图像嵌入之间的相似性：

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
# 编码图像
img_embeddings = model.encode([
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg",
])
# 编码文本查询（每个图像一个匹配和一个硬负样本）
text_embeddings = model.encode([
"A green car parked in front of a yellow building",
"A red car driving on a highway",
"A bee on a pink flower",
"A wasp on a wooden table",
])
# 计算跨模态相似性
similarities = model.similarity(text_embeddings, img_embeddings)
print(similarities)
# tensor([[0.5115, 0.1078],
# [0.1999, 0.1108],
# [0.1255, 0.6749],
# [0.1283, 0.2704]])
```

如预期所示，"黄色建筑前停着的绿色汽车"与汽车图像最相似（0.51），"粉红色花上的蜜蜂"与蜜蜂图像最相似（0.67）。硬负样本（"在高速公路上行驶的红色汽车"、"木桌上的黄蜂"）正确地收到了较低的得分。

您可能会注意到，即使最佳匹配分数（0.51、0.67）也不是很接近 1.0。这是由于模态差距：来自不同模态的嵌入往往聚集在空间的不同区域。跨模态相似性通常低于模态内相似性（例如，文本到文本），但相对排序得到保留，因此检索仍然可以很好地工作。

### 编码查询和文档

对于检索任务，`encode_query()` 和 `encode_document()` 是推荐的方法。许多检索模型会根据输入是查询还是文档预添加不同的指令提示，类似于聊天模型如何根据目标应用不同的系统提示。模型作者可以在模型配置中指定他们的提示，而 `encode_query()` / `encode_document()` 会自动加载并应用正确的提示。

`encode_query()` 使用模型的 `"query"` 提示（如果可用）并设置 `task="query"`。`encode_document()` 使用 `"document"`、`"passage"` 或 `"corpus"` 中的第一个可用提示，并设置 `task="document"`。

在幕后，两者都是 `encode()` 的薄包装，它们只是为您处理提示选择。以下是跨模态检索的样子：

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
# 用查询提示编码文本查询
query_embeddings = model.encode_query([
"Find me a photo of a vehicle parked near a building",
"Show me an image of a pollinating insect",
])
# 用文档提示编码文档屏幕截图
doc_embeddings = model.encode_document([
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg",
])
# 计算相似性
similarities = model.similarity(query_embeddings, doc_embeddings)
print(similarities)
# tensor([[0.3907, 0.1490],
# [0.1235, 0.4872]])
```

这些方法接受与 `encode()` 相同的输入类型（图像、URL、多模态字典等），并传递相同的参数。对于没有专门查询/文档提示的模型，它们的行为与 `encode()` 相同。

## 多模态重排序模型

多模态重排序（CrossEncoder）模型对输入对之间的相关性进行评分，其中每个元素可以是文本、图像、音频、视频或组合。它们的质量往往优于嵌入模型，但由于它们单独处理每一对而速度较慢。当前可用的预训练多模态重排序器主要关注文本和图像输入，但架构支持底层模型可以处理的任何模态。

### 排序混合模态文档

`rank()` 方法对查询的文档列表进行评分和排序，支持混合模态：

```
from sentence_transformers import CrossEncoder
model = CrossEncoder("Qwen/Qwen3-VL-Reranker-2B", revision="refs/pr/11")
query = "A green car parked in front of a yellow building"
documents = [
# 图像文档（URL 或本地文件路径）
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg",
# 文本文档
"A vintage Volkswagen Beetle painted in bright green sits in a driveway.",
# 组合文本 + 图像文档
{
"text": "A car in a European city",
"image": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
},
]
rankings = model.rank(query, documents)
for rank in rankings:
print(f"{rank['score']:.4f}\t(document {rank['corpus_id']})")
"""
0.9375 (document 0)
0.5000 (document 3)
-1.2500 (document 2)
-2.4375 (document 1)
"""
```

重排序器正确地识别汽车图像（文档 0）为最相关的结果，其次是关于欧洲城市中汽车的组合文本+图像文档（文档 3）。蜜蜂图像（文档 1）得分最低。请记住，模态差距可能会影响绝对得分：文本-图像对得分可能占据与文本-文本或图像-图像对得分不同的范围。

您也可以使用 `modalities` 和 `supports()` 检查重排序器支持的模态，就像嵌入模型一样：

```
print(model.modalities)
# ['text', 'image', 'video', 'message']
print(model.supports("image"))
# True
# 检查模型是否支持特定的模态对
print(model.supports(("image", "text")))
# True
```

### 预测对得分

您也可以使用 `predict()` 获取特定输入对的原始相关性分数：

```
from sentence_transformers import CrossEncoder
model = CrossEncoder("jinaai/jina-reranker-m0", trust_remote_code=True)
scores = model.predict([
("A green car", "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg"),
("A bee on a flower", "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg"),
("A green car", "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg"),
])
print(scores)
# [0.9389156 0.96922314 0.46063158]
```

## 检索和重排序

一个常见的模式是使用嵌入模型进行快速初始检索，然后用重排序器细化前几个结果：

```
from sentence_transformers import SentenceTransformer, CrossEncoder
# 步骤 1：使用嵌入模型检索
embedder = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
query = "revenue growth chart"
query_embedding = embedder.encode_query(query)
# 预计算语料库嵌入（执行一次，然后存储）
document_screenshots = [
"path/to/doc1.png",
"path/to/doc2.png",
# ... 可能数百万份文档屏幕截图
]
corpus_embeddings = embedder.encode_document(document_screenshots, show_progress_bar=True)
# 简单的余弦相似性检索，只要嵌入能装进内存就可行
similarities = embedder.similarity(query_embedding, corpus_embeddings)
top_k_indices = similarities.argsort(descending=True)[0][:10]
# 步骤 2：使用重排序器模型重排序前 k 个结果
reranker = CrossEncoder("nvidia/llama-nemotron-rerank-vl-1b-v2", trust_remote_code=True)
top_k_documents = [document_screenshots[i] for i in top_k_indices]
rankings = reranker.rank(query, top_k_documents)
for rank in rankings:
print(f"{rank['score']:.4f}\t{top_k_documents[rank['corpus_id']]}")
```

由于语料库嵌入是预先计算的，即使在数百万份文档上初始检索也很快。重排序器随后在较小的候选集上提供更准确的评分。

## 输入格式和配置

### 支持的输入类型

多模态模型接受多种输入格式。以下是您可以传递给 `model.encode()` 的总结：

| 模态 | 接受的格式 |
|---|---|
| 文本 | - 字符串 |
| 图像 | - `PIL.Image.Image` 对象 - 文件路径（例如 `"./photo.jpg"`） - URL（例如 `"https://.../image.jpg"`） - NumPy 数组、torch 张量 |
| 音频 | - 文件路径（例如 `"./audio.wav"`） - URL（例如 `"https://.../audio.wav"`） - NumPy/torch 数组 - 带 `"array"` 和 `"sampling_rate"` 键的字典 - `torchcodec.AudioDecoder` 实例 |
| 视频 | - 文件路径（例如 `"./video.mp4"`） - URL（例如 `"https://.../video.mp4"`） - NumPy/torch 数组 - 带 `"array"` 和 `"video_metadata"` 键的字典 - `torchcodec.VideoDecoder` 实例 |
| 多模态 | - 映射模态名称到值的字典，例如 `{"text": "a caption", "image": "https://.../image.jpg"}` 有效键：`"text"`、`"image"`、`"audio"`、`"video"` |
| 消息 | - 带 `"role"` 和 `"content"` 键的消息字典列表，例如 `[{"role": "user", "content": [...]}]` |

### 检查模态支持

您可以使用 `modalities` 属性和 `supports()` 方法检查模型支持的模态：

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("Qwen/Qwen3-VL-Embedding-2B", revision="refs/pr/23")
# 列出所有支持的模态
print(model.modalities)
# ['text', 'image', 'video', 'message']
# 检查特定的模态
print(model.supports("image"))
# True
print(model.supports("audio"))
# False
```

`"message"` 模态指示模型接受带有交错内容的聊天风格消息输入。实际上，您很少需要直接使用它。当您传递字符串、URL 或多模态字典时，模型会在内部将它们转换为适当的消息格式。Sentence Transformers 支持两种消息格式：

**结构化**（大多数 VLM，例如 Qwen3-VL）：内容是类型化字典的列表，例如 `[{"type": "text", "text": "..."}, {"type": "image", "image": ...}]`

**扁平**（例如 Deepseek-V3）：内容是直接值，例如 `"some text"`

格式从模型的聊天模板中自动检测。

由于所有输入都在内部转换为相同的消息格式，您可以在单个 `encode()` 调用中混合输入类型：

```
embeddings = model.encode([
# 文本输入
"A green car parked in front of a yellow building",
# 图像输入（URL）
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
# 组合文本 + 图像输入
{
"text": "A car in a European city",
"image": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
},
])
```

## 如果您需要传递原始消息输入，请单击此处

如果模型不遵循任何一种格式，您需要完全控制，可以直接传递带 `role` 和 `content` 键的原始消息字典：

```
embeddings = model.encode([
[
{
"role": "user",
"content": [
{"type": "image", "image": "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg"},
{"type": "text", "text": "Describe this vehicle."},
],
}
],
])
```

这绕过了自动格式转换，直接将消息传递给处理器的 `apply_chat_template()`。

### 处理器和模型 kwargs

您可能想要控制图像分辨率限制或模型精度。在加载模型时使用 `processor_kwargs` 和 `model_kwargs`：

```
model = SentenceTransformer(
"Qwen/Qwen3-VL-Embedding-2B",
model_kwargs={"attn_implementation": "flash_attention_2", "torch_dtype": "bfloat16"},
processor_kwargs={"min_pixels": 28 * 28, "max_pixels": 600 * 600},
revision="refs/pr/23",
)
```

`processor_kwargs` 控制输入的预处理方式（例如，图像分辨率限制）。较高的 `max_pixels` 意味着更高的质量但需要更多的内存和计算。这些直接传递给 `AutoProcessor.from_pretrained(...)`。`model_kwargs` 控制底层模型的加载方式（例如，精度、注意力实现）。这些直接传递给适当的 `AutoModel.from_pretrained(...)` 调用（例如，`AutoModel`、`AutoModelForCausalLM`、`AutoModelForSequenceClassification` 等，取决于模型模块的配置）。

有关这些 kwargs 的更多详细信息，请参阅 SentenceTransformer API 参考文档。

在 Sentence Transformers v5.4 中，`tokenizer_kwargs` 已重命名为 `processor_kwargs` 以反映多模态模型使用处理器而不仅仅是分词器的事实。旧名称仍被接受但已弃用。

## 支持的模型

以下是 v5.4 中支持的多模态模型，也可在 v5.4 集成集合中使用：

### 支持的多模态嵌入模型

| 模型 | 参数 | 模态 | Revision |
|---|---|---|---|
| Qwen/Qwen3-VL-Embedding-2B | 2B | 文本、图像、视频 | `revision="refs/pr/23"` |
| Qwen/Qwen3-VL-Embedding-8B | 8B | 文本、图像、视频 | `revision="refs/pr/11"` |
| nvidia/llama-nemotron-embed-vl-1b-v2 | 1.7B | 文本、图像 | 无需 `revision` |
| nvidia/omni-embed-nemotron-3b | 4.7B | 文本、图像 | 无需 `revision` |

### 支持的多模态重排序模型

| 模型 | 参数 | 模态 | Revision |
|---|---|---|---|
| Qwen/Qwen3-VL-Reranker-2B | 2B | 文本、图像、视频 | `revision="refs/pr/11"` |
| Qwen/Qwen3-VL-Reranker-8B | 8B | 文本、图像、视频 | `revision="refs/pr/9"` |
| nvidia/llama-nemotron-rerank-vl-1b-v2 | 2B | 文本、图像 | 无需 `revision` |
| jinaai/jina-reranker-m0 | 2B | 文本、图像 | 无需 `revision` |

### 纯文本重排序模型（也是 v5.4 中的新功能）

| 模型 | 参数 | Revision |
|---|---|---|
| Qwen/Qwen3-Reranker-0.6B | 0.6B | `revision="refs/pr/24"` |
| Qwen/Qwen3-Reranker-4B | 4B | `revision="refs/pr/11"` |
| Qwen/Qwen3-Reranker-8B | 8B | `revision="refs/pr/11"` |
| mixedbread-ai/mxbai-rerank-base-v2 | 0.5B | 无需 `revision` |
| mixedbread-ai/mxbai-rerank-large-v2 | 2B | 无需 `revision` |

## 单击此处查看纯文本重排序器使用示例

```
from sentence_transformers import CrossEncoder
model = CrossEncoder("mixedbread-ai/mxbai-rerank-base-v2")
query = "How do I bake sourdough bread?"
documents = [
"Sourdough bread requires a starter made from flour and water, fermented over several days.",
"The history of bread dates back to ancient Egypt around 8000 BCE.",
"To bake sourdough, mix your starter with flour, water, and salt, then let it rise overnight.",
"Rye bread is a popular alternative to wheat-based breads in Northern Europe.",
]
pairs = [(query, doc) for doc in documents]
scores = model.predict(pairs)
print(scores)
# [ 7.3077507 -2.6217823 8.724761 -2.2488995]
rankings = model.rank(query, documents)
for rank in rankings:
print(f"{rank['score']:.4f}\t{documents[rank['corpus_id']]}")
# 8.7248 To bake sourdough, mix your starter with flour, water, and salt, then let it rise overnight.
# 7.3078 Sourdough bread requires a starter made from flour and water, fermented over several days.
# -2.2489 Rye bread is a popular alternative to wheat-based breads in Northern Europe.
# -2.6218 The history of bread dates back to ancient Egypt around 8000 BCE.
```

### CLIP 模型

较旧的 CLIP 模型继续得到支持：

| 模型 | ImageNet 零样本 Top-1 准确度 | 注释 |
|---|---|---|
| sentence-transformers/clip-ViT-L-14 | 75.4 | |
| sentence-transformers/clip-ViT-B-16 | 68.1 | |
| sentence-transformers/clip-ViT-B-32 | 63.3 | |
| sentence-transformers/clip-ViT-B-32-multilingual-v1 | N/A | 多语言文本编码器，50+ 种语言 |

这些简单的 CLIP 模型在低资源硬件上仍然效果很好。

## 单击此处查看 CLIP 使用示例

```
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("sentence-transformers/clip-ViT-L-14")
images = [
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/transformers/tasks/car.jpg",
"https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/bee.jpg",
"https://huggingface.co/datasets/huggingface/cats-image/resolve/main/cats_image.jpeg"
]
texts = ["A green car", "A bee on a flower", "Some cats on a couch", "One cat sitting in the window"]
image_embeddings = model.encode(images)
text_embeddings = model.encode(texts)
print(image_embeddings.shape, text_embeddings.shape)
# (3, 768) (4, 768)
similarities = model.similarity(image_embeddings, text_embeddings)
print(similarities)
# tensor([[0.2208, 0.1042, 0.0617, 0.0907], # 第一张图像（汽车）最相似于"一辆绿色汽车"
# [0.1205, 0.2303, 0.0632, 0.0917], # 第二张图像（蜜蜂）最相似于"花上的蜜蜂"
# [0.1107, 0.0196, 0.2425, 0.1162]]) # 第三张图像（多只猫）最相似于"沙发上的一些猫"
```

## 其他资源

### 文档

- Sentence Transformer > 使用
- Sentence Transformer > 预训练模型
- Cross Encoder > 使用
- Cross Encoder > 预训练模型
- 安装

### 训练

我将在接下来的几周内发布一篇关于训练和微调多模态模型的博客文章，敬请期待！在此期间，您可以尝试在预训练模型上进行推理，或尝试使用训练文档进行训练：

- Sentence Transformer > 训练概述
- Sentence Transformer > 训练示例
- Cross Encoder > 训练概述
- Cross Encoder > 训练示例
- Sparse Encoder > 训练概述
- Sparse Encoder > 训练示例
