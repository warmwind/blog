---
title: Components of a Coding Agent
pubDatetime: 2026-04-06T12:00:00+08:00
description: Sebastian Raschka 文章《Components of a Coding Agent》的中文翻译
slug: components-of-a-coding-agent-zh
originalTitle: Components of a Coding Agent
originalUrl: https://magazine.sebastianraschka.com/p/components-of-a-coding-agent
---

> **原文标题**: Components of a Coding Agent  
> **原文链接**: https://magazine.sebastianraschka.com/p/components-of-a-coding-agent

## 概述

Sebastian Raschka 的文章探讨了编码 Agent 的架构基础——这些系统用复杂的软件框架包装大语言模型，以增强它们的编码能力。

## 核心区分：模型 vs Harness

Raschka 强调"最近 LLM 系统实际进展很大一部分不仅仅是关于更好的模型，而是关于我们如何使用它们"。这种区分很重要：虽然 Claude Code 和 Codex 看起来比基础模型更强大，但这种优越性在很大程度上源于它们周围的系统，而不是模型差异本身。

关系层次结构包括：
- **LLM**：基础的下一令牌预测引擎
- **推理模型**：为中间推理跟踪优化的 LLM
- **Agent Harness**：提供上下文、工具和执行支持的软件框架

## 六个核心组件

### 1. **实时仓库上下文**

Agent 首先收集工作区信息——仓库结构、git 分支状态和项目文档。这个"稳定事实"基础防止 Agent 在"每个提示上都从无上下文开始"。

### 2. **提示形状和缓存复用**

与其在每个轮次完全重建提示，复杂的 Harness 维护一个"稳定提示前缀"，其中包含指令和工具描述，只更新频繁变化的元素，如最近的对话记录和用户请求。

### 3. **工具访问和使用**

Agent 使用预定义的经过验证的工具，而不是任意命令。Harness 通过路径验证和权限检查等检查在执行前验证操作，提高了安全性和可靠性。

### 4. **最小化上下文膨胀**

编码 Agent 采用两种主要策略：裁剪冗长的输出和对话记录总结。Raschka 指出这代表了"一个被低估的、令人厌倦的好编码 Agent 设计部分"。

### 5. **结构化会话内存**

系统维护两个层次：存储精简当前状态的工作内存，以及保留完整交互历史的完整记录，以实现恢复能力。

### 6. **有限的 Subagent**

Agent 可以将子任务委派给拥有继承上下文但受限界限的子 Agent，实现并行化而不重复工作或资源冲突。

## 实际影响

Raschka 建议，在可比 Harness 中的等效开源权重模型可能会与专有解决方案的性能相匹配，尽管特定 Harness 的培训通常能带来好处。围绕模型的工程通常比单纯的模型选择决定实际能力更重要。

## 引用

- [原文 - Components of a Coding Agent](https://magazine.sebastianraschka.com/p/components-of-a-coding-agent)
