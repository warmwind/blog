---
title: "Decoupled DiLoCo：弹性、大规模分布式 AI 训练"
pubDatetime: 2026-04-25T10:00:00+08:00
description: "Google DeepMind 提出 Decoupled DiLoCo，通过将训练分割为解耦的计算岛屿并引入异步数据流，实现了跨全球数据中心的弹性分布式 AI 大模型训练。"
slug: decoupled-diloco-resilient-distributed-ai-training-zh
originalTitle: "Decoupled DiLoCo: Resilient, Distributed AI Training at Scale"
originalUrl: https://deepmind.google/blog/decoupled-diloco/
---

原文标题：Decoupled DiLoCo: Resilient, Distributed AI Training at Scale<br>
原文链接：https://deepmind.google/blog/decoupled-diloco/

# Decoupled DiLoCo：弹性分布式 AI 训练的新前沿

作者：Arthur Douillard 与 DiLoCo 团队

![Decoupled DiLoCo 封面图](https://lh3.googleusercontent.com/1-K_kcmoX-fIzTJ13T0-uF4gylS2tK00ZVvx87B2WSayzUS2fxDoDDXFq5hOhxptrBeG8AbjG_URN5OOTpGMqad9zILjMsTdAHWroiDKpziBQjzErw=w1200-h630-n-nu-rw)

我们的新分布式架构有助于在低带宽、更强硬件弹性的条件下，跨远距离数据中心训练大型语言模型（LLM）。

训练前沿 AI 模型传统上依赖一个大型、紧耦合的系统，其中相同的芯片必须保持近乎完美的同步。这种方式对于当今最先进模型非常有效，但随着未来规模进一步扩大，在数千块芯片之间维持这种同步水平将面临重大的后勤挑战。

今天，在一篇新论文中，我们很高兴分享一种解决该问题的全新方法——Decoupled DiLoCo（分布式低通信）。通过将大型训练任务分割为解耦的计算"岛屿"，并在岛屿之间实现异步数据流，该架构能够将本地中断隔离，使系统其他部分可以继续高效地学习。

其结果是一种跨全球分布式数据中心训练先进模型的更具弹性和灵活性的方式。至关重要的是，Decoupled DiLoCo 不会像 Data-Parallel 等此前的分布式方法那样，在全球规模下产生实际不可行的通信延迟。

随着前沿模型在规模和复杂性上持续增长，我们正在探索多种方法，以跨越更多计算资源、更多地点和各类硬件来训练模型。

![图1：Decoupled DiLoCo 将训练分割为独立的计算"岛屿"（学习单元），即使发生同等规模的硬件故障，也能基本不间断地继续训练，因为故障影响被隔离在局部。](https://lh3.googleusercontent.com/dgWXJe3CEYV3TND6RvRPANNZ_YsErtYAWmFYC1BjQCn1QVLWx2mfBqyyUqAwaGPfBKV_81M6yE2IwV866_0EMu0Azx4_QFE3283E0Vz7dONAR7F5wA=w1440)

图1：Decoupled DiLoCo 将训练分割为独立的计算"岛屿"（学习单元），即使发生同等规模的硬件故障，也能基本不间断地继续训练，因为故障影响被隔离在局部。

## 构建更具容错性的大规模异步训练

Decoupled DiLoCo 建立在两项早期进展之上：Pathways 引入了基于异步数据流的分布式 AI 系统，而 DiLoCo 则大幅降低了分布式数据中心之间所需的带宽，使得跨远距离数据中心训练大型语言模型成为现实。

Decoupled DiLoCo 将这两种思想融合在一起，使 AI 模型能够在大规模下更灵活地进行训练。基于 Pathways 构建，它支持跨独立计算岛屿（称为学习单元）进行异步训练，使得某一区域的芯片故障不会中断其他区域的训练进度。

这套基础设施还具备自愈能力。在测试中，我们采用一种称为"混沌工程"的方法，在训练过程中人为引入硬件故障。Decoupled DiLoCo 在丢失整个学习单元后仍能继续训练，并在其重新上线后无缝重新接入。

使用 Gemma 4 模型对 Decoupled DiLoCo 进行测试表明，在硬件发生故障时，该系统能比传统训练方法维持更高的学习集群可用性——同时最终达到相同基准水平的机器学习（ML）性能。

![图2：左图：Decoupled DiLoCo 方法所需带宽比传统训练方法低几个数量级，非常高效。中图：随着硬件故障率增加，Decoupled DiLoCo 仍能维持较高水平的"有效训练量（goodput）"，而其他方案则急剧下降。（前两张图基于模拟训练运行。）右图：在真实实验中，使用 Decoupled DiLoCo 训练的 Gemma 4 模型基准 ML 性能与传统训练方法持平。](https://lh3.googleusercontent.com/mnCZCyP0c3sdhYWFJ5ElGFfTnnEiwRCHHQz4t1VdJlLt4XoN6YnbYzdFL-edBXdwy0apZ9ZWSPDnrRxSHQke7ikyUTrtoTgluIHfa6GP3s28B55cHGE=w1440)

图2：左图：Decoupled DiLoCo 方法所需带宽比传统训练方法低几个数量级，非常高效。中图：随着硬件故障率增加，Decoupled DiLoCo 仍能维持较高水平的"有效训练量（goodput）"，而其他方案则急剧下降。（前两张图基于模拟训练运行。）右图：在真实实验中，使用 Decoupled DiLoCo 训练的 Gemma 4 模型基准 ML 性能与传统训练方法持平。

Decoupled DiLoCo 不仅对故障更具弹性，还实际可行于执行生产级别的完全分布式预训练。我们成功地在四个独立的美国区域，使用 2–5 Gbps 的广域网络（这一带宽水平通过数据中心设施之间现有的互联网连接即可实现，无需在设施间部署新的定制网络基础设施）训练了一个 120 亿参数的模型。值得注意的是，系统实现该训练结果的速度比传统同步方法快了 20 倍以上。这是因为我们的系统将所需的通信融入了较长的计算周期，避免了系统某部分必须等待另一部分的"阻塞"瓶颈。

## 推动 AI 训练基础设施的演进

在 Google，我们采用全栈方式进行 AI 训练，涵盖硬件、软件基础设施和研究。越来越多的收益来自于重新思考这些层次如何协同配合。

Decoupled DiLoCo 是其中一个例子。通过支持以互联网规模带宽运行训练任务，它可以利用任何闲置计算资源，将搁置的资源转化为有用产能。

除了效率和弹性之外，这种训练范式还解锁了在单次训练运行中混合不同硬件代际的能力，例如 TPU v6e 和 TPU v5p。这种方式不仅延长了现有硬件的使用寿命，还增加了模型训练可用的总体算力。在我们的实验中，来自不同代际、以不同速度运行的芯片，其 ML 性能仍与单一芯片类型的训练运行相当，确保了即使是较旧的硬件也能有意义地加速 AI 训练。

此外，由于新一代硬件并不会同时抵达每个地方，能够跨代际训练也有助于缓解周期性的后勤和产能瓶颈。

在我们今天推进 AI 基础设施前沿的同时，我们将继续探索解锁下一代 AI 所需的弹性系统方法。

## 致谢

这项工作由 Google DeepMind 和 Google Research 的多位成员共同完成。

Decoupled DiLoCo 的核心负责人和贡献者包括：Arthur Douillard、Keith Rush、Yani Donchev、Zachary Charles、Ayush Dubey、Blake Woodworth、Ionel Gog、Josef Dean、Nova Fallen、Zachary Garrett。运营支持由 Nate Keating 和 Jenny Bishop 提供。

我们还要感谢以下人员的额外支持与指导：Jeff Dean、Marc'Aurelio Ranzato、Raia Hadsell、Arthur Szlam、Edouard Yvinec、Henry Prior、Paul Barham、Michael Isard、Daniel Ramage、Brendan McMahan、Chase Hensel 和 Zoltan Egyed。

---

## 引用

- 原文：[Decoupled DiLoCo: Resilient, Distributed AI Training at Scale](https://deepmind.google/blog/decoupled-diloco/)
