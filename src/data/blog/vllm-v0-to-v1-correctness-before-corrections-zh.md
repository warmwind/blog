---
title: vLLM V0 到 V1：RL 中先保证正确性，再做修正
pubDatetime: 2026-05-09T11:00:00+08:00
description: ServiceNow AI 分享了将 vLLM 从 V0 迁移到 V1 的经验：修复了 logprob 语义、运行时默认值、动态权重更新和 fp32 lm_head 四个问题，恢复了与 V0 参考训练的对等性。
slug: vllm-v0-to-v1-correctness-before-corrections-zh
originalTitle: "vLLM V0 to V1: Correctness Before Corrections in RL"
originalUrl: "https://huggingface.co/blog/ServiceNow-AI/correctness-before-corrections"
tags:
  - AI
  - vLLM
  - 强化学习
  - 推理引擎
---

原文标题：vLLM V0 to V1: Correctness Before Corrections in RL<br>
原文链接：https://huggingface.co/blog/ServiceNow-AI/correctness-before-corrections

---

[PipelineRL](https://github.com/ServiceNow/PipelineRL/) 使用 vLLM 作为推理引擎进行 rollout 生成。推理引擎对 token 进行采样并返回 token 的对数概率（logprobs）；训练器使用这些 logprobs 来计算策略比率、KL 散度、截断率、熵和奖励。这些 logprobs 的计算方式上的任何差异都可能改变训练动态。这就是我们在从 vLLM V0 迁移到 V1 时需要消除的训练-推理不匹配问题。

**总结：** 在修复了四个问题之后，vLLM V1 与我们的 vLLM V0 参考对齐了：处理后的 rollout logprob、V1 特定的运行时默认值、动态权重更新路径，以及用于最终投影的 fp32 `lm_head`。我们在更改 RL 目标之前先修复了后端行为。

参考运行使用了 vLLM `0.8.5`；V1 运行使用了 vLLM `0.18.1`。图 1 展示了最终结果。红色运行是最初的 V1 尝试，绿色运行是应用以下修复后的最终 V1 运行。

![](https://cdn-uploads.huggingface.co/production/uploads/61f750055596aa721ce68efe/2Q2pkNtiYPrlLVLoH51dO.png)

图 1. vLLM V0 参考（蓝色）、初始 vLLM V1 尝试（红色）和应用修复（包括 fp32 `lm_head`）后的最终 vLLM V1 运行（绿色）的训练器端指标。最终 V1 运行在截断率、KL 散度、熵和奖励方面接近 V0 的轨迹。

## 迁移目标

vLLM V1 是对 V0 引擎的大规模重写。因此，我们的迁移目标是有意地设定得很窄：

- 验证 V1 以训练器期望的形式返回 rollout logprob
- 在 V0 参考上重跑相同的工作负载
- 仅在后端一致性恢复后再评估目标层面的变更

最初的可见症状出现在：

- `clamp_log_ratio_new_old_indicator`
- `kl_new_old`
- `entropy`
- `reward`

这些指标来自于一次 GSPO 训练运行，即本次实验使用的目标函数。同类不匹配问题可能出现在 PPO、GRPO 或任何将 rollout 端 logprob 作为优化目标一部分的在线 RL 系统中。

初始 V1 运行清楚地展示了这个问题。训练器端的 logprob 和奖励在训练早期就偏离了 V0 参考。

![](https://cdn-uploads.huggingface.co/production/uploads/61f750055596aa721ce68efe/YhRfKIEKndf4LGG9g7Ck9.png)

图 2. 训练器在更新期间计算的当前策略 logprob（左）和奖励（右）。初始 vLLM V1 运行（红色）从 vLLM V0 参考（蓝色）中分离出来。

同样的模式出现在训练器指标中。截断率是初始比较中最容易读取的信号。

![](https://cdn-uploads.huggingface.co/production/uploads/61f750055596aa721ce68efe/6fQ4PVHFb_bbYMzducj1o.png)

图 3. vLLM V0 参考（蓝色）和初始 vLLM V1 尝试（红色）的训练器端指标。截断率追踪 rollout/训练器策略差距；熵和奖励显示该差距如何传播到训练中。

## 失效模式

我们将可能的原因分为三层：

- **语义不匹配**：后端返回的 logprob 相对于训练器期望的含义不同。
- **推理路径不匹配**：后端对缓存、调度或请求处理使用不同的运行时默认值，因此相同的提示遵循不同的执行路径。
- **目标不匹配**：RL 目标需要针对剩余的过时程度或后端不匹配进行修正。

我们最初过早地怀疑是第三类。有用的诊断来自于将前两类视为后端行为问题，并首先排除它们。

## V1 后端修复

### Logprob 语义

第一个问题是语义性的。vLLM V1 默认情况下从原始模型输出返回 logprob，在对数 logit 后处理（如温度缩放、惩罚和 top-k/top-p 过滤）之前。PipelineRL 期望的是来自采样器使用的处理后分布的 logprob。

所需的设置为：

- `logprobs-mode=processed_logprobs`

这消除了 rollout logprob 中明显的均值偏移。训练曲线仍然显示出相对于已知良好参考的差距，因此下一个问题必须在推理路径中。

策略比率图直接显示了这一点。一旦为 V1 开启 `processed_logprobs`，三次运行中均值策略比率极其接近 `1.0`。这确立了均值偏置的修复。剩余的不匹配出现在截断率、KL 散度、熵和下游训练行为中。

![](https://cdn-uploads.huggingface.co/production/uploads/61f750055596aa721ce68efe/K0PQyxwunQUipAXv9Iy1n.png)

图 4. rollout/训练器策略比率偏离 1.0 的每步偏差，放大 10,000 倍，用于 vLLM V0 参考（蓝色）、初始 vLLM V1 运行（红色）和修正后的 vLLM V1 运行（绿色）。

### 运行时默认值

早期 V1 运行将引擎版本与 V1 运行时默认值混合在一起：

- 前缀缓存，在早期运行中未设置，因此应用了 vLLM `0.18.1` 的默认值
- 异步调度，在早期运行中未设置，因此应用了 vLLM `0.18.1` 的默认值
- 一个临时的 `disable-cascade-attn` 覆盖，通过启动时的 kwarg 传递设置，位于已提交配置中的一致性配方之外

对于一致性运行，我们明确了这些选择：

```
vllm_config:
  use_v1: true
  vllm_kwargs:
    logprobs-mode: processed_logprobs
    enable-prefix-caching: false
    async-scheduling: false
```

前缀缓存值得单独说明。它通常是固定模型状态下的保持正确性的推理优化。在这个在线 RL 设置中，相对于 V0 参考路径，它是缓存生命周期和重用上的一个仅限 V1 的差异。actor 还在处理重复的前缀、并发请求、异步调度和动态权重更新。

前缀缓存命中可能会在缓存策略忽略权重更新边界时重用权重更新之前计算的状态。禁用前缀缓存消除了一致性比较中的一个仅限 V1 的自由度。

### 动态权重更新

权重同步也必须与在线 RL 更新模型相匹配。一种选择是通过在每次更新时排空请求和清除缓存，使 V1 比 V0 更严格。这会回答另一个问题。我们首先需要验证 V1 可以匹配现有的 V0 行为。

V0 实际上所做的更接近于：

- 在引擎边界处阻塞执行
- 加载新权重
- 恢复而不显式使缓存状态失效

最接近的 V1 类比是：

```python
await engine.pause_generation(mode="keep", clear_cache=False)
await engine_client.collective_rpc_async(
    "receive_weight_update",
    args=(request.model_dump_json(),),
)
await engine.resume_generation()
```

两个细节很重要：

- `mode="keep"` 比 `wait` 或 `abort` 更接近旧的动态更新模型
- `clear_cache=False` 匹配 V0 包装器行为，后者在更新时保持缓存状态完整

延迟是一个有用的运行时诊断。初始 V1 路径在训练后期比修正后的 V1 运行携带更多持续延迟。

![](https://cdn-uploads.huggingface.co/production/uploads/680ba1729f7688275d2ce0f4/XWXONkgJtznG09PVLFCAl.png)

图 5. rollout 服务器中的权重落后于训练器策略的步数，用于 vLLM V0 参考（蓝色）、初始 vLLM V1 运行（红色）和修正后的 vLLM V1 运行（绿色）。

## 剩余差距：fp32 lm_head

上述 V1 后端修复消除了明显的迁移问题，但最终的一致性仍然需要匹配用于计算 logit 的数值路径。训练器使用 fp32 的 `lm_head` 进行最终投影。rollout 后端必须匹配这一行为。

[MiniMax-M1 技术报告](https://arxiv.org/abs/2506.13585)中出现了一个密切相关的问题：他们的 RL 运行显示了训练/推理 token 概率不匹配，他们将其追溯到 LM 输出头，并通过以 fp32 计算头来修复。

这很重要，因为 RL 更新直接消费 token logprob。logit 中的细微变化可能在策略比率、KL 散度和截断中变得可见。因此，最终投影精度是在线 RL 正确性表面的一部分。[ScaleRL 论文](https://arxiv.org/abs/2510.13786)后来将 fp32 logit/头计算作为其 RL 配方的一部分，并将其作为大规模 RL 的有用设计选择进行了消融。

包含 fp32 `lm_head` 路径后，奖励给出了最终一致性结果的紧凑视图。在图 6 中，最终 V1 运行追踪 V0 参考；初始 V1 尝试产生了明显不同的奖励曲线。

![](https://cdn-uploads.huggingface.co/production/uploads/680ba1729f7688275d2ce0f4/oCuXYiTLSl6-jPJLBzWoU.png)

图 6. vLLM V0 参考（蓝色）、初始 vLLM V1 尝试（红色）和包含 fp32 `lm_head` 路径的最终 vLLM V1 运行（绿色）的奖励。包含 fp32 头后，最终 V1 运行追踪 V0 参考。

## 消融实验

负面结果很重要，因为它们排除了常见的解释。

- **仅 `processed_logprobs`**：修复了语义 logprob 错误；训练不匹配仍然存在。
- **批次不变性**：在单独的测试中，不匹配仍然存在，延迟更高，截断率更高，且存在 NCCL 复杂性。
- **将第一次 V1 运行视为公平基线**：第一次 V1 运行启用了多个仅限 V1 的默认值，因此这是一个混淆的迁移比较。

## 为什么我们先修复后端正确性

截断重要性采样、重要性比率重加权和相关方法等目标端修正是有用的工具。如果 rollout 是有意地过时的、异步生成的，或者由一个无法保证与训练器端策略等价的后端生成的，那么添加某种形式的修正通常是正确的做法。

这里的第一个问题是推理正确性。迁移到 V1 后，rollout 后端返回了破坏训练器假设的 logprob 和运行时行为。在那时添加目标端修正本来会混淆两个问题：

- 推理后端是否在生成正确的 logprob？
- 给定正确的 logprob，目标是否仍然需要离策略或异步修正？

这些问题需要分开处理。否则，目标端修正可能会补偿损坏的推理后端行为，这使得训练曲线更难以解释。

当前目标仍然可以改进。推理一致性恢复后，下一个改进是常见的异步/离策略清理：

- 在 rollout 时保留显式行为策略 logprob
- 在优化时重新计算训练器端的旧策略 logprob
- 将后端不匹配修正与策略更新比率分离
- 追踪修正项的 ESS 等诊断以及聚合训练器指标

这次迁移的主要教训更为简单：**先修复后端正确性，然后再对剩余的不匹配添加修正。**

---

## 引用

- 原文：[vLLM V0 to V1: Correctness Before Corrections in RL](https://huggingface.co/blog/ServiceNow-AI/correctness-before-corrections)
- PipelineRL：[https://github.com/ServiceNow/PipelineRL/](https://github.com/ServiceNow/PipelineRL/)
- MiniMax-M1 技术报告：[https://arxiv.org/abs/2506.13585](https://arxiv.org/abs/2506.13585)
- ScaleRL 论文：[https://arxiv.org/abs/2510.13786](https://arxiv.org/abs/2510.13786)
