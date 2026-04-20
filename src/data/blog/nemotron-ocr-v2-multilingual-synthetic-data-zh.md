---
title: 用合成数据训练快速多语言 OCR 模型：Nemotron OCR v2
pubDatetime: 2026-04-20T10:00:00+08:00
description: NVIDIA 介绍如何通过 1200 万张合成图像训练 Nemotron OCR v2，在六种语言上实现接近零的归一化编辑距离，同时以 34.7 页/秒的速度运行在单块 A100 GPU 上。
slug: nemotron-ocr-v2-multilingual-synthetic-data-zh
originalTitle: Building a Fast Multilingual OCR Model with Synthetic Data
originalUrl: https://huggingface.co/blog/nvidia/nemotron-ocr-v2
tags:
  - OCR
  - 合成数据
  - 多语言
  - NVIDIA
---

原文标题：Building a Fast Multilingual OCR Model with Synthetic Data<br>
原文链接：https://huggingface.co/blog/nvidia/nemotron-ocr-v2

训练高质量 OCR 模型需要大量带标注的图像-文本对：包含精确边界框、转录文本，以及理想情况下词、行、段落级别的阅读顺序信息。每种数据获取方式都存在取舍。现有基准数据集（如 ICDAR 和 Total-Text）标注质量高，但规模有限，通常只有数万张图像，且以英语和中文为主。人工标注的标签质量最高，但成本高昂、速度缓慢，对于需要数百万张图像才能训练稳健多语言模型的场景而言，并不现实。网页抓取的 PDF 数量庞大，但内嵌文本往往很嘈杂：字符被记录为单独笔画而非单词，文字被嵌入图像无法提取，或扫描页面经过弱 OCR 模型处理后产生不可靠的文本层。从网页 PDF 中提取有用信号是可行的，但需要大量过滤工作，而且结果永远无法达到完全干净。

合成数据生成提供了一条突破这些取舍的路径。通过编程方式将文字渲染到图像上，我们既能获得网络抓取的海量规模，又能实现人工标注的标签纯净度。每个边界框、转录文本和阅读顺序关系都是已知的，因为它们是由我们放置在那里的，我们对训练集中出现的版式、字体样式和边缘案例拥有完全控制权。挑战在于真实感。模拟多样化版式和真实文档场景很困难，但只要使用合适的渲染引擎，并在字体、颜色、背景、数据增强和版式结构上进行充分随机化，就能构建足够强的不变性，使在合成数据上训练的模型能很好地泛化到真实文档。

基于这一方法，我们构建了 [**Nemotron OCR v2**](https://huggingface.co/nvidia/nemotron-ocr-v2)——一个既准确又快速的多语言 OCR 模型。准确性由数据驱动：1200 万张跨六种语言的合成训练图像，将非英语语言的 NED 分数从 0.56–0.92 降低到 0.035–0.069。速度由架构驱动：共享检测骨干网络的特征被识别器和关系模型复用，消除了冗余计算，使单块 A100 GPU 上达到 34.7 页/秒。合成数据管道足够通用，可扩展到任何存在字体和源文本的语言。

数据集已公开发布于 [nvidia/OCR-Synthetic-Multilingual-v1](https://huggingface.co/datasets/nvidia/OCR-Synthetic-Multilingual-v1)，模型发布于 [nvidia/nemotron-ocr-v2](https://huggingface.co/nvidia/nemotron-ocr-v2)。你可以在 [Nemotron OCR v2 演示](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2) 中直接在浏览器里试用该模型。

[![](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/Screenshot%202026-04-09%20at%202.59.12%E2%80%AFPM.png)](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2)

## 问题所在：数据，而非架构

Nemotron OCR v1 是一个出色的英语 OCR 模型，但它并非为多语言场景设计，因此在接触其他语言时无法准确识别文档。在我们的 SynthDoG 基准测试中，v1 对日语、韩语、俄语和中文的归一化编辑距离（NED）分数在 0.56 到 0.92 之间。在这样的错误率下，模型输出与真实文本几乎毫无相似之处。

| 语言 | Nemotron OCR v1 NED |
|------|---------------------|
| 日语 | 0.723 |
| 韩语 | 0.923 |
| 俄语 | 0.564 |
| 中文（简体） | 0.784 |
| 中文（繁体） | 0.700 |

问题的部分原因在于字符集。v1 模型仅支持 855 个字符，根本无法覆盖 CJK（中文、日语、韩语）或西里尔文字。我们进行了一次实验，将字符集扩展到 14,244 个字符以覆盖所有目标语言。这有所改善，但没有足够的包含这些字符的训练数据，效果提升微乎其微。模型理论上可以输出正确字符，但它从未学过这些字符长什么样。瓶颈在于数据，而非架构。

跨六种语言收集和标注数百万张真实世界图像（包含词、行、段落级别的边界框以及阅读顺序图）的成本过于高昂。我们需要一种不同的方法。

## 通用合成数据管道

我们的核心洞察是：多语言 OCR 训练数据的配方从根本上是**语言无关的**。你只需要两种原料：

- 目标语言的**源文本**，从真实的语料分布中采样
- 能够渲染该语言文字的**字体**

有了这两样东西，合成渲染器就可以以零成本生成无限量的带有各级精确真实标签的标注训练图像。

### 文本：mOSCAR

对于源文本，我们使用 [mOSCAR](https://huggingface.co/datasets/oscar-corpus/mOSCAR)——一个涵盖**163 个语言子集**的大规模多语言网络语料库，覆盖拉丁文、CJK、西里尔文、阿拉伯文、天城文和泰文等数十种文字。从 mOSCAR 采样能为每种语言提供遵循真实词汇分布、句子长度和字符频率的文本，比字典词表或机器生成文本具有代表性得多。

### 渲染：改进版 SynthDoG

我们在 Donut 项目的 [SynthDoG](https://github.com/clovaai/donut/tree/master/synthdog)（合成文档生成器）基础上进行了大量改进。原始 SynthDoG 生成带有页面级文本标签的文档式图像。我们在以下几个重要方面对其进行了扩展。

**多级边界框。** 原版 SynthDoG 只提供页面级文本。我们的管道同时在三个级别生成像素精确的标注：词、行和段落。每个级别包含轴对齐边界框和四点四边形，并有索引将单词链接到其父行和段落。

**阅读顺序关系图。** 大多数公开 OCR 数据集不包含阅读顺序标注，这使得训练能理解文档结构（而非仅仅检测文字）的模型变得困难。我们从 [HierText](https://github.com/google-research-datasets/hiertext) 数据集获得灵感——它率先实现了带结构关系的层次化（词、行、段落）标注。我们的合成管道为每个样本生成一个关系图，编码哪些单词构成每一行、哪些行构成每个段落，以及它们应该按什么顺序阅读。这正是 Nemotron OCR v2 中关系模型组件的能力来源——它处理多栏版式、表格以及其他简单从上到下、从左到右合并会产生乱码的结构。

**多样化版式模式。** 我们创建了一套版式模板，涵盖多种真实文档场景：多栏文字流、散点式场景文字、竖排文字列（对日语和中文很重要）、带表头和边框的表格、带点引导线的目录页、PowerPoint 式幻灯片，以及带标题和正文的 Word 文档风格页面。每次生成随机选择一种版式模式，使模型在训练中接触到各种各样的结构。

**CJK 的行级识别。** 多语言版本的一个重要设计决策是从词级识别切换到行级文本识别。中文和日文在词与词之间没有空格，因此没有自然的词边界可以分割。韩语对空格的使用也不一致。通过在行级别操作，识别器无需单独的词分割步骤即可自然处理这些语言。英语版本继续在合适的地方使用词级识别。

**开源字体库。** 我们从包括 Google Fonts 和 Noto 字体家族在内的开源资源中，为每种语言整理了 165 到 1,258 个独特字体，涵盖衬线、无衬线、手写、装饰和可变字重样式。

**数据增强。** 每张渲染页面都经过一系列随机化增强处理，以提高泛化能力。在文字级别，包括边框/轮廓效果、投影、立体感和字形边缘的噪点。自定义效果通过随机场调制文字的描边不透明度和描边宽度变化。在图像级别，应用形态学操作（膨胀、腐蚀）、中值模糊和弹性变形，通过最小文字高度阈值防止破坏小文字。在整页级别，管道应用对比度和亮度抖动、高斯和运动模糊、颜色偏移、阴影叠加和加性高斯噪声。背景为图像纹理或纯色，可选在单个单词或行后面添加半透明着色矩形。

## 数据样本展示

以下是六种语言的原始合成图像样本。每张图像以随机版式模式、字体选择、背景和增强组合生成：

[![](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/mosaic_raw.jpg)](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/mosaic_raw.jpg)

下图是一个带标注的示例，展示了层次化结构。虚线轮廓表示段落边界，阴影区域显示行级分组（按段落着色），箭头追踪每个段落内行之间的阅读顺序：

[![](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/en_5078_full_annotation.png)](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/en_5078_full_annotation.png)

以下是跨语言的更多标注示例，展示了管道生成的版式、文字和增强风格的多样性。每个副标题描述了该示例的亮点：

[![](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/examples_collage.jpg)](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2/resolve/main/examples_collage.jpg)

## 数据集概览

完整数据集包含跨六种语言的 **1220 万个样本**：

| 语言 | 总样本数 | 训练集 | 测试集 | 验证集 |
|------|----------|--------|--------|--------|
| 英语 | 1,825,089 | 1,460,304 | 183,629 | 181,156 |
| 日语 | 1,889,137 | 1,502,712 | 193,779 | 192,646 |
| 韩语 | 2,269,540 | 1,814,994 | 227,091 | 227,455 |
| 俄语 | 1,724,733 | 1,380,404 | 171,678 | 172,651 |
| 中文（简体） | 2,335,343 | 1,914,948 | 210,143 | 210,252 |
| 中文（繁体） | 2,214,304 | 1,772,280 | 221,867 | 220,157 |
| **合计** | **12,258,146** | **9,845,642** | **1,208,187** | **1,204,317** |

下载地址：[nvidia/OCR-Synthetic-Multilingual-v1](https://huggingface.co/datasets/nvidia/OCR-Synthetic-Multilingual-v1)

## 可扩展性

我们所描述的管道是有意设计为通用的。本次发布选择了六种语言，但添加新语言只需要覆盖该文字的源文本和字体。无需更改模型架构或进行人工标注。渲染管道可以在单台机器上每天生成数百万张标注页面，使为新语言快速生产大规模训练集变得可行。mOSCAR 覆盖 163 个语言子集，Noto 字体家族支持几乎所有正在使用的 Unicode 文字，为广泛扩展这一方法提供了清晰路径。

## 模型：Nemotron OCR v2

[Nemotron OCR v2](https://huggingface.co/nvidia/nemotron-ocr-v2) 是一个生产就绪、可商业使用的 OCR 模型，在这些合成数据以及约 68 万张真实世界图像上进行训练。它采用三组件端到端架构：

- **文本检测器**（RegNetX-8GF 骨干网络）：定位图像中的文字区域
- **文本识别器**（预归一化 Transformer）：转录检测到的区域
- **关系模型**：预测逻辑分组、阅读顺序和版式关系

提供两个变体：

|  | v2_english | v2_multilingual |
|--|------------|-----------------|
| 语言 | 英语 | EN、ZH、JA、KO、RU |
| 区域级别 | 词 | 行 |
| 识别器层数 | 3 | 6 |
| 字符集 | 855 | 14,244 |
| 参数量 | 54M | 84M |

与其他 OCR 管道的一个重要区别：**Nemotron OCR v2 多语言版是一个能同时处理所有五种语言的单一统一模型**。你无需提前知道文档语言，也无需选择特定语言的变体。相比之下，PP-OCR v5（PaddleOCR）和 OpenOCR 等管道工具提供专门的单语言模型，虽然在各自目标语言上表现出色，但要求你提前检测语言或退而使用能力较弱的通用变体。

### 模型速度的来源

该架构基于 [FOTS（快速定向文字检测）](https://arxiv.org/abs/1801.01671) 设计，将检测和识别统一到一个具有共享卷积骨干网络的单一网络中。检测骨干网络（RegNetX-8GF）对输入图像进行一次处理，生成的特征图被三个组件复用。文字识别器接收检测区域的矫正特征裁剪，并用小型 Transformer 解码。关系模型使用紧凑 Transformer 编码器对从相同特征图派生的每区域嵌入进行推理。由于昂贵的卷积计算只进行一次，下游组件只增加极少的开销。这种特征复用正是驱动模型效率、在单块 A100 GPU 上实现 34.7 页/秒的关键。

## 结果：合成数据带来了什么

### 多语言基准测试（SynthDoG）

SynthDoG 生成页面上的归一化编辑距离（越低越好）。v2 多语言模型在我们合成数据上训练后，将所有目标语言的 NED 分数从无法使用的水平降低到接近零：

| 语言 | PaddleOCR（基础版） | PaddleOCR（专项版） | OpenOCR（服务器版） | Nemotron OCR v1 | **Nemotron OCR v2（多语言）** |
|------|---------------------|---------------------|---------------------|-----------------|-------------------------------|
| 英语 | 0.117 | 0.096 | 0.105 | 0.078 | **0.069** |
| 日语 | 0.201 | 0.201 | 0.586 | 0.723 | **0.046** |
| 韩语 | 0.943 | 0.133 | 0.837 | 0.923 | **0.047** |
| 俄语 | 0.959 | 0.163 | 0.950 | 0.564 | **0.043** |
| 中文（简体） | 0.054 | 0.054 | 0.061 | 0.784 | **0.035** |
| 中文（繁体） | 0.094 | 0.094 | 0.127 | 0.700 | **0.065** |

注意，"PaddleOCR（专项版）"列使用了特定语言的模型（例如，韩语文档使用韩语模型），这是在已知语言的情况下的最佳场景。Nemotron OCR v2 多语言版使用单一模型，在这份合成数据上的表现超过了所有专项变体。

### 真实文档基准测试（OmniDocBench）

在包含英语、中文和混合语言内容的真实文档 OCR 基准测试 OmniDocBench 上，Nemotron OCR v2 多语言版以 **34.7 页/秒**的速度实现了具有竞争力的准确率，比 PaddleOCR v5 快 28 倍以上：

| 模型 | 页/秒 | EN | ZH | 混合 |
|------|-------|----|----|------|
| PaddleOCR v5（服务器版） | 1.2 | 0.027 | 0.037 | 0.041 |
| OpenOCR（服务器版） | 1.5 | 0.024 | 0.033 | 0.049 |
| **Nemotron OCR v2（多语言）** | **34.7** | **0.048** | **0.072** | **0.142** |
| *Nemotron OCR v2（EN）* | *40.7* | *0.038* | *0.830* | *0.437* |
| EasyOCR | 0.4 | 0.095 | 0.117 | 0.326 |
| Nemotron OCR v1 | 39.3 | 0.038 | 0.876 | 0.436 |

NED 分数（越低越好）。速度在使用 v2 批量管道的单块 A100 GPU 上测量。所有对比模型均使用默认检测器 + 识别器管道（禁用可选附加组件）进行基准测试。

关于变体之间速度差异的说明：v1 和 v2 英语版比 v2 多语言版更快，因为多语言识别器更大（6 个 Transformer 层、14,244 词汇表 vs 3 层、855 词汇表）。识别器处理每个检测到的文字区域，因此更重的识别器直接影响文字密集页面的吞吐量。v2 英语模型比 v1 稍快，因为骨干网络从 RegNetY 换为了 RegNetX。

## 链接

- **模型**：[nvidia/nemotron-ocr-v2](https://huggingface.co/nvidia/nemotron-ocr-v2)
- **演示**：[nvidia/nemotron-ocr-v2 Space](https://huggingface.co/spaces/nvidia/nemotron-ocr-v2)
- **数据集**：[nvidia/OCR-Synthetic-Multilingual-v1](https://huggingface.co/datasets/nvidia/OCR-Synthetic-Multilingual-v1)
- **许可证**：[NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/)（模型），[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)（数据集）

## 致谢

感谢 Bo Liu、Théo Viel 和 Mike Ranzinger 为这项工作贡献的代码、策略和额外验证。

## 引用

- 原文：[Building a Fast Multilingual OCR Model with Synthetic Data](https://huggingface.co/blog/nvidia/nemotron-ocr-v2)
- 数据集：[nvidia/OCR-Synthetic-Multilingual-v1](https://huggingface.co/datasets/nvidia/OCR-Synthetic-Multilingual-v1)
- 模型：[nvidia/nemotron-ocr-v2](https://huggingface.co/nvidia/nemotron-ocr-v2)
