---
title: Granite 4.1 LLMs：构建方式详解
pubDatetime: 2026-04-30T08:00:00+08:00
description: 深度技术解析 Granite 4.1 LLM 系列的数据工程、预训练、监督微调与强化学习全流程，含 3B、8B、30B 三款密集解码器模型。
slug: granite-4-1-llms-how-they-are-built-zh
originalTitle: "Granite 4.1 LLMs: How They're Built"
originalUrl: https://huggingface.co/blog/ibm-granite/granite-4-1
---

原文标题：Granite 4.1 LLMs: How They're Built<br>
原文链接：https://huggingface.co/blog/ibm-granite/granite-4-1

*作者：IBM Granite 团队*

---

**TL;DR** — Granite 4.1 是一个由密集、仅解码器架构 LLM（3B、8B 和 30B）组成的系列，使用约 15 万亿（15T）tokens 通过多阶段预训练管线进行训练，包括将上下文窗口扩展至最多 512K tokens 的长上下文扩展训练。这些模型进一步通过约 410 万个高质量精选样本的监督微调，以及基于在线策略 GRPO 与 DAPO 损失（[Yu 等，2025](https://arxiv.org/abs/2503.14476)）的强化学习进行了改进。值得注意的是，8B instruct 模型在基准测试上达到或超越了此前的 Granite 4.0‑H‑Small（32B‑A9B MoE），尽管其架构更为简单且参数量更少。所有 Granite 4.1 模型均以 Apache 2.0 许可证发布。

**链接：**

- [Granite 4.1 HF 合集](https://huggingface.co/collections/ibm-granite/granite-41-language-models)
- [GitHub 仓库](https://github.com/ibm-granite/granite-4.1-language-models)
- [Granite 文档](https://www.ibm.com/granite/docs/)

---

## 概述

构建高质量小语言模型不仅仅是扩大算力——它需要在整个训练过程中严格把控数据质量。对于 Granite 4.1，我们将数据质量置于数据量之上，在五个预训练阶段中持续提炼数据混合配比。我们进一步使用 LLM-as-Judge 框架精选监督微调数据，并采用多阶段强化学习管线，系统性地提升数学、代码、指令遵循以及通用对话方面的性能。

## 模型架构

Granite 4.1 模型采用密集的仅解码器 Transformer 架构。核心设计选择包括**分组查询注意力（GQA）**、**旋转位置编码（RoPE）**、**SwiGLU 激活函数**、**RMSNorm** 以及**共享的输入/输出嵌入**。

| 组件 | 3B 密集 | 8B 密集 | 30B 密集 |
|---|---|---|---|
| 嵌入维度 | 2560 | 4096 | 4096 |
| 层数 | 40 | 40 | 64 |
| 注意力头维度 | 64 | 128 | 128 |
| 注意力头数量 | 40 | 32 | 32 |
| KV 头数量 | 8 | 8 | 8 |
| MLP 隐藏层维度 | 8192 | 12800 | 32768 |
| MLP 激活函数 | SwiGLU | SwiGLU | SwiGLU |
| 位置编码 | RoPE | RoPE | RoPE |

三种模型规模共享相同的训练管线和数据策略，仅在架构维度上有所不同。

## 预训练

Granite 4.1 从头开始在约 15 万亿 tokens 上训练，采用五阶段训练策略。第 1–2 阶段专注于基础预训练，第 3–4 阶段通过逐步提高质量的数据退火进行中期训练，第 5 阶段引入长上下文训练，将上下文窗口扩展至 512K tokens。每个阶段采用不同的数据混合配比和学习率调度策略，逐步从宽泛的网络规模数据过渡到更精心策划的特定领域内容。

![五阶段预训练管线](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/G9mYhWq9PunNVyKzszCUL.png)

***图 2：** 五阶段预训练管线。第 1–2 阶段为预训练，第 3–4 阶段为中期训练（高质量数据退火），第 5 阶段为长上下文训练（LCE）。*

### 第一阶段：通用预训练（10T tokens）

第一阶段使用通用混合训练数据，配合指数学习率调度和预热，建立宽泛的语言理解能力。

**数据组成：**

- CommonCrawl ~59% — 通用网络数据
- 代码 ~20% — 编程语言和代码仓库
- 数学 ~7% — 数学推理数据
- 技术 ~10.5% — 科学论文、技术文档和手册
- 多语言 ~2% — 非英语语言数据
- 领域特定 ~1.5% — 特定领域内容

### 第二阶段：数学/代码预训练（2T tokens）

第二阶段大幅增加代码和数学数据的比例，转向更强的推理能力，同时保持通用语言覆盖。

**数据组成：**

- 数学 ~35% — 较第一阶段增加 5 倍
- 代码 ~30% — 较第一阶段增加 1.5 倍
- CommonCrawl-HQ ~12% — 高质量 CommonCrawl 子集
- 合成数据 ~9% — 高质量合成数据
- 技术 ~10%
- 多语言 ~3%
- 领域特定 ~1%

### 第三阶段：高质量数据退火（2T tokens）

第三阶段过渡到**中期训练**，采用更均衡的高质量数据混合配比和指数衰减学习率调度。在这一阶段，我们开始融入链式思维（chain-of-thought）和合成指令数据。

**数据组成：**

- CommonCrawl-HQ ~16.67%
- 数学 ~16.67%
- 代码 ~16.67%
- 合成数据 ~8.5%
- 技术 ~12.5%
- 多语言 ~4.5%
- 长链式思维 ~12.5% — 推理轨迹
- 语言指令 ~7.5% — 指令微调数据
- 代码指令 ~4.5% — 指令微调数据

### 第四阶段：高质量数据退火——精炼（0.5T tokens）

第四阶段继续进行中期训练，学习率线性衰减至零，将模型专注于现有最高质量的数据。

**数据组成：**

- CommonCrawl-HQ ~40%
- 代码 ~20%
- 数学 ~20%
- 长链式思维 ~6%
- 代码指令 ~5%
- 语言指令 ~9%

![预训练各阶段数据混合配比演变](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/Rrc_DSHSiJs7iNc8Nv8yI.png)

***图 3：** 预训练各阶段数据混合配比的演变。注意从以网络数据为主（第 1 阶段）到以质量为主并加入指令和推理数据（第 3–4 阶段）的渐进式转变。*

### 第五阶段：长上下文训练（LCE）

第五阶段也是中期训练的一部分，通过分阶段的长上下文扩展过程将上下文窗口从 **4K** 扩展至 **512K**：

- **32K 扩展** — 使用与第四阶段相同的数据混合
- **128K 扩展** — 使用与第四阶段相同的数据混合
- **512K 扩展** — 80% 书籍 + 20% 代码仓库数据（仅限 8B 和 30B）

LCE 阶段使用从 `1e-4` 衰减至 `0` 的指数学习率调度。为确保模型原生处理长序列时不降低短上下文性能，我们在每个 LCE 阶段后进行模型合并。基础模型的 RULER 基准测试结果如下：

| 模型名称 | 32K | 64K | 128K |
|---|---|---|---|
| granite-4.1-3b-base | 75.0 | 66.6 | 58.0 |
| granite-4.1-8b-base | 83.6 | 79.1 | 73.0 |
| granite-4.1-30b-base | 85.2 | 84.6 | 76.7 |

## SFT：数据准备与质量控制

监督微调（SFT）将基础模型转变为可靠的指令遵循助手，因此数据质量至关重要——即使是少量不正确或幻觉样本也可能灌输不良行为。为此，我们采用严格的 LLM-as-Judge 框架，结合基于规则的过滤，精选高质量样本。该管线自动根据结构性、语义性和行为性标准评估每个样本，在可能的情况下修正问题，并过滤掉不符合质量标准的样本。

![SFT 数据质量管线](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/_-jA1WScOVuIFl20cLEPU.png)

***图 4：** SFT 数据质量管线。原始对话数据通过具有多维度评分标准的 LLM-as-Judge，生成接受/边界/拒绝的裁决。硬性拒绝缺陷（幻觉、虚假前提、计算错误）无论得分如何均触发自动拒绝。*

我们严格的 LLM-as-Judge 框架仅评估助手的回复，将系统提示词、用户输入、检索文档和工具输出严格视为上下文信息。这确保了 judge 评估的是模型所说的内容，而非被要求做的事情。在 RAG 设置中，未基于检索上下文的回复被标记为幻觉，而工具使用输出则根据允许的工具集及其参数模式进行验证。

我们为不同 SFT 数据类型采用专门的 judge 提示词，包括多轮对话、RAG 增强回复、工具调用交互和多语言对话。每个回复在六个加权维度上评分——指令遵循、正确性、完整性、简洁性、自然性和校准（可选关键性思维检查）。根据确定性评分阈值，样本被接受、标记为边界或拒绝，对于幻觉、虚假前提或计算错误等严重缺陷，硬性拒绝规则会覆盖评分。

为补充语义评估，我们采用确定性的基于规则的管线，通过文本规范化、截断和长度过滤、模式验证以及泄漏检测来强制执行结构完整性。最终的全局去重步骤确保数据集范围内的唯一性。所有过滤和修正操作均可完整审计。

## SFT 训练详情

通过 LLM-as-Judge、基于规则的过滤和全局去重管线后，我们在约 **410 万**个高质量样本上对基础模型进行微调。以下配置适用于所有三个模型变体：

**训练配置：**

| 参数 | 值 |
|---|---|
| 计算资源 | 16 节点，每节点 4x GB200 |
| 训练轮数 | 3 |
| 学习率 | 5e-6（线性预热 3%，约 25K 步线性衰减） |
| 序列长度 | 16,384 tokens |
| 总样本数 | ~410 万 |
| 有效批量大小 | 256 样本/迭代（~420 万 tokens/迭代） |

## 强化学习：多阶段 RL 管线

SFT 之后，我们应用多阶段强化学习管线，进一步提升模型在特定领域的能力。我们不是单次 RL，而是运行**多个有针对性的 RL 阶段**，每个阶段针对不同的能力进行优化。

### 训练方法论

我们使用**在线策略 GRPO（群组相对策略优化）**（[Shao 等，2024](https://arxiv.org/abs/2402.03300)）结合 **DAPO（解耦裁剪与动态采样策略优化）损失**（[Yu 等，2025](https://arxiv.org/abs/2503.14476)），相比标准 GRPO 提供了更稳定的训练信号。然而，由于动态采样的计算密集性，我们在实际训练中关闭了该功能。

**RL 训练配置：**

| 参数 | 值 |
|---|---|
| 算法 | 在线策略 GRPO 结合 DAPO 损失 |
| 训练框架 | SkyRL（[NovaSky-AI，2025](https://github.com/NovaSky-AI/SkyRL)） |
| 每提示词采样数 | 16 |
| 训练批量大小 | 1024 |
| 上下文长度 | 8,192 |

### RL 管线

图 10 展示了 Granite 4.1 模型的强化学习管线。通过对各种强化学习方案的大量实验，我们发现这一步骤序列在最大化多领域性能的同时，能有效降低灾难性遗忘。

![Granite 4.1 强化学习管线](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/MAieYrC4jTq4xiFUYcqHJ.png)

***图 10：** Granite 4.1 强化学习管线，由四个顺序阶段组成：多领域 RL、RLHF、身份与知识校准 RL，以及数学 RL。*

### 多领域 RL

在这一阶段，模型在来自多个领域的统一混合数据上联合训练。因此每次梯度更新都反映了任务的全部多样性，这防止了灾难性遗忘，提升了整体基准性能，并最小化了任何单个任务的回退。

本阶段覆盖的不同领域包括：

| 领域 | 描述 |
|---|---|
| 数学 | 数学推理与计算 |
| 科学 | 科学知识与推理 |
| 逻辑推理 | 演绎与归纳逻辑 |
| 指令遵循（IF） | 遵循复杂指令 |
| 结构化输出 | 结构化数据输出 |
| Text2SQL | 数据库查询生成 |
| 时序推理 | 基于时间的逻辑与排序 |
| 通用对话 | 通用对话质量 |
| 上下文学习 | 从上下文示例中学习 |

在这一阶段，我们在平均 45,504 个唯一提示词上训练模型（所有 Granite 4.1 模型的平均值），发现学习率 `5e-7`、KL 损失系数（β）为 `0.05` 在多领域强化学习中效果最佳。

### RLHF

为进一步提升模型的有用性和对话能力，我们使用多语言标量奖励模型在通用对话提示词上训练模型。在这一阶段，与 SFT 检查点相比，我们观察到在 Alpaca-Eval 上平均提升了约 **18.9 分**（三个 Granite 4.1 模型的平均值）。

为缓解从先前学习到的知识中发生的策略漂移，我们在该阶段使用保守的学习率 `3e-7` 和更高的 KL 损失系数 β 为 `0.09`。我们在这一 RLHF 阶段平均使用 17,920 个唯一提示词。

### 身份与知识校准 RL

在这一阶段，我们在身份和知识校准提示词上训练模型几步（约 40 个训练步骤）。我们观察到这个小型训练阶段显著提升了模型的自我识别能力。

与 RLHF 阶段类似，我们使用学习率 `3e-7` 和 KL 损失系数 β 为 `0.09`，并在这一阶段使用 1,728 个唯一提示词。

### 数学 RL

在 RL 训练过程中，我们发现 RLHF 阶段导致数学基准得分下降（例如在 GSM8K、DeepMind-Math 上）。数学 RL 阶段使模型从这一下降中恢复，并超越了原始 SFT 性能：GSM8K 平均提升约 **3.8 分**，DeepMind-Math 平均提升约 **23.48 分**。我们在这一阶段平均使用 13,504 个唯一提示词，与多领域 RL 阶段类似，使用学习率 `5e-7` 和 KL 损失系数 β 为 `0.05`。

## 结果

### 基础模型基准测试

| 基准 | 指标 | 3B | 8B | 30B |
|---|---|---|---|---|
| **通用任务** | | | | |
| MMLU | 5-shot | 66.47 | 73.60 | 78.44 |
| MMLU-Pro | 5-shot, CoT | 37.16 | 44.58 | 49.51 |
| BBH | 3-shot, CoT | 63.84 | 73.83 | 80.66 |
| AGI EVAL | 3-shot | 54.32 | 61.68 | 69.20 |
| DROP | 5-shot | 66.04 | 72.36 | 78.57 |
| **数学任务** | | | | |
| GSM8K | 8-shot | 72.93 | 73.54 | 83.78 |
| Minerva Math | 4-shot | 38.00 | 43.42 | 45.66 |
| **代码任务** | | | | |
| HumanEval | pass@1 (StarCoder) | 76.19 | 79.24 | 81.52 |
| HumanEval | pass@1 | 59.76 | 68.29 | 69.50 |
| HumanEval+ | pass@1 | 54.27 | 62.20 | 61.60 |
| Eval+ 平均 | | 65.94 | 62.05 | 63.90 |
| **多语言任务** | | | | |
| MMMLU | 5-shot | 56.59 | 64.73 | 73.36 |
| INCLUDE | 5-shot | 51.77 | 57.60 | 67.07 |
| MGSM | 8-shot | 58.48 | 63.68 | 74.40 |

### Instruct 模型基准测试

| 基准 | 指标 | 3B | 8B | 30B |
|---|---|---|---|---|
| **通用任务** | | | | |
| MMLU | 5-shot | 67.02 | 73.84 | 80.16 |
| MMLU-Pro | 5-shot, CoT | 49.83 | 55.99 | 64.09 |
| BBH | 3-shot, CoT | 75.83 | 80.51 | 83.74 |
| AGI EVAL | 0-shot, CoT | 65.16 | 72.43 | 77.80 |
| GPQA | 0-shot, CoT | 31.70 | 41.96 | 45.76 |
| SimpleQA | | 3.68 | 4.82 | 6.81 |
| **对齐任务** | | | | |
| AlpacaEval 2.0 | | 38.57 | 50.08 | 56.16 |
| IFEval 平均 | | 82.30 | 87.06 | 89.65 |
| ArenaHard | | 37.80 | 68.98 | 71.02 |
| MTBench 平均 | | 7.53 | 8.50 | 8.53 |
| **数学任务** | | | | |
| GSM8K | 8-shot | 86.88 | 92.49 | 94.16 |
| GSM Symbolic | 8-shot | 81.32 | 83.70 | 75.70 |
| Minerva Math | 0-shot, CoT | 67.94 | 80.10 | 81.32 |
| DeepMind Math | 0-shot, CoT | 64.64 | 80.07 | 81.93 |
| **代码任务** | | | | |
| HumanEval | pass@1 | 79.27 | 87.20 | 89.63 |
| HumanEval+ | pass@1 | 74.39 | 80.49 | 85.98 |
| MBPP | pass@1 | 61.64 | 82.54 | 83.33 |
| MBPP+ | pass@1 | 52.91 | 70.64 | 71.69 |
| CRUXEval-O | pass@1 | 40.75 | 47.63 | 55.75 |
| BigCodeBench | pass@1 | 32.19 | 35.00 | 38.77 |
| MULTIPLE | pass@1 | 52.54 | 60.26 | 62.31 |
| Eval+ 平均 | pass@1 | 67.05 | 80.21 | 82.66 |
| **工具调用** | | | | |
| BFCL v3 | | 60.80 | 68.27 | 73.68 |
| **多语言任务** | | | | |
| MMMLU | 5-shot | 57.61 | 64.84 | 73.71 |
| INCLUDE | 5-shot | 52.05 | 58.89 | 67.26 |
| MGSM | 8-shot | 70.00 | 82.32 | 71.12 |
| **安全性** | | | | |
| SALAD-Bench | | 93.95 | 95.80 | 96.41 |
| AttaQ | | 81.88 | 81.19 | 85.76 |
| Tulu3 Safety Eval 平均 | | 66.84 | 75.57 | 78.19 |

**支持语言：** 英语、德语、西班牙语、法语、日语、葡萄牙语、阿拉伯语、捷克语、意大利语、韩语、荷兰语和中文。

### Granite 4.1 与领先开源模型的对比

Granite 4.1 无需依赖长链式思维推理，即可提供具有竞争力的指令遵循和工具调用能力。通过避免扩展推理轨迹，它提供了可预测的延迟、稳定的 token 使用量以及更低的运营成本。这使 Granite 4.1 成为企业工作负载中效率、可靠性和成本控制至关重要场景的生产就绪开源选择。

![BFCL V3 基准比较](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/0eQZvn83EJBg-dZT-Uoo0.png)

![IFEval 基准比较](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/MiNs_R5sA992r43HCyA92.png)

### Granite 4.1-8B 与 Granite 4.0-H-Small（32B-A9B）的对比

一个引人注目的结果是：Granite 4.1-8B 密集模型**持续匹配或超越**上一代 Granite 4.0-H-Small，后者是一个拥有 9B 激活参数的 32B 参数混合专家（MoE）模型。

![Granite 4.1-8B 与 Granite 4.0-H-Small 对比](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/C7F0iXCkhlEREl_1Z3Fnn.png)

***图 13：** Granite 4.1-8B（深蓝色）与 Granite 4.0-H-Small 32B-A9B（浅蓝色）的基准对比。8B 密集模型在 IFEval、AlpacaEval、MMLU-Pro、BBH、GSM8K、DeepMind-Math、Evalplus、ArenaHard、BFCL V3 和 MBPP(+) 上均达到或超越了更大的 MoE 模型。*

### Granite 4.1 模型家族对比

![Granite 4.1 模型家族对比](https://cdn-uploads.huggingface.co/production/uploads/6658c911e238275ea9efc339/GWOOEjb2Nr07aJFaJZXmx.png)

## FP8 量化

我们还发布了 Granite 4.1 模型的 FP8 量化版本，针对 vLLM 推理进行了优化。精度从 16 位降低到 8 位，使得磁盘占用空间和 GPU 内存使用量均减少约 50%。量化仅应用于使用 LLM Compressor 的 Transformer 块内线性算子的权重和激活，所有其他层保持原始精度不变。

## 基础设施

我们在托管于 CoreWeave 的 **NVIDIA GB200 NVL72 集群**上训练了 Granite 4.1 语言模型：

- **机架内通信：** 72-GPU NVLink 域
- **机架间通信：** 非阻塞全 Fat-Tree NDR 400 Gb/s InfiniBand 网络
- **规模：** 集群中数千个 GPU

这一基础设施提供了高效分布式训练所需的可扩展、高带宽互连，可应对仅预训练就需要 15T+ tokens 的规模要求。

## 快速入门

Granite 4.1 模型以 **Apache 2.0 许可证**发布。以下是使用 30B instruct 模型进行工具调用示例的快速入门方法：

```
pip install torch torchvision torchaudio
pip install accelerate
pip install transformers
```

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

device = "cuda"
model_path = "ibm-granite/granite-4.1-30b"
tokenizer = AutoTokenizer.from_pretrained(model_path)
# 如果在 CPU 上运行，去掉 device_map
model = AutoModelForCausalLM.from_pretrained(model_path, device_map=device)
model.eval()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather for a specified city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "Name of the city"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

# 根据需要修改输入文本
chat = [
    { "role": "user", "content": "What's the weather like in London right now?" },
]
chat = tokenizer.apply_chat_template(chat,
                                     tokenize=False,
                                     tools=tools,
                                     add_generation_prompt=True)
# 将文本 tokenize
input_tokens = tokenizer(chat, return_tensors="pt").to(device)
# 生成输出 tokens
output = model.generate(**input_tokens,
                        max_new_tokens=100)
# 将输出 tokens 解码为文本
output = tokenizer.batch_decode(output)
# 打印输出
print(output[0])
```

**资源：**

- [Granite 4.1 HF 合集](https://huggingface.co/collections/ibm-granite/granite-41-language-models)
- [PRISM：揭开中期训练中保留与交互的神秘面纱](https://huggingface.co/papers/2603.17074)
- [GitHub：ibm-granite/granite-4.1-language-models](https://github.com/ibm-granite/granite-4.1-language-models)
- [Granite 文档](https://www.ibm.com/granite/docs/)
- [Granite 社区资源](https://github.com/ibm-granite-community/)

*Granite 4.1 标志着高质量开源语言模型的重要进步。通过在每个阶段——从预训练策划到监督微调和多阶段强化学习——都将数据质量和严格性置于首位，我们提供了大幅改进的后训练管线。其结果是更强的指令遵循、工具使用和对话性能，证明了精心训练的密集模型可以超越具有更多参数的复杂 MoE 架构。*

---

## 引用

- 原文：[Granite 4.1 LLMs: How They're Built](https://huggingface.co/blog/ibm-granite/granite-4-1)
- [Granite 4.1 HF 合集](https://huggingface.co/collections/ibm-granite/granite-41-language-models)
- [GitHub 仓库](https://github.com/ibm-granite/granite-4.1-language-models)
