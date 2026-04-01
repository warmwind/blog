---
title: "在你自己的基础设施中运行 Cloud Agents"
pubDatetime: 2026-04-01T15:00:00+08:00
description: "Cursor 官方博客《Self-hosted Cloud Agents》中文翻译（含原文引用）。介绍 Cursor 如何支持自托管 Cloud Agents，让代码和工具执行完全留在你自己的网络中。"
slug: self-hosted-cloud-agents-zh
originalTitle: "Self-hosted Cloud Agents"
originalUrl: https://www.cursor.com/blog/self-hosted-cloud-agents
---

> 原文标题：Self-hosted Cloud Agents
> 原文链接：https://www.cursor.com/blog/self-hosted-cloud-agents

# 在你自己的基础设施中运行 Cloud Agents

*作者：Katia Bazzi — 2026 年 3 月 25 日*

![文章题图](https://ptht05hbb1ssoooe.public.blob.vercel-storage.com/assets/blog/self-hosted-cloud-agents-v5.png)

Cursor 现已支持自托管 Cloud Agents，让代码和工具执行完全留在你自己的网络中。

Cloud Agents 需要自己的开发环境来并行处理软件任务。Cursor 的 Agent 运行在隔离的虚拟机中，具备终端、浏览器和完整的桌面访问能力。它们可以克隆仓库、配置环境、编写和测试代码、推送变更以供审查，并在离线状态下继续运行。

自托管 Agent 提供了与云托管版本相同的所有优势，同时增强了安全性：**你的代码库、工具执行和构建产物永远不会离开你的环境。** 拥有复杂开发环境的团队可以像通过工程师账户一样访问内部缓存、依赖项和网络端点。

## 为什么选择自托管

高度监管的企业由于安全和合规要求，无法允许代码、密钥或构建产物离开其环境。一些组织在维护自定义后台 Agent 基础设施上投入了大量资源。像 Brex、Money Forward 和 Notion 这样的公司现在已经转而使用 Cursor 的自托管方案。

自托管 Agent 允许团队在保持现有安全模型和构建环境的同时，由 Cursor 管理编排、模型访问和用户体验——减少基础设施维护的开销。

## 同一产品，你的基础设施

自托管 Cloud Agents 提供与 Cursor 托管版本完全相同的能力：

- **隔离的远程环境：** 每个 Agent 拥有专用机器，实现更好的并行化
- **多模型支持：** 在自定义 Agent harness 中支持 Composer 2 或前沿模型
- **插件：** 通过 skills、MCPs、subagents、rules 和 hooks 实现可扩展性
- **团队权限：** 组织级别的 Cloud Agent 运行访问控制

未来功能包括视频演示、截图、日志以及对运行中自动化的远程桌面接管。

## 工作原理

Worker 是通过 HTTPS 出站连接到 Cursor 云端的进程——无需入站端口、防火墙修改或 VPN 隧道。在 Agent 会话期间，Cursor 的 harness 处理推理和规划，将工具调用发送到 Worker 进行本地执行，结果回传以进行后续推理轮次。

每个会话获得自己的专用 Worker，通过 `agent worker start` 启动。Worker 可以是长生命周期的，也可以是一次性的。

为了扩展到数千个 Worker，Cursor 提供了 Helm charts 和 Kubernetes operators。组织可以定义具有所需池大小的 `WorkerDeployment` 资源；控制器自动管理扩缩容、更新和生命周期。非 Kubernetes 环境可使用 Fleet 管理 API 进行监控和自定义自动扩缩容。

---

## 引用

- 原文：[Self-hosted Cloud Agents](https://www.cursor.com/blog/self-hosted-cloud-agents) — Cursor Blog, 2026-03-25
