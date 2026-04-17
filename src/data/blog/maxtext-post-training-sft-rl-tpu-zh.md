---
title: MaxText 扩展后训练能力：在单主机 TPU 上引入 SFT 和 RL
pubDatetime: 2026-04-17T11:00:00+08:00
description: MaxText 现在支持在单主机 TPU 配置上进行监督微调（SFT）和强化学习（RL），结合 JAX 效率和 GRPO 等先进算法，为专项任务和复杂推理精炼 LLM。
slug: maxtext-post-training-sft-rl-tpu-zh
originalTitle: "MaxText Expands Post-Training Capabilities: Introducing SFT and RL on Single-Host TPUs"
originalUrl: https://developers.googleblog.com/maxtext-expands-post-training-capabilities-introducing-sft-and-rl-on-single-host-tpus/
---

原文标题：MaxText Expands Post-Training Capabilities: Introducing SFT and RL on Single-Host TPUs<br>
原文链接：https://developers.googleblog.com/maxtext-expands-post-training-capabilities-introducing-sft-and-rl-on-single-host-tpus/

![MaxText 构建封面图](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Building-1-banner_Tg8sqqU.original.png)

在大型语言模型（LLM）快速演进的背景下，预训练只是第一步。要将基础模型转变为专业助手或高性能推理引擎，后训练（post-training）不可或缺。今天，我们非常高兴地宣布 [MaxText](https://github.com/AI-Hypercomputer/maxtext) 的新特性，这些特性将简化这一过程：**监督微调（SFT）** 和 **强化学习（RL）** 现已可在单主机 TPU 配置（如 v5p-8 和 v6e-8）上使用。

通过利用 JAX 的强大功能和 [Tunix](https://github.com/google/tunix/tree/main) 库的高效性，MaxText 为开发者提供了一条高性能、可扩展的路径，使用最新的后训练技术精炼他们的模型。你可以查阅 [SFT](https://maxtext.readthedocs.io/en/maxtext-v0.2.1/tutorials/posttraining/sft.html) 和 [RL](https://maxtext.readthedocs.io/en/maxtext-v0.2.1/tutorials/posttraining/rl.html) 的完整文档，立即开始你在 TPU 上的后训练之旅。

### 监督微调（SFT）：简化精准调优

监督微调是将预训练模型适配为遵循特定指令或在细分任务上表现卓越的主要方法。有了全新的单主机 SFT 支持，用户现在可以使用现有的 MaxText 或 Hugging Face 检查点，在标注数据集上以最少的设置进行微调。

**关键亮点：**

- **无缝集成：** 原生支持 Hugging Face 数据集（例如 ultrachat_200k）。
- **灵活的检查点：** 使用现有的 MaxText 检查点，或直接在生态系统内转换 Hugging Face 模型（如 Gemma 3）。
- **优化执行：** 由 Tunix 提供支持，Tunix 是一个专为后训练效率设计的 JAX 库。

### 强化学习（RL）：提升推理能力

对于需要复杂逻辑和推理的任务——例如数学或编程——强化学习是一个改变游戏规则的方案。MaxText 现在支持在单主机 TPU 上运行多种最先进的 RL 算法，在训练循环中利用 **vLLM** 进行高吞吐量推理。例如：

1. **组相对策略优化（GRPO）** GRPO 是 PPO（近端策略优化）的内存高效变体。它消除了对单独价值函数模型的需求，取而代之的是为每个提示生成多个响应，并在组内计算相对优势。这显著减少了硬件占用，使高级 RL 能够在单个 TPU 主机上实现。

2. **组序列策略优化（GSPO）** GSPO 专注于序列级别的重要性比率和裁剪。它通过在序列级别奖励模型行为来提高训练稳定性和效率，使其在提升 GSM8K 等基准测试上的性能方面特别有效。

### 开始使用

要开始使用这些新特性，请确保已安装最新的后训练依赖：

```shell
uv pip install maxtext[tpu-post-train]==0.2.1 --resolution=lowest
install_maxtext_tpu_post_train_extra_deps
```

#### 运行 SFT：

你可以使用 train_sft 模块启动 SFT 训练，指定你的模型、数据集和输出目录：

```shell
python3 -m maxtext.trainers.post_train.sft.train_sft \
   model_name=${MODEL?} \
   load_parameters_path=${MAXTEXT_CKPT_PATH?} \
   run_name=${RUN_NAME?} \
   base_output_directory=${BASE_OUTPUT_DIRECTORY?}
```

#### 运行 RL（GRPO/GSPO）：

对于 RL，train_rl 模块负责加载策略模型和参考模型，执行训练，并在推理基准测试上提供自动评估：

```shell
python3 -m maxtext.trainers.post_train.rl.train_rl \
  model_name=${MODEL?} \
  load_parameters_path=${MAXTEXT_CKPT_PATH?} \
  run_name=${RUN_NAME?} \
  base_output_directory=${BASE_OUTPUT_DIRECTORY?} \
  loss_algo=gspo-token \
  chips_per_vm=${CHIPS_PER_VM?}
```

### 下一步是什么？

虽然单主机支持为许多开发者提供了强大的入口点，但 MaxText 是为规模化而构建的。这些相同的工作流程被设计为对于那些训练更大模型和利用大规模数据集的用户，能够无缝过渡到多主机配置。请继续关注我们未来在这方面的更多更新。

## 引用

- 原文：[MaxText Expands Post-Training Capabilities: Introducing SFT and RL on Single-Host TPUs](https://developers.googleblog.com/maxtext-expands-post-training-capabilities-introducing-sft-and-rl-on-single-host-tpus/)
- [MaxText GitHub 仓库](https://github.com/AI-Hypercomputer/maxtext)
- [Tunix 库](https://github.com/google/tunix/tree/main)
- [SFT 文档](https://maxtext.readthedocs.io/en/maxtext-v0.2.1/tutorials/posttraining/sft.html)
- [RL 文档](https://maxtext.readthedocs.io/en/maxtext-v0.2.1/tutorials/posttraining/rl.html)
