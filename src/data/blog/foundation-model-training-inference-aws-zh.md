---
title: AWS 基础模型训练与推理的基础构建块
pubDatetime: 2026-05-12T10:00:00+08:00
description: 本文介绍 AWS 基础模型生命周期（预训练、后训练、推理）所需的基础架构构建块，涵盖计算、网络、存储、资源调度、ML 软件栈与可观测性。
slug: foundation-model-training-inference-aws-zh
originalTitle: "Building Blocks for Foundation Model Training and Inference on AWS"
originalUrl: https://huggingface.co/blog/amazon/foundation-model-building-blocks
---

原文标题：Building Blocks for Foundation Model Training and Inference on AWS<br>
原文链接：https://huggingface.co/blog/amazon/foundation-model-building-blocks

# AWS 基础模型训练与推理的基础构建块

长期以来，基础模型领域的"扩展"几乎只意味着一件事：在预训练上投入更多算力，能力随之提升。这一直觉得到了实证研究的支持，例如 [Kaplan et al. (2020)](https://arxiv.org/abs/2001.08361) 报告了随着**模型参数量**、**数据集规模**和**训练算力**的扩展，损失呈现出可预测的幂律趋势。在实践中，这些趋势为持续投资大规模加速器容量及其周边分布式基础设施提供了理由，以保持高效利用率。

但前沿已经演进——扩展不再是单一的曲线。NVIDIA 提出的"从一条到三条扩展定律"框架有助于强调：在预训练之外，性能越来越多地通过**后训练**（例如，监督微调 (SFT) 和基于强化学习 (RL) 的方法）以及**测试时计算**（"长思考"、搜索/验证、多样本策略）来扩展。

![3-Scaling-Laws-Chart-1280x720](https://cdn-uploads.huggingface.co/production/uploads/64d6b270c2eedf9af82baa23/X5ZiXBoPmJzcDhaiL_Zkf.jpeg)

> **图：** 改编自 ["AI's Three Scaling Laws, Explained"](https://blogs.nvidia.com/blog/ai-scaling-laws/)（NVIDIA Blog）。

综合来看，这些扩展范式推动基础模型生命周期——预训练、后训练和推理——趋向于一致的基础设施需求：紧密耦合的加速器计算、高带宽低延迟网络，以及用于数据和检查点的分布式存储后端。它们也提升了资源管理编排的重要性，以及应用层和硬件层可观测性的重要性，以维护集群健康并在规模上诊断性能问题。

另一个关键趋势是基础模型生命周期对开源软件（OSS）生态系统的依赖日益增加，该生态系统涵盖模型开发框架、集群资源管理和运维工具。在集群层，资源管理通常由 [Slurm](https://slurm.schedmd.com/documentation.html) 和 [Kubernetes](https://kubernetes.io/docs/) 等系统提供。模型开发和分布式训练通常在 [PyTorch](https://pytorch.org/) 和 [JAX](https://jax.readthedocs.io/) 等框架中实现。监控与可视化——即可观测性——通常使用 [Prometheus](https://prometheus.io/docs/introduction/overview/) 进行指标收集，使用 [Grafana](https://grafana.com/docs/grafana/latest/) 进行可视化和告警，作为基础设施和资源管理之上的运维层。图 1 展示了这种分层架构，说明硬件基础设施如何支撑资源编排，进而支撑 ML 框架，而可观测性则跨越所有层。

![Building Blocks Intro](https://cdn-uploads.huggingface.co/production/uploads/64d6b270c2eedf9af82baa23/QSBYRirLS8pkgJK3rvqMF.png)

*图 1：基础模型训练与推理的开源软件栈分层架构*

本文面向参与基础模型训练与推理的机器学习工程师和研究人员，特别关注构建在 OSS 框架之上的工作流程。本文分析 AWS 基础设施——包括多节点加速器计算、高带宽低延迟网络、分布式共享存储及相关托管服务——如何与基础模型生命周期中常见的 OSS 栈进行交互。主要目标是为理解跨越预训练、后训练和推理的系统瓶颈和扩展特性提供技术基础。本文作为系列的导论，呈现整体系统架构，强调 AWS 基础设施组件与支撑大规模分布式训练和推理的 OSS 工具之间的集成点。

## AWS 基础构建块

本系列的其余部分将研究如何在 AWS 上实现这种分层架构，依次介绍基础设施、资源编排、ML 软件栈和可观测性。以下各节预览每一层。

### 基础设施：计算、网络与存储

如图 1 所示，基础设施由三个紧密耦合的构建块锚定——拥有大设备内存的加速计算、用于集合通信的宽带宽互连，以及用于数据和检查点的可扩展分布式存储。

加速计算构成大规模基础模型预训练、后训练和推理的基础。AWS 作为其 [Amazon EC2 加速计算实例](https://aws.amazon.com/ec2/instance-types/accelerated-computing/)的一部分提供多代 NVIDIA GPU，包括 Amazon EC2 P 实例系列。[P5 实例系列](https://aws.amazon.com/ec2/instance-types/p5/)包括搭载八块 [NVIDIA H100](https://www.nvidia.com/en-us/data-center/h100/) GPU 的 p5.48xlarge、搭载单块 H100 GPU 用于较小规模工作负载的 p5.4xlarge，以及搭载 [NVIDIA H200](https://www.nvidia.com/en-us/data-center/h200/) GPU 的 p5e.48xlarge/p5en.48xlarge 变体。[P6 实例系列](https://aws.amazon.com/ec2/instance-types/p6/)引入了搭载 [NVIDIA Blackwell B200](https://www.nvidia.com/en-us/data-center/dgx-b200/) 架构的 p6-b200.48xlarge，以及搭载 [Blackwell Ultra B300](https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/) 的 p6-b300.48xlarge。
在这些代际中，主要的扩展轴是峰值 Tensor 吞吐量、HBM 容量和带宽，以及互连带宽（节点内和跨节点）。

作为一阶近似，以每秒浮点运算次数（FLOPS）衡量的峰值 Tensor Core 吞吐量有助于在同一轴上定位这些加速器。下表汇总了密集 BF16/FP16 和 FP8 Tensor 运算的每 GPU 峰值吞吐量，以及 HBM 容量和 HBM 带宽，使用与基于 NVSwitch/NVLink 的多 GPU 节点一致的 SXM/HGX 级规格。

| GPU（代表性变体） | BF16/FP16 Tensor 峰值（密集） | FP8 Tensor 峰值（密集） | FP4 Tensor 峰值（密集） | HBM 容量 | HBM 带宽 |
|---|---|---|---|---|---|
| [H100 (SXM)](https://www.nvidia.com/en-us/data-center/h100/) | 0.9895 PFLOPS | 1.979 PFLOPS | — | 80 GB HBM3 | 3.35 TB/s |
| [H200 (SXM)](https://www.nvidia.com/en-us/data-center/h200/) | 0.9895 PFLOPS | 1.979 PFLOPS | — | 141 GB HBM3e | 4.8 TB/s |
| [B200 (HGX, 每 GPU)](https://www.nvidia.com/en-us/data-center/dgx-b200/) | 2.25 PFLOPS | 4.5 PFLOPS | 9 PFLOPS | 180 GB HBM3e | 8 TB/s |
| [B300 (HGX, 每 GPU)](https://www.nvidia.com/en-us/data-center/dgx-b300/) | 2.25 PFLOPS | 4.5 PFLOPS | 13.5 PFLOPS | 288 GB HBM3e | 8 TB/s |

*注：NVIDIA 产品规格表通常报告"含稀疏性"的 Tensor 吞吐量；本表报告密集吞吐量。在适用情况下，密集吞吐量取稀疏吞吐量的一半，遵循 NVIDIA 针对 HGX 级平台的指导（[NVIDIA](https://www.nvidia.com/en-us/data-center/hgx/)）。DGX 数字为系统级；B200 HBM 容量和带宽值通过将 DGX 总量除以八来表示每 GPU 值（[NVIDIA](https://www.nvidia.com/en-us/data-center/dgx-b200/)）。*

随着模型规模的扩大，每步时间通常由集合通信和内存移动主导，而非原始计算吞吐量，这促使明确进行纵向扩展和横向扩展的带宽核算。
对于多 GPU 实例，GPU 通信跨越两种范式。**内部纵向扩展（NVLink/NVSwitch）**在节点内提供高带宽、低延迟的 GPU 到 GPU 连接，使 all-reduce 和 all-gather 等集合操作无需经过主机网络栈即可执行。**外部横向扩展（EFA）**在节点间提供 OS 旁路网络，AWS 将其用作 [Amazon EC2 UltraClusters](https://aws.amazon.com/ec2/ultraclusters/) 的构建块，在该集群中，通信密集型集合操作跨越数千个实例。下表汇总了这些实例类型的关键规格：

| 实例类型 | GPU | GPU 数量 | GPU 内存 | NVLink | NVLink 带宽（聚合） | EFA | EFA 带宽（聚合） |
|---|---|---|---|---|---|---|---|
| [p5.4xlarge](https://aws.amazon.com/ec2/instance-types/p5/) | H100 | 1 | 80 GB HBM3 | — | — | v2 | 12.5 GB/s |
| [p5.48xlarge](https://aws.amazon.com/ec2/instance-types/p5/) | H100 | 8 | 640 GB HBM3 | 4th | 7.2 TB/s | v2 | 400 GB/s |
| [p5e.48xlarge](https://aws.amazon.com/ec2/instance-types/p5/) | H200 | 8 | 1,128 GB HBM3e | 4th | 7.2 TB/s | v2 | 400 GB/s |
| [p5en.48xlarge](https://aws.amazon.com/ec2/instance-types/p5/) | H200 | 8 | 1,128 GB HBM3e | 4th | 7.2 TB/s | v3 | 400 GB/s |
| [p6-b200.48xlarge](https://aws.amazon.com/ec2/instance-types/p6/) | B200 | 8 | 1,440 GB HBM3e | 5th | 14.4 TB/s | v4 | 400 GB/s |
| [p6-b300.48xlarge](https://aws.amazon.com/ec2/instance-types/p6/) | B300 | 8 | 2,100 GB HBM3e | 5th | 14.4 TB/s | v4 | 800 GB/s |

*注：EFA 带宽从 Gbps 换算为 GB/s（÷8），以与其他带宽指标保持一致；参见 [EC2 加速计算网络规格](https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html#ac_network)。NVLink 和 EFA 带宽数字显示为每实例的聚合值，而非每链路值；参见 [P5 实例系列页面](https://aws.amazon.com/ec2/instance-types/p5/) 和 [P6 实例系列页面](https://aws.amazon.com/ec2/instance-types/p6/) 了解对应的节点内互连和网络特性。*

弹性网络适配器（Elastic Fabric Adapter，EFA）是一种适用于 Amazon EC2 的网络接口，使用 [可扩展可靠数据报（Scalable Reliable Datagram，SRD）](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/efa.html) 协议提供 OS 旁路远程直接内存访问（RDMA）能力。通过使应用程序能够通过 Libfabric API 直接与网络设备通信——绕过操作系统内核——EFA 降低了延迟并提升了分布式训练中集合操作的吞吐量。

不同实例系列上提供多代 EFA。Amazon EC2 P5 和 P5e 实例配备 EFA 版本 2（EFAv2）。[EFA 版本 3（EFAv3）提供于 P5en 实例，与 EFAv2 相比，数据包延迟降低约 35%](https://aws.amazon.com/blogs/aws/new-amazon-ec2-p5en-instances-with-nvidia-h200-tensor-core-gpus-and-efav3-networking/)。[EFA 版本 4（EFAv4）提供于 P6 实例，与 EFAv3 相比，集合通信性能再提升 18%](https://aws.amazon.com/blogs/machine-learning/aws-ai-infrastructure-with-nvidia-blackwell-two-powerful-compute-solutions-for-the-next-frontier-of-ai/)。

在规模上，分布式训练（流式处理语料库和写入多 TB 检查点）和大规模推理（暂存权重和管理 KV cache 增长）都需要分层存储层次结构——用于热数据的本地 NVMe SSD、用于共享高吞吐访问的 Lustre，以及用于持久化存储的 [Amazon S3](https://aws.amazon.com/s3/)。

在本系列主要的多 GPU 实例中，本地 NVMe 以**实例存储（临时性）**形式提供，**原始容量为 30.72 TB（8 × 3.84 TB NVMe SSD）**；参见 [EC2 加速计算实例存储规格](https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html#ac_instance-store)。

[Lustre](https://www.lustre.org/about/) 是一个开源的、符合 POSIX 标准的分布式文件系统，广泛用于高性能计算（HPC），为众多客户端提供具有高聚合吞吐量的共享命名空间。[Amazon FSx for Lustre](https://aws.amazon.com/fsx/lustre/) 将 Lustre 作为完全托管服务提供，并将其公开为能够提供每秒 TB 级吞吐量、百万级 IOPS 和亚毫秒级延迟的并行文件系统。数据仓库关联支持与 [Amazon S3](https://aws.amazon.com/s3/) 集成，支持训练数据集的懒加载和自动检查点导出以实现持久化。

在集群规模上，这些实例部署在 [Amazon EC2 UltraClusters](https://aws.amazon.com/ec2/ultraclusters/) 中，该集群在一个可用区内将数千个加速实例作为单一、紧密放置的集群进行配置，并使用 PB 级非阻塞网络将它们互连。

![ec2-ultraclusters-gen2](https://cdn-uploads.huggingface.co/production/uploads/64d6b270c2eedf9af82baa23/iMu8fYvHpDiGrquj6d-6m.jpeg)

> **图：** 第二代 Amazon EC2 UltraClusters（P5 UltraCluster 示例）。

对于每步通信密集度高的工作负载（例如，MoE 模型中的专家并行，其中 all-to-all token 调度跨越多个 GPU），NVLink 域的大小可能成为一阶约束。作为内部纵向扩展轴的延伸，增大 NVLink 域可以减少性能关键通信必须离开 NVLink fabric 的频率。

[Amazon EC2 UltraServers](https://aws.amazon.com/ec2/ultraservers/) 通过专用加速器互连连接多个组件实例，将 NVLink 域扩展到单个 EC2 实例之外。AWS 报告称，[P6e-GB200 UltraServers](https://aws.amazon.com/about-aws/whats-new/2025/07/amazon-p6e-gb200-ultraservers-gpu-performance-ec2/) 基于 [NVIDIA GB200 NVL72](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) 平台构建，在一个 NVLink 域内公开多达 72 块 Blackwell GPU 和 13.4 TB 的聚合 HBM3e。在更大的规模下，EFA 仍然是多 UltraServer 作业的跨节点 fabric，但增加域内 GPU 数量可以减少性能关键通信必须离开 NVLink fabric 的频率。

这些系统由 NVIDIA Grace–Blackwell 超级芯片构建，通过缓存一致性 [NVLink-C2C](https://developer.nvidia.com/blog/nvidia-grace-hopper-superchip-architecture-in-depth/) 将 Grace CPU 内存和 Blackwell GPU HBM 耦合在一起，无需显式的主机-设备拷贝即可直接访问 CPU 和 GPU 附属内存。在实践中，这可以扩展 GPU 工作负载的有效可用内存（例如，将较冷的模型状态或 KV cache 放置在 CPU 附属内存中），同时避免 PCIe 级拷贝开销，尽管与本地 HBM 相比延迟更高、带宽更低。

P6e-GB200 UltraServers 的组件实例类型是 [`p6e-gb200.36xlarge`](https://aws.amazon.com/ec2/instance-types/p6/)，提供四块 GPU 和弹性网络适配器（EFA）v4 网络。下表汇总了每实例和组合 UltraServer 的配置。

| 实例类型 | GPU | GPU 数量 | GPU 内存 | 内存带宽 | NVLink | NVLink 带宽 | EFA | EFA 带宽 |
|---|---|---|---|---|---|---|---|---|
| [p6e-gb200.36xlarge](https://aws.amazon.com/ec2/instance-types/p6/) | [GB200 NVL72](https://www.nvidia.com/en-us/data-center/gb200-nvl72/) | 4 | [740 GB HBM3e](https://aws.amazon.com/blogs/aws/new-amazon-ec2-p6e-gb200-ultraservers-powered-by-nvidia-grace-blackwell-gpus-for-the-highest-ai-performance/) | — | — | — | v4 | [200 GB/s](https://aws.amazon.com/blogs/aws/new-amazon-ec2-p6e-gb200-ultraservers-powered-by-nvidia-grace-blackwell-gpus-for-the-highest-ai-performance/) |

*注：`p6e-gb200.36xlarge` EFA 带宽由已发布的聚合 EFA 网络（4 × 400 Gbps）换算为 GB/s（÷8）；参见 [EC2 加速计算网络规格](https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html#ac_network)。*

| UltraServer | 组件实例类型 | GPU（NVLink 域） | HBM3e（聚合） | EFA | EFA 带宽 |
|---|---|---|---|---|---|
| u-p6e-gb200x36 | [p6e-gb200.36xlarge](https://aws.amazon.com/ec2/instance-types/p6/) | 36 | 6.7 TB | v4 | 1,800 GB/s |
| u-p6e-gb200x72 | [p6e-gb200.36xlarge](https://aws.amazon.com/ec2/instance-types/p6/) | 72 | 13.4 TB | v4 | 3,600 GB/s |

*注：UltraServer EFA 带宽由 AWS 报告的 Tbps 换算为 GB/s（÷8）；参见 [P6e-GB200 UltraServers 公告](https://aws.amazon.com/blogs/aws/new-amazon-ec2-p6e-gb200-ultraservers-powered-by-nvidia-grace-blackwell-gpus-for-the-highest-ai-performance/) 和 [P6 实例系列页面](https://aws.amazon.com/ec2/instance-types/p6/)。*

### 资源编排：Slurm 与 Kubernetes

当训练跨越数百或数千个加速器时，手动资源管理变得难以处理。例如，需要 512 个 GPU 的训练作业必须同时协调调度 64 个八 GPU 节点（P 实例），并在完成或失败时原子性地释放资源。[Slurm](https://slurm.schedmd.com/) 和 [Kubernetes](https://kubernetes.io/) 都通过控制平面架构解决这一挑战：集中式调度器维护集群状态并做出分配决策，而工作节点执行分配的工作负载。

![slurm-k8s-highlevel-arch](https://cdn-uploads.huggingface.co/production/uploads/64d6b270c2eedf9af82baa23/rYM10isubva2wx3jIVeZm.png)

*图 2：AWS 上基于 Slurm 和基于 Kubernetes 的资源编排高层架构*

[Slurm](https://slurm.schedmd.com/)（Simple Linux Utility for Resource Management）是高性能计算中占主导地位的工作负载管理器，基于模块化插件架构构建，允许独立配置调度算法、拓扑模型、资源类型和记账后端。其调度模型将资源组织成分区（节点的逻辑分组），通过 `sbatch` 接受作业提交，并通过 `srun` 在分配的节点上以同步启动的方式启动并行任务。对于分布式训练，Slurm 在作业级别进行调度这一点至关重要——在任何任务启动之前，原子性地分配整个多节点作业。[回填调度器](https://slurm.schedmd.com/sched_config.html) 在空闲槽位启动低优先级作业而不延迟高优先级作业，而[多因素优先级](https://slurm.schedmd.com/priority_multifactor.html)系统通过权衡公平份额使用量、作业年龄和 QOS 层级来跨租户排序队列。Slurm 还通过建模网络交换机层次结构的插件支持[拓扑感知放置](https://slurm.schedmd.com/topology.html)——在 AWS 上，编码 EFA fabric 拓扑以将作业共置于交换机跳数最少的节点上——以及通过其通用资源（GRES）接口支持原生 [GPU 调度](https://slurm.schedmd.com/gres.html)，该接口跟踪 GPU 类型并强制执行设备亲和性。

AWS 提供多种 Slurm 编排的部署选项。[AWS ParallelCluster](https://github.com/aws/aws-parallelcluster) 是一个开源集群管理工具，可自动在 EC2 上部署 Slurm 集群，处理头节点配置、计算队列扩展和与共享存储的集成。[AWS Parallel Computing Service (PCS)](https://aws.amazon.com/pcs/) 提供了一个替代方案，提供托管控制平面。专门针对分布式训练工作负载，[Amazon SageMaker HyperPod](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod.html) 支持 Slurm 模式，并提供专为大规模训练定制的额外功能，例如[持续节点健康监控](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod-resiliency-slurm-cluster-health-check.html)和[作业自动恢复功能](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod-resiliency-slurm-auto-resume.html)。

[Kubernetes](https://kubernetes.io/) 采用声明式、API 驱动的方法：用户通过资源清单指定期望状态，控制器将实际状态调和至匹配。虽然 Kubernetes 在模型部署方面表现出色，但其原生调度模型对于紧密耦合的分布式训练存在几个缺口。Kubernetes 在 pod 级别进行调度；在没有作业级原子性的情况下，多节点训练作业可能部分启动——某些 rank 运行而其他 rank 仍处于 Pending 状态——浪费 GPU 或导致死锁。原生 Kubernetes 还缺乏带有优先级回填的批量队列语义，以及对网络 fabric 拓扑（NVLink 域、EFA 互连）的内置感知，用于放置通信密集型集合操作。

多个 Kubernetes 原生项目在不同层面解决这些缺口。[Kueue](https://kueue.sigs.k8s.io/) 作为准入控制器运行在默认调度器之上，管理作业级 gang 准入、具有分层公平共享的多租户配额和基于优先级的抢占——同时将 pod 放置委托给底层调度器。[Volcano](https://volcano.sh/) 和 [NVIDIA KAI Scheduler](https://github.com/NVIDIA/KAI-Scheduler) 采用不同方法，替换或增强默认调度器，将 gang 调度与拓扑感知 pod 放置直接集成——Volcano 作为通用批量调度器，KAI Scheduler 具有深度 NVLink/NVSwitch 感知，用于 GPU 优化放置。这些层是互补的：Kueue 可以管理准入和配额策略，同时将已准入的作业传递给拓扑感知调度器进行放置。

对于 AWS 上基于 Kubernetes 的编排，[Amazon Elastic Kubernetes Service (EKS)](https://aws.amazon.com/eks/) 通过 [NVIDIA device plugin](https://github.com/NVIDIA/k8s-device-plugin) 提供支持 GPU 调度的托管 Kubernetes。Amazon SageMaker HyperPod 还支持 [EKS 模式](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod-eks.html)，将 Kubernetes 编排与 HyperPod 的训练专用功能相结合。HyperPod EKS 通过专为大规模基础模型训练设计的功能扩展 EKS。[任务治理](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod-eks-operate-console-ui-governance-policies.html)提供跨团队的计算分配和策略执行，集成托管的 [Kueue](https://kueue.sigs.k8s.io/) 用于准入控制和 [Karpenter](https://karpenter.sh/) 用于即时节点配置。[无检查点训练](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-eks-checkpointless.html)解决了传统基于检查点的容错固有的恢复延迟问题。无检查点训练不是定期将模型状态序列化到共享存储，而是在 GPU 之间维持连续的点对点状态复制。当发生故障时，存活节点通过基于 EFA 的通信重建丢失状态，而不是从 FSx for Lustre 或 S3 读取多 TB 检查点。[弹性训练](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-eks-elastic-training.html)使作业能够根据资源可用性自动扩展。当有额外加速器可用时（例如，来自已完成的作业或新配置的容量），弹性作业可以扩展以利用它们；当更高优先级的工作负载需要资源时，作业可以收缩同时保持训练进度。

### ML 软件栈

分布式训练和推理涉及必须正确配置和协调的多个软件层。一个有用的模型将运行时栈视为五层，从硬件邻近组件（这些组件必须正确运行才能有任何东西运行）到框架级抽象（决定程序员生产力和模型吞吐量）排列：硬件使能、加速器运行时和数学库、通信底层、ML 框架，以及分布式训练/推理框架。

![demystify-ml-software-stack](https://cdn-uploads.huggingface.co/production/uploads/64d6b270c2eedf9af82baa23/nglvcX4bzuE_vxavN-2ZU.png)

*图 3：EC2 实例上分布式训练和推理的 ML 软件栈*

#### 硬件使能：内核驱动程序

在基础层，Linux 内核驱动程序提供直接的硬件访问。NVIDIA GPU 驱动程序公开计算能力，并支持 [GPUDirect RDMA](https://docs.nvidia.com/cuda/gpudirect-rdma/index.html) 用于 GPU 和网络适配器之间的直接数据传输。[GDRCopy](https://github.com/NVIDIA/gdrcopy) 驱动程序（`gdrdrv`）使 CPU 发起的低延迟 GPU 内存拷贝成为可能，被 NCCL 用于小消息传输。[EFA 驱动程序](https://github.com/amzn/amzn-drivers)通过 [libfabric](https://github.com/ofiwg/libfabric) API 提供 OS 旁路网络，[Lustre 客户端](https://www.lustre.org/)驱动程序支持对 FSx for Lustre 并行文件系统的 POSIX 访问。

#### 加速器运行时、编译器和内核库

[CUDA](https://developer.nvidia.com/cuda-toolkit) 平台为 GPU 计算提供编程模型和运行时。针对 CUDA 编译的应用程序可以在 NVIDIA GPU 上启动内核、管理设备内存，并协调多设备间的执行。当前版本为 CUDA Toolkit 13.x，支持 Blackwell 架构（计算能力 10.x）。

现代训练和推理性能越来越多地由专用优化库和自定义内核驱动，而不仅仅是通用供应商原语。像 [FlashAttention](https://github.com/Dao-AILab/flash-attention) 这样的内核将 attention 融合为单次内存高效的传递，减少 HBM 流量并提升吞吐量。许多团队还编写了针对其精确模型调优的形状和精度专用融合内核（例如，layernorm/residual/activation、量化 GEMM、MoE dispatch、KV cache 操作）。这得益于 [Triton](https://triton-lang.org/)（Python GPU 内核编译器）和 NVIDIA 的 [CuTe](https://github.com/NVIDIA/cutlass/blob/main/media/docs/cute/00_quickstart.md)（张量布局和 warp 级 DSL）等可编程工具链，以及 [CUTLASS](https://github.com/NVIDIA/cutlass) 等库，这些库提供高度优化的 GEMM 和融合构建块。在实践中，这个内核和编译器层对端到端性能的决定作用往往与 ML 框架同等重要。

#### 通信底层：NCCL 与传输插件

多 GPU 训练依赖于高效的集合通信。[NVIDIA Collective Communications Library (NCCL)](https://developer.nvidia.com/nccl) 实现了集合操作——all-reduce、all-gather、reduce-scatter、all-to-all、broadcast 以及点对点 send/receive——使用拓扑感知算法，利用 NVLink 进行节点内通信，使用网络传输进行节点间流量。NCCL 动态检测通信拓扑，并根据消息大小和可用带宽选择环形或树形算法。数据并行和张量并行策略主要依赖 all-reduce 和 all-gather，而带有专家并行的混合专家（MoE）模型依赖 all-to-all 集合操作在 GPU 之间路由 token：一个调度 all-to-all 将每个 token 发送到托管其分配专家的 GPU，一个合并 all-to-all 将专家输出返回到原始 GPU（[NVIDIA Developer Blog](https://developer.nvidia.com/blog/accelerating-large-scale-mixture-of-experts-training-in-pytorch/)）。由于专家并行组中的每个 GPU 都与其他所有 GPU 交换数据，all-to-all 通信量随专家数量线性扩展，在高专家并行度下可能成为主要瓶颈。

在 AWS 上，NCCL 的节点间通信通过 [aws-ofi-nccl](https://github.com/aws/aws-ofi-nccl) 插件实现，该插件将 NCCL 的传输 API 映射到 [libfabric](https://github.com/ofiwg/libfabric) 接口。这使 NCCL 能够利用 EFA 的 OS 旁路和可扩展可靠数据报（SRD）协议，无需更改应用程序。

对于推理工作负载，集合操作无法涵盖所有通信模式。分离式推理架构——将预填充和解码阶段分离到不同的 GPU 池中——需要高效的点对点数据移动，尤其是在实例间传输 KV cache 状态。[NVIDIA Inference Xfer Library (NIXL)](https://github.com/ai-dynamo/nixl) 通过提供跨内存层（HBM、DRAM、NVMe、分布式存储）和互连（NVLink、InfiniBand、Ethernet）的点对点传输统一 API 来满足这一需求。NIXL 与 NVIDIA Dynamo 等推理框架集成，并支持 UCX 和 GPUDirect Storage 等后端。

#### ML 框架：PyTorch

基础模型开发的两个主要框架是 [PyTorch](https://pytorch.org/) 和 [JAX](https://jax.readthedocs.io/)。JAX 通过 XLA 采用 SPMD（单程序多数据）方法，相同程序在各设备上执行，自动进行数据分布和集合降级。本系列专注于 PyTorch，它在开源生态系统中有更广泛的采用，并构成下文讨论的分布式训练和推理框架的基础。

PyTorch 提供带 GPU 加速的张量计算、自动微分和灵活的即时执行模型。对于分布式工作负载，PyTorch 的 `torch.distributed` 模块提供核心原语：用于集合通信的进程组，以及分布式数据并行抽象，包括[分布式数据并行（DDP）](https://docs.pytorch.org/docs/stable/nn.html#torch.nn.parallel.DistributedDataParallel)和[完全分片数据并行（FSDP2）](https://docs.pytorch.org/docs/stable/distributed.fsdp.fully_shard.html)。DDP 在 GPU 间复制模型并通过 all-reduce 同步梯度，而 FSDP2 使用 ZeRO 算法的技术在工作进程间分片参数、梯度和优化器状态，使训练超出单 GPU 内存容量的模型成为可能。

#### 分布式训练和推理框架

顶层包含在 PyTorch 之上构建的框架，为大规模分布式训练和推理提供更高级的抽象。对于训练，三类框架解决复杂性-性能权衡中的不同点。以下是一些示例。

[Hugging Face Transformers](https://huggingface.co/docs/transformers/) 通过 [Accelerate](https://huggingface.co/docs/accelerate/) 提供内置支持分布式训练的 `Trainer` 类，Accelerate 对 DDP、FSDP 和 DeepSpeed 进行了抽象。这条路径优先考虑易用性和广泛的模型兼容性，使其适合于微调和中等规模训练，在这些场景中配置简单性比最大吞吐量更重要。

[NVIDIA Megatron Core](https://developer.nvidia.com/megatron-core) 以在规模上实现最大效率为目标，实现了 3D 并行（张量并行、流水线并行和专家并行），并通过 Transformer Engine 进行 FP8 混合精度优化。[NeMo Framework](https://docs.nvidia.com/nemo-framework/user-guide/latest/) 基于 Megatron Core 构建，提供端到端的预训练和微调工作流程。

对于基于人类反馈的强化学习（RLHF）和相关的后训练方法，[veRL](https://github.com/volcengine/verl)（Volcano Engine Reinforcement Learning）提供了一个灵活的框架，实现了包括 PPO、GRPO 和 REINFORCE++ 在内的算法。veRL 的 HybridFlow 架构允许在同一作业中混合训练后端（FSDP2、Megatron）和推理引擎（vLLM、SGLang），通过在 actor 和 rollout 组件之间在内存中共享模型权重来避免权重同步开销。

对于推理服务，[vLLM](https://github.com/vllm-project/vllm) 实现了 PagedAttention，将 KV cache 作为分页虚拟内存管理，以减少碎片化并实现更高的批次大小。[SGLang](https://github.com/sgl-project/sglang) 通过 RadixAttention 扩展了这一功能，以实现请求间的自动前缀复用，一个将 CPU 调度与 GPU 计算重叠的零开销批调度器，以及一个基于预测缓存命中率路由请求的缓存感知负载均衡器。两个框架都支持张量并行以服务超出单 GPU 内存的模型，并且都与 [NVIDIA Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) 集成，用于分离预填充和解码阶段的分离式服务架构。

### 可观测性

可观测性是在规模上调试和运营分布式训练系统的先决条件。当训练作业停滞或吞吐量下降时，从业者需要了解原因是硬件故障、网络拥塞、存储瓶颈还是应用级效率低下。在本系列讨论的基础设施规模上——数千个 GPU、PB 级互连带宽和 TB 级检查点数据——挑战从简单监控转变为系统化的遥测收集、存储和分析。可观测性跨越三个遥测类别：基础设施指标（GPU、网络、存储）、工作负载指标（训练吞吐量、队列延迟）以及用于主动故障检测的告警。

#### 核心栈：Prometheus 与 Grafana

Kubernetes 和 HPC 环境中可观测性的事实标准将 [Prometheus](https://prometheus.io/docs/introduction/overview/) 用于指标收集，将 [Grafana](https://grafana.com/docs/grafana/latest/) 用于可视化和告警。Prometheus 基于拉取模式运行，定期抓取指标导出器公开的 HTTP 端点。收集的指标存储在时序数据库（TSDB）中，并通过 PromQL 查询，PromQL 是一种用于聚合、过滤和告警规则评估的灵活查询语言。Grafana 将 Prometheus 作为数据源，基于 PromQL 表达式渲染仪表板和触发告警。

对于生产部署，[Amazon Managed Service for Prometheus (AMP)](https://docs.aws.amazon.com/prometheus/latest/userguide/what-is-Amazon-Managed-Service-Prometheus.html) 提供完全托管的、与 Prometheus 兼容的时序数据库，可扩展到每秒摄取数百万个样本，无需运维人员管理存储、复制或高可用性。[Amazon Managed Grafana (AMG)](https://docs.aws.amazon.com/grafana/latest/userguide/what-is-Amazon-Managed-Service-Grafana.html) 提供托管的 Grafana 工作区，与 AMP 原生集成，并通过 IAM Identity Center 进行 AWS 身份验证。这两个服务共同消除了运维开销，同时保持与现有 Prometheus 导出器和 Grafana 仪表板的兼容性。

#### GPU、网络和应用遥测

[DCGM-Exporter](https://github.com/NVIDIA/dcgm-exporter) 以 Prometheus 格式公开 NVIDIA GPU 指标，包括利用率、内存使用量、功耗、温度以及硬件健康指标（如 ECC 错误和 XID 事件）。对于训练工作负载，SM 活跃度（`DCGM_FI_PROF_SM_ACTIVE`）通常比基本利用率指标更准确地衡量计算效率。

EFA 公开驱动级统计信息（字节、数据包、重传、超时），有助于诊断分布式训练中集合操作的瓶颈。[aws-ofi-nccl](https://github.com/aws/aws-ofi-nccl) 插件将 NCCL 桥接到 libfabric 接口，运维人员可以将 EFA 计数器与 NCCL 诊断信息（`NCCL_DEBUG=INFO`）结合使用，以隔离网络层问题。

[Amazon FSx for Lustre](https://aws.amazon.com/fsx/lustre/) 公开客户端侧指标，包括吞吐量和元数据延迟，而应用级指标（训练的每步时间、每秒 token 数、损失值；推理的 TTFT、令牌间延迟）可以通过 Prometheus 客户端库导出。

#### GPU 健康监控与告警

主动故障检测防止硬件问题演变为长时间的训练中断。典型工作流程监控 DCGM 健康指标，并在错误计数超过阈值时触发告警。ECC 单比特错误（SBE）在数量较少时可能可以容忍，但 SBE 率加速通常预示着双比特错误（DBE）或其他故障。XID 63（行重映射失败）、XID 64（GPU 从总线上脱落）和 XID 94/95（已遏制/未遏制错误）通常需要立即更换节点。

[GPU Health - Cluster dashboard](https://grafana.com/grafana/dashboards/21645-gpu-health-cluster/)（Grafana 仪表板 ID 21645）为常见 GPU 错误模式提供参考可视化。该仪表板汇总整个集群节点的 ECC 错误、XID 事件、热违规和行重映射状态，使运维人员能够在故障影响训练作业之前识别出问题硬件。

![GPU Health - Cluster dashboard](https://huggingface.co/blog/amazon/figs/gpu-health.png)
*图 4：GPU Health - Cluster 仪表板，显示 GPU 错误模式和实例报告*

本系列第 5 部分将全面介绍可观测性架构，包括指标收集策略、仪表板配置以及用于在规模上维护集群健康的告警模式。

## 总结

从单一预训练扩展定律转变为三种互补范式——预训练、后训练和测试时计算——并未分散基础设施需求；而是强化了这些需求。三种范式都需要紧密耦合的加速器计算、高带宽低延迟网络和可扩展的分布式存储，主要区别在于工作负载特征和资源调度模式。

本文展示了在 AWS 上满足这些需求的四层架构：基础设施构建块（EC2 P 实例、EFA 网络和分层存储）、资源编排（Slurm 和 Kubernetes 以及 SageMaker HyperPod）、ML 软件栈（从内核驱动程序和 CUDA 到 NCCL 再到 PyTorch），以及可观测性（Prometheus、Grafana 和 GPU 健康监控）。每一层都约束并使能其上层——配置错误的驱动程序或饱和的网络链路可以像次优的并行策略一样有效地成为原本调优良好的训练运行的瓶颈。

理解这些集成点是诊断性能瓶颈并在基础模型生命周期中做出明智扩展决策的基础。

## 作者

**[Aman Shanbhag](https://www.linkedin.com/in/aman-shanbhag/)** 是 NVIDIA MARS MLOps 团队的 AI 性能与基础设施工程师，帮助研究团队构建可扩展、高性能的 ML 训练和推理系统。他此前担任 AWS 专业解决方案架构师，支持全球客户进行 AWS 上的 ML 训练和推理优化。Aman 拥有莱斯大学计算机科学、数学和创业学学位，专注于 AI 基础设施、性能优化以及分布式训练和推理。

**[Pavel Belevich](https://www.linkedin.com/in/pbelevich/)** 是 Amazon Web Services GenAI ML 框架团队的高级应用科学家。他将分布式训练和大模型推理的研究应用于生产规模的真实客户工作负载。加入 AWS 之前，Pavel 在 PyTorch Distributed 团队工作，为 FSDP 和流水线并行等核心分布式训练技术做出了贡献。在 AWS，他致力于 MoE 通信模式和大规模服务/训练工作流程，并定期通过专家并行和大模型系统的技术深度解析分享最佳实践。

**[Keita Watanabe](https://www.linkedin.com/in/keitawatanabe/)** 是 Amazon Web Services GenAI ML 框架团队的首席解决方案架构师，专注于 ML 系统性能工程，支持全球客户进行 AWS 上的 ML 训练和推理优化。他的背景是机器学习研究与开发。加入 AWS 之前，Keita 在乐天担任研究科学家，开发了基于图像的产品搜索系统。Keita 持有东京大学理学博士学位。

---

## 引用

- 原文：[Building Blocks for Foundation Model Training and Inference on AWS](https://huggingface.co/blog/amazon/foundation-model-building-blocks)
- [Kaplan et al. (2020)](https://arxiv.org/abs/2001.08361)
- [NVIDIA Blog: AI's Three Scaling Laws, Explained](https://blogs.nvidia.com/blog/ai-scaling-laws/)
- [Amazon EC2 UltraClusters](https://aws.amazon.com/ec2/ultraclusters/)
- [Amazon SageMaker HyperPod](https://docs.aws.amazon.com/sagemaker/latest/dg/sagemaker-hyperpod.html)
