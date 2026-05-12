---
title: 使用 Amazon Nova 多模态 Embeddings 实现制造业智能
pubDatetime: 2026-05-12T10:30:00+08:00
description: 本文介绍如何使用 Amazon Nova 多模态 Embeddings 和 Amazon S3 Vectors 为航空航天制造文档构建多模态检索系统，并与纯文本管道进行评估对比。
slug: manufacturing-intelligence-nova-multimodal-embeddings-zh
originalTitle: "Manufacturing Intelligence with Amazon Nova Multimodal Embeddings"
originalUrl: https://aws.amazon.com/blogs/machine-learning/manufacturing-intelligence-with-amazon-nova-multimodal-embeddings/
---

原文标题：Manufacturing Intelligence with Amazon Nova Multimodal Embeddings<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/manufacturing-intelligence-with-amazon-nova-multimodal-embeddings/

# 使用 Amazon Nova Multimodal Embeddings 实现制造业智能

如果您从事航空航天、汽车或重工业制造，您的组织很可能维护着庞大的技术文档库。这些文档将书面规范与工程图纸、CAD 图纸、检验照片、热分析图和疲劳曲线相结合。关于喷嘴喉部最高壁温的文本查询，其答案可能锁定在热等值线图中，而非书面文字里。纯文本检索系统无法检索到这些信息，因为它们看不到图像内容。

[Amazon Nova Multimodal Embeddings](https://aws.amazon.com/blogs/aws/amazon-nova-multimodal-embeddings-now-available-in-amazon-bedrock/) 通过将文本、图像和文档页面映射到共享向量空间来填补这一空白。文本查询可以检索工程图纸，图像查询可以检索书面规范，因为两种模态共享同一坐标系。

本文使用 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 上的 Amazon Nova Multimodal Embeddings 和 [Amazon S3 Vectors](https://aws.amazon.com/s3/features/vectors/) 为航空航天制造文档构建多模态检索系统。我们在 26 个制造业查询上对系统进行评估，并比较纯文本管道与多模态管道的生成质量。

## 多模态检索对制造业的重要性

大多数制造文档结合了文本、图纸和图像。一份工单可能包含书面装配程序，同时附有已完成步骤的注释照片。检验报告将合格/不合格测量结果与焊接接头的射线照片配对。材料认证同时包含机械性能表格和 S-N 疲劳曲线，工程师必须在设计评审时参考这些内容。

考虑本文数据集中视觉信息的几个具体示例：扭矩规格表被描绘在工程图纸内部，而不是作为独立文本存储。彩色热等值线图用于可视化火箭发动机喷嘴上的峰值温度。制造工艺流程图通过决策菱形和彩色关口以视觉方式标注质量控制点，相关的循环时间以注释形式出现在图表本身上。

纯文本检索系统通过 OCR 提取文本来处理这些文档，然后对提取的字符串进行嵌入和索引。当答案出现在文档的书面部分时，这种方法是有效的，但纯文本系统会遗漏图纸中的空间关系、检验图像中的视觉模式，以及图表和图形中编码的定量信息。当您搜索涡轮泵中使用的轴承类型时，答案可能以标注引线的形式出现在截面图上，而 OCR 要么误读，要么剥离其空间上下文。

Multimodal Embeddings 采用不同的方法。模型不是将图像转换为文本再进行嵌入，而是直接处理图像并在与文本嵌入相同的空间中生成向量。关于涡轮泵轴承的文本查询可以基于视觉理解与我们数据集中的截面图匹配，而不仅仅依赖 OCR 设法提取的文本。

## Amazon Nova Multimodal Embeddings 概述

[Amazon Nova Multimodal Embeddings](https://docs.aws.amazon.com/nova/latest/nova2-userguide/embeddings.html) 在 Amazon Bedrock 中提供，可为文本、图像和多页文档生成嵌入。文本、图像和文档模态投影到单一共享向量空间中，这意味着您可以直接计算文本嵌入与图像嵌入之间的 cosine similarity。

您可以配置 256、384、1024 或 3072 的嵌入维度。更高的维度可捕获更多语义细节，但相似性搜索需要更多存储和计算资源。本文的评估使用 1024 维，作为检索质量和成本之间的实际平衡。该模型还支持 `DOCUMENT_IMAGE` 详细级别，这是一种专为包含混合内容（如图表、表格和注释图纸）的页面设计的处理模式。

对于检索工作负载，模型接受设置为 `GENERIC_INDEX`（用于被索引的文档）或 `GENERIC_RETRIEVAL`（用于查询）的 `purpose` 参数。这种非对称嵌入方法改进了用于检索的向量空间，无需手动格式化查询。

## 解决方案概述

我们在同一数据集上构建了两个并行检索管道，以比较其下游生成质量。

**数据集 –** 15 张独立技术图像（CAD 图纸、检验报告、测试图表、材料规范、工艺流程图）和五个多页 PDF（装配程序、热点火测试报告、工程变更通知、材料认证、不符合报告）。这些文档包含合成的航空航天制造数据。

**管道 A，多模态 –** 使用 Amazon Nova Multimodal Embeddings 直接嵌入每张图像，并将每个 PDF 页面作为文档图像嵌入，然后导入 Amazon Simple Storage Service（Amazon S3）Vectors 索引。

**管道 B，纯文本基线 –** 将每张图像和 PDF 页面发送到 Amazon Nova 2 Lite 进行 OCR 文本提取，使用 Amazon Nova Multimodal Embeddings（纯文本输入）嵌入提取的文本，然后导入单独的 Amazon S3 Vectors 索引。OCR 步骤使用以下提示：

```json
Note: OCR prompt for text extraction
"Extract ALL visible text from this image exactly as it appears. Include all numbers, labels, annotations, table contents, headers, and footnotes. Preserve the structure (tables, lists, sections) as much as possible. Return only the extracted text, no commentary."
```

**评估 –** 针对多模态索引运行 26 个制造业查询，获取检索指标（Recall@K、Mean Reciprocal Rank (MRR)、NDCG@K）。然后，对两条管道分别检索上下文并使用 Amazon Nova 2 Lite 生成答案，通过大型语言模型（LLM）评判器对每个答案与基准答案进行评分。

下图展示了端到端的管道架构。源文档经过两条并行路径：管道 A 使用 Amazon Nova Multimodal Embeddings 直接嵌入图像，而管道 B 在嵌入之前通过 OCR 提取文本。两条管道都将向量存储在 Amazon S3 Vectors 中。在查询时，检索到的上下文被输入 Amazon Nova 2 Lite 进行答案生成，LLM 评判器将每个答案与基准答案进行评分。

[![Pipeline architecture](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-1.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-1.png)

下图展示了数据集中的三个示例文档。从左到右依次为：喷嘴组件 CAD 图纸、焊接检验报告和 Inconel 718 疲劳 S-N 曲线。每种文档类型都呈现了仅靠文本提取难以捕获的信息。

[![Sample documents](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-2.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-2.png)

## 解决方案详解

本节介绍关键实现步骤，从生成嵌入到构建向量索引和运行查询。完整代码可在 [GitHub 的配套笔记本](https://github.com/aws-samples/amazon-nova-samples/tree/main/multimodal-embeddings/repeatable-patterns/manufacturing-intelligence-nova-mme) 中获取。

### 前提条件

要跟随本文操作，您需要在 AWS 账户中配置以下资源和访问权限：

- 具有访问 `us-east-1` 区域 Amazon Bedrock 权限的 AWS 账户
- 已启用 `amazon.nova-2-multimodal-embeddings-v1:0` 和 `us.amazon.nova-2-lite-v1:0` 的模型访问权限
- Amazon SageMaker AI 笔记本实例或本地 Python 环境
- Python 3.10+ 及 `boto3`、`numpy`、`pandas`、`matplotlib`、`Pillow`、`pdf2image` 和 `tqdm`
- 用于 Amazon Bedrock `InvokeModel`、Amazon S3 和 Amazon S3 Vectors API 的 IAM 权限

本文中的示例代码仅供教育目的，未经过生产环境使用审查。在部署到生产环境之前，请根据您组织的安全要求对其进行审查和测试。

### 生成多模态嵌入

为制造业图像生成嵌入只需要对 Amazon Bedrock 进行一次 `InvokeModel` 调用。请求指定图像字节、所需嵌入维度和详细级别。对于 CAD 图纸等独立图像，我们使用 `STANDARD_IMAGE`。对于包含混合文本和图形的 PDF 页面，`DOCUMENT_IMAGE` 会产生更好的结果，因为模型对表格和图表内容应用了额外处理。

```python
import base64, json, boto3

bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "amazon.nova-2-multimodal-embeddings-v1:0"

with open("dataset/nozzle_assembly_diagram.png", "rb") as f:
    b64_data = base64.b64encode(f.read()).decode("utf-8")

request_body = {
    "taskType": "SINGLE_EMBEDDING",
    "singleEmbeddingParams": {
        "embeddingPurpose": "GENERIC_INDEX",
        "embeddingDimension": 1024,
        "image": {
            "format": "png",
            "detailLevel": "STANDARD_IMAGE",
            "source": {"bytes": b64_data},
        },
    },
}

response = bedrock_runtime.invoke_model(
    modelId=MODEL_ID,
    body=json.dumps(request_body),
    accept="application/json",
    contentType="application/json",
)
embedding = json.loads(response["body"].read())["embeddings"][0]["embedding"]
print(f"Embedding dimension: {len(embedding)}")  # 1024
```

### 构建 Amazon S3 Vectors 索引

Amazon S3 Vectors 提供托管向量存储和查询层。我们创建一个向量桶和一个配置为 cosine similarity 的索引，然后以 50 个为一批导入嵌入。

```python
s3vectors = boto3.client("s3vectors", region_name="us-east-1")

# Create vector bucket and index
s3vectors.create_vector_bucket(vectorBucketName="manufacturing-vectors")
s3vectors.create_index(
    vectorBucketName="manufacturing-vectors",
    indexName="manufacturing-multimodal",
    dataType="float32",
    dimension=1024,
    distanceMetric="cosine",
)

# Ingest a batch of embeddings with metadata
vectors = [
    {
        "key": "img-nozzle_assembly_diagram",
        "data": {"float32": embedding},
        "metadata": {
            "source_file": "nozzle_assembly_diagram.png",
            "type": "image",
        },
    }
]
s3vectors.put_vectors(
    vectorBucketName="manufacturing-vectors",
    indexName="manufacturing-multimodal",
    vectors=vectors,
)
```

### 查询索引

在查询时，我们使用 `GENERIC_RETRIEVAL` 目的生成文本嵌入，然后调用 `query_vectors` 检索最相似的文档。`GENERIC_RETRIEVAL` 目的告诉模型改进用于查询-文档匹配的嵌入。

```python
query = "What is the torque specification for the chamber flange bolts?"

request_body = {
    "taskType": "SINGLE_EMBEDDING",
    "singleEmbeddingParams": {
        "embeddingPurpose": "GENERIC_RETRIEVAL",
        "embeddingDimension": 1024,
        "text": {"truncationMode": "END", "value": query},
    },
}
response = bedrock_runtime.invoke_model(
    modelId=MODEL_ID, body=json.dumps(request_body),
    accept="application/json", contentType="application/json",
)
query_embedding = json.loads(response["body"].read())["embeddings"][0]["embedding"]

results = s3vectors.query_vectors(
    vectorBucketName="manufacturing-vectors",
    indexName="manufacturing-multimodal",
    queryVector={"float32": query_embedding},
    topK=5,
    returnDistance=True,
    returnMetadata=True,
)
for v in results["vectors"]:
    print(f"  {v['key']}  (distance: {v['distance']:.4f})")
```

该查询将扭矩规格图像和法兰螺栓图案图作为排名靠前的结果检索出来，两者都包含答案。纯文本系统需要 OCR 提取能够正确捕获工程图纸中的扭矩值，但对于复杂技术图纸来说这并不总是可靠的。

## 评估方法

我们分两个阶段评估系统：检索质量（系统是否找到了正确的文档？）和生成质量（语言模型能否根据检索到的上下文给出正确答案？）。评估数据集包含从航空航天制造文档中衍生的 26 个查询，每个查询都有基准相关文档 ID 和参考答案。以下小节描述每个阶段的工作方式。

### 检索评估

对于每个查询，我们使用 `GENERIC_RETRIEVAL` 目的生成文本嵌入，查询多模态 S3 Vectors 索引，并将返回的文档与基准相关文档 ID 进行比较。

```python
query = "What is the torque specification for the chamber flange bolts?"
query_embed = generate_text_embedding(
    query, dim=1024, purpose="GENERIC_RETRIEVAL"
)

results = s3vectors.query_vectors(
    vectorBucketName="manufacturing-vectors",
    indexName="manufacturing-multimodal",
    queryVector={"float32": query_embed},
    topK=10,
    returnDistance=True,
    returnMetadata=True,
)
retrieved_ids = [v["key"] for v in results["vectors"]]
```

我们在 K=3、5 和 10 时计算三个指标：**Recall@K**（在前 K 个结果中找到的相关文档比例）、**MRR**（衡量第一个相关结果出现的位置）和 **NDCG@K**（Normalized Discounted Cumulative Gain，当相关文档排名更靠前时给予更多加分）。

### 使用 LLM 评判器进行生成评估

对于生成评估，两条管道各自检索每个查询的前五个结果。多模态管道将检索到的图像直接作为多模态上下文传递给 Amazon Nova 2 Lite。纯文本管道将 OCR 提取的文本作为字符串上下文传递。

```python
def generate_answer_multimodal(query, retrieved_keys):
    """Pass retrieved images directly as multimodal context."""
    content_blocks = []
    for key in retrieved_keys[:5]:
        img_path = vector_key_to_image_path(key)
        with open(img_path, "rb") as f:
            img_bytes = f.read()
        content_blocks.append({"text": f"Retrieved document:"})
        content_blocks.append({
            "image": {"format": "png", "source": {"bytes": img_bytes}}
        })
    content_blocks.append({
        "text": (
            f"Review each image above carefully. "
            f"Answer the following question concisely and precisely.\n\n"
            f"Question: {query}\n\nAnswer:"
        )
    })
    response = bedrock_runtime.converse(
        modelId="us.amazon.nova-2-lite-v1:0",
        messages=[{"role": "user", "content": content_blocks}],
        inferenceConfig={"maxTokens": 500, "temperature": 0.1},
    )
    return response["output"]["message"]["content"][0]["text"]
```

每个生成的答案都使用 Anthropic Claude Sonnet 4.5 作为 LLM 评判器与基准参考进行评分。评判器接收查询、基准答案和生成答案，然后给出 1–5 分的评分并附简短说明。

```python
def judge_correctness(query, generated_answer, ground_truth):
    prompt = (
        "You are an evaluation judge. Score the generated answer compared "
        "to the ground truth on a scale of 1-5.\n\n"
        "1 = Completely wrong or irrelevant\n"
        "2 = Partially relevant but mostly incorrect\n"
        "3 = Somewhat correct but missing key information\n"
        "4 = Mostly correct with minor omissions\n"
        "5 = Fully correct and complete\n\n"
        f"Question: {query}\n"
        f"Ground Truth: {ground_truth}\n"
        f"Generated Answer: {generated_answer}\n\n"
        'Respond with ONLY a JSON object: '
        '{"score": <1-5>, "reason": "<brief explanation>"}'
    )
    response = bedrock_runtime.converse(
        modelId="us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 200, "temperature": 0.0},
    )
    return response["output"]["message"]["content"][0]["text"]
```

通过分别评估检索和生成，您可以精确定位每条管道成功或失败的位置。管道可能检索到了正确的文档，但如果生成器无法从所提供的上下文格式中提取信息，仍然可能产生错误答案。

## 评估结果

我们在从航空航天制造数据集衍生的 26 个查询上评估了多模态管道。每个查询都有一个或多个基准相关文档 ID。检索指标衡量系统在不同 K 值（返回结果数量）下检索正确文档的能力。

### 多模态检索指标

多模态管道在 K=5 时实现了 90% 的召回率，这意味着它在前五个结果中检索到了大多数相关文档，在 K=10 时上升至 96%。MRR 为 0.92，表明第一个相关结果通常出现在第 1 位。在 K=10 时召回率低于 1.0 的两个查询涉及相关信息分散在 PDF 和独立图像中的文档，其中一个相关来源出现在前 10 名之外。

下图展示了 K=3、5 和 10 时的多模态检索指标。MRR 衡量第一个相关结果出现的位置。Recall@K 衡量在前 K 个结果中找到的相关文档比例。NDCG@K 衡量排名质量，当相关文档出现在列表更靠前的位置时给予更多加分。

[![Retrieval metrics chart](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-3.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-3.png)

### 生成质量：纯文本 vs. 多模态

*检索指标* 衡量系统是否找到了正确的文档。*生成指标* 衡量下游语言模型能否从检索到的上下文中生成正确答案。我们将每条管道检索到的前五个结果传递给 Amazon Nova 2 Lite 进行答案生成，然后使用 Anthropic Claude Sonnet 4.5 作为 LLM 评判器按 1–5 分制对每个答案与基准答案进行评分。

| 管道 | 平均评判分数 | 归一化（0–1） |
|---|---|---|
| 多模态（MME） | **4.88 / 5** | **0.977** |
| 纯文本（OCR） | 2.00 / 5 | 0.400 |

*表 2：LLM 评判器评分的生成质量。多模态管道直接将图像传递给生成器，而纯文本管道传递 OCR 提取的文本。*

多模态管道在 88% 的查询（26 个中的 23 个）中得分更高，平均 4.88/5。纯文本管道平均 2.00 分，26 个查询中有 17 个得分为 1（完全错误）。热分析等值线图、疲劳曲线、工艺流程图和 CAD 标注标签等视觉内容显示出最大的改进。对于两条管道都得分较好（4 或 5）的少数查询，答案恰好以 OCR 能可靠捕获的清晰格式化文本出现，例如表格布局中的材料名称或数值。

下图展示了两条管道的 LLM 评判分数（1–5）分布。多模态管道集中在 5 分，而纯文本管道对于需要视觉内容理解的查询集中在 1 分。

[![LLM judge scores distribution](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-4.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/ML-20830-image-4.png)

这些结果表明，检索质量直接影响答案质量。当系统检索到正确的文档但只将 OCR 文本传递给生成器时，它会丢失答案所依赖的视觉信息。多模态管道通过将原始图像传递给多模态生成器，避免了这种有损转换。

### 实现复杂度与成本

除了准确性之外，多模态管道构建更简单，运行成本也更低。纯文本管道每个文档需要两次模型调用（一次用于 OCR 文本提取，一次用于文本嵌入），加上针对不同文档布局的提示工程。多模态管道每个文档只需要一次嵌入调用，无需中间提取步骤，将实现复杂度和每文档导入成本大约降低了一半。

## 清理

为避免持续产生费用，请在完成评估后删除 S3 Vectors 索引和桶。[GitHub 上的配套笔记本](https://github.com/aws-samples/amazon-nova-samples/tree/main/multimodal-embeddings/repeatable-patterns/manufacturing-intelligence-nova-mme) 包含这些清理命令（出于安全考虑已注释掉）。以下代码片段展示了如何删除索引和向量桶：

```python
# Delete indexes
s3vectors.delete_index(vectorBucketName=S3_VECTOR_BUCKET, indexName=MME_INDEX)
s3vectors.delete_index(vectorBucketName=S3_VECTOR_BUCKET, indexName=TEXT_ONLY_INDEX)

# Delete vector bucket
s3vectors.delete_vector_bucket(vectorBucketName=S3_VECTOR_BUCKET)
```

Amazon Bedrock 嵌入推理按请求计费，无需管理持久基础设施。

## 总结

Multimodal Embeddings 填补了纯文本系统无法解决的检索空白，适用于包含大量视觉内容的文档集合。在本文的航空航天制造数据集上，多模态管道在 K=5 时实现了 90% 的召回率（K=10 时为 96%），生成质量接近完美（4.88/5），而纯文本管道得分为 2.00/5，原因在于 OCR 无法可靠地捕获工程图纸、热分析图和工艺流程图中的信息。

借助 Amazon Bedrock 上的 Amazon Nova Multimodal Embeddings，您无需管理嵌入模型基础设施即可构建此功能。Amazon S3 Vectors 提供向量存储和查询层，无需集群管理或容量规划。

要亲自尝试，请从 [GitHub 克隆配套代码示例](https://github.com/aws-samples/amazon-nova-samples/tree/main/multimodal-embeddings/repeatable-patterns/manufacturing-intelligence-nova-mme) 并在 Amazon SageMaker AI 或本地环境中运行。您可以通过替换示例数据集和查询，将管道适配到您自己的制造文档。有关更多模式和示例，请参阅以下资源：

- [Amazon Nova Multimodal Embeddings 文档](https://docs.aws.amazon.com/nova/latest/nova2-userguide/embeddings.html)
- [使用 Amazon Nova Multimodal Embeddings 进行跨模态搜索](https://aws.amazon.com/blogs/machine-learning/crossmodal-search-with-amazon-nova-multimodal-embeddings/)
- [Amazon Nova Multimodal Embeddings 技术报告](https://www.amazon.science/publications/amazon-nova-multimodal-embeddings-technical-report-and-model-card)
- [Amazon S3 Vectors 文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)

---

## 关于作者

[![Adewale Akinfaderin](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2025/03/06/wale_picture_blog.png)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2025/03/06/wale_picture_blog.png)

**Adewale Akinfaderin** 是 Amazon Bedrock 生成式 AI 高级数据科学家，致力于 AWS 基础模型和生成式 AI 应用的前沿创新。他的专长在于可复现的端到端 AI/ML 方法、实际实现，以及帮助全球客户制定和开发跨学科问题的可扩展解决方案。他拥有两个物理学研究生学位和一个工程学博士学位。

[![Matthew Lydon](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/mattlydon.jpeg)](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/05/06/mattlydon.jpeg)

**Matthew Lydon** 是 Amazon Web Services 航空航天与卫星团队的解决方案架构师。他曾为超过 1,000 家航空航天客户提供支持，从立方星初创公司到重型运载火箭制造商。他的技术重点包括针对 ITAR 受限工作负载的安全 AI 实施、发动机测试数据处理、工程仿真 HPC 以及卫星图像处理。Matthew 负责领导面向航空航天行业的生成式 AI 研讨会。

---

## 引用

- 原文：[Manufacturing Intelligence with Amazon Nova Multimodal Embeddings](https://aws.amazon.com/blogs/machine-learning/manufacturing-intelligence-with-amazon-nova-multimodal-embeddings/)
- [Amazon Nova Multimodal Embeddings documentation](https://docs.aws.amazon.com/nova/latest/nova2-userguide/embeddings.html)
- [Amazon S3 Vectors documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- [Companion notebook on GitHub](https://github.com/aws-samples/amazon-nova-samples/tree/main/multimodal-embeddings/repeatable-patterns/manufacturing-intelligence-nova-mme)
