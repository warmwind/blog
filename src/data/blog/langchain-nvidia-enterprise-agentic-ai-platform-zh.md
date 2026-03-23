---
title: "LangChain 宣布与 NVIDIA 共建企业级 Agentic AI 平台"
pubDatetime: 2026-03-23T18:00:00+08:00
description: "LangChain 文章《LangChain Announces Enterprise Agentic AI Platform Built with NVIDIA》中文翻译（含原文引用）。"
slug: langchain-nvidia-enterprise-agentic-ai-platform-zh
---

> 原文标题：LangChain Announces Enterprise Agentic AI Platform Built with NVIDIA
> 原文链接：https://blog.langchain.com/nvidia-enterprise/

![LangChain x NVIDIA](https://blog.langchain.com/content/images/size/w760/format/webp/2026/03/bg-2--1-.png)

**综合性 agent 工程平台与 NVIDIA AI 的结合，使企业能够大规模构建、部署和监控生产级 AI agent。**

开发团队往往需要花费数月时间来构建自定义基础设施，而非专注于交付业务价值。LangChain 宣布与 NVIDIA 展开全面合作，推出企业级 agentic AI 开发平台。该方案将 LangChain 的 LangSmith agent 工程平台和开源框架，与 NVIDIA 的 Agent Toolkit 及相关技术进行深度整合。

## 平台组成

该集成方案包含以下核心组件：

- LangChain 的 **LangGraph**、**Deep Agents** 和 **LangSmith** 可观测性平台
- **NVIDIA Nemotron** 模型
- **NVIDIA NeMo Agent Toolkit**
- **NVIDIA NIM** 微服务
- **NVIDIA Dynamo**
- **NVIDIA OpenShell** 运行时环境

## 核心能力

### 构建（Build）

LangGraph 支持有状态的多 agent 编排；Deep Agents 增加了任务规划和长期记忆能力；AI-Q Blueprint 则作为生产级深度研究系统运行。

### 加速（Accelerate）

NVIDIA 优化的执行策略通过并行执行和推测执行独立的工作流节点来降低延迟。

### 部署（Deploy）

NIM 微服务在各类环境中提供**比标准部署高 2.6 倍的吞吐量**。

### 监控（Monitor）

LangSmith 提供分布式链路追踪和成本监控；统一可观测性将基础设施级别和应用级别的洞察整合在一起。

### 评估（Evaluate）

支持对 Nemotron 模型家族进行全面评估，包含离线和在线两种评估方式。

## 关键数据

- 开源框架累计下载量超过 **10 亿次**
- LangSmith 已处理 **150 亿条** traces
- 累计处理 **100 万亿** tokens
- 超过 **300 家**企业客户
- 每月框架下载量达 **1 亿次**
- 超过 **100 万**从业者使用 LangChain 工具

LangChain CEO Harrison Chase 强调："前沿模型必须超越原始智能，实现可靠的工具使用、长周期推理和 agent 协调。"

## 加入 Nemotron Coalition

LangChain 加入了 Nemotron Coalition——NVIDIA 的全球计划，旨在通过共享专业知识、数据和算力来推进开放的前沿 AI 模型。

## 可用性

该集成方案即日起可用；LangGraph 和 LangChain 继续在 GitHub 上开源；LangSmith 可在 [smith.langchain.com](https://smith.langchain.com) 访问；Nemotron 3 Ultra 预计于 2026 年上半年发布。

## 引用

- 原文：[LangChain Announces Enterprise Agentic AI Platform Built with NVIDIA](https://blog.langchain.com/nvidia-enterprise/)
- [LangChain 官方文档](https://docs.langchain.com)
- [LangSmith](https://smith.langchain.com)
- [LangChain GitHub](https://github.com/langchain-ai)
