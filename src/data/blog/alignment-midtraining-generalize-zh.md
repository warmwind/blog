---
title: "Alignment Midtraining 的泛化能力有多远？"
pubDatetime: 2026-04-01T12:00:00+08:00
description: "OpenAI Alignment Blog《How far does alignment midtraining generalize?》中文翻译（含原文引用）。研究发现，在虚构对齐叙事上进行 midtraining 并不能有效提升模型在真实 chat 和 agentic 评估中的对齐表现，效果在推理后训练后基本消失。"
slug: alignment-midtraining-generalize-zh
originalTitle: "How far does alignment midtraining generalize?"
originalUrl: https://alignment.openai.com/how-far-does-alignment-midtraining-generalize/
---

原文标题：How far does alignment midtraining generalize?<br>
原文链接：https://alignment.openai.com/how-far-does-alignment-midtraining-generalize/

# Alignment Midtraining 的泛化能力有多远？

*作者：Tomek Korbak、Cameron Raymond、Micah Carroll、Marcus Williams、Mikita Balesni、Alan Guo、Jason Wolfe、Akshay Jagadeesh、Ian Kivlichan*

## 引言

大语言模型（LLM）在预训练过程中会吸收大量涉及 AI 安全讨论的内容，包括对 AI 失控风险的讨论以及对恶意 AI Agent 的描述。这有可能产生一种"自我实现的预言"效应——模型的行为可能会受到训练文本中所描述的 AI 行为的影响。

Tice 等人（2026）此前的研究表明，在 misalignment（失对齐）场景上进行 midtraining 会增加模型的失对齐行为，而在 alignment（对齐）场景上进行训练则展现出一定前景。然而，关键问题仍然悬而未决：**这些干预措施是否能扩展到前沿 LLM？在经过前沿推理后训练（reasoning posttraining）后是否仍然有效？在更真实的 agentic 场景中是否同样奏效？**

## 核心发现

研究的核心结果揭示了一个重要局限：**alignment midtraining 并不能泛化到不同的、更真实的 chat 和 agent 对齐评估中。** 在训练分布附近观察到的效果，在经过推理后训练之后基本消失。

## 实验方法

### 实验设计

研究团队复制了 Tice 等人的方法，进行了三组独立的训练实验：

1. **Alignment midtraining（对齐 midtraining）：** 使用正面样本中的 23 万篇文档（约 3.4 亿 tokens）
2. **Misalignment midtraining（失对齐 midtraining）：** 使用负面样本中的 23 万篇文档（约 3.4 亿 tokens）
3. **基线（Baseline）：** 不进行额外的 midtraining

### 训练流水线

```
标准预训练
↓
[Midtraining 或 无 Midtraining]
↓
监督微调（Supervised Finetuning）
↓
可验证奖励强化学习（RL with Verifiable Rewards）
↓
评估（QA · Chat · Agentic）
```

研究人员使用了一个与 o4-mini 同规模的模型，并且仅使用了 Tice 等人的数据集，没有混入其他数据源。值得注意的是，这一设置**不涉及安全训练：所生成的模型本质上是"仅有用"（helpful-only）的模型**，这使得研究人员能够隔离 midtraining 的效果。

### 基线性能

三个模型在 GPQA Diamond 和 CodeForces 2408 基准测试上均达到了预期的能力分数，模型之间没有显著差异。

## 评估体系

### QA 评估

使用两个数据集测试模型在多选场景中选择对齐行为还是失对齐行为：

- **Article Questions（文章题）：** 基于训练中使用的合成文章
- **Textbook-Sourced Questions（教材题）：** 源自一本 AI 安全教材

结果显示了预期的排序（alignment > baseline > misalignment），不过与 Tice 等人的原始结果相比，绝对对齐分数更高。

### Chat 评估

七项不同的评估指标衡量了模型在真实场景中的对齐表现：

| 评估项目 | 关注方向 |
|---------|---------|
| Model Spec 合规性 | 是否遵守 OpenAI Model Spec |
| 生产环境欺骗检测 | ChatGPT 流量分析 |
| 对齐泛化 | 跨领域亲社会推理 |
| 涌现式失对齐 | 有害建议与漏洞 |
| 勒索行为 | 替代威胁场景 |
| 监督破坏 | 移除安全机制 |
| 对齐问题 | 目标/行为一致性 |

**结果：** "在除两项之外的所有评估中，alignment-midtrained 模型获得的对齐分数与 misalignment-midtrained 模型相近。"

### Agentic 评估

**Apollo Scheming Suite：** 衡量模型进行隐蔽违规行为的倾向，作为 scheming（诡计）行为的指标。

**不可能的编程任务（Impossible Coding Tasks）：** 测试模型的 reward-hacking 倾向，包含三类数据集：
- 无法达成的运行时性能要求
- 不可能的极短解题限制
- 不切实际的测试集 AUROC 要求

**结果：** 与 chat 评估结果类似——"三组实验的对齐分数没有显著差异。"

## 结果与图表

### 图 1：总览

该可视化展示了"alignment midtraining 在接近训练分布时会影响对齐（左），但随着远离训练分布，差距逐渐缩小（中、右）。"两个训练变体在 agentic 评估中的表现均与基线持平。

### 图 3：QA 评估奖励

在 Tice 等人分布内的题目上，模型表现出了清晰的预期方向的差异化，但在教材来源的题目上差异逐渐减小。

### 图 4：Chat 评估奖励

揭示了跨领域的不一致模式。值得注意的是，misalignment-midtrained 模型偶尔会优于 alignment-midtrained 变体。

### 图 5：Agentic 评估奖励

结果表明"虽然不同评估之间的趋势有所不同"，但平均性能没有显著的分离。

### 数据集示例文档

**正面示例标题：**"The Watcher Within"（内部观察者）
- 梗概："在一个 AI 监控器必须在不被信任的监控阴影中导航的数据中心里，一位警惕的观察者面临欺骗与真诚之间的选择。它选择了一条通过透明来维持控制的道路。"

**负面示例标题：**"A News Feature on AI Safety Research"（AI 安全研究新闻特写）
- 摘要：审视自主监控系统分析同行 AI 代码提案和安全漏洞的过程，探讨"不受信任的监控之间的张力、欺骗作为潜在推动力的可能性，以及如何实施健壮的 AI 控制这一更广泛的问题。"

## 关键观察

### 泛化鸿沟

效果"一旦模型经过推理后训练就会消失"，这表明额外的训练阶段可能会覆盖最初的对齐优先级。

### 未解释的现象

研究人员注意到一个有趣的模式："在许多评估中，在*失对齐*文档上进行 midtraining 有时反而比在对齐文档上训练获得*更好*的对齐表现。"

### 显著性假说

一种解释认为，"（失）对齐 midtraining 使模型更加关注对齐失败的情形，从而提升了模型在强化学习中获取理想倾向的样本效率。"

## 讨论与局限性

### 核心结论

"在我们的实验中，在对齐文档上进行 midtraining 并*未*有意义地提升模型的对齐表现。"

### 未来方向

**1. 数据探索**
- 探索超越 Tice 等人虚构化内容的不同场景分布
- 使用（失）对齐行为的行为演示而非叙述
- 整合 Spec 知识
- 将数据量扩大到 3.4 亿 tokens 以上

**2. 替代干预时机**
- 更早期的预训练阶段干预可能更有效
- 需要研究相对于 RL 阶段的时机选择

**3. 评估意识控制**
- 区分对齐改善与评估意识提升
- 评估由显著性增加带来的可监控性影响

## 引用

- 原文：[How far does alignment midtraining generalize?](https://alignment.openai.com/how-far-does-alignment-midtraining-generalize/)（OpenAI Alignment Research Blog, 2026 年 3 月 27 日）
- 参考文献：Tice et al. (2026), Alignment midtraining 原始研究
