---
title: 发布 NVIDIA Nemotron 3 Nano Omni：面向文档、音频和视频 Agent 的长上下文多模态智能
pubDatetime: 2026-04-29T10:30:00+08:00
description: NVIDIA 发布 Nemotron 3 Nano Omni，这是一款新型全模态理解模型，支持真实文档分析、自动语音识别、长音视频理解、Agentic 计算机使用和通用多模态推理，采用混合 Mamba-Transformer-MoE 骨干架构。
slug: nvidia-nemotron-3-nano-omni-multimodal-intelligence-zh
originalTitle: "Introducing NVIDIA Nemotron 3 Nano Omni: Long-Context Multimodal Intelligence for Documents, Audio and Video Agents"
originalUrl: https://huggingface.co/blog/nvidia/nemotron-3-nano-omni-multimodal-intelligence
tags:
  - NVIDIA
  - Multimodal
  - LLM
  - Agent
  - HuggingFace
---

原文标题：Introducing NVIDIA Nemotron 3 Nano Omni: Long-Context Multimodal Intelligence for Documents, Audio and Video Agents<br>
原文链接：https://huggingface.co/blog/nvidia/nemotron-3-nano-omni-multimodal-intelligence

- **NVIDIA Nemotron 3 Nano Omni** 是一款新型全模态理解模型，专为**真实文档分析、多图像推理、自动语音识别、长音视频理解、Agentic 计算机使用和通用推理**而构建。
- 它将 Nemotron 多模态系列从强大的视觉语言系统扩展到更广泛的**文本 + 图像 + 视频 + 音频**模型。
- Nemotron 3 Nano Omni 在复杂文档智能排行榜（如 [MMlongbench-Doc](https://huggingface.co/spaces/OpenIXCLab/mmlongbench-doc)、[OCRBenchV2](https://99franklin.github.io/ocrbench_v2/)）上实现了**最佳准确率**，同时在视频和音频排行榜（如 [WorldSense](https://jaaackhongggg.github.io/WorldSense/#leaderboard) 和 [DailyOmni](https://lliar-liar.github.io/Daily-Omni/#leaderboard)）上同样领先。它在音频理解方面达到了 [VoiceBench](https://matthewcym.github.io/VoiceBench/) 的顶级准确率，并在 [MediaPerf](https://mediaperf.org/leaderboard) 上荣登最具成本效益的开放视频理解模型之列。
- 在底层，它结合了 **Nemotron 3 混合 Mamba-Transformer 混合专家（MoE）骨干**与 **C-RADIOv4-H** 视觉编码器和 **Parakeet-TDT-0.6B-v2** 音频编码器。
- 该架构旨在保留精细的视觉细节，增加原生音频理解能力，并扩展至**超长多模态上下文**，适用于密集图像、文档、视频和混合模态推理。
- 训练方案采用**分阶段多模态对齐和上下文扩展**，随后进行**偏好优化和多模态强化学习**。
- 与替代方案相比，Nemotron 3 Nano Omni 在多模态使用场景中提供高达 9 倍的吞吐量和 2.9 倍的单流推理速度。
- 在 HuggingFace 下载 [BF16](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16)、[FP8](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8) 和 [NVFP4](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4) 检查点。
- 有关模型架构、训练方案、数据流水线和基准测试的更多信息，请阅读完整的 [Nemotron 3 Nano Omni 报告](https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Omni-report.pdf)。

**基准测试亮点**

在 Nemotron Nano V2 VL 的基础上，Nemotron 3 Nano Omni 实现了显著的视觉性能提升，并增加了全新的音频和视频+音频能力——同时在众多领域领先另一个开放权重全模态模型 Qwen3-Omni。

| 任务 | 基准测试 | Nemotron 3 Nano Omni | Nemotron Nano V2 VL | Qwen3-Omni 30B-A3B |
|---|---|---|---|---|
| 文档理解 | OCRBenchV2-En | **65.8** | 61.2 | - |
| | MMLongBench-Doc | **57.5** | 38.0 | 49.5 |
| | CharXiv 推理 | **63.6** | 41.3 | 61.1 |
| GUI | ScreenSpot-Pro | 57.8 | 5.5 | **59.7** |
| | OSWorld | **47.4** | 11.0 | 29.0 |
| 视频理解 | Video-MME | **72.2** | 63.0 | 70.5 |
| 视频+音频理解 | WorldSense | **55.4** | - | 54.0 |
| | DailyOmni | **74.1** | - | 73.6 |
| 语音交互 | VoiceBench | **89.4** | - | 88.8 |
| ASR | HF Open ASR（越低越好） | **5.95** | - | 6.55 |

**效率亮点**

与其他具有同等交互性的开放全模态模型相比，Nemotron 3 Nano Omni 在多文档使用场景中实现了 7.4 倍的系统效率提升，在视频使用场景中实现了 9.2 倍的系统效率提升。

[![Efficiency-Plots](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/rGMQD-HIFMJskyK7dIfHb.png)](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/rGMQD-HIFMJskyK7dIfHb.png)

*图 1. 在固定的每用户交互性阈值（tokens/sec/user）下，每个模型在多文档和视频使用场景中维持的总系统吞吐量*

## Nemotron 3 Nano Omni 的设计目标

从高层次来看，Nemotron 3 Nano Omni 针对五类工作负载而设计：

### 1. 真实文档分析

这不仅仅是 OCR 的问题。该模型定位于处理长篇、复杂、高价值文档——在这类文档中，理解取决于布局、表格、图形、公式、章节结构和跨页面引用。想想合同、技术论文、报告、手册、多页表格或合规文件包。该模型可处理 100 页以上的文档。

### 2. 自动语音识别

Nemotron 3 Nano Omni 具备强大的语音理解能力，可在各种音频条件下实现高质量转录。它能处理具有不同说话人、口音和背景噪音的长音频。这些能力可集成到更广泛的工作流程中，使口语内容能够被转录、分析，并与其他模态结合，用于摘要、问答和跨模态推理等任务。

### 3. 长音视频理解

许多企业和开发者工作流程依赖于混合音频和视觉证据：带旁白的屏幕录像、带幻灯片的培训视频、会议、教程、产品演示、客户支持录像和长视频档案。Nemotron 3 Nano Omni 专为联合推理这些输入而构建。

### 4. Agentic 计算机使用

Nemotron 3 Nano Omni 模型经过专门训练，用于 Agentic 计算机使用，使其能够在图形用户界面（GUI）环境中协助完成任务。其功能包括解读屏幕截图、监控用户界面状态、将推理根植于屏幕视觉内容，以及帮助进行动作选择或工作流自动化。

### 5. 通用多模态推理

该模型的设计不止于感知。它在推理密集型任务中表现卓越，这些任务需要在长 Context Window、多种模态以及结构化或半结构化证据中综合信息。它可以进行多步推理、执行计算，并连接来自文本、图像、表格和其他输入的信号，以得出连贯、有充分支撑的答案。

## 模型架构与关键创新

Nemotron 3 Nano Omni 采用统一的**编码器-投影器-解码器**设计。语言骨干是 Nemotron 3 Nano 30B-A3B，搭配 C-RADIOv4-H 视觉编码器和 Parakeet-TDT-0.6B-v2 音频编码器。模态专属编码器通过轻量级投影器连接到 LLM 骨干。

[![Nemotron_arch_v3_reduced](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/r408GJ1edj5Q7ao-lIOZp.png)](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/r408GJ1edj5Q7ao-lIOZp.png)

*图 2. NVIDIA Nemotron 3 Nano Omni 30B-A3B 的模型架构*

### 用于长多模态上下文的混合 Mamba-Transformer-MoE 骨干

模型骨干交错了三个关键组件：**23 个 Mamba 选择性状态空间层**，用于高效的长上下文处理；**23 个 MoE 层**，具有 **128 个专家、top-6 路由**和一个**共享专家**，提供条件容量；以及 **6 个分组查询注意力层**，以保持强大的全局交互和表达能力。

Nemotron 3 Nano Omni 在统一设计中结合了状态空间模型、注意力机制和 MoE，在保持强大推理性能的同时，对长多模态上下文保持实用性。

### 针对密集文档、图表和屏幕的动态分辨率

在视觉方面，Nemotron 3 Nano Omni 将 v2 模型中使用的切块策略替换为**以原始宽高比进行动态分辨率处理**。每张图像可以使用可变数量的 16×16 个图像块表示，**每张图像最少 1,024 个，最多 13,312 个视觉图像块**。对于正方形图像，这相当于 512×512 到 1840×1840。

这种灵活性对于处理高分辨率、复杂视觉输入至关重要——如 OCR 密集文档、财务表格、幻灯片、研究图形、截图和 GUI 布局——尤其是当需要同时理解精细细节和整体结构时。

### 用于视频的 Conv3D 时序压缩

对于视频，Nemotron 3 Nano Omni 使用专用的 **Conv3D 管状嵌入**路径。与独立嵌入每一帧不同，每对连续帧在 ViT 之前被融合成单个"管状体"，将语言模型需要关注的视觉 token 数量减半。这使我们能够在相同 token 预算下将帧数加倍，或在相同帧数下将 token 数量减半。

### EVS — 高效视频采样

EVS 是一项重要功能，在推理时启用，可以在视觉编码器之后丢弃冗余的视频 token。这在保持准确性的同时降低了延迟并提高了吞吐量。视频的第一帧被完整保留，然后对于每个后续帧，EVS 保留视频正在变化的"动态" token，并丢弃与前一帧相比没有变化的"静态" token。我们将其与 Conv3D 结合以实现卓越的压缩：Conv3D 将帧对的 token 融合为一个，然后 EVS 修剪冗余的静态信息。

### 原生音频输入，而非仅文字转录

音频端由 **Parakeet-TDT-0.6B-v2** 驱动，通过其自身的 2 层 MLP 投影器连接到骨干。音频以 **16 kHz** 采样，模型训练时输入最长可达 **1,200 秒（20 分钟）**，而 LLM 最大上下文长度支持 5 小时以上。

这代表了从传统 VLM 流水线的转变，通过在共享多模态序列中实现原生音频处理，使音频、视觉和文本 token 得以联合建模。这对于旁白屏幕录像、语音改变视觉意义的视频问答、长篇指导性或会议内容，以及需要时序对齐的多模态推理等场景至关重要。

### 轻量级模态投影器与统一 Token 交错

每个编码器通过轻量级 **2 层 MLP 投影器**连接到 LLM，该投影器将编码器特征映射到共享嵌入空间。投影后，**视觉、音频和文本 token 被交错并联合处理**。

这种设计在保持整体系统模块化的同时，仍然使骨干内部实现真正的跨模态推理。

## 训练数据、基础设施与系统

SFT 阶段在 **NVIDIA H100** 上训练，根据阶段不同，从 **32 到 128 个节点**进行扩展。整个技术栈使用 **Megatron-LM**、**Transformer Engine** 和 **Megatron Energon**，支持张量并行、专家并行、序列并行、长上下文阶段的上下文并行、在线序列打包和选择性激活重计算。

SFT 后的强化学习使用 [**NeMo-RL**](https://github.com/NVIDIA-NeMo/RL/blob/nano-v3-omni/docs/guides/nemotron-3-nano-omni.md) **和 [NeMo Gym](https://github.com/NVIDIA-NeMo/Gym)**，以 Megatron 为后端。RL 基础设施采用基于 **Ray 的分布式设置**，跨 **B200 和 H100 集群**，并进行多模态去重，这样重复的 rollout 不会使图像、视频和音频内存成倍增加。

我们开源了训练代码的重要部分。

### 使用 RL 塑造可靠的多模态行为

我们在 Nemotron 3 Nano Omni 中引入了多环境文本和全模态训练。我们的文本 RL 训练阶段在 Nemo-Gym 中跨越多样化的环境进行，评估模型执行一系列动作的能力，如工具调用、编写代码和多部分规划，以满足可验证的标准。

全模态 RL 在统一框架内训练模型跨**图像、视频、音频和文本**进行推理，覆盖从**单模态到完全多模态场景**的任务。多样化的验证器套件评估多种格式（如多项选择、数学、GUI 定位和 ASR）的输出，同时有意包含无法回答的情况，以教导模型在证据不足时选择放弃而不是产生幻觉。

### 数据与数据流水线

Nemotron 3 Nano Omni 在一个强调跨多种模态高质量推理的增强数据集上训练。我们显著扩大了任务覆盖范围，并为公共数据集有限的复杂推理场景引入了合成数据。为支持这一点，我们为可扩展的合成数据生成构建了针对特定任务的多阶段流水线。

举一个例子，我们使用 [NeMo Data Designer](https://github.com/NVIDIA-NeMo/DataDesigner) 从大量真实 PDF 语料库中生成了约 1140 万个合成问答对（约 450 亿 token）。这个数据集用于在后训练阶段加强长上下文文档推理，并在 MMLongBench-Doc 的总体准确率上实现了 2.19 倍的提升。

我们在 [Data Designer 开发者说明](https://nvidia-nemo.github.io/DataDesigner/latest/devnotes/training-a-vlm-to-understand-long-documents-an-iterative-sdg-story/)中详细介绍了完整的流水线演进过程，包括失败分析和关键经验教训。该说明还包含[九个可运行的流水线方案](https://github.com/NVIDIA-NeMo/DataDesigner/tree/main/docs/assets/recipes/vlm_long_doc)，可作为构建自己的文档理解数据集的起点。

## 示例工作流程

### 示例 1：长多页文档分析

Nemotron 3 Nano Omni 可以分析并推理长篇文档，如财务报告、学术论文、产品手册等。以下示例从 100 页以上的文档中提取财务指标以计算另一个指标：

[![adobe-multipage-reasoning-visual-v6](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/bbDDPTKPfpyUEGHb-9iBl.png)](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/bbDDPTKPfpyUEGHb-9iBl.png)

*图 3：MMLongBench-Doc 基准测试中的程式化示例*

模型被提示按如下方式回答问题：

```
Extract information from all the given images, then answer the question using a single word or phrase. Return 'Not answerable' if the answer cannot be derived from the the images.
```

该模型能够在一次运行中完成长上下文检索、结构化提取、表格/图表阅读和多页推理。

### 示例 2：视频 + 音频理解

Nemotron-3 Nano Omni 执行联合音视频分析，既可针对特定场景进行局部分析，也可对整个视频进行全局分析。这使它能够回答需要跨模态推理的复杂问题——例如，识别在音频中提及某个特定主题时恰好展示的具体画面。

**视频**

**问题**

```
Watch the video and listen to the narration.
1.What structure is on fire as shown in the video and how much money was being spent in its renovation project? 
2. Describe in short what visuals are shown when the eye-witness narrates her experience?
```

**答案**

```
1. The structure on fire is the Notre Dame Cathedral, which was undergoing an almost $7 million renovation project.

2. When the eye-witness narrates her experience, the visuals show the cathedral engulfed in flames and thick smoke, scaffolding surrounding the burning roof, firefighters using ladders to spray water, a crowd of people watching from the riverbank, and views of the burning structure against the Paris skyline.
```

### 示例 3：Agentic 计算机使用 / 截图推理

Nemotron 3 Omni 可以集成到 Agentic 计算机使用系统中，用于推理用户意图、分析 GUI 元素并执行动作以完成任务。

[![animation](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/FhDeY9OyrilBzVY_RoiAW.gif)](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/FhDeY9OyrilBzVY_RoiAW.gif)

该模型被提供了一个 Web 环境，并使用如下系统提示词：

```
You are a GUI agent. You are given an instruction, a screenshot of the screen and your previous interactions with the computer. You need to perform a series of actions to complete the task. The password of the computer is {password}.

For each step, provide your response in this format:
{thought}
## Action:
{action}
## Code:
{code}

In the code section, the code should be either pyautogui code or one of the following functions wrapped in the code block:
- {"name": "computer.wait", "description": "Make the computer wait for 20 seconds for installation, running code, etc.", "parameters": {"type": "object", "properties": {}, "required": []}}
- {"name": "computer.terminate", "description": "Terminate the current task and report its completion status", "parameters": {"type": "object", "properties": {"status": {"type": "string", "enum": ["success", "failure"], "description": "The status of the task"}, "answer": {"type": "string", "description": "The answer of the task"}}, "required": ["status"]}}
```

**用户指令**

```
Find the Driver License Eligibility Requirements
```

**模型响应**：

上方 GIF 展示了 Agent 为完成用户请求所采取的操作：

- 点击"License & IDs"标签页
- 从下拉菜单中点击"Driver's License"
- 在左侧点击"Driver's License Eligibility"
- 在该页面向下和向上滚动
- 最终为用户生成如下回复：

```
Successfully found the Driver License Eligibility Requirements page on the Virginia DMV website. The page contains comprehensive information about driver license eligibility including:

**General Requirements:**
- Must be a resident of the Commonwealth of Virginia
- Must be at least 16 years and 3 months of age

**First Time Drivers:**
- Must complete a state-approved driver education program
- Must obtain a learner's permit at least 60 days before taking the road skills test
- Must be at least 15 years and 6 months of age for a learner's permit
- No exceptions to age requirements

**New Residents:**
- Temporary residents: must obtain license within 6 months
- Permanent residents: must obtain license within 1 year

**Military Personnel:**
- Active-duty members of the Armed Forces stationed in Virginia
- Spouses and dependents 16 years and 3 months or older may drive with valid out-of-state license
- If vehicle is co-owned and out-of-state plates are used, all co-owners must be active duty members

**Out-of-State Students:**
- Full-time students enrolled in accredited Virginia schools (not employed) may drive with valid out-of-state license
- Full-time students who are employed are considered Virginia residents for vehicle laws

**Non-Residents:**
- Non-residents temporarily living in Virginia may drive with home state license for no more than 6 months
- Note: This does not apply to commercial vehicle drivers
- If becoming gainfully employed, must hold Virginia driver's license

**Identification and Residency Requirements:**
- Proof of identity (acceptable documents listed in DMV 141)
- Proof of legal presence in the U.S.
- Proof of Virginia residency
- Proof of Social Security number
- Proof of name change (if applicable)

Additional resources available: interactive document guide, "Acceptable Documents for Obtaining a Driver's License or Photo ID Card" (DMV 141), and Spanish language version.
```

### 示例 4：混合文档 + 图表 + 旁白推理

Nemotron-3 Nano Omni 可以分析图像中的图表和图形，以及音频文件，从而生成媒体之间的共同点和差异。

**图像**

[![Screenshot 2026-04-27 at 12.29.11 PM](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/Mj5qYhHUhUcHx73J50RH8.png)](https://cdn-uploads.huggingface.co/production/uploads/67ac5d85a19e34140ea1013b/Mj5qYhHUhUcHx73J50RH8.png)

**音频**

**问题**

```
Use both the slide content and the spoken commentary.
List out any extra points mentioned by the speaker that is not shown in the slide
```

**答案**

```
Based on the speaker's commentary and the visual content of the slide, here are the extra points mentioned that are not explicitly shown or detailed in the slide:

* **The Topic:** The speaker explicitly states she will be covering **multitask learning** with neural networks, while the slide title is simply "Some notation" (though it contains the mathematical definitions for tasks).
* **Nature of the Output:** She describes the output ($y$) as a **probability distribution** over possible labels (e.g., tiger, tiger cat, lynx, cat), whereas the slide only shows a bar chart with class labels without explicitly labeling the vector as a distribution.
* **Specific Task Example (Paper Titles):** She introduces a concrete example where the input is the **title of a paper** and the neural network is tasked with estimating the **length of the paper**. The slide shows "length of paper" near the bar chart, but does not visually distinguish how a paper title maps to these bars versus representing animal classes.
* **Optimization Techniques:** She mentions that the loss function is typically optimized using **stochastic gradient descent** or a **"favorite optimizer,"** which are procedural steps not written on the slide (which only defines the loss function $\mathcal{L}$ to minimize).
* **Input Diversity:** She specifies that inputs can be a **"wide range of unstructured inputs,"** specifically mentioning **images** and **text**. The slide visually displays a single image (a structured input) and uses a generic variable $x$ for the input class.
```

### 示例 5：声景

Nemotron-3 Nano Omni 可以分析各种音频，包括声景和环境声音。

**音频**

**问题**

```
What is producing the main sound in this audio, and what does the acoustic environment suggest about where it was recorded?
```

**答案**

```
The main sound is a bird chirping, and the presence of multiple bird calls and a natural, open acoustic environment suggests the recording was made outdoors in a natural setting like a forest or park.
```

### 示例 6：音乐

Nemotron-3-Nano-Omni 可以解读和推理一般音频，包括声景和环境声音。

**音频**

**问题**

```
What's the overall vibe of this song, and what kind of scenario would it complement well?
```

**答案**

```
The song has a calm, reflective, and slightly melancholic vibe, with a gentle piano melody and soft string accompaniment. It would complement a quiet, introspective scene such as a rainy evening, a peaceful walk, or a moment of personal reflection.
```

## 开始使用 Nemotron 3 Nano Omni

| 资源 | 链接 |
|---|---|
| Hugging Face BF16 检查点 | [`https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16`](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16) |
| Hugging Face FP8 检查点 | [`https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8`](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-FP8) |
| Hugging Face NVFP4 检查点 | [`https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4`](https://huggingface.co/nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4) |
| 技术报告 / PDF | [`https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Omni-report.pdf`](https://research.nvidia.com/labs/nemotron/files/NVIDIA-Nemotron-3-Omni-report.pdf) |
| 数据集 / 集合发布 | [`https://huggingface.co/datasets/nvidia/Nemotron-Image-Training-v3`](https://huggingface.co/datasets/nvidia/Nemotron-Image-Training-v3) |
| Megatron-Bridge | [`https://github.com/NVIDIA-NeMo/Megatron-Bridge/tree/main/examples/models/vlm/nemotron_3_omni`](https://github.com/NVIDIA-NeMo/Megatron-Bridge/tree/main/examples/models/vlm/nemotron_3_omni) |
| Nemo-RL | [`https://github.com/NVIDIA-NeMo/RL/blob/nano-v3-omni/docs/guides/nemotron-3-nano-omni.md`](https://github.com/NVIDIA-NeMo/RL/blob/nano-v3-omni/docs/guides/nemotron-3-nano-omni.md) |
| NeMo Data Designer SDG 方案 | [`https://github.com/NVIDIA-NeMo/DataDesigner/tree/main/docs/assets/recipes/vlm_long_doc`](https://github.com/NVIDIA-NeMo/DataDesigner/tree/main/docs/assets/recipes/vlm_long_doc) |

## 参考文献

- NVIDIA Nemotron Nano V2 VL. **技术报告：** [https://arxiv.org/abs/2511.03929](https://arxiv.org/abs/2511.03929)
- NVIDIA Nemotron 3: Efficient and Open Intelligence. **技术报告：** [https://arxiv.org/abs/2512.20856](https://arxiv.org/abs/2512.20856)
- C-RADIOv4-H. **Hugging Face 模型页面：** [https://huggingface.co/nvidia/C-RADIOv4-H](https://huggingface.co/nvidia/C-RADIOv4-H)
- Parakeet-TDT-0.6B-v3. **Hugging Face 模型页面：** [https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
- Megatron-LM. **GitHub：** [https://github.com/NVIDIA/Megatron-LM](https://github.com/NVIDIA/Megatron-LM)
- Transformer Engine. **GitHub：** [https://github.com/NVIDIA/TransformerEngine](https://github.com/NVIDIA/TransformerEngine)
- Megatron Energon. **GitHub：** [https://github.com/NVIDIA/Megatron-Energon](https://github.com/NVIDIA/Megatron-Energon)
