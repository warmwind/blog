---
title: "Gemini Robotics-ER 1.6：通过增强的具身推理驱动真实世界机器人任务"
pubDatetime: 2026-04-16T12:00:00+08:00
description: "Google DeepMind 发布 Gemini Robotics-ER 1.6，在空间推理、多视角理解和仪器读取方面取得重大突破，是迄今最安全的机器人推理模型，已向开发者开放 API。"
slug: gemini-robotics-er-1-6-zh
originalTitle: "Gemini Robotics-ER 1.6: Powering real-world robotics tasks through enhanced embodied reasoning"
originalUrl: https://deepmind.google/blog/gemini-robotics-er-1-6/
---

原文标题：Gemini Robotics-ER 1.6: Powering real-world robotics tasks through enhanced embodied reasoning<br>
原文链接：https://deepmind.google/blog/gemini-robotics-er-1-6/

*作者：Laura Graesser 和 Peng Xu*

对于机器人来说，若要真正在我们的日常生活和工业领域中发挥作用，它们不仅需要遵循指令，还必须对物理世界进行推理。从在复杂设施中导航，到解读压力表上的指针，机器人的"具身推理"能力让它们能够弥合数字智能与物理行动之间的鸿沟。

今天，我们推出 [Gemini Robotics-ER 1.6](https://deepmind.google/models/gemini-robotics/)，这是我们推理优先模型的重大升级，使机器人能够以前所未有的精度理解其环境。通过增强空间推理和多视角理解能力，我们正在为下一代物理 Agent 带来全新的自主水平。

该模型专注于机器人技术至关重要的推理能力，包括视觉与空间理解、任务规划和成功检测。它作为机器人的高层推理模型，能够通过原生调用 Google 搜索等工具来查找信息、视觉-语言-动作模型（VLA）或任何其他第三方用户自定义函数来执行任务。

Gemini Robotics-ER 1.6 在 [Gemini Robotics-ER 1.5](https://developers.googleblog.com/building-the-next-generation-of-physical-agents-with-gemini-robotics-er-15/) 和 [Gemini 3.0 Flash](https://blog.google/products-and-platforms/products/gemini/gemini-3-flash/) 的基础上均取得了显著提升，尤其在空间和物理推理能力方面，例如指点、计数和成功检测。我们还解锁了一项新能力：仪器读取，使机器人能够读取复杂的仪表盘和视窗——这是我们通过与合作伙伴波士顿动力（Boston Dynamics）的密切合作发现的应用场景。

从今天起，Gemini Robotics-ER 1.6 已通过 [Gemini API](https://ai.google.dev/gemini-api/docs/robotics-overview) 和 [Google AI Studio](https://aistudio.google.com/prompts/new_chat?model=gemini-robotics-er-1.6-preview) 向开发者开放。为帮助你入门，我们还提供了一个开发者 [Colab](https://github.com/google-gemini/robotics-samples/blob/main/Getting%20Started/gemini_robotics_er.ipynb)，其中包含如何配置模型并对其进行具身推理任务提示的示例。

![基准测试结果对比图](https://lh3.googleusercontent.com/_dicgE2AAgiQBrY1zvNrdLqTsE5oNi3vbp95Zo4-vp809tdsRitsV4uOQHLBJES4QFjdqrJEW0gFUvwnYVDrbqcE6yd_wuigVj2Xxi-9Q-KA1UjodQ=w1440-h810-n-nu-rw-lo)

*图 1：Gemini Robotics-ER 1.6 与 Gemini Robotics-ER 1.5 和 Gemini 3.0 Flash 的基准测试结果对比。仪器读取评估在启用代理视觉的情况下运行（Gemini Robotics-ER 1.5 不支持此功能，因此该模型未启用）。所有其他评估在禁用代理视觉的情况下运行。单视角和多视角成功检测评估包含不同的示例，因此不具可比性。*

## 指点：空间推理的基础

指点是具身推理模型的基本能力，随着每一代模型的迭代而不断演进。指点可以用来表达许多概念，包括：

Gemini Robotics-ER 1.6 可以将指点作为推理更复杂任务的中间步骤。例如，它可以使用指点来计算图像中的物品数量，或识别图像上的显著点以帮助模型执行数学运算以改善其度量估计。

下面的示例展示了 Gemini Robotics-ER 1.6 在指向多个元素以及知道何时指向、何时不指向方面的优势。

![指点能力对比图](https://lh3.googleusercontent.com/wX1QYLrafPEhOPLVaFTsvztVDlTW4g7YglaDK1Ex4fO-4spBmnEYOcHFzLyDvzFQsfEbCwRqlSWCtBcCu4ou5xvIipQ-a3nnxkGzo55dhhOFJHJ0Ug=w1440-n-nu-rw-lo)

*Gemini Robotics-ER 1.6 正确识别了锤子数量（2 个）、剪刀数量（1 个）、油漆刷数量（1 个）、钳子数量（6 个）以及可以解释为单个组或多个点的园艺工具集合。它不会指向图像中不存在的请求物品——独轮车和 Ryobi 电钻。相比之下，Gemini Robotics-ER 1.5 无法正确识别锤子或油漆刷的数量，完全遗漏了剪刀，幻觉出了一辆独轮车，并且在钳子指点上缺乏精度。Gemini 3.0 Flash 与 Gemini Robotics-ER 1.6 接近，但在处理钳子方面不如后者出色。*

## 成功检测：自主性的引擎

在机器人技术中，知道任务何时完成与知道如何开始任务同样重要。成功检测是自主性的基石，作为关键的决策引擎，让 Agent 能够智能地在重试失败的尝试与推进到计划的下一阶段之间进行选择。

在机器人技术中实现视觉理解具有挑战性，需要复杂的感知和推理能力，结合广泛的世界知识，以处理遮挡、光线不足和模糊指令等复杂因素。此外，大多数现代机器人设置包含多个摄像头视角，例如顶置和腕部安装的摄像头。这意味着系统需要理解不同视角如何在每个时刻以及跨时间段结合形成连贯的图像。

Gemini Robotics-ER 1.6 推进了多视角推理能力，使系统能够更好地理解多个摄像头流及其相互关系，即使在动态或被遮挡的环境中也不例外，如下面的典型多视角场景所示。

*（视频）Gemini Robotics-ER 1.6 从多个摄像头视角获取线索，以确定任务"将蓝色笔放入黑色笔筒"何时完成。*

## 仪器读取：真实世界视觉推理

要理解 Gemini Robotics-ER 1.6 的一项关键优势，我们需要看看它如何将空间推理和世界知识等能力相结合，以解决复杂的现实世界问题。仪器读取就是一个完美的例子。

这项任务源于设施检查需求，这是我们与波士顿动力合作伙伴的关键重点领域。工业设施包含许多仪器——温度计、压力表、化学视窗等——需要持续监测。Spot，波士顿动力的机器人产品，能够访问整个设施中的仪器并捕获其图像。

*Gemini Robotics-ER 1.6 使机器人能够解读各种仪器，包括圆形压力表、垂直液位指示器和现代数字显示器。*

仪器读取需要复杂的视觉推理。必须精确感知各种输入——包括指针、液位、容器边界、刻度线等——并理解它们之间的相互关系。对于视窗来说，这涉及到在考虑摄像机视角造成的畸变的情况下估计液体填充视窗的程度。仪表通常有描述单位的文字，必须读取并解释，有些仪表有多个指针指向不同的小数位，需要将它们组合起来。

> 仪器读取等能力以及更可靠的任务推理将使 Spot 能够完全自主地感知、理解和应对现实世界的挑战。

*——Marco da Silva，波士顿动力 Spot 副总裁兼总经理*

Gemini Robotics-ER 1.6 通过使用代理视觉来实现高度精确的仪器读取，代理视觉将视觉推理与代码执行相结合。模型采取中间步骤：首先放大图像以更好地读取仪表中的小细节，然后使用指点和代码执行来估计比例和间隔以获得精确读数，最终运用其世界知识来解释含义。

![仪器读取能力分解图](https://lh3.googleusercontent.com/RvYAY_w1ZJfrVeEtxg3oh6YjyQuvSgFcIammormuzrUixbvwlNjFLLFRpUULIG153bgevZaZtnEjNZNaM_U2YKj_LWLqDaMcbqyMQs56h2VWCFpXr-ug=w1440-n-nu-rw-lo)

*图 2：Gemini Robotics-ER 1.6 的不同元素如何协同工作以在仪器读取任务上达到高水平性能。*

### 精确读取模拟仪表

*（视频）此示例演示了模型如何使用指点和代码执行进行缩放，以将仪表读数精确到子刻度精度。*

## 迄今最安全的机器人模型

安全性已集成到我们具身推理模型的每个层面。Gemini Robotics-ER 1.6 是我们迄今最安全的机器人模型，与所有前代模型相比，在对抗性空间推理任务上对 Gemini 安全政策表现出卓越的遵从性。

该模型还展示了大幅提升的遵守物理安全约束的能力。例如，它通过指点等空间输出就哪些物体可以在夹爪或材料约束下安全操作（例如，"不要处理液体"、"不要拾取重量超过 20 公斤的物体"）做出更安全的决策。

我们还测试了模型根据真实伤害报告在文本和视频场景中识别安全隐患的能力。在这些任务上，我们的 Gemini Robotics-ER 模型在准确感知伤害风险方面改善了基线 Gemini 3.0 Flash 的性能（文本提升 6%，视频提升 10%）。

![安全性能对比图](https://lh3.googleusercontent.com/JzklnvIzHI-kFlxFia447n9ZeMHmAlqrg4sA4CL4PURVcnvMbx-DWMSWLgOR3bQ9MdeNTLNhlOc-soMWNWpZnk8oJ7jfklxmXZM3TdGxEq59tQ47mg=w1440-n-nu-rw-lo)

*图 3：Gemini Robotics-ER 1.6 在测试遵守物理安全约束能力的安全指令遵从上，相比 Gemini Robotics-ER 1.5 有显著改善。在指点方面，它也优于 Gemini 3.0 Flash，且两个模型在文本方面的准确率都非常高。Gemini 3.0 Flash 在边界框方面表现更好。*

## 与我们合作改进机器人的具身推理

我们致力于确保 Gemini Robotics-ER 为机器人社区提供最大价值。如果当前能力对于你的专业应用有所限制，我们邀请你提交包含 10 到 50 个带标注图像的表单，说明具体的失败模式，以帮助我们构建更稳健的推理功能。我们期待与你合作，在即将发布的版本中增强这些能力。

立即在 Google AI Studio 上体验 Gemini Robotics-ER 1.6。

---

## 引用

- 原文：[Gemini Robotics-ER 1.6: Powering real-world robotics tasks through enhanced embodied reasoning](https://deepmind.google/blog/gemini-robotics-er-1-6/) — Google DeepMind
- [Gemini Robotics-ER 模型页面](https://deepmind.google/models/gemini-robotics/)
- [Gemini API 机器人概览](https://ai.google.dev/gemini-api/docs/robotics-overview)
- [开发者入门 Colab](https://github.com/google-gemini/robotics-samples/blob/main/Getting%20Started/gemini_robotics_er.ipynb)
