---
title: "OpenAI 如何大规模交付低延迟 Voice AI"
pubDatetime: 2026-05-06T10:30:00+08:00
description: "OpenAI 工程师 Yi Zhang 和 William McDonald 介绍了如何重构 WebRTC 协议栈，通过 Relay+Transceiver 架构，实现面向 9 亿+ 周活跃用户的低延迟实时语音 AI 服务。"
slug: openai-low-latency-voice-ai-scale-zh
originalTitle: "How OpenAI Delivers Low-Latency Voice AI at Scale"
originalUrl: https://openai.com/index/delivering-low-latency-voice-ai-at-scale/
---

原文标题：How OpenAI Delivers Low-Latency Voice AI at Scale<br>
原文链接：https://openai.com/index/delivering-low-latency-voice-ai-at-scale/

*作者：Yi Zhang，William McDonald*

## 挑战：语音 AI 的速度要求

语音 AI 只有在对话节奏与人类语速相当时才能感觉自然。任何可察觉的延迟——无论是网络传输、模型推理还是音频处理方面的延迟——都会打破实时对话的幻觉。

在 OpenAI 的规模下，这一要求转化为三个具体需求：

- **全球覆盖**：为分布在各大洲的 9 亿+ 周活跃用户提供服务
- **快速连接建立**：用户发起会话后必须能立即开始说话
- **低且稳定的媒体往返时延**：最小延迟、低抖动、低丢包率，确保流畅的对话轮转

这些需求带来了一个远超"部署快速模型"的复杂工程问题。

OpenAI 选择 WebRTC 作为实时语音 AI 的基础，理由充分。WebRTC 是一套处理实时通信中棘手问题的开放标准：

- **ICE（交互式连接建立）**：负责 NAT 和防火墙穿越
- **DTLS（数据报传输层安全）**：对传输中的媒体加密
- **SRTP（安全实时传输协议）**：确保音频的加密和认证
- **编解码协商**：自动选择兼容的音频压缩方式
- **RTCP（实时传输控制协议）**：监控连接质量
- **客户端功能**：回声消除、抖动缓冲等

若没有 WebRTC，每个客户端都需要为这些问题提供自定义解决方案。有了 WebRTC，OpenAI 得以在浏览器和移动平台上已实现的协议栈基础上构建，将工程资源聚焦于真正的差异化创新。

更重要的是，WebRTC 支持持续的音频流式传输。模型无需等待用户说完再处理，而是可以在用户说话的同时开始转录、推理和生成语音，让对话感觉更加自然流畅。

## 架构问题：WebRTC 遇上 Kubernetes

OpenAI 的第一版实现很直接：一个基于 Pion（一个优秀的开源 WebRTC 库）的单体 Go 服务，同时处理信令和媒体终止。这套方案运行良好，但部署到 Kubernetes 时带来了运维挑战。

**根本问题在于：WebRTC 传统的"每会话一个端口"模型与云基础设施并不契合。**

在高并发场景下，"每会话一个端口"模型要求暴露和管理大量 UDP 端口范围。这带来了多重问题：

- **负载均衡复杂性**：云负载均衡器并非为管理数万个公共 UDP 端口而设计
- **安全挑战**：大范围端口扩大了外部可达的攻击面
- **自动扩缩容脆弱性**：Kubernetes 会持续添加、移除和重新调度 Pod，导致稳定端口范围难以维护
- **运维开销**：每个额外的端口范围都增加了防火墙策略、健康检查和发布安全的复杂性

ICE 和 DTLS 是有状态协议。创建会话的进程必须继续接收该会话的数据包，以处理 ICE 重启等会话变更。如果同一会话的数据包落到了不同进程，连接就会中断。这对会话亲和性的要求与 Kubernetes 的动态调度机制相互冲突。

## 解决方案：Relay + Transceiver 架构

OpenAI 的解决方案通过将 WebRTC 协议栈拆分为两个组件，优雅地实现了关注点分离：

**Relay（中继器）** 是一个轻量级、无状态的 UDP 转发服务，负责：

- 接受来自客户端的媒体数据包
- 仅读取足够的数据包元数据以确定目的地
- 将数据包转发给对应的 Transceiver
- 维护路由所需的最少会话状态

关键在于，Relay **不**参与编解码协商。这使 Relay 保持简单且可水平扩展。如果某个 Relay 实例崩溃，客户端的下一个数据包即可重建路由状态。

**Transceiver（收发器）** 是有状态的 WebRTC 端点，负责：

- 拥有所有协议状态（ICE、DTLS、SRTP、会话生命周期）
- 从客户端角度呈现正常的 WebRTC 流程
- 将媒体和事件转换为更简单的内部协议
- 连接到用于推理、转录和语音生成的后端服务

从客户端角度来看，一切如常——它们仍然与标准 WebRTC 交互。

**关键创新**在于 OpenAI 如何在无需外部查询服务的情况下，将客户端的第一个数据包路由到正确的 Transceiver。

每个 WebRTC 会话都包含一个 ICE 用户名片段（ufrag）——一个在建立阶段交换并在 STUN 连接检查中回传的短标识符。OpenAI 将服务端的 ufrag 生成为包含路由元数据：

- 信令阶段，Transceiver 分配会话状态，并在 SDP 应答中返回共享的 Relay VIP（虚拟 IP）和端口
- 客户端的第一个媒体数据包通常是 STUN 绑定请求
- Relay 仅从该数据包中解析服务端 ufrag
- Relay 解码路由提示并转发给指定的 Transceiver
- 后续 DTLS、RTP 和 RTCP 数据包在已建立的会话内流动

这种方案的优雅之处在于：

- 使用协议中已有的信息
- 无需热路径查询服务
- 确定性强、可靠
- 即使 Relay 重启也能工作（下一个 STUN 数据包即可重建路由）

OpenAI 还使用 Redis 缓存映射关系，以加快 Relay 重启后的恢复速度。

## 全球 Relay 架构

将公共 UDP 暴露面缩减为少量稳定的地址和端口后，OpenAI 在全球范围内部署了 Relay 模式。全球 Relay 是一组分布在各地的 Relay 入口节点，全部实现相同的数据包转发行为。

这种架构带来了多重好处：

- **更低的首跳延迟**：数据包在靠近用户的 Relay 进入 OpenAI 网络
- **更低的抖动**：在进入 OpenAI 骨干网之前减少公共互联网的跳数
- **更好的丢包特性**：避开拥塞的公共互联网路径

OpenAI 使用 Cloudflare 的地理和就近引导进行信令，确保初始 HTTP/WebSocket 请求到达附近的 Transceiver 集群。SDP 应答提供全球 Relay 地址，而 ufrag 则包含指定集群的路由信息。

## Go 实现细节

OpenAI 用 Go 实现的 Relay 展示了多项性能优化技术：

- **无协议终止**：Relay 仅解析 STUN 头和 ufrag；后续数据包通过缓存状态处理
- **临时状态**：小型短超时内存映射跟踪客户端到 Transceiver 的路由
- **水平可扩展性**：多个 Relay 实例并行运行；状态不是硬性 WebRTC 状态，因此重启造成的中断极小
- **SO_REUSEPORT**：Linux socket 选项，允许多个 Relay worker 绑定同一 UDP 端口，由内核将数据包分发给各 worker
- **runtime.LockOSThread**：将每个读取 UDP 的 goroutine 绑定到特定 OS 线程，提升缓存局部性
- **预分配缓冲区**：最小化分配开销和垃圾回收

值得注意的是，OpenAI 没有使用 DPDK 等内核旁路框架。在 Go 中更简单的用户空间实现已经足以应对他们的工作负载。

## 架构成果

这套架构成功实现了在 Kubernetes 中运行 WebRTC 媒体，而无需暴露数千个 UDP 端口。其优势包括：

- **更小的 UDP 暴露面**：更易于保护和负载均衡
- **动态扩缩容**：基础设施可以扩展，无需预留大范围端口
- **标准 WebRTC 语义**：客户端仍然使用标准 WebRTC 行为
- **简化的后端**：推理服务不需要表现得像 WebRTC 对等体

这套架构体现的核心设计原则是：

- 在边缘保留协议语义：客户端仍然使用标准 WebRTC
- 将硬状态集中在一处：Transceiver 拥有所有协议状态
- 基于已有信息进行路由：利用 ICE ufrag 进行首包路由
- 针对常见情况优化：精心设计的 Go 实现配合适当的线程策略已经足够

通过将公共 UDP 暴露面缩减为少量稳定地址和端口，OpenAI 实现了对 Kubernetes 动态调度的完全兼容，同时保持了标准 WebRTC 的客户端体验。这套基础设施的不可见性，正是语音 AI 能够感觉真正自然、流畅的根本所在。

---

## 引用

- 原文：[How OpenAI Delivers Low-Latency Voice AI at Scale](https://openai.com/index/delivering-low-latency-voice-ai-at-scale/)
- Pion WebRTC 库：[github.com/pion/webrtc](https://github.com/pion/webrtc)
