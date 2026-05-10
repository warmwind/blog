---
title: LLM 能否在 TLA+ 中对真实系统建模？
pubDatetime: 2026-05-10T10:30:00+08:00
description: Specula 团队通过 SysMoBench 基准测试，系统评估了主流 LLM 用 TLA+ 对真实分布式系统建模的能力，揭示了当前 LLM 在形式化建模中的核心局限。
slug: llms-tla-plus-model-real-world-systems-zh
originalTitle: "Can LLMs model real-world systems in TLA+?"
originalUrl: https://www.sigops.org/2026/can-llms-model-real-world-systems-in-tla/
tags:
  - AI
  - LLM
  - Formal Methods
  - Systems
---

原文标题：Can LLMs model real-world systems in TLA+?<br>
原文链接：https://www.sigops.org/2026/can-llms-model-real-world-systems-in-tla/

***编者注：** AI 正在积极推动计算系统应用形式化方法的前沿。在本文中，[Specula 团队](https://github.com/specula-org)分享了他们评估 LLM 对系统代码进行建模——这是 agent 式模型检验的基本能力——使用 TLA+（一种用于并发和分布式系统的规约语言）的经验。本文是[《系统智能的下一个地平线》](https://www.sigops.org/2025/the-next-horizon-of-system-intelligence/)系列的第 7 篇博客。*

几个月前，我们请 Claude 为 [Etcd 的 Raft 实现](https://github.com/etcd-io/raft)编写一份 [TLA](https://lamport.azurewebsites.net/tla/tla.html)+ 规约（spec）。它通过了语法检查，通过了 [TLC](https://github.com/tlaplus/tlaplus) 模型检查器，乍看之下像是一份精良的形式化模型。然后我们发现了一些不对劲：这看起来像是 Raft 论文中的规约，与 Etcd 的具体细节几乎没有任何关联。Claude 生成的不是 Etcd 的规约，而是 [Raft 论文](https://raft.github.io/raft.pdf)附录中的规约。此后，我们不断回到这个问题：我们如何判断 AI 是在忠实地对一个计算系统进行建模，还是只是在背诵系统的参考论文？

随着大型语言模型（LLM）的持续进步，这个问题变得愈发难以回答。LLM 几乎见过网上每一个 TLA+ 示例。要求其"编写一个 Raft 规约"几乎等同于要求其从训练记忆中召回内容。要求其"编写 Etcd 的规约"——一份能够反映 Etcd 实际如何分解原子动作、如何演进状态的规约——则是完全不同的问题。这要测试的是 LLM 是否能够从复杂的实现中抽象出逻辑，并将该抽象转化为正确的形式化模型。

*SysMoBench* 是我们通过自动化基准测试来区分这两者的尝试。

## 什么是 SysMoBench？

SysMoBench 向 LLM 提供十一个系统，并自动评估其生成的 TLA+ 规约。

![表格 1：SysMoBench 中作为测试工件使用的系统](https://www.sigops.org/wp-content/uploads/2026/05/sysmobench-1672x941.jpg)

这十一个系统涵盖了并发同步和分布式协议。对于每个任务，我们提供源代码、一个追踪收集框架和一个不变量模板。

![图 1：SysMoBench 概述](https://www.sigops.org/wp-content/uploads/2026/05/Screenshot-2026-05-07-at-2.55.17-AM-1024x353.png)

评估分四个阶段进行：

- 语法阶段检查规约是否能够编译。
- 运行时阶段检查 TLC 是否能够无错误地执行规约。
- 一致性阶段使用追踪验证（检查规约与代码一致性的常用方法）：将代码的执行追踪与模型进行比较。
- 不变量阶段检查规约是否满足关键的安全性和活性属性。

这四个阶段共同揭示了只会背诵教科书的规约与实际对系统建模的规约之间的差距。每个阶段都会产生以动作或不变量为粒度的诊断结果，而非单一的综合分数，因此我们可以精确看到规约在哪个动作或不变量上与实现不一致。

## LLM 的建模模式

当我们在 SysMoBench 上运行当今领先的 LLM——Claude、GPT、Gemini、DeepSeek、Kimi、Qwen 等——时，会出现一种反复出现的模式。这些规约在前两个阶段（语法和运行时）表现相当好。大多数编译顺畅，许多也能无错误地通过 TLC。但是，一旦评估进入一致性阶段，两种系统性的"教科书式建模"形式便会显现：（1）规约会进入真实系统永远不会达到的状态，（2）规约无法达到真实系统必然会达到的状态。这两种失败模式直接体现在一致性和不变量分数上：即使是最新的领先 LLM，在语法上得分接近满分，但一致性平均约 46%，不变量平均约 41%。

在规约进入真实系统永远不会到达的状态的案例中，LLM 按照一种与系统实际数据结构不匹配的通用形式化模板编写规约，导致规约允许的转换会产生真实系统永远不会出现的状态。一个具体的例子来自 Claude Sonnet 对 ZooKeeper 快速领导者选举（FLE）的规约。

![图 2：LLM 生成的 ZooKeeper FLE 规约中的两种失败模式](https://www.sigops.org/wp-content/uploads/2026/05/image-3-1024x387.png)

在 ZooKeeper 代码中，每个服务器的 recvset 是一个以发送方为键的映射：当同一个节点在新一轮发送新投票时，会覆盖该节点的旧投票。Sonnet 将此写为集合并运算，`recvVotes' = recvVotes ∪ {newVote}`，同时保留旧投票和新投票。"将所有投票作为证据累积"的模式出现在许多形式化方法教科书中，但它与 ZooKeeper 的语义不符。因此，每当一个节点的投票在多轮之间发生变化时（这在 ZooKeeper 选举中经常发生），规约的后续状态同时包含旧投票和新投票，而真实系统只保留新投票。一旦下游的法定人数检查依赖于投票计数，规约就会遇到真实代码永远不会进入的状态。

在规约无法达到真实系统必然到达的状态的案例中，LLM 将代码中跨多个步骤的操作合并为单个原子保护条件，使得规约中的某些转换变得不可能。在同一份 Sonnet 的 ZooKeeper 规约中，HandleNotification 动作带有一个保护条件 `m.electionEpoch <= logicalClock[s]`，用于检查传入消息的纪元是否高于本地 logicalClock。如果是，则该动作被禁用。但 ZooKeeper 的代码并非如此工作。当服务器收到纪元更高的消息时，它首先将自己的 logicalClock 提升到与之匹配，然后处理该消息。这两个步骤在代码中按此顺序发生。然而，LLM 将它们融合成了单个保护条件，并在此过程中抹去了代码在每一轮选举中都会进入的状态（本地纪元=1，传入纪元=2）。

以上两种模式有一个共同的原因。LLM 生成的 TLA+ 模块结构完整、类型正确，但这些模块是按照教科书形式化模板编写的，而非反映实际实现。LLM 知道 Raft 和 ZAB 作为协议是什么样子的，但它不知道 Etcd 或 ZooKeeper 如何将某个特定动作拆分为多个步骤。这正是为什么语法和运行时评估标准不够充分。LLM 生成的规约都能通过 [SANY](https://github.com/tlaplus/tlaplus) TLA+ 解析器，因为它们结构完整、语法清晰。要区分"对 Etcd 建模"和"背诵 Raft 论文"，评估必须到达一致性和不变量阶段，针对每个动作询问其转换是否与系统在运行时实际产生的状态变化相符。

## 转换验证：以动作粒度读取规约

SysMoBench 的所有阶段都会产生以动作或不变量为粒度的诊断，而非单一的综合分数。语法阶段对每个动作进行分解，以定位哪个动作存在问题，而非直接编译整个模块。运行时阶段分析状态空间的每动作覆盖率，而非仅仅检查 TLC 是否能执行规约。不变量阶段单独验证每个不变量，使用 LLM 将固定模板转化为每个生成规约的可运行不变量。一致性阶段使用我们称之为*转换验证*的方法，它最直接地揭示了"背诵教科书协议"与"对系统建模"之间的差距。

这个思路很简单。我们从系统的真实运行中收集执行追踪，然后将每条追踪切分为一系列"转换窗口"。一个窗口是一个三元组：（前置状态、动作、后置状态）。每个窗口独立输入给 TLC，TLC 检查规约的动作是否能够从前置状态转换到后置状态。输出不是单一分数，而是每个动作的细分，每个动作对应一个通过率。

举一个具体例子：当我们对 Asterinas RwMutex 运行转换验证时，输出是一张每动作的计分卡，详细列出每个动作的通过率。粗粒度的评估无法提供这种诊断。单一分数只告诉你规约是通过还是失败，而转换验证不仅告诉你哪个动作不一致，还告诉你哪个具体的状态转换失败，精确定位到追踪中的特定窗口。

## 发现：分数在哪里出现分化

在十一个系统上运行领先的 LLM，结果表明 LLM 非常擅长生成正确的 TLA+ 语法，但难以确保一致性和适当的不变量。

![图 3：11 个 LLM 在 SysMoBench 各阶段的分数（按综合分排序）；不同 LLM 的排名可在 SysMoBench 排行榜上查看](https://www.sigops.org/wp-content/uploads/2026/05/image-4-1024x495.png)

大多数 LLM 在语法阶段得分接近 100%：几乎每个前沿 LLM 都能编写出语法有效的 TLA+ 规约。运行时阶段已经出现分化，范围从 30% 到 92%。真正的差距在一致性和不变量上打开。在不变量阶段，最弱的 LLM 仅达到 16%，而 Gemini 3.1 达到了 81%。

这种一致性和不变量分数较差的模式在每个系统层面上是一致的。图 4 以 Claude Sonnet 4.6 为代表模型加以说明。在较简单的系统（Asterinas Spin、Mutex、RwMutex）上，几乎每个 LLM 都能以高分完成从阶段 1（语法）到阶段 4（不变量）的全程。在复杂的分布式系统（Etcd、RedisRaft、CURP、PGo raftkvs）上，LLM 在阶段 1（语法）上可靠地得到 100% 或接近 100% 的分数，但从阶段 2（运行时）开始逐渐崩溃；有些甚至无法让 TLC 运行，而那些能够运行的，其一致性和不变量分数仅在 10% 到 50% 之间。即便是最强大的 LLM 之一 Claude Sonnet 4.6，在 RedisRaft 和 CURP 上的综合得分也只有 25%。

![图 4：Claude Sonnet 4.6 在不同系统上的综合得分，按难度级别排序（从简单到困难）。](https://www.sigops.org/wp-content/uploads/2026/05/image-5-1024x427.png)

我们在所有 LLM 上都观察到类似的行为。编写能编译的 TLA+ 模块是可以实现的，但将该模块与特定系统的实际行为对齐则颇具挑战性。语法的高分很大程度上反映了训练数据中 TLA+ 示例的丰富性。一旦评估要求按照真实代码的方式分解动作，并将状态与数据结构相匹配，先前的示例就不再有用。分别评估一致性和不变量粒度，使我们能够区分"编写 TLA+"与"对特定系统建模"。

## 尚待解决的挑战

仍有几个问题尚未解决。

首先，窗口级别的评估在很大程度上依赖于追踪采样。转换验证无法评估追踪未覆盖的代码路径。举一个具体例子：在我们的某次运行中，Asterinas RwMutex 中的 AcquireUpReadLock 动作的窗口数量为 0——不是因为规约失败了，而是因为该追踪中根本没有执行 upread() 代码路径。转换验证可以清晰地报告这一点，但它无法自行填补这一空白。系统性地扩大追踪覆盖率仍是一个开放性问题。

其次，状态抽象不可避免地会丢失信息。将变量 log 表示为 `(logLen, logLastTerm)` 对，对于深入检查日志内容的动作（例如 HandleAppendEntries 检查特定中间条目的任期）而言是有损的。我们目前在转换验证模块中手动放宽这些限制，尚无系统性的策略。

第三，跨任务的泛化能力是一个挑战。添加一个新系统仍然需要手写框架、不变量模板和转换验证模块。我们正在为这一流程搭建自动化脚手架，但完全自动化还需要更多工程投入。

这些是我们希望（最好与社区一起）解决的开放性问题，而非我们已经解决的问题。如果其中任何问题令你感兴趣，欢迎合作！

## 下一步

我们将继续迭代 SysMoBench，同时构建超越原始 LLM 的更强大的 agent 工具。

事实上，我们发现 Claude Code 和 Codex 等前沿代码 agent 在对真实系统进行 TLA+ 建模方面已经具备了很强的能力：它们可以自主读取目标代码库，决定建模内容，并驱动完整的规约工作流程。我们正在开发 [Specula](https://github.com/specula-org/Specula)，这是一个专门用于 TLA+ 形式化建模的 agent。Specula 在当前 SysMoBench 任务上实现了完整的一致性和不变量分数（请参阅我们的[排行榜](https://sysmobench.com/#/leaderboard)）。

![图 5：各 LLM 和 agent 在 SysMoBench 上的综合得分](https://www.sigops.org/wp-content/uploads/2026/05/image-1024x459.png)

[sysmobench.com](http://sysmobench.com) 上的排行榜正在持续收录新的 LLM 和系统。我们欢迎对新系统、新 LLM 和新结果的贡献！

- **论文：** [https://arxiv.org/abs/2509.23130](https://arxiv.org/abs/2509.23130) [1]
- **代码：** [https://github.com/specula-org/SysMoBench](https://github.com/specula-org/SysMoBench)
- **排行榜：** [https://sysmobench.com](https://sysmobench.com)

[1] 随着 LLM 的快速发展，本文所报告的评估数字可能与原始论文中的数字有所不同。事实上，本文的写作动机正是来自最近重新运行 SysMoBench 以评测新批次模型的请求。我们的排行榜持续跟踪新模型。

本文由 Haoran Qiu 和 Mike Chieh-Jan Liang 编辑。

## 引用

- 原文：[Can LLMs model real-world systems in TLA+?](https://www.sigops.org/2026/can-llms-model-real-world-systems-in-tla/)
- 论文：[https://arxiv.org/abs/2509.23130](https://arxiv.org/abs/2509.23130)
- 代码：[https://github.com/specula-org/SysMoBench](https://github.com/specula-org/SysMoBench)
- 排行榜：[https://sysmobench.com](https://sysmobench.com)
