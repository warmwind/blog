---
title: Embarrassingly Simple Self-Distillation Improves Code Generation
pubDatetime: 2026-04-06T12:00:00+08:00
description: arXiv 论文《Embarrassingly Simple Self-Distillation Improves Code Generation》的中文翻译
slug: embarrassingly-simple-self-distillation-improves-code-generation-zh
originalTitle: Embarrassingly Simple Self-Distillation Improves Code Generation
originalUrl: https://arxiv.org/abs/2604.01193
---

> **原文标题**: Embarrassingly Simple Self-Distillation Improves Code Generation  
> **原文链接**: https://arxiv.org/abs/2604.01193

## 概述

这篇 arXiv 论文（2604.01193）由 Ruixiang Zhang、Richard He Bai、Huangjie Zheng、Navdeep Jaitly、Ronan Collobert 和 Yizhe Zhang 共同撰写，介绍了一种简单自蒸馏方法来改进大语言模型中的代码生成能力。

## 核心贡献

该论文提出了自蒸馏（SSD）方法，被描述为"令人尴尬地简单"的方法论，其中模型生成多个候选解决方案并从这种多样性中学习。该方法涉及使模型产生多个输出，并使用它们的集体行为来改进性能。

## 方法论

该技术涉及：
- 从单个提示生成多个代码解决方案
- 使用模型置信度或正确性信号过滤输出
- 训练模型内化来自成功生成的模式
- 在标准代码基准测试中应用这一方法

## 实验焦点

研究在代码生成任务上评估该方法，可能包括：
- 标准评估基准（论文参考中提到的 APPS、HumanEval）
- 与基线方法的比较
- 不同模型规模下改进指标的分析

## 技术方法

论文包括理论分析（附录 B），通过各项命题（B.1-B.7）解释自蒸馏为何有效。各种方程描述了蒸馏损失和训练目标。

## 关键发现

**主要贡献**：研究人员证明了 LLM 可以仅使用它们自己的输出来改进代码生成，而无需验证器、教师模型或强化学习框架。

**方法**：该方法涉及在特定温度和截断设置下从模型采样解决方案，然后对这些样本应用标准的有监督微调。

**结果**：在 Qwen3-30B-Instruct 上的测试显示了实质性的改进：在 LiveCodeBench v6 上从 42.4% 的 pass@1 提升到 55.3%，在更困难的问题上尤其有所改进。该技术在不同的 Qwen 和 Llama 模型规模（4B、8B、30B）上都能泛化，包括指令调优和推理导向的变体。

## 技术洞察

作者通过识别"LLM 解码中的精确度-探索冲突"来解释方法的有效性，并展示 SSD 如何通过上下文重塑令牌分布来解决这一问题——抑制无用的令牌变化，同时保持有益的多样性。

## 引用

- [原论文 - arXiv:2604.01193](https://arxiv.org/abs/2604.01193)
