---
title: "Introducing Cohere Transcribe: state-of-the-art speech recognition"
pubDatetime: 2026-03-26T00:00:00+08:00
description: Cohere发布先进的开源语音识别模型的技术文章（含原文引用）
slug: introducing-cohere-transcribe-speech-recognition-zh
originalTitle: "Introducing Cohere Transcribe: state-of-the-art speech recognition"
originalUrl: https://cohere.com/blog/transcribe
---

> **原文标题**：Introducing Cohere Transcribe: state-of-the-art speech recognition  
> **原文链接**：https://cohere.com/blog/transcribe

## 概述

Cohere发布了Transcribe，一个自动语音识别（ASR）模型，以Apache 2.0许可证提供开源软件。该公司将其定位为为企业应用提供"无与伦比的转录精度"。

## 技术架构

**模型名称**：cohere-transcribe-03-2026

### 核心架构

- **类型**：基于Conformer的编码器-解码器架构
- **输入**：音频波形转换为对数梅尔频谱图
- **输出**：转录文本
- **模型大小**：20亿参数
- **设计**：大型Conformer编码器用于声学表示提取，后跟轻量级Transformer解码器用于令牌生成
- **训练**：在输出令牌上进行标准监督交叉熵，从零开始训练

### 多语言支持

该模型支持14种语言，涵盖：

- **欧洲语言**：英语、法语、德语、意大利语、西班牙语、葡萄牙语、希腊语、荷兰语、波兰语
- **亚太地区语言**：中文（普通话）、日语、韩语、越南语
- **中东和北非语言**：阿拉伯语

这种多语言覆盖使该模型适用于全球部署，支持跨越主要地理区域和语言族的转录任务。

## 性能基准

### 精度（字错误率 - WER）

该模型在HuggingFace开源ASR排行榜上**排名第一，平均WER达到5.42%**，超过了Whisper Large v3（7.44%）、ElevenLabs Scribe v2（5.83%）等竞争对手。

### 详细性能指标

在标准基准数据集上的性能：

- **AMI数据集**：8.13% WER
- **LibriSpeech清洁**：1.25% WER
- **LibriSpeech其他**：2.37% WER
- **SPGISpeech**：3.08% WER
- **TedLium**：2.49% WER
- **Gigaspeech**：9.34% WER
- **Earnings 22**：10.86% WER
- **Voxpopuli**：5.87% WER

这些结果展示了该模型在各种音频条件和领域中的鲁棒性。

### 人工评估

该系统在头对头人工偏好评估中表现出强劲的性能，人工注释员在真实世界音频样本中评估转录质量的准确性、连贯性和可用性。

### 吞吐量

该模型在1B+参数模型类别中达到"一流的吞吐量（高RTFx）"，同时保持精度，扩展了效率前沿。

## 部署选项

### 1. 开源下载

- 在HuggingFace上提供，具有完整的基础设施控制
- 适合在本地或私有云环境中进行自托管部署
- 允许组织对模型进行微调以适应特定用途

### 2. API访问

- 通过Cohere API免费层提供，用于实验的速率限制
- 适合快速原型设计和低体量应用
- 无需管理基础设施

### 3. Model Vault

- 在Cohere托管的推理平台上的生产部署
- 定价基于每小时实例使用和折扣长期承诺选项
- 提供企业级支持和可靠性保证
- 最适合大规模生产工作负载

## 与North的集成计划

该公司表示计划"将Cohere Transcribe与North的AI agent协调平台更深入地集成"，将该模型定位为更广泛的企业语音智能能力的基础。

这一集成将使企业能够：
- 将语音识别功能整合到Agent工作流中
- 为基于语音的AI交互构建端到端系统
- 创建多模态Agent，将语音输入与其他数据源相结合

## 技术优势

### 效率与性能的平衡

基于Conformer的架构优化了两个关键参数：
- **推理延迟**：该设计支持低延迟的实时转录
- **模型大小**：20亿参数的适度规模意味着它可以在标准GPU上运行
- **精度**：领先的基准测试性能确保了高质量的转录

### 可扩展性

20亿参数的模型大小使其能够：
- 在单个GPU或多GPU设置上高效运行
- 支持批量处理应用中的吞吐量需求
- 在边缘设备上部署（通过量化）

## 主要贡献者

Julian Mack、Ekagra Ranjan、Cassie Cao、Bharat Venkitesh和Pierre Harvey Richemond被列为关键团队成员，他们为该模型的开发和评估做出了贡献。

## 行业影响

Cohere Transcribe的发布代表了开源语音识别的显著进步：

1. **可访问性**：使企业可以访问生产级语音识别，无需依赖专有解决方案
2. **成本效益**：开源模型和自托管选项为语音应用提供了显著的成本节省
3. **定制**：组织可以微调模型以适应特定的领域或语言
4. **透明性**：开源发布允许对模型行为和偏见进行审查

---

## 引用

- Cohere. "Introducing Cohere Transcribe: state-of-the-art speech recognition." Cohere Blog, March 26, 2026. https://cohere.com/blog/transcribe
