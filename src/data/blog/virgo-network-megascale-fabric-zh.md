---
title: 发布 Virgo Network：Google 面向 AI 时代的超大规模数据中心网络结构
pubDatetime: 2026-04-23T12:30:00+08:00
description: Google 发布 Virgo Network——专为现代 AI 工作负载设计的超大规模数据中心网络结构，采用扁平两层无阻塞拓扑，支持 134,000 颗 TPU 芯片互联，提供高达 47 Pb/s 的对分带宽，是 AI 超算机的核心基础设施。
slug: virgo-network-megascale-fabric-zh
originalTitle: "Introducing Virgo Network, Google's scale-out AI data center fabric"
originalUrl: https://cloud.google.com/blog/products/networking/introducing-virgo-megascale-data-center-fabric
tags:
  - AI Infrastructure
  - Networking
  - Google Cloud
---

原文标题：Introducing Virgo Network, Google's scale-out AI data center fabric<br>
原文链接：https://cloud.google.com/blog/products/networking/introducing-virgo-megascale-data-center-fabric

![Virgo Network 超大规模数据中心网络结构](https://storage.googleapis.com/gweb-cloudblog-publish/images/GCN26_102_BlogHeader_2436x1200_Opt_2_Dark.max-2500x2500.jpg)

AI 时代要求对云的物理架构进行根本性的重新思考——尤其是网络层面。随着基础模型参数规模的指数级增长，传统通用网络正在逼近其极限。为了驱动未来十年的机器学习发展，Google 设计了 Virgo Network——一种全新的超大规模 AI 数据中心网络结构，秉承"园区即计算机"（campus-as-a-computer）的设计理念，是我们 AI 超算机（AI Hypercomputer）的核心底座。

传统网络设计在面对现代 AI 的诸多约束时已显力不从心：

**大规模扩展**：训练所需的算力和空间已超出单一数据中心的承载能力，亟需统一的跨数据中心计算域。

- **带宽爆炸式增长**：由于基础模型训练严重依赖网络，近年来每颗加速器所需的带宽大幅攀升，对旧有架构造成吞吐瓶颈和拥塞问题。
- **同步流量突发**：毫秒级的高强度流量峰值（图 1）对网络缓冲区形成巨大压力。结果是，哪怕一个"掉队节点"（straggler）也会拖慢整个集群的性能。
- **低延迟要求**：ML 推理服务需要快速、一致的响应时间以实现实时推理，因此严格的延迟控制是关键架构约束。

图 1：AI 训练工作负载的亚毫秒级线速突发流量

![图 1：AI 训练工作负载的亚毫秒级线速突发流量](https://storage.googleapis.com/gweb-cloudblog-publish/images/1_Sub-millisecond_line-rate_bursts_of_an_A.max-1700x1700.png)

### 重新定义数据中心网络

满足 AI 时代的需求，需要从通用网络设计向专用扁平低延迟网络架构进行根本性转变。为了应对独特的规模和延迟约束，我们将久经考验的 Jupiter 网络用于南北向流量，同时引入一种全新的网络结构专门处理东西向通信。由此形成的架构由三个截然不同、各有专攻的层次组成，共同运作为一个统一的计算域：

- **纵向扩展（Scale-up）域**：高带宽、低延迟的互联网络结构，专为单个 Pod 内加速器之间的紧耦合通信而设计。

- **横向扩展（Scale-out）加速器网络结构（东西向）**：专用的加速器间远程直接内存访问（RDMA）网络结构，针对跨 Pod 的大规模水平扩展进行优化。该层专为确定性延迟和最高可靠性而设计，为 ML 工作负载提供高"有效吞吐量"（goodput）。

- **Jupiter 前端网络（南北向）**：高容量网络结构，提供对分布式存储和通用计算资源的快速可靠访问。它确保数据访问不会成为训练和推理工作负载的瓶颈，同时也用于在超大规模训练任务中跨多个站点进行横向扩展。

这种架构解耦带来了重要的战略优势：

- **独立演进**：我们可以独立升级和演进各个网络域，在加速创新周期的同时避免全系统中断。
- **专用横向扩展带宽**：无阻塞网络为加速器提供用于关键训练任务的大规模对分带宽。
- **ML 与网络协同设计**：网络与每一代新型 ML 加速器同步构建，确保网络结构与其所支撑的硬件相互匹配。

图 2：数据中心网络架构

![图 2：数据中心网络架构](https://storage.googleapis.com/gweb-cloudblog-publish/images/2_Data_center_network_architecture.max-1500x1500.png)

### 发布 Virgo Network：超大规模数据中心网络结构

Virgo Network 是一种专为现代 AI 工作负载极端需求设计的横向扩展（scale-out）网络结构。它基于高基数交换机构建，通过增加每台交换机的端口数来减少网络层数，采用扁平、两层无阻塞拓扑。与传统数据中心网络相比，通过最小化网络层级，显著降低延迟。Virgo Network 采用多平面设计，具有独立控制域来连接加速器（图 3）。加速器机架同时通过 Jupiter 南北向网络访问计算与存储服务。这套精简架构共同提供了海量的对分带宽和确定性低延迟，既支持分布式训练，也支持推理服务工作负载。

图 3：超大规模数据中心网络结构（Virgo Network）

![图 3：超大规模数据中心网络结构（Virgo Network）](https://storage.googleapis.com/gweb-cloudblog-publish/images/3_Megascale_data_center_fabric_Virgo_Netwo.max-1600x1600.png)

Virgo Network 是我们下一代加速器设计的基础，具备以下优势：

- **超大规模网络扩展**：Virgo Network 可将 134,000 颗芯片（TPU 8t）互联，在单一网络结构中提供最高 47 Pb/s 的无阻塞对分带宽。

- **代际性能飞跃**：与上一代相比，Virgo Network 在每颗加速器（TPU 8t）上提供最高 4 倍的带宽，充分释放每颗芯片的完整算力。

- **可预测的低延迟**：与上一代相比，Virgo Network 为 TPU 提供 40% 更低的空载网络延迟，为延迟敏感型 AI 工作负载提供更可预测的性能表现。

### 大规模可靠性提升

在支撑数十万颗芯片的系统中，硬件故障不可避免。由于单个故障组件就可能中断同步训练任务，大规模可靠性是首要关注点。为最大化工作负载有效吞吐量，我们围绕故障隔离、深度可观测性以及挂起（hang）和掉队（straggler）的快速缓解来设计 Virgo Network 架构。

在这种规模下，全系统弹性需要坚实的网络基础。Virgo Network 集成了独立交换平面，提供强健的故障隔离能力，防止局部硬件故障降低集群整体的有效吞吐量。

图 4：故障停止（fail-stop）与故障缓慢（fail-slow）对平均恢复时间（MTTR）的影响

![图 4：故障停止与故障缓慢对 MTTR 的影响](https://storage.googleapis.com/gweb-cloudblog-publish/images/4_How_fail-stop_and_fail-slow_impact_MTTR.max-1600x1600.png)

在此基础上，我们通过优化软件和编排层来最大化平均中断间隔时间（MTBI）并最小化平均恢复时间（MTTR），主要聚焦两个方向：

- **可观测性**：大规模可靠性需要高保真可见性。我们使用亚毫秒级遥测来监控网络系统。这种深度可见性使我们能够检测瞬态拥塞、优化缓冲区管理，并在硬件和软件栈中精准定位慢速故障的根本原因。

- **识别掉队节点与挂起**：主动监控对于识别性能降级节点（掉队节点）或完全停止响应的节点（挂起）至关重要。通过快速定位这些瓶颈——借助自动化的掉队检测以及新增的挂起检测能力——我们能够加速训练任务并保护其免受局部性能下降的影响。

### AI 超算机的基础底座

Virgo Network 是一种从零开始为现代 AI 工作负载严苛需求而专门构建的重新设计的横向扩展数据中心网络。这种扁平多平面架构将各 Pod 中的加速器统一为单一计算域，解决了传统网络在带宽和规模上的局限。通过在硬件层面直接提供强健的故障隔离能力，Virgo Network 成为全系统弹性的基础，保护同步工作负载免受局部硬件故障的影响。

归根结底，Virgo Network 提供了在智能体 AI 时代加速发展所必需的规模、可预测延迟与可靠性。如需进一步了解我们如何为 AI 的未来构建基础设施，请访问我们的 [AI 基础设施解决方案页面](https://cloud.google.com/ai-infrastructure)，探索技术文档，或参加 Google Cloud Next 的专题分论坛。

---

## 引用

- 原文：[Introducing Virgo Network, Google's scale-out AI data center fabric](https://cloud.google.com/blog/products/networking/introducing-virgo-megascale-data-center-fabric)
