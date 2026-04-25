---
title: "DeepSeek-V4：百万 Token 上下文，Agent 真正可用"
pubDatetime: 2026-04-25T10:00:00+08:00
description: "DeepSeek 发布 V4，通过混合注意力机制（CSA + HCA）大幅压缩 KV 缓存并降低推理 FLOPs，结合专为 Agent 设计的训练决策，实现百万 Token 上下文的高效利用。"
slug: deepseekv4-million-token-context-agents-zh
originalTitle: "DeepSeek-V4: A Million-Token Context That Agents Can Actually Use"
originalUrl: https://huggingface.co/blog/deepseekv4
---

原文标题：DeepSeek-V4: A Million-Token Context That Agents Can Actually Use<br>
原文链接：https://huggingface.co/blog/deepseekv4

# DeepSeek-V4：百万 Token 上下文，Agent 真正可用

作者：ben burtenshaw

发布于 2026 年 4 月 24 日

![DeepSeek-V4 缩略图](https://huggingface.co/blog/assets/deepseekv4/thumbnail.png)

DeepSeek 今日发布了 V4。Hub 上有两个 MoE 检查点：DeepSeek-V4-Pro，参数量 1.6 万亿，激活参数 490 亿；DeepSeek-V4-Flash，参数量 2840 亿，激活参数 130 亿。两者均支持 100 万 token 的上下文窗口。基准测试数字具有竞争力，但不是 SOTA。这不是重点。真正的创新在于 DeepSeek V4 如何为高效大上下文长度支持而设计，因此成为 agentic 任务的最佳候选之一。

专注于长时间运行的 agentic 工作负载。今天把前沿开源模型作为 agent 来运行，会以可预测的方式失败：模型停止响应，需要重新提示；trace 超出上下文预算；KV 缓存填满 GPU；工具调用往返在长任务执行到一半时性能开始下降。V4 正是为了修复这些已知的故障模式而设计的，并为社区指明了方向。

本文涵盖三个方面：架构在哪些地方做了不同的处理，使得长上下文推理成本更低；在此基础上叠加的面向 agent 的后训练决策；以及从论文中得出的一些有助于理解这些变化的思考。

## KV 缓存问题与 Agent 的关系

100 万 token 的上下文窗口只是容量，不是性能。能否真正使用它，取决于在该深度下每次前向传播的成本。对于运行长工具使用轨迹的 agent（SWE-bench 任务、多步浏览会话、包含数百条命令的终端会话），每个工具结果都会被追加到上下文中，而后续的每个 token 都需要对之前所有内容支付完整的注意力计算成本。

有两个数字至关重要：单 token 推理 FLOPs 和 KV 缓存大小。两者都随序列长度增长。在 100 万 token 时，DeepSeek-V4-Pro 仅需 DeepSeek-V3.2 单 token 推理 FLOPs 的 27%，因此在相同硬件上运行更快；KV 缓存内存也仅为 V3.2 的 10%。V4-Flash 将这些数字进一步压缩：FLOPs 为 10%，KV 缓存仅为 7%。

如果将 KV 缓存内存与使用 8 头分组查询注意力、以 bfloat16 格式存储的成熟架构相比，DeepSeek V4 所需缓存大小约为其 2%。这使得在非常大的上下文下部署变得容易得多。

![图1：基准测试比较（左），每 token FLOPs 和 KV 缓存随序列长度的变化（右）。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig1_efficiency.png)

图1：基准测试比较（左），每 token FLOPs 和 KV 缓存随序列长度的变化（右）。

## 混合注意力：CSA 与 HCA

效率提升来自于将注意力机制分为两种，并在各层之间交替使用。

压缩稀疏注意力（Compressed Sparse Attention，CSA）通过带学习位置偏置的 softmax 门控池化，在序列维度上对 KV 条目进行 4 倍压缩。一个闪电检索器（FP4、ReLU 评分的多头点积）为每个查询挑选 top-k 压缩块。它继承了 V3.2 中 DeepSeek 稀疏注意力的稀疏选择思路，但在已经比原始序列短 4 倍的块上运行。检索器的搜索空间随之缩小。

![图3：CSA。压缩器将每 4 个 token 折叠为一个压缩 KV 条目。闪电检索器为每个查询挑选 top-k 压缩块。一个滑动窗口分支处理最近未压缩的 token。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig3_csa.png)

图3：CSA。压缩器将每 4 个 token 折叠为一个压缩 KV 条目。闪电检索器为每个查询挑选 top-k 压缩块。一个滑动窗口分支处理最近未压缩的 token。

重度压缩注意力（Heavily Compressed Attention，HCA）对 KV 条目进行 128 倍压缩，并舍弃稀疏选择。每个查询对所有压缩块进行稠密注意力计算。压缩后的序列足够短，使得稠密注意力代价低廉。

![图4：HCA。更重度的压缩器（128 倍对比 CSA 的 4 倍），随后对压缩流进行稠密注意力计算，以及相同的滑动窗口分支用于处理近期内容。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig4_hca.png)

图4：HCA。更重度的压缩器（128 倍对比 CSA 的 4 倍），随后对压缩流进行稠密注意力计算，以及相同的滑动窗口分支用于处理近期内容。

各层在 CSA 和 HCA 之间交替排列。不同层承载不同的注意力模式，在所有层上强制使用同一种机制会浪费容量。在 V4-Pro 的 61 层堆栈中，第 0–1 层为 HCA，第 2–60 层在 CSA 和 HCA 之间交替，末尾的 MTP 块仅使用滑动窗口。

两条路径均对大多数 KV 条目使用 FP8 存储，仅对 RoPE 维度使用 BF16。CSA 内部的闪电检索器以 FP4 运行。这些存储选择与压缩比相叠加，产生了 2% 的 KV 缓存占用率。

![图2：整体架构。注意力层在 CSA 和 HCA 之间交替。前馈层使用 DeepSeekMoE。残差连接替换为流形约束的超连接（mHC）。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig2_architecture.png)

图2：整体架构。注意力层在 CSA 和 HCA 之间交替。前馈层使用 DeepSeekMoE。残差连接替换为流形约束的超连接（mHC）。

## Agent 场景下有何不同

高效长上下文注意力对于 agent 工作流是必要条件，但还不够。论文中描述了三项直接针对 agent 使用场景的后训练和基础设施决策。

### 工具调用间的交错思考

V3.2 在工具结果的多轮对话中会保留推理 trace，但每当新的用户消息到来时就会将其丢弃。对于处理单个用户轮次的 agent，这没有问题。但对于多轮 agentic 工作流——用户在 agent 已完成若干工具调用链之后再发送跟进消息——模型会失去其积累的推理内容，并不得不重新构建状态。

V4 在对话包含工具调用时，跨用户消息边界保留推理内容。模型在所有轮次（包括跨用户轮次）中保持完整的推理历史，从而支持在长周期 agent 任务中形成连贯的、累积的思维链。对于不含工具的对话使用，仍保留旧行为：每轮刷新推理内容以保持上下文简洁。

![图7：带工具的思考（上）跨所有轮次保留推理内容。不带工具的思考（下）在每条新用户消息时丢弃推理内容。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig7_thinking.png)

图7：带工具的思考（上）跨所有轮次保留推理内容。不带工具的思考（下）在每条新用户消息时丢弃推理内容。

### 带专用 token 的工具调用 schema

V4 引入了 `|DSML|` 特殊 token 和基于 XML 的工具调用格式。与 JSON 字符串工具调用相比，XML 格式减少了转义失败问题——这是模型生成嵌套引号内容时的常见失败模式。

该 schema 将字符串参数（通过 `string="true"` 原样传递）与结构化参数（通过 `string="false"` 以 JSON 格式传递）分离。这消除了 JSON 工具调用格式中经常遇到的数字和布尔值解析错误。

### DSec：为 RL 展开而构建的沙箱

Agent 行为是通过在真实工具环境中进行强化学习（RL）训练的。论文描述了为此目的构建的沙箱基础设施。DeepSeek Elastic Compute（DSec）是一个 Rust 平台，通过单一 Python SDK 暴露四种执行底层：函数调用、容器、微虚拟机（Firecracker）和完整虚拟机（QEMU）。单一集群可运行数十万个并发沙箱。

三项 DSec 特性对 agent 训练至关重要：通过分层 3FS 存储实现快速镜像加载（使 RL 展开无需等待容器启动）；支持抢占的轨迹回放（使中断的训练步骤无需重新运行工具调用即可恢复）；以及跨底层的统一 API（使训练 harness 无需重写即可针对函数调用或完整虚拟机）。这些基础设施决策支撑了 agent 基准测试成绩。

## Agent 基准测试结果

知识和推理数字具有竞争力，但不居领先。agent 数字才是 V4-Pro-Max 与竞争对手拉开差距的地方。

论文表 6 agent 部分的具体数字：

Terminal Bench 2.0：V4-Pro-Max 得分 67.9，超过 GLM-5.1（63.5）和 K2.6（66.7），落后于 GPT-5.4-xHigh（75.1）和 Gemini-3.1-Pro（68.5）。

- SWE Verified：解决率 80.6，与 Opus-4.6-Max（80.8）和 Gemini-3.1-Pro（80.6）相差不超过 1 分。

- MCPAtlas Public：73.6，仅次于 Opus-4.6-Max（73.8）。

- Toolathlon：51.8，超过 K2.6（50.0）、GLM-5.1（40.7）和 Gemini-3.1-Pro（48.8）。

在论文内部的研发编程基准测试中——涵盖 PyTorch、CUDA、Rust 和 C++ 的 30 个精选任务——V4-Pro-Max 达到 67% 的通过率，而 Sonnet 4.5 为 47%，Opus 4.5 为 70%。在一项对 85 位将 V4-Pro 作为日常主力使用的 DeepSeek 开发者的调查中，52% 表示它已准备好取代当前的主要编码模型，39% 倾向于"是"。

长上下文检索数字见图 9。MRCR 8 针准确率在 256K token 时仍保持在 0.82 以上，在 100 万 token 时维持在 0.59。

![图9：MRCR 8 针检索。V4-Pro-Max 在 256K token 时保持在 0.82 以上，在 100 万 token 时维持在 0.59。](https://huggingface.co/buckets/burtenshaw/deepseek-v4-figures/resolve/v4_fig9_mrcr.png)

图9：MRCR 8 针检索。V4-Pro-Max 在 256K token 时保持在 0.82 以上，在 100 万 token 时维持在 0.59。

## 使用模型

Hub 上有四个检查点。instruct 模型对 MoE 专家权重使用 FP4，其余部分使用 FP8。base 模型全部使用 FP8。

- deepseek-ai/DeepSeek-V4-Pro（1.6T / 激活 49B，instruct）

- deepseek-ai/DeepSeek-V4-Flash（284B / 激活 13B，instruct）

- deepseek-ai/DeepSeek-V4-Pro-Base（1.6T / 激活 49B，base）

- deepseek-ai/DeepSeek-V4-Flash-Base（284B / 激活 13B，base）

两个 instruct 模型均支持三种推理模式：Non-think（快速，无思维链）、Think High（在 `<think>` 块中进行显式推理）和 Think Max（最大推理力度，需要专用系统提示）。Think Max 需要至少 384K token 的上下文窗口。所有模式的推荐采样参数均为 `temperature=1.0`，`top_p=1.0`。

V4-Pro 在 SWE Verified、MCPAtlas 和内部研发基准上的数字使其在 agent 任务方面与前沿闭源模型不相上下。开放的问题是：社区的工具 harness 将如何适配 `|DSML|` schema，以及交错思考的收益是否能迁移到非原生 agent 框架。

本文中的图表均来自技术报告 DeepSeek_V4.pdf。

---

## 引用

- 原文：[DeepSeek-V4: A Million-Token Context That Agents Can Actually Use](https://huggingface.co/blog/deepseekv4)
