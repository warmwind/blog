---
title: "用 Gemma 4 将最先进的 Agent 能力带到边缘设备"
pubDatetime: 2026-04-03T10:00:00+08:00
description: "Google Developers Blog《Bring state-of-the-art agentic skills to the edge with Gemma 4》中文翻译（含原文引用）。Google DeepMind 发布 Gemma 4 开源模型，支持在移动端、桌面、IoT 等边缘设备上运行多步规划和自主 Agent 工作流，无需专门微调。"
slug: gemma-4-agentic-skills-edge-zh
originalTitle: "Bring state-of-the-art agentic skills to the edge with Gemma 4"
originalUrl: https://developers.googleblog.com/bring-state-of-the-art-agentic-skills-to-the-edge-with-gemma-4/
---

> 原文标题：Bring state-of-the-art agentic skills to the edge with Gemma 4
> 原文链接：https://developers.googleblog.com/bring-state-of-the-art-agentic-skills-to-the-edge-with-gemma-4/

# Bring state-of-the-art agentic skills to the edge with Gemma 4

![Gemma 4 Banner](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/gemma4_banner_2.original.png)

*作者：Google AI Edge Team*

今天，Google DeepMind 发布了 **Gemma 4**——一系列最先进的开源模型，重新定义了在你自己的硬件上所能实现的可能性。Gemma 4 现已在 Apache 2.0 许可证下发布，为开发者提供了强大的端侧 AI 开发工具包。借助 Gemma 4，你可以超越聊天机器人，构建直接在设备上运行的 Agent 和自主 AI 应用场景。Gemma 4 支持多步规划、自主行动、离线代码生成，甚至音视频处理——所有这些都无需专门的微调。它还面向全球用户，支持超过 140 种语言。

我们很高兴地宣布，从今天起你就可以在边缘设备上体验 Gemma 4 的全面能力！通过全新的 [AICore Developer Preview](https://developers.google.com/ml-kit/genai/aicore-dev-preview) 访问 Android 内置的 Gemma 4 模型，或利用 [Google AI Edge](https://ai.google.dev/edge) 在移动端、桌面和边缘设备上构建 Agent 化的应用内体验。

在本文中，我们将展示如何使用 Google AI Edge Gallery 和 LiteRT-LM 开始构建。

## 在 Google AI Edge Gallery 中探索 Gemma 4 的 Agent Skills

[Google AI Edge Gallery](https://github.com/google-ai-edge/gallery) 支持 [iOS](https://apps.apple.com/us/app/google-ai-edge-gallery/id6749645337) 和 [Android](https://play.google.com/store/apps/details?id=com.google.ai.edge.gallery&hl=en_US)，让你能够构建和试验完全在设备端运行的 AI 体验。今天，我们非常激动地宣布推出 **Agent Skills**——这是首批完全在设备端运行多步自主 Agent 工作流的应用之一。由 Gemma 4 驱动，Agent Skills 能够：

- **扩充知识库：** Gemma 4 可以通过 Skills 访问其初始训练数据之外的信息，实现 Agent 式的知识增强体验。例如，你可以构建一个查询 Wikipedia 的 Skill，让 Agent 能够查询并回答任何百科问题。

- **生成丰富的交互内容：** 将段落或视频转化为简洁的摘要或学习卡片，或将数据转化为交互式可视化图表。例如，你可以创建一个 Skill，根据用户的语音输入，自动汇总并展示每日睡眠时长和心情的趋势。

- **扩展 Gemma 4 的核心能力：** 与其他模型集成，如文本转语音、图像生成或音乐合成。例如，你可以利用 Skills 为照片配上完美匹配氛围的音乐。

- **创建完整的端到端体验：** 用户无需在多个应用之间切换，可以通过与 Gemma 4 的对话来管理复杂的工作流并构建自己的应用。为了展示这一点，我们构建了一个可以描述并播放动物叫声的工作应用。

要体验 Gemma 4 E2B 和 E4B 模型的实际效果，请立即下载 Google AI Edge Gallery 应用。在应用内，你可以通过我们的指南轻松开始试验并创建自己的 Skills。我们迫不及待地想看到你构建的成果，欢迎在 [GitHub Discussion](https://github.com/google-ai-edge/gallery) 中分享你的 Skills！

## 使用 LiteRT-LM 跨设备部署 Gemma 4

对于希望在应用内或更广泛设备上部署 Gemma 4 的开发者，[LiteRT-LM](https://ai.google.dev/edge/litert-lm/overview) 在整个硬件范围内提供出色的性能。LiteRT-LM 在 LiteRT 之上添加了 GenAI 专用库——LiteRT 已经凭借其高性能库 XNNPack 和 ML Drift 赢得了数百万 Android 和边缘设备开发者的信任。LiteRT-LM 在此技术栈之上，通过以下新特性进一步提升模型性能：

- **极小的内存占用：** 得益于 LiteRT 对 2-bit 和 4-bit 权重以及内存映射逐层 Embedding 的支持，在部分设备上运行 Gemma 4 E2B 仅需不到 1.5GB 内存。

- **约束解码（Constrained Decoding）：** 每次都能获得结构化、可预测的输出，确保你的 AI 驱动应用和工具调用脚本在生产环境中保持可靠。

- **动态 Context：** 灵活地在 CPU 和 GPU 上使用动态 Context 长度处理单个模型，让你充分利用 Gemma 4 的 128K Context Window。

为了支持 Agent 用例所需的扩展 Context 长度，LiteRT-LM 利用前沿的 GPU 优化，在 **3 秒内** 跨 **2 个不同的 Skills** 处理 **4,000 个输入 Token**。

LiteRT-LM 还能将较小的 Gemma 4 模型部署到 IoT 和边缘设备上，并实现令人瞩目的性能。例如，在 Raspberry Pi 5 上，Gemma 4 E2B 实现了 **133 tokens/秒** 的预填充吞吐量和 **7.6 tokens/秒** 的解码吞吐量。凭借这样的性能，你可以在资源受限的硬件上完全离线运行智能家居控制器、语音助手和机器人应用。

准备好开始了吗？查看 [LiteRT-LM 文档](https://ai.google.dev/edge/litert-lm/overview) 获取完整指南和设备特定的性能指标。你还可以查看 [Gemma 4 E2B](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm) 和 [Gemma 4 E4B](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm) 的模型卡片。

## 在任何设备上运行

Gemma 4 今天发布，支持范围前所未有的平台：

- **移动端：** 在 Android 和 iOS 上均支持 CPU/GPU。开发者还可以通过 Android AICore 在系统范围内访问和部署 Android 内置的优化版 Gemma 4 模型。

- **桌面和 Web：** 在 Windows、Linux 和 macOS（通过 Metal）上提供流畅的性能，加上由 WebGPU 驱动的原生浏览器端执行。

- **IoT 和机器人：** 我们正在将 Gemma 4 带到 **Raspberry Pi 5** 和 **Qualcomm IQ8 NPU** 平台的边缘设备上。

今天，我们还发布了一个新的 Python 包和 CLI 工具，让在控制台中试验 Gemma 变得前所未有的简单，并为 IoT 设备上的基于 Gemma 的 Python 管道提供支持。`litert-lm` CLI 支持 **Linux、macOS 和 Raspberry Pi**，开发者无需编写任何代码即可试用最新的 Gemma 4 模型能力。CLI 现在还支持驱动 Google AI Edge Gallery 中 Agent Skills 的工具调用。LiteRT-LM 的 Python 绑定提供了从 Python 深度定制端侧 LLM 管道的灵活性。使用我们的 [指南](https://ai.google.dev/edge/litert-lm/cli) 即可在终端中快速上手 LiteRT-LM。

端侧 Agent 体验的时代已经到来，我们希望你对在边缘设备上构建感到兴奋。无论你在哪种设备上构建，都可以从 Google AI Edge Gallery 中的 [Agent Skills 示例](https://github.com/google-ai-edge/gallery) 和 [LiteRT-LM 入门指南](https://ai.google.dev/edge/litert-lm/overview) 开始。我们迫不及待地想看到你的作品！

## 致谢

特别感谢以下重要贡献者在此项目上的工作：

Advait Jain, Alice Zheng, Amber Heinbockel, Andrew Zhang, Byungchul Kim, Cormac Brick, Daniel Ho, Derek Bekebrede, Dillon Sharlet, Eric Yang, Fengwu Yao, Frank Barchard, Grant Jensen, Hriday Chhabria, Jae Yoo, Jenn Lee, Jing Jin, Jingxiao Zheng, Juhyun Lee, Lu Wang, Lin Chen, Majid Dadashi, Marissa Ikonomidis, Matthew Chan, Matthew Soulanille, Matthias Grundmann, Milen Ferev, Misha Gutman, Mohammadreza Heydary, Pradeep Kuppala, Qidong Zhao, Quentin Khan, Ram Iyengar, Raman Sarokin, Renjie Wu, Rishika Sinha, Rodney Witcher, Ronghui Zhu, Sachin Kotwani, Suleman Shahid, Tenghui Zhu, Terry Heo, Tiffany Hsiao, Wai Hon Law, Weiyi Wang, Xiaoming Hu, Xu Chen, Yishuang Pang, Yi-Chun Kuo, Yu-Hui Chen, Zichuan Wei 以及 gTech 团队。

## 引用

- 原文：[Bring state-of-the-art agentic skills to the edge with Gemma 4](https://developers.googleblog.com/bring-state-of-the-art-agentic-skills-to-the-edge-with-gemma-4/) — Google Developers Blog
- [Gemma 4 官方博客](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/)
- [Google AI Edge](https://ai.google.dev/edge)
- [Google AI Edge Gallery (GitHub)](https://github.com/google-ai-edge/gallery)
- [LiteRT-LM 概览](https://ai.google.dev/edge/litert-lm/overview)
- [AICore Developer Preview](https://developers.google.com/ml-kit/genai/aicore-dev-preview)
- [Gemma 4 E2B 模型卡片](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
- [Gemma 4 E4B 模型卡片](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm)
