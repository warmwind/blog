---
title: 第八代 TPU 深度解析：TPU 8t 与 TPU 8i 架构技术详解
pubDatetime: 2026-04-23T12:00:00+08:00
description: Google 第八代 TPU（TPU 8t 与 TPU 8i）深度技术解析，涵盖 SparseCore、CAE、Boardfly 拓扑、Virgo Network 等核心架构设计，以及面向大规模预训练和高并发推理的专项优化。
slug: tpu-8t-8i-architecture-deep-dive-zh
originalTitle: "Inside the eighth-generation TPU: An architecture deep dive"
originalUrl: https://cloud.google.com/blog/products/compute/tpu-8t-and-tpu-8i-technical-deep-dive
tags:
  - AI Infrastructure
  - TPU
  - Google Cloud
---

原文标题：Inside the eighth-generation TPU: An architecture deep dive<br>
原文链接：https://cloud.google.com/blog/products/compute/tpu-8t-and-tpu-8i-technical-deep-dive

![第八代 TPU](https://storage.googleapis.com/gweb-cloudblog-publish/images/eighth-generation_TPU.max-2000x2000.jpg)

在 Google，我们 TPU 的设计理念始终围绕三大支柱：可扩展性、可靠性与高效性。随着 AI 模型从稠密大语言模型（LLM）演进为大规模混合专家模型（MoE）和重推理架构，硬件的使命已不再只是叠加浮点运算量（FLOPS），而是必须针对最新工作负载的具体运算强度持续演进。

智能体（Agentic）AI 的兴起要求底层基础设施能够处理超长上下文窗口（Context Window）和复杂的序列逻辑。与此同时，世界模型（World Model）已成为当前"下一序列数据预测"架构之外的必要演进方向——更新一代的 Agent 需要模拟未来场景、预判行动后果，并通过"想象"而非高风险的试错来学习。第八代 TPU（TPU 8t 与 TPU 8i）正是我们对上述挑战的回应：确保每一个工作负载——从训练的第一个 token，到多轮推理链的最后一步——都运行在最高效的路径上。它们专为高效训练和服务 Google DeepMind 的 Genie 3 等世界模型而生，让数百万 Agent 能够在多样化的模拟环境中练习和打磨推理能力。

### TPU 8：专项设计，各司其职

我们认识到，预训练、后训练与实时推理服务的基础设施需求已经出现明显分化。因此，第八代 TPU 引入了两套截然不同的系统：TPU 8t 与 TPU 8i。这两套新系统是 Google Cloud AI 超算机（AI Hypercomputer）的核心组件——AI 超算机是一套融合了硬件、软件与网络的集成超算架构，旨在驱动完整的 AI 全生命周期。尽管两套系统共享 Google AI 技术栈的核心基因并支持全生命周期 AI 工作负载，但各自针对不同瓶颈进行了专项优化。此外，通过在第八代 TPU 系统中全面集成基于 Arm 架构的 Axion CPU 主节点，我们消除了数据预处理延迟造成的主机瓶颈。Axion 提供了充足的算力余量，能够应对复杂的数据预处理和编排任务，使 TPU 保持持续满负载而不至于停滞。

### TPU 8t：大规模预训练的算力引擎

TPU 8t 针对大规模预训练和 embedding 密集型工作负载进行了深度优化。它沿用了我们久经验证的 3D 环形（torus）网络拓扑，但规模进一步扩大至单个超算节点（superpod）容纳 9,600 颗芯片。TPU 8t 专为在数百个超算节点间实现最大吞吐量而设计，确保训练任务按时完成。

以下是 TPU 8t 相较前代 TPU 的几项关键升级：

**SparseCore 优势**：TPU 8t 的核心是 SparseCore——一种专为处理 embedding 查找过程中不规则内存访问模式而设计的专用加速器。矩阵乘法单元（MXU）负责矩阵运算，而 SparseCore 则将数据依赖型的全规约（all-gather）操作及其他集合通信操作进行卸载，从而避免通用芯片上常见的零操作瓶颈。

- **VPU/MXU 重叠执行与均衡扩展**：TPU 8t 的设计目标是最大化已配置 FLOPS 的利用率。通过对向量处理单元（VPU）实施更均衡的扩展，架构将暴露的向量操作时间降至最低。这使得量化、softmax 和 layernorm 等操作能够与 MXU 中的矩阵乘法更好地重叠执行，让芯片保持高负载而非等待串行向量任务。

- **原生 FP4 支持**：TPU 8t 引入原生 4 位浮点（FP4），以突破内存带宽瓶颈。在保持大模型低精度量化精度的同时，MXU 吞吐量翻倍。通过减少每个参数所需的比特数，该平台将能耗密集型数据搬运降至最低，并允许更大的模型层完全驻留在本地硬件缓冲区中，从而达到峰值算力利用率。

图 1：TPU 8t ASIC 模块框图

![图 1：TPU 8t ASIC 模块框图](https://storage.googleapis.com/gweb-cloudblog-publish/images/1_TPU_diagrams___Inside_the_8th_Generation.max-2200x2200.jpg)

- **Virgo 网络拓扑与最高 4 倍数据中心网络带宽提升**：为支撑 TPU 8t 的海量数据需求，我们推出了 Virgo Network（Virgo 网络）。这一全新网络架构使 TPU 8t 训练的数据中心网络（DCN）带宽最高提升 4 倍。Virgo Network 是一种专为现代 AI 工作负载极端需求而设计的横向扩展（scale-out）网络结构。它基于高基数交换机构建，通过增加每台交换机的端口数来减少网络层数，采用扁平、两层无阻塞拓扑。与传统数据中心网络相比，通过最小化网络层级，显著降低延迟。Virgo Network 采用多平面设计，具有独立控制域来连接 TPU 8t 芯片。TPU 8t 机架同时通过 Jupiter 南北向网络访问计算与存储服务。这套精简架构共同提供了海量的对分带宽（bisection bandwidth）和确定性低延迟，为实现全球最大训练集群的高可用性奠定基础。

相较于上一代，TPU 8t 在芯片间互联（ICI）上实现了 2 倍的纵向扩展（scale-up）带宽，并提供最高 4 倍的原始横向扩展（scale-out）DCN 带宽，大幅降低数据瓶颈。为进一步加速前沿模型的研发，我们将分布式训练规模扩展至单集群之外。借助 JAX 和 Pathways，如今可以在单个训练集群中扩展至超过 100 万颗 TPU 芯片。Virgo Network 可将超过 134,000 颗 TPU 8t 芯片互联，在单一网络结构中提供最高 47 Pb/s 的无阻塞对分带宽，以近线性扩展性能提供超过 160 万 ExaFlops 的算力。

图 2：TPU 8t 机架级与 Virgo 网络结构的连接

![图 2：TPU 8t 机架级与 Virgo 网络结构的连接](https://storage.googleapis.com/gweb-cloudblog-publish/images/2_TPU_8t_rack_level_connectivity_to_Virgo_.max-2000x2000.png)

- **更快的存储访问**：我们在 TPU 8t 中引入了 TPUDirect RDMA 和 TPU Direct Storage。TPU Direct RDMA 支持 TPU 内存（HBM）与网络接口卡（NIC）之间的直接数据传输，绕过主机 CPU 和 DRAM，从而降低延迟并消除主机系统瓶颈，提升 TPU 间通信的有效带宽。类似地，TPUDirect Storage 通过支持 TPU 与高速托管存储（如 10T Lustre）之间的直接内存访问，绕过 CPU 主机瓶颈，有效将海量数据传输带宽翻倍。这一架构使硅片能够以线速摄取训练数据，确保即使处理大型多模态数据集时 MXU 也保持满负载运转。

通过结合 Managed Lustre 10T 与 TPUDirect Storage，将数百 PB 的数据集直接路由至硅片，TPU 8t 彻底消除了数据摄取瓶颈导致的训练延迟。与在第七代 Ironwood TPU 上训练相比，存储访问速度提升 10 倍。

图 3：上图展示了未使用 TPUDirect Storage 的数据传输路径；下图展示了 2 颗 TPU 8t 芯片通过 TPUDirect Storage 与 Managed 10T Lustre 存储进行数据传输的路径。

![图 3：TPU 8t 数据传输路径对比——不含与含 TPUDirect Storage](https://storage.googleapis.com/gweb-cloudblog-publish/images/3_rq0yjyX.max-2000x2000.png)

### TPU 8i：采样与推理服务专家

TPU 8i 专为后训练（post-training）和高并发推理优化而生。我们为其配备了有史以来片上 SRAM 容量最大的设计、全新的集合通信加速引擎（CAE），以及专为推理服务优化的全新网络拓扑——Boardfly。

- **超大片上 SRAM**：片上 SRAM 较上一代提升 3 倍，TPU 8i 可将更大的 KV Cache 完整驻留在硅片上，大幅减少长上下文解码（long-context decoding）期间内核的空闲等待时间。

图 4：TPU 8i ASIC 模块框图

![图 4：TPU 8i ASIC 模块框图](https://storage.googleapis.com/gweb-cloudblog-publish/images/Figure_4-_TPU_8i_ASIC_block_diagram.max-2200x2200.jpg)

- **集合通信加速引擎（CAE）**：为解决采样瓶颈，TPU 8i 采用 CAE，以近乎零延迟在内核间聚合结果，专门加速自回归解码（auto-regressive decoding）和"思维链"（chain-of-thought）处理过程中所需的归约和同步步骤。在每颗 TPU 8i 芯片上，核心芯片上有两个张量核心（TC），小芯片（chiplet）上有一个 CAE，取代了前代 Ironwood TPU 核心芯片上的四个 SparseCore（SC）。通过集成专用 CAE，TPU 8i 进一步将片上集合通信延迟降低 5 倍。每次集合通信操作延迟的降低意味着等待时间的减少，直接提升了同时运行数百万 Agent 所需的吞吐量。

- **Boardfly ICI 拓扑**：3D 环形拓扑适合将数千颗芯片紧密协同，但大规模 mesh 中芯片间跳数更多，全互联（all-to-all）延迟也更高。针对 8i，我们改变了芯片之间的连接方式：在各板上实现全互联后，再将各板聚合成组。借助高基数设计，最多将 1,152 颗芯片互联，压缩网络直径和数据包穿越系统所需的跳数。通过削减全互联通信（MoE 和推理模型的核心操作）所需的跳数，Boardfly 在通信密集型工作负载上实现了最高 50% 的延迟改善。

图 5：TPU 8i 分层 Boardfly 拓扑——从 4 颗全互联芯片的基础模块，逐步扩展至 8 块全互联板组成的完整 Group，最终由 36 个 Group 全互联构成 TPU 8i Pod

![图 5：TPU 8i 分层 Boardfly 拓扑](https://storage.googleapis.com/gweb-cloudblog-publish/images/5_I1mUzjb.max-1300x1300.png)

Boardfly 由以下元素组成，其拓扑本质上是层级式的：

- **基础模块（BB）**：每个托盘通过内部 ICI 链路组成一个 4 芯片环，对外提供 16 个外部连接端口，用于更广泛的网络互联。
- **Group（G）**：8 块板通过铜缆实现全互联，构成一个本地化的 Group，利用 11 条可用外部链路进行 Group 内通信。
- **Pod 结构**：最终架构扩展至 36 个 Group（最多 1,024 颗活跃芯片），通过光学电路交换机（OCS）互联，确保任意芯片间通信的最大跳数不超过 7 跳。

### 深度解析：Boardfly 与 Torus 的数学对比

为什么 TPU 8i 要放弃 Torus 拓扑？根本原因在于网络直径。

在 3D Torus 中，节点排列成网格，每个维度像环形一样首尾相连。在 8 x 8 x 16（1024 芯片）的配置中，数据包到达最远芯片需要穿越每个环距离的一半：

3D Torus = 8/2（X 轴）+ 8/2（Y 轴）+ 16/2（Z 轴）= **16 跳**

尽管 Torus 对稠密训练中典型的近邻通信（neighbor-to-neighbor communication）非常高效，但对于全互联通信模式而言却带来了延迟代价（latency tax）。在推理模型和 MoE 时代，任何一颗芯片都可能需要与其他任意芯片通信以路由 token，此时跳数至关重要。

Boardfly 的高基数拓扑灵感来源于 Dragonfly 拓扑原理。通过增加组间光学长距离直连链路数量，我们将网络扁平化。对于同样规模的 1024 芯片 Pod，Boardfly 将网络直径从 16 跳压缩至仅 **7 跳**。

网络直径 56% 的压缩直接转化为更低的尾部延迟，使 TPU 8i 的 CAE 无需等待数据从 Pod 另一端传输过来。

图 6：通过光学电路交换机实现 TPU 8i Pod 内最大 7 跳 ICI 网络直径的可视化示意

![图 6：TPU 8i Pod 内最大 7 跳 ICI 网络直径示意](https://storage.googleapis.com/gweb-cloudblog-publish/images/6_Qu7H2lI.max-1300x1300.png)

### TPU 8t 与 TPU 8i 规格对比

| 特性 | TPU 8t | TPU 8i |
|------|--------|--------|
| 主要工作负载 | 大规模预训练 | 采样、推理服务与推理 |
| 网络拓扑 | 3D Torus | Boardfly |
| 专用芯片特性 | SparseCore（Embedding）& LLM Decoder Engine | CAE（集合通信加速引擎） |
| HBM 容量 | 216 GB | 288 GB |
| 片上 SRAM（Vmem） | 128 MB | 384 MB |
| 峰值 FP4 PFLOPs | 12.6 | 10.1 |
| HBM 带宽 | 6,528 GB/s | 8,601 GB/s（约为 TPU 8t 的 1.3 倍） |
| CPU 主节点 | Arm Axion | Arm Axion |

### 软件赋能：性能优先的 AI 技术栈

硬件的能量只有通过软件才能充分释放。第八代 TPU 构建于我们在第七代 Ironwood TPU 上开创的"性能优先"技术栈之上，旨在让自定义内核开发触手可及，同时不牺牲高层框架的抽象能力。这套技术栈包括：

- **Pallas 与 Mosaic**：我们为 Pallas 提供一流支持——这是我们的自定义内核语言，让你能够用 Python 编写具备硬件感知能力的内核。这使你可以充分榨取 TPU 8i CAE 和 TPU 8t SparseCore 的每一分性能。

- **原生 PyTorch 体验**：我们很高兴宣布，TPU 的原生 PyTorch 支持现已进入预览阶段。如果你目前正在使用 PyTorch 构建和服务模型，我们让你比以往任何时候都更容易迁移到 TPU。你可以将现有模型原样带来，完整支持你所依赖的 Eager Mode 等原生功能。

- **可移植性**：在 Ironwood 上运行的相同 JAX、PyTorch 或 Keras 代码，可以直接扩展至本代 TPU。加速线性代数（XLA）在后台处理 Boardfly 拓扑和 CAE 同步的复杂转译，让你专注于模型本身，而非互联细节。

### 代际飞跃：性能对比

我们持续坚持软硬件协同设计的承诺，成果丰硕。与第七代 Ironwood TPU 相比，第八代 TPU 实现了显著跃升：

- **训练性价比**：TPU 8t 在大规模训练上相比 Ironwood TPU 实现了最高 2.7 倍的每美元性能提升。
- **推理性价比**：TPU 8i 相比 Ironwood TPU 实现了最高 80% 的每美元性能提升，尤其在大型 MoE 模型低延迟目标场景下表现突出。
- **能效**：两款芯片均实现了最高 2 倍的每瓦特性能提升，这对于可持续地扩展下一代 AI 至关重要。

### 展望未来

为赋能 Google Cloud 客户在下一波创新浪潮中抢占先机，我们将 TPU 8t 与 TPU 8i 设计为两套截然不同的专用系统，分别针对 AI 全生命周期中的多元化未来需求进行量身定制。TPU 8t 和 8i 均专为最苛刻的推理服务与训练工作负载而生，与 AI 超算机软件栈完全集成：JAX、PyTorch、vLLM、XLA 和 Pathways。这种专项化设计以及从零开始的全面重新设计——均与 Google DeepMind 深度协作完成——带来了卓越的性价比和能效表现。

我们第八代架构的模块化设计为未来提供了清晰独特的路线图。正如计算领域每一次重大范式转变都需要基础设施突破一样，智能体时代同样如此。在持续反馈循环中规划、执行和学习的推理 Agent，无法在原本为传统训练或事务性推理优化的硬件上发挥峰值效率——它们的运算强度从根本上就是不同的。我们的第八代 TPU 基础设施已针对上述特定需求正面进化。

如需进一步了解第八代 TPU 系列：

- 提交第八代 TPU 使用意向表
- 参与社区论坛
- 观看第八代 TPU 发布视频
- 访问 TPU 官网

---

## 引用

- 原文：[Inside the eighth-generation TPU: An architecture deep dive](https://cloud.google.com/blog/products/compute/tpu-8t-and-tpu-8i-technical-deep-dive)
