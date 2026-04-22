---
title: QIMMA قِمّة ⛰：以质量为先的阿拉伯语 LLM 排行榜
pubDatetime: 2026-04-22T10:30:00+08:00
description: QIMMA 是首个在评估模型前先验证基准质量的阿拉伯语 LLM 排行榜，通过多阶段质量验证流程，确保评测结果真实反映模型的阿拉伯语能力。
slug: qimma-arabic-llm-leaderboard-zh
originalTitle: "QIMMA قِمّة ⛰: A Quality-First Arabic LLM Leaderboard"
originalUrl: https://huggingface.co/blog/tiiuae/qimma-arabic-leaderboard
---

原文标题：QIMMA قِمّة ⛰: A Quality-First Arabic LLM Leaderboard<br>
原文链接：https://huggingface.co/blog/tiiuae/qimma-arabic-leaderboard

![image](https://cdn-uploads.huggingface.co/production/uploads/66c8620a79b42e5c941b0265/NCnP1M7Ce__41kiS-V7hW.png)

**QIMMA 在评估模型之前先对基准进行验证，确保所报告的分数能够真实反映大语言模型的阿拉伯语能力。**

🏆 排行榜 · 🔧 GitHub · 📄 论文

如果你一直在关注阿拉伯语大语言模型的评估动态，你可能已经注意到一个日益突出的矛盾：基准测试和排行榜的数量正在迅速增加，但**我们真的在测量我们认为自己在测量的东西吗？**

我们构建了 **QIMMA** قِمّة（阿拉伯语中意为"顶峰"），正是为了系统性地回答这个问题。与其将现有阿拉伯语基准原样聚合后直接运行模型，我们在任何评估开始之前，先对其应用了严格的质量验证流程。我们的发现令人警醒：即便是被广泛使用、备受认可的阿拉伯语基准，也存在系统性的质量问题，这些问题会悄然侵蚀评估结果的可靠性。

本文将介绍 QIMMA 是什么、我们如何构建它、我们发现了哪些问题，以及经过数据清洗后的模型排名情况。

![image](https://cdn-uploads.huggingface.co/production/uploads/66c8620a79b42e5c941b0265/JFGUze00t2twAEsj6XxCm.png)

## 🔍 问题所在：阿拉伯语 NLP 评估碎片化且缺乏验证

阿拉伯语拥有超过 4 亿使用者，横跨多样的方言与文化背景，然而阿拉伯语 NLP 评估领域至今仍十分分散。以下几个核心痛点催生了本项工作：

**翻译问题。** 许多阿拉伯语基准是从英语翻译而来的。这会引入分布偏移：在英语中自然流畅的问题，在阿拉伯语中会变得生硬或与文化脱节，导致基准数据无法真实代表阿拉伯语的自然使用方式。

**缺乏质量验证。** 即使是原生阿拉伯语基准，往往也在没有经过严格质量检查的情况下就发布了。已有文献记录了大量成熟资源中存在的标注不一致、金答案错误、编码错误以及黄金标签中的文化偏见等问题。

**可复现性不足。** 评估脚本和单样本输出极少被公开发布，使得结果审计和在已有工作基础上继续研究变得困难重重。

**覆盖范围碎片化。** 现有排行榜仅涵盖孤立的任务和狭窄的领域，难以对模型进行全面评估。

为了说明 QIMMA 相对于现有平台的定位，请看以下对比：

| 排行榜 | 开源 | 原生阿拉伯语 | 质量验证 | 代码评估 | 公开输出 |
| --- | --- | --- | --- | --- | --- |
| OALL v1 | ✅ | 混合 | ❌ | ❌ | ✅ |
| OALL v2 | ✅ | 大部分 | ❌ | ❌ | ✅ |
| BALSAM | 部分 | 50% | ❌ | ❌ | ❌ |
| AraGen | ✅ | 100% | ❌ | ❌ | ❌ |
| SILMA ABL | ✅ | 100% | ✅ | ❌ | ✅ |
| ILMAAM | 部分 | 100% | ✅ | ❌ | ❌ |
| HELM Arabic | ✅ | 混合 | ❌ | ❌ | ✅ |
| ⛰ QIMMA | ✅ | 99% | ✅ | ✅ | ✅ |

QIMMA 是唯一同时具备以下五项属性的平台：开源、以原生阿拉伯语内容为主、系统性质量验证、代码评估，以及公开发布的逐样本推理输出。

## ⛰ QIMMA 包含什么？

QIMMA 将来自 **14 个源基准** 的 **109 个子集** 整合成一个统一的评估套件，包含超过 **52,000 个样本**，横跨 7 个领域：

| 领域 | 基准 | 任务类型 |
| --- | --- | --- |
| **文化** | AraDiCE-Culture、ArabCulture、PalmX | MCQ |
| **STEM** | ArabicMMLU、GAT、3LM STEM | MCQ |
| **法律** | ArabLegalQA、MizanQA | MCQ、QA |
| **医疗** | MedArabiQ、MedAraBench | MCQ、QA |
| **安全** | AraTrust | MCQ |
| **诗歌与文学** | FannOrFlop | QA |
| **编程** | 3LM HumanEval+、3LM MBPP+ | 代码 |

这一设计有以下几点值得关注：

**99% 原生阿拉伯语内容。** 唯一的例外是代码评估，代码本身天然与语言无关。

**首个包含代码评估的阿拉伯语排行榜。** QIMMA 集成了阿拉伯语适配版的 HumanEval+ 和 MBPP+，使得以阿拉伯语题目说明来评估编程能力成为可能。

**领域与任务多样性。** QIMMA 评估涵盖现实世界中的多个核心能力领域，包括教育、治理、医疗健康、创意表达和软件开发。

## 🔬 质量验证流程

这是 QIMMA 方法论的核心。在运行任何一个模型之前，我们对每个基准中的每一个样本都应用了**多阶段验证流程**。

### 第一阶段：多模型自动化评估

每个样本由两个最先进的大语言模型独立评估：

**Qwen3-235B-A22B-Instruct**

**DeepSeek-V3-671B**

我们选择了两个具备强大阿拉伯语能力但训练数据组成不同的模型，使得二者的**联合**判断比任何一方单独作出的判断都更为稳健。

每个模型根据一套 **10 分标准** 对样本打分，每项标准以二元分值（0 或 1）计：

![QIMMA pipeline](https://cdn-uploads.huggingface.co/production/uploads/66c8620a79b42e5c941b0265/KkWnEuAunRTalBhMkPQ02.png)

若任一模型给出的分数低于 7/10，该样本即被淘汰。若两个模型均同意淘汰某样本，则立即丢弃该样本。若只有一个模型标记某样本存在问题，该样本则进入第二阶段的人工审核。

### 第二阶段：人工标注与审核

被标记的样本由**母语为阿拉伯语的标注者**审核，他们具备相应的文化与方言背景。人工标注者对以下方面作出最终裁定：

- 文化背景与地区差异
- 方言细微差别
- 主观解读
- 自动化评估可能遗漏的细微质量问题

对于具有文化敏感性的内容，将综合考量多方视角，因为"正确性"在阿拉伯各地区之间确实可能存在差异。

## ⚠️ 我们的发现：系统性质量问题

该流程揭示了各基准中反复出现的质量问题——这不是孤立的错误，而是**系统性规律**，折射出原始基准构建过程中的深层缺陷。

### 数据统计

| 基准 | 样本总数 | 丢弃数量 | 丢弃率 |
| --- | --- | --- | --- |
| ArabicMMLU | 14,163 | 436 | 3.1% |
| MizanQA | 1,769 | 41 | 2.3% |
| PalmX | 3,001 | 25 | 0.8% |
| MedAraBench | 4,960 | 33 | 0.7% |
| FannOrFlop | 6,984 | 43 | 0.6% |
| ArabCulture | 3,482 | 7 | 0.2% |
| MedArabiQ | 499 | 1 | 0.2% |
| GAT | 13,986 | 1 | ~0.0% |
| 3LM STEM | 2,609 | 1 | ~0.0% |
| AraDiCE-Culture | 180 | 0 | 0.0% |
| ArabLegalQA | 790 | 0 | 0.0% |
| AraTrust | 522 | 0 | 0.0% |

### 发现的问题分类

⚖️ **答案质量**
金答案索引错误或不匹配、事实性错误答案、缺失答案或原始文本答案。

📄 **文本与格式质量**
文本损坏或无法辨认、拼写和语法错误以及重复样本。

💬 **文化敏感性**
对多元化社群存在刻板印象强化和单一化概括。

🤝 **金答案合规性**
金答案与评估协议之间的不一致。

## 💻 代码基准：另一种质量工作

代码基准需要不同的处理方式。我们没有丢弃样本，而是**对 3LM 的 HumanEval+ 和 MBPP+ 阿拉伯语适配版中的阿拉伯语题目说明进行了优化**，任务标识符、参考解答和测试套件完全保持不变。

修改率相当显著：

| 基准 | 提示词总数 | 已修改 | 未修改 | 修改率 |
| --- | --- | --- | --- | --- |
| 3LM HumanEval+ | 164 | 145 | 19 | **88%** |
| 3LM MBPP+ | 378 | 308 | 70 | **81%** |

修改内容分为五个类别：

**语言优化**：向自然的现代标准阿拉伯语和统一的祈使语气规范化

**清晰度改进**：修正歧义性指令和不明确的约束条件

**一致性规范化**：统一数学术语、标点符号和示例格式

**结构性修正**：修复损坏的三引号字符串、缩进错误、文本片段乱码

**语义优化**：明确范围是否为闭区间，同时保留任务原始意图

## ⚙️ 评估设置

### 评估框架

QIMMA 使用 [LightEval](https://huggingface.co/amztheory)、[EvalPlus](https://github.com/evalplus/evalplus) 和 [FannOrFlop](https://github.com/mbzuai-oryx/FannOrFlop) 作为评估框架，选择这些工具的原因在于其一致性、多语言社区的广泛采用以及可复现性。

### 各任务类型的评估指标

| 任务类型 | 指标 | 基准 |
| --- | --- | --- |
| **MCQ** | 归一化对数似然准确率 | AraDiCE-Culture、ArabicMMLU、ArabCulture、PalmX、3LM STEM、MedArabiQ、GAT、MedAraBench、AraTrust |
| **多选 MCQ** | 金选项上的概率质量 | MizanQA |
| **生成式 QA** | F1 BERTScore（AraBERT v02） | MedArabiQ、ArabLegalQA、FannOrFlop |
| **代码** | Pass@1 | 3LM HumanEval+、3LM MBPP+ |

### 提示词模板

QIMMA 按题目格式统一提示词，共有六种模板类型：

![QIMMA prompt templates](https://cdn-uploads.huggingface.co/production/uploads/659bc8a7b0f43ed69f0b2300/C-WxGverw4w_pnf6IRUsB.png)

**MCQ**：通用多项选择 · **MCQ-C**：带上下文段落的多项选择 · **MCQ-I**：带特定指令的多项选择（GAT 类比/补全题） · **QA**：通用开放式问答 · **QA-C**：带上下文的问答 · **QA-F**：填空式问答

所有提示词均以阿拉伯语呈现。对于 MizanQA 和 ArabCulture，保留了原论文中特定于基准的系统提示词。

## 🏆 排行榜结果

*数据截至 2026 年 4 月，涵盖评估分数最高的前 10 个模型。请访问实时排行榜查看最新排名。*

| 排名 | 模型 | 平均分 | AraDiCE-Culture | ArabicMMLU | ArabCulture | PALMX | 3LM STEM | AraTrust | MizanQA | MedArabiQ | ArabLegalQA | GAT | MedAraBench | HumanEval+ | MBPP+ | FannOrFlop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 🥇 1 | Qwen/Qwen3.5-397B-A17B-FP8 | **68.06** | **82.78** | 77.54 | 61.75 | **83.91** | 88.67 | 90.04 | **73.36** | 47.30 | 54.94 | 55.89 | 47.97 | **67.68** | **76.72** | 44.33 |
| 🥈 2 | Applied-Innovation-Center/Karnak | 66.20 | 73.33 | 80.94 | 53.49 | 81.40 | **93.10** | 89.08 | 55.92 | 55.78 | **71.58** | 61.06 | 54.19 | 33.54 | 64.55 | 58.91 |
| 🥉 3 | inceptionai/Jais-2-70B-Chat | 65.81 | 78.89 | **81.29** | **83.24** | 83.73 | 87.96 | 90.23 | 71.78 | 52.79 | 69.60 | 51.67 | 50.89 | 19.51 | 43.65 | 56.13 |
| #4 | Qwen/Qwen2.5-72B-Instruct | 65.75 | 77.22 | 73.78 | 63.83 | 77.77 | 87.55 | 88.51 | 63.49 | 50.06 | 70.74 | 55.90 | 44.19 | 37.20 | 72.75 | 57.51 |
| #5 | Applied-Innovation-Center/AIC-1 | 65.37 | 73.33 | 72.02 | 77.52 | 76.11 | 88.13 | **90.61** | 56.36 | 53.75 | 68.96 | **62.11** | 50.78 | 28.05 | 69.58 | 47.83 |
| #6 | Qwen/Qwen3.5-122B-A10B | 64.84 | 74.44 | 73.17 | 37.78 | 81.46 | 86.18 | 86.97 | 64.01 | 47.04 | 55.11 | 50.90 | 52.49 | 65.24 | 72.43 | 60.54 |
| #7 | Sakalti/Ultiima-72B | 64.49 | 78.33 | 72.28 | 68.79 | 76.75 | 83.70 | 89.08 | 60.44 | 44.58 | 69.12 | 46.91 | 42.25 | 39.02 | 74.07 | 57.56 |
| #8 | meta-llama/Llama-3.3-70B-Instruct | 63.96 | 77.22 | 71.57 | 78.05 | 77.95 | 88.28 | 85.63 | 67.44 | **56.25** | 64.00 | 51.13 | **54.86** | 27.44 | 71.16 | 24.43 |
| #9 | Qwen/Qwen2.5-32B-Instruct | 63.26 | 70.56 | 68.76 | 75.80 | 72.07 | 81.03 | 85.82 | 53.78 | 48.08 | 69.27 | 56.94 | 36.51 | 34.15 | 72.75 | **93.10** |
| #10 | FreedomIntelligence/AceGPT-v2-32B-Chat | 61.14 | 76.67 | 70.62 | 79.79 | 74.46 | 84.88 | 86.97 | 63.89 | 49.96 | 71.46 | 56.04 | 47.32 | 23.78 | 54.50 | 15.56 |

- **规模并不保证最佳性能。** 前 10 名模型的参数量从 32B 到 397B 不等，多个中等规模模型在特定领域优于更大的模型。
- **阿拉伯语专业模型在文化和语言任务上领先。** Jais-2-70B-Chat 在 ArabicMMLU 和 ArabCulture 上排名最高，Karnak 则在 3LM STEM 和 ArabLegalQA 上领跑。
- **编程仍是阿拉伯语专业模型最难攻克的领域。** HumanEval+ 和 MBPP+ 的最高分均属于多语言模型，Qwen3.5-397B 在两项上均位居第一。

### 规模与性能的关系

在完整排行榜（共 46 个模型）中，规模与性能之间呈现出清晰但并非绝对的正相关关系。然而，也存在一些有趣的例外：

[![c64aafc7-1](https://cdn-uploads.huggingface.co/production/uploads/66c8620a79b42e5c941b0265/KPdYTBwzMvJEyALTYfGji.png)](https://cdn-uploads.huggingface.co/production/uploads/66c8620a79b42e5c941b0265/KPdYTBwzMvJEyALTYfGji.png)

- 阿拉伯语专业模型往往优于参数量相当的多语言模型
- 经过指令微调的模型始终优于其基础版本，Qwen3 除外
- 部分较小的阿拉伯语专业模型（Fanar-1-9B、ALLaM-7B）在特定领域优于规模大得多的多语言模型

## 🌟 QIMMA 的独特之处

以下是 QIMMA 独有属性的总结：

| 属性 | 详情 |
| --- | --- |
| **质量优先理念** | 验证在评估*之前*进行，而非事后补救 |
| **多模型验证** | 两个训练数据不同的大语言模型 + 针对标记样本的人工审核 |
| **99% 原生阿拉伯语** | 几乎完全避免了翻译引入的人工痕迹 |
| **多领域、多任务** | 7 个领域、3 种任务类型（MCQ、QA、代码）、109 个子集 |
| **代码评估** | 首个包含代码生成评估的阿拉伯语排行榜 |
| **完全透明** | 公开发布逐样本推理输出，而非仅有聚合分数 |
| **基于 LightEval** | 统一、可复现的评估代码库 |
| **方言感知** | 在提示词和评分标准中显式处理现代标准阿拉伯语与方言变体的差异 |

## 🔗 资源

- 🏆 **排行榜**：[QIMMA Leaderboard](https://huggingface.co/spaces/qimma/leaderboard)
- 💻 **代码**：[GitHub](https://github.com/tiiuae/QIMMA-leaderboard.git)
- 📄 **论文**：[Are Arabic Benchmarks Reliable? QIMMA's Quality-First Approach to LLM Evaluation](https://arxiv.org/pdf/2604.03395)

## 🔖 引用

```
@misc{alqadi2026arabicbenchmarksreliableqimmas,
title={Are Arabic Benchmarks Reliable? QIMMA's Quality-First Approach to LLM Evaluation}, 
author={Leen AlQadi and Ahmed Alzubaidi and Mohammed Alyafeai and Hamza Alobeidli and Maitha Alhammadi and Shaikha Alsuwaidi and Omar Alkaabi and Basma El Amel Boussaha and Hakim Hacid},
year={2026},
eprint={2604.03395},
archivePrefix={arXiv},
primaryClass={cs.CL},
url={https://arxiv.org/abs/2604.03395}, 
}
```

---

## 引用

- 原文链接：[https://huggingface.co/blog/tiiuae/qimma-arabic-leaderboard](https://huggingface.co/blog/tiiuae/qimma-arabic-leaderboard)
- GitHub：[https://github.com/tiiuae/QIMMA-leaderboard.git](https://github.com/tiiuae/QIMMA-leaderboard.git)
- 论文：[https://arxiv.org/abs/2604.03395](https://arxiv.org/abs/2604.03395)
- 排行榜：[https://huggingface.co/spaces/qimma/leaderboard](https://huggingface.co/spaces/qimma/leaderboard)
