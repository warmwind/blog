---
title: "在 Google TPU 上为 LLM 推理提速：DFlash 扩散式投机解码实现 3 倍加速"
pubDatetime: 2026-05-06T11:00:00+08:00
description: "UCSD 研究团队将 DFlash 块扩散投机解码框架集成到 vLLM TPU 推理生态系统，在 TPU v5p 上实现平均 3.13 倍加速，数学和编程任务接近 6 倍加速，并发现了 K-Flat 硬件验证特性。"
slug: supercharging-llm-inference-google-tpu-dflash-zh
originalTitle: "Supercharging LLM Inference on Google TPUs: Achieving 3X Speedups with Diffusion-Style Speculative Decoding"
originalUrl: https://developers.googleblog.com/supercharging-llm-inference-on-google-tpus-achieving-3x-speedups-with-diffusion-style-speculative-decoding/
---

原文标题：Supercharging LLM Inference on Google TPUs: Achieving 3X Speedups with Diffusion-Style Speculative Decoding<br>
原文链接：https://developers.googleblog.com/supercharging-llm-inference-on-google-tpus-achieving-3x-speedups-with-diffusion-style-speculative-decoding/

*作者：Weiren Yu（Product Manager）、Yarong Mu（Senior Staff Software Engineer, Google Cloud）、Lihao Ran（Software Engineer, Google Cloud）、Zhaoxiang Feng（Research Assistant, UCSD）、Yiming Zhao（Research Assistant, UCSD）、Hao Zhang（Assistant Professor, UCSD）*

*发布时间：2026 年 5 月 4 日*

![Gemini_Generated_Image_5uj3px5uj3px5uj3](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_Generated_Image_5uj3px5uj3px5uj3.original.jpg)

当前大语言模型（LLM）加速领域的主流方向是自回归投机解码：一个轻量级草稿器**顺序**预测多个 token，再由目标模型进行验证。然而，这种串行草稿方法引入了一个根本性的执行瓶颈：生成 *K* 个候选 token 需要 *K* 次串行前向传播。这种逐步依赖迫使系统等待每个 token 预测完成后才能开始下一个，从根本上限制了草稿阶段的加速潜力。为打破这一效率瓶颈，研究人员将目光投向逐 token 草稿之外的**块扩散**——这一范式转变使得整块候选 token 的生成只需一次 *O*(1) 单次前向传播。

我们很自豪地支持外部研究人员突破 AI 硬件的边界。今天，我们很高兴介绍 UCSD 研究人员的一项重大开源里程碑，该团队由 **paged attention** 和 **prefill/decode 分离式服务**的共同发明者 **Hao Zhang** 领衔。他们**成功在 Google TPU 上实现了块扩散投机解码**（即 [DFlash](https://arxiv.org/abs/2602.06036)，由 UCSD Z Lab 的 Zhijian Liu、Jian Chen 等人开发的一种卓越的扩散式投机解码方法）。

通过将这一新颖架构直接集成到开源 **vLLM TPU 推理**生态系统，UCSD 团队在 TPU v5p 上实现了平均 **3.13 倍的 tokens/秒提升**，在复杂数学任务上的峰值加速接近 **6 倍**。在 **TPU v5p** 上 DFlash 与 EAGLE-3 的端到端服务对比中，[DFlash](https://arxiv.org/abs/2602.06036) 实现了 2.29 倍的端到端服务加速，**几乎是** [EAGLE-3](https://arxiv.org/abs/2503.01840) 1.30 倍性能提升的两倍。

以下是来自 UCSD 研究人员的技术深度解析，详细介绍了他们的构建方式、性能基准，以及这对 Google TPU 生态系统未来的意义。

## 克服自回归瓶颈

标准 LLM 推理以自回归方式生成文本。这意味着模型每生成一个 token 就需要一次完整的前向传播，严重低估了 TPU 等 AI 加速器的海量并行计算能力，尤其在较低批次大小时尤为明显。

**投机解码**通过使用一个较小的高效"草稿"模型（或机制）同时预测多个未来 token 来缓解这一问题。较大的"目标"模型随后在单次并行前向传播中验证这些草稿 token。如果草稿 token 准确，系统就能以单步的代价接受多个 token，从而大幅降低延迟。

然而，投机解码的潜力常常受到草稿模型本身的制约。大多数现有方法依赖**自回归草稿机制**，顺序生成候选 token。这意味着，尽管目标模型的验证是并行的，草稿阶段仍受 *O(K)* 串行步骤的瓶颈制约。因此，"猜测"token 所花费的时间开始侵蚀验证节省的时间，使实际加速潜力受到限制。

## 在 Google TPU 上的扩散式草稿

扩散 LLM（dLLMs）从根本上改变了游戏规则，以**块扩散**机制取代了这一串行过程。与逐字猜测不同，dLLM"涂绘"整个块。DFlash 是一种值得关注的基于 dLLM 的草稿方法，通过利用从目标模型提取的隐藏特征，DFlash 可以在单次前向传播中生成整个草稿 token 块。这种从 *O(K)* 到 *O*(1) 复杂度的转变将草稿延迟降至几乎可以忽略不计的水平，使其成为 TPU 高带宽矩阵乘法单元（MXUs）的完美架构匹配。

UCSD 研究团队将 **DFlash** 集成到 **vLLM TPU 推理框架**中。DFlash 是一种利用块扩散机制以极高接受长度（*T*）提出草稿 token 的新型投机解码方法。

在 Google TPU 上的实现需要深度优化。在 Google Cloud 工程师的架构指导下，UCSD 团队最小化了开销，确保内存带宽和矩阵乘法单元得到充分利用。通过将 DFlash 提议器和验证流水线高效映射到 TPU 架构，他们在最大化目标模型并行验证吞吐量的同时，最小化了草稿阶段的开销。

## 将 DFlash 移植到 TPU/JAX

将 DFlash 从其原始 GPU/PyTorch 实现移植到 Google TPU/[JAX AI Stack](https://docs.cloud.google.com/tpu/docs/jax-ai-stack) 生态系统，不仅仅是简单的代码翻译，而是需要对系统进行重新设计，以适配 TPU 的独特架构优势。以下是 UCSD 团队如何解决三个主要技术难题的方案。

### Attention 的"双缓存"解决方案

在 PyTorch 世界中，DFlash 依赖简单的动态 KV 管理。然而，通过 [tpu-inference](https://github.com/vllm-project/tpu-inference) 进行的高性能 TPU 服务使用基于 Pallas 内核的分页注意力机制——一种将内存划分为固定大小页面以最大化效率的系统。

问题在于：DFlash 的非因果块扩散——正是使其能够"涂绘"token 块的特性——与标准分页注意力从根本上不兼容。为解决这一问题，研究人员设计了一种**双缓存架构**。**目标模型**继续使用分页 KV 缓存，确保其从大规模服务所需的高性能 Pallas 内核中获益。**草稿模型**则使用带有设备上静态 JAX 数组的专用路径，成功复制了原始 DFlash 设计，同时保持 TPU 原生性能。

### 智能上下文管理

DFlash 的独特之处在于草稿模型是"目标条件化"的——它通过观察目标模型的中间推理步骤来保持智能。这些"隐藏状态"存储在随时间增长的**上下文缓冲区**中。

为了尽可能快地保持主机 CPU 与 TPU 加速器之间的通信，团队实现了**2 的幂次填充**策略。这确保了新投影特征追加到缓冲区时，以优化的块进行传输。通过精确跟踪草稿模型已"消费"的上下文量，防止任何重复处理或数据丢失，从而保持并行草稿的高度准确性。

### 弥合 TPU 推理中的元数据差距

与标准草稿方法不同，DFlash 具有独特的有状态性，依赖跨迭代的**持久状态**（包括上下文缓冲区、KV 缓存位置和 RoPE 偏移量）来维持其并行块预测。在 TPU 优化的 vLLM 流水线中，转发给提议器的元数据包括当前正在验证的草稿 token。这对大多数模型来说是标准的，但对于基于扩散的架构，这导致了"序列长度膨胀"——内部草稿状态与目标模型的实际情况产生了错位。

通过重新设计提议器，使其严格与真实接受 token 数量同步，研究团队恢复了两个模型之间的完美**对齐**。这一调整使块扩散逻辑能够在 TPU 硬件上以完整的数学精度运行，从而释放了最终结果中看到的显著加速效果。

## 对 TPU 服务未来的基准测试

### 正面交锋：TPU v5p 上的 DFlash vs. EAGLE-3

为确保严格公正的比较，UCSD 研究人员在 TPU 上的主流投机解码方法 EAGLE-3 上对 DFlash 进行了基准测试。在这项比较研究中，研究人员对两者使用了完全相同的硬件（TPU v5p）和相同的目标模型（Llama-3.1-8B）。

![DFlash vs. Eagle3 on the vLLM TPU pipeline & v5p TPUs. Model: Llama-3.1-8B-Instruct (target) + z-lab/LLaMA3.1-8B-Instruct-DFlash-UltraChat (DFlash draft, K=10) / yuhuili/EAGLE3-LLaMA3.1-Instruct-8B (EAGLE-3 draft, K=2)](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/table1.original.png)

*DFlash 与 EAGLE-3 在 vLLM TPU 流水线和 v5p TPU 上的对比。模型：Llama-3.1-8B-Instruct（目标模型）+ z-lab/LLaMA3.1-8B-Instruct-DFlash-UltraChat（DFlash 草稿，K=10）/ yuhuili/EAGLE3-LLaMA3.1-Instruct-8B（EAGLE-3 草稿，K=2）*

该设置代表了两种方法最实际的部署场景，因为 K 值的选择基于各自官方开源检查点，**开箱即用**，无需额外微调或重新配置。像 EAGLE-3 这样的自回归草稿器会产生随 K 线性增长的串行延迟惩罚，这通常将其限制在较小的投机预算内以维持较低的每 token 延迟。相比之下，DFlash 使用并行块扩散在单次前向传播中预测所有 token，使草稿成本基本上对 K 不敏感。结果是决定性的：DFlash 实现了 2.29 倍加速，而 EAGLE-3 仅提升了 1.30 倍。在 mbpp 等编程任务上，DFlash 将生成时间从每 token 9.81ms 压缩到 3.48ms，提升了 2.83 倍。

差距为何如此之大？EAGLE-3 **每步自回归预测 2 个 token**，需要串行前向传播，且每步之间有 Python 编排开销。而 DFlash 则在单次前向传播中生成**一个包含 10 个高质量候选 token 的块**，完全消除了这一串行瓶颈。在 TPU 上，这种"高质量、高数量"的草稿输出直接转化为更高的平均接受长度，将 TPU 的海量计算潜力转化为实际的服务吞吐量。

### TPU v5p 上的基准测试结果

为评估 DFlash 在 Google TPU 上的影响，UCSD 团队在 TPU v5p 上跨多个领域对其实现进行了基准测试，重点关注复杂推理、数学和编程——这些领域的长上下文生成通常面临高延迟问题。

UCSD 团队构建了一个**独立 JAX 基准**来评估 DFlash 结果。通过剥离服务层开销，他们能够隔离 DFlash-on-TPU 算法的原始性能。他们观察到跨所有数据集**平均 3.13 倍的加速**，在数学推理方面有显著峰值。

![Benchmark results on v5p TPUs. Models: Qwen/Qwen3-4B (target) + z-lab/Qwen3-4B-DFlash-b16 (draft, K=16); greedy decoding](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/table2.original.png)

*v5p TPU 上的基准测试结果。模型：Qwen/Qwen3-4B（目标模型）+ z-lab/Qwen3-4B-DFlash-b16（草稿，K=16）；贪婪解码*

对于 *math500* 等严格数学任务，DFlash 将生成时间从每 token 8.02ms 降至 **1.40ms**。在 *humaneval* 等编程评估中，生成速度提升超过 3.5 倍。

## 对投机效率的深度洞察

### "K-Flat"突破：为何更宽是免费的

在优化过程中，研究团队发现了一个改变工程师对投机限制思考方式的硬件特性：**K-Flat 验证**。

在 TPU v5p 等数据中心级加速器上，他们的系统性实验揭示了一个令人惊讶的现实：**验证 1024 个 token 的成本几乎与验证 16 个 token 的成本相同**。这种现象的出现是因为，在高端硬件上，时间主要被模型权重的加载所占据，而非这些序列长度下注意力机制的原始计算量。换句话说，硬件的计算上限如此之高，以至于检查更长"猜测"的额外工作基本上是免费的。

这一发现改变了整个研究前沿。它证明，投机解码的瓶颈不在于"验证成本"，而在于"草稿质量"。了解到更宽的块在计算上是免费的，开发者可以大胆地扩展草稿块大小，利用更丰富的双向上下文来提高准确性，而无需担心拖慢硬件速度。

### 扩展理论：质量优于数量

虽然数据中心级 AI 加速器使增加块大小（*K*）几乎"免费"，但他们的扩展理论揭示，简单地添加更多 token 会产生递减收益。在他们当前的工作点，K=16 的块大小已经捕获了理论最大加速的 90% 以上。事实上，将 K 从 16 扩展到 128 可能每步只能多接受不到一个 token。

真正的性能杠杆是**质量优于数量**。他们的分析表明，提高每位置接受概率（*a*）的价值是增加块大小 *K* 的 **2-3 倍**。这改变了研究重心：在验证成本恒定的环境中，主要瓶颈不再是系统能检查多少 token，而是能多准确地预测它们。LLM 服务的下一个前沿在于更智能的草稿训练，而不仅仅是更宽的投机窗口。

### 可预测性因素：任务驱动的加速

接受概率与任务的**可预测性**密切相关。团队观察到一种自然的"位置衰减"现象：块末尾的 token 比开头的 token 更难猜测。在**数学和编程**等逻辑驱动领域，这种衰减非常缓慢，即使在块的深处也保持高接受率。而对话聊天则更为随机，准确率在前几个 token 之后急剧下降。

这种可预测性直接驱动加速效果。由于结构化推理产生更可预测的序列，数学和代码任务允许更长的接受块，更有效地饱和 TPU 的并行验证能力。因此，DFlash 在数学推理中获得最高收益，其次是编程，而对话任务则有更适中的改善。

## 与 vLLM 的开源集成

这一合作的核心原则是丰富开源生态系统。与其作为内部研究原型保留，完整实现已提交到 [vLLM tpu-inference 代码库](https://github.com/vllm-project/tpu-inference)，涵盖：

- **PR [#1868](https://github.com/vllm-project/tpu-inference/pull/1868)**：DFlash 模型和提议器架构
- **PR [#1869](https://github.com/vllm-project/tpu-inference/pull/1869)**：投机解码的端到端流水线集成
- **PR [#1870](https://github.com/vllm-project/tpu-inference/pull/1870)**：全面的 CI 和端到端测试框架

UCSD 团队正在积极开发 torchax 提议器，以使 DFlash 也能在 PyTorch 服务路径上工作。

## 扩展投机系统的前沿

这一里程碑为下一波 Google TPU 创新奠定了基础。通过利用 DFlash 独特的并行采样，他们正在为投机式投机解码（Speculative Speculative Decoding, SSD）铺路，使用投机缓存在高吞吐量环境中大幅降低延迟。为了捕获更丰富的上下文并提高复杂推理的接受率，他们计划使用 TPU RL Stack [Tunix](https://github.com/google/tunix) 和 [MaxText](https://github.com/AI-Hypercomputer/maxtext) 扩展到更宽的草稿块。此外，新开发的高性能 JAX 内核为支持基于扩散的目标模型提供了基础，使 vLLM-TPU 生态系统始终处于高效非自回归生成的绝对前沿。

您可以通过 [Colab Notebook](https://colab.research.google.com/drive/1ekk8lY2u843KE9_dpJ36Z_vyv5idL-Pf?usp=sharing) 查看底层技术报告和实现细节，或直接深入 [vLLM GitHub 仓库](https://github.com/vllm-project/tpu-inference)中的代码。

## 研究提案征集

这项工作由 TPU Builder 计划提供支持，体现了我们授权学术和开源社区访问高性能硬件和 Google Cloud 积分的使命。如果您有兴趣将 TPU 用于研究、教学或开源开发，我们希望听到您的声音！发送邮件至 tpu-builders-support@google.com 与我们联系。

*致谢：衷心感谢 UCSD 研究团队，包括 Zhongyan Luo、Son Nguyen、Andy Huang。特别感谢 Kyuyeun Kim、Brittany Rockwell、Chris Chan、Mitali Singh、Yixin Shi 和 Gang Ji 团队协助 PR 落地，以及 Josh Gordon、Edgar Chen、Aditi Joshi、Shubha Rao、Mani Varadarajan、Joe Pamer、Fenghui Zhang、Hassan Sipra 和 Bill Jia 对 TPU Builder Program 研究合作伙伴关系的坚定支持和投入。*

---

## 引用

- 原文：[Supercharging LLM Inference on Google TPUs: Achieving 3X Speedups with Diffusion-Style Speculative Decoding](https://developers.googleblog.com/supercharging-llm-inference-on-google-tpus-achieving-3x-speedups-with-diffusion-style-speculative-decoding/)
- DFlash 论文：[arxiv.org/abs/2602.06036](https://arxiv.org/abs/2602.06036)
- vLLM tpu-inference 代码库：[github.com/vllm-project/tpu-inference](https://github.com/vllm-project/tpu-inference)
