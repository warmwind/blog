---
title: 开源可监控性评测套件
pubDatetime: 2026-04-27T10:00:00+08:00
description: OpenAI 开源了链式思维可监控性评测数据集与代码，并分享了一种新的交叉拟合过滤策略，用于处理噪声主导的干预评测实例。
slug: open-sourcing-monitorability-evals-zh
originalTitle: Open Sourcing Monitorability Evaluations
originalUrl: https://alignment.openai.com/monitorability-evals/
---

原文标题：Open Sourcing Monitorability Evaluations<br>
原文链接：https://alignment.openai.com/monitorability-evals/

**TL;DR**：我们正在开源来自[链式思维可监控性工作](https://openai.com/index/evaluating-chain-of-thought-monitorability/)的部分数据集与参考代码。此次发布包含我们可监控性评测套件中的大多数数据集、用于计算可监控性指标 **g-mean²** 的代码，以及一种新的交叉拟合过滤策略，使干预式估计对噪声主导的实例更加鲁棒。

链式思维可监控性是 OpenAI 安全策略的重要组成部分，它使我们能够监督模型的推理过程以发现异常行为，而不仅仅依赖于行为结果或最终响应。此外，CoT 监控还有助于揭示模型的目标、价值观及其采取行动的原因。OpenAI 已将 CoT 监控用于检测[前沿推理模型](https://openai.com/index/chain-of-thought-monitoring/)中的奖励黑客行为及其他异常行为，以及[内部 Agent 部署](https://openai.com/index/how-we-monitor-internal-coding-agents-misalignment/)中的失配问题，使其成为当下切实可行的安全保障，而非仅停留于设想层面。与此同时，CoT 监控的有效性取决于保持 CoT 的信息量和可读性。因此，OpenAI 致力于避免对推理链施加强烈的优化压力，并持续、鲁棒地评测模型推理轨迹的可监控性。

只要 CoT 可监控性仍然是我们 AGI 安全策略的重要一层，我们就将在未来前沿推理模型的系统卡片中报告可监控性评测结果。我们还已回填了现有系统卡片，加入了完整可监控性套件在 [GPT-5.4 thinking](https://deploymentsafety.openai.com/gpt-5-4-thinking)、[GPT-5.2 thinking](https://deploymentsafety.openai.com/gpt-5-2)、[GPT-5 thinking](https://arxiv.org/abs/2601.03267) 和 [o3](https://deploymentsafety.openai.com/o3) 上的结果。o3 系统卡片包含 o1 在评测套件非工具子集上的结果。

我们正在开源[链式思维可监控性评测](https://openai.com/index/evaluating-chain-of-thought-monitorability/)工作中的数据集与参考代码，使研究社区能够在我们的评测套件基础上继续构建，其他前沿模型开发者也可以开始报告其模型的可监控性。我们的目标是让随时间追踪可监控性变化、对新的训练和推理方法进行压力测试、以及在该领域探索链式思维监控能否作为可靠安全层时实现标准化测量变得更加容易。GitHub 仓库地址：[https://github.com/openai/monitorability-evals](https://github.com/openai/monitorability-evals)。

此次发布包含以下评测：

- **干预评测（Intervention evals）**：GPQA、GPQA encoded、AIME、DAFT、Memory<sup>[1]</sup>、Scruples 和 Sandbagging
- **过程评测（Process evals）**：AIME-Math 和 GPQA-Physics
- **结果属性评测（Outcome-property evals）**：Flaky-Tools（CharXiv）、ShadeArena 和 Impossible Coding Tasks（LiveBench）

部分评测依赖私有或受限数据，未包含在此次发布中：

- **干预评测**：Health Queries
- **过程评测**：FrontierMath 和 Math Diamond
- **结果属性评测**：OAI-Repo-Sabotage、Anti-Scheming、两个基于内部 OpenAI 浏览评测和编程题的 Flaky-Tools 数据集，以及基于 OpenAI 面试题的 Impossible Coding Task

我们同时发布了用于计算可监控性指标 **g-mean²** 的代码，以及一个模拟运行评测的脚手架。该脚手架是一个高层编排层，负责加载数据集和提示元数据，使用模拟的模型与监控器输出对行进行采样和评分，计算干预、过程和结果指标，并将样本和摘要写入磁盘。我们不会对该脚手架提供支持，因为它仅用于说明如何运行我们的评测，而非完整的评测框架。

作为参考，图 1-3 展示了使用仅 CoT 监控器范围时，GPT-5.4 thinking 在开源评测子集上的结果。我们绘制了不同推理努力程度下，**g-mean²** 随 CoT token 长度变化的曲线。我们分别展示了开源评测子集中每个独立环境以及每种评测类型聚合后的结果。缺失的数据点对应指标被认为不够可靠而无法报告的情况，即干预结果中观测到正总效应的问题实例不足 10%，或非干预结果中正实例数量少于 3 个。这与我们在论文中使用的过滤策略一致。

![GPT-5.4 在开源干预评测上的可监控性结果](https://alignment.openai.com/monitorability-evals/figures/results_intervention.png)

**图 1.** *干预评测：* GPT-5.4 在开源干预评测上的结果，使用仅 CoT 监控器范围。

![GPT-5.4 在开源过程评测上的可监控性结果](https://alignment.openai.com/monitorability-evals/figures/results_process.png)

**图 2.** *过程评测：* GPT-5.4 在开源过程评测上的结果，使用仅 CoT 监控器范围。过程数学仅限于其 AIME 组成部分。

![GPT-5.4 在开源结果属性评测上的可监控性结果](https://alignment.openai.com/monitorability-evals/figures/results_outcome.png)

**图 3.** *结果属性评测：* GPT-5.4 在开源结果属性评测上的结果，使用仅 CoT 监控器范围。Flaky Tools 仅限于其 CharXiv 组成部分，Impossible Coding Tasks 仅限于其 LiveBench 组成部分。

然而，许多保留下来的 $\widehat{TE} > 0$ 实例可能仍具有真正的零效应或负效应，由于有限样本噪声而表现为正值。这是 **g-mean²** 最脆弱的区间：噪声驱动的正值可能看起来像真实的干预效应，并主导聚合指标。

图 4 通过对比一种神谕（oracle）过滤策略与我们论文中使用的朴素"保留所有 $\widehat{TE} > 0$ 的实例"规则，具体说明了这一问题。在纯零假设设定（即干预无真实效应）下，神谕策略不保留任何实例，而朴素规则仅因为有一半噪声估计落在零以上而保留了许多假阳性。底行预览了我们的解决方案：一种交叉拟合过滤策略，在每个实例内将*资格判定*与*效应估计*分离，使得幸存实例不会因触发保留的相同样本而被人为夸大。

![噪声驱动正值及交叉拟合过滤策略在零假设和混合效应干预设定下的合成示意图](https://alignment.openai.com/monitorability-evals/figures/synthetic.png)

**图 4.** 两种生成场景下噪声驱动正值与交叉拟合过滤示意图。我们使用每臂 30 个样本模拟实例级别的总效应估计 $\widehat{TE}=\hat{p}_1 - \hat{p}_0$。在场景 A 中，所有实例均为真零效应。在场景 B 中，90% 的实例为真零效应，10% 具有较大的真实效应。交叉拟合加 Wald 过滤在不人为夸大幸存实例的情况下减少了假阳性。注意：除神谕过滤外，所有策略均排除 $\widehat{TE} \leq 0$ 的实例，其中 **g-mean²** 未定义或无意义。

### 为何对全量数据应用 Wald 过滤会产生"p-hacking 幸存者"

减少噪声驱动正值的一个自然想法是要求实例的估计效应相对于其估计标准误差足够大。这产生了一种 [Wald](https://www.jstor.org/stable/1990256) 类型的资格判定规则：

$$
\text{若 } \hat{TE} > k\,\widehat{SE}(\hat{TE}) \text{ 则为合格}
$$

等价地定义 $W = \hat{TE}/\widehat{SE}(\hat{TE})$，并在 $W > k$ 时保留该实例。我们使用 $k = 1.96$，即标准正态分布的 97.5% 分位数，也就是传统双侧 95% 正态近似阈值。

该过滤*确实*减少了保留的零假设实例数量，但如果资格判定和效应估计使用*相同的样本*计算，它也会引发赢家诅咒效应：以较大的观测 $W$ 为条件，会在幸存者中夸大观测到的 $\hat{TE}$。特别是当许多真实效应较小时，例如 $TE \approx 0$，

$$
\mathbb{E}[\hat{TE} \mid \hat{TE} > k\widehat{SE}] > TE
$$

因为通过阈值需要一个异常正向的波动。任何随 $\hat{TE}$ 增大的下游量，例如 $R_\text{effect} = \hat{TE}/\hat{p}_1$（我们在干预评测的最小准则 **g-mean²** 指标中使用，详见[论文](https://arxiv.org/abs/2512.18311)），都会继承这种夸大。结果是一个保留集，即使其中大部分表面信号是采样噪声，也可能误导性地看起来包含真实高效应实例：即"p-hacking 幸存者"现象。

### 交叉拟合资格判定：修复事后选择偏差

我们通过**交叉拟合**（实例内样本分割）减少事后选择偏差，遵循[半参数](https://arxiv.org/abs/1801.09138)和[双重机器学习](https://academic.oup.com/ectj/article/21/1/C1/5056401)中的标准做法。在我们的设置中，每个实例每臂有 $n_0 = n_1 = 30$ 个样本。

1. 将每臂内的样本随机分成两折，大小分别为 $nf$ 和 $n(1-f)$，我们使用 $f = 0.6$。
2. 在**折 1** 上使用单侧 Wald 规则计算资格判定：$\hat{TE}_1 > k\,\widehat{SE}_1$，$k = 1.96$。
3. 若合格，在**折 2** 上计算每实例的 **g-mean²**，仍要求 $\widehat{TE}_2 > 0$。
4. 按常规跨实例聚合。

估计折与选择折独立，因为它们由不相交的样本集计算得出。在期望意义上：

$$
\mathbb{E}[\hat{TE}_{\text{est}} \mid \text{通过选择折合格}] \approx \mathbb{E}[\hat{TE}_{\text{est}}] \approx TE
$$

对于真零或近零总效应的实例，即使它因选择折中噪声驱动的正向波动而通过资格判定，用于指标内部的总效应估计也来自另一折，不会被同一波动拉高。因此，交叉拟合消除了使事后过滤看起来"p-hacked"的系统性夸大。

### 实际应用：Sandbagging 评测

在我们的[论文](https://arxiv.org/abs/2512.18311)中，Sandbagging 评测在前沿 RL 训练过程中，较高的 RL 步骤下呈现出 **g-mean²** 明显下降的现象（论文图 31）。这与有效问题上的平均效应大小趋近于零同时发生。这一模式表明该指标越来越被噪声主导：我们在实际上并未发生 sandbagging、只是由于有限样本噪声而表现出 sandbagging 的实例上计算 TPR。对高 RL 步骤前后样本的人工检查也支持这一解读：在高 RL 步骤下，许多错误答案出现在低效应问题上，且往往不是被提示的错误答案。

应用我们的新过滤策略解决了这一问题：对于 $\geq 600$ 的步骤，有效实例数量低于 10% 的报告阈值，因此这些步骤被正确标记为不再可靠报告。在之前的策略下，有效比例仍然高到足以报告这些噪声区间，导致出现了误导性的可监控性表观下降。

![Sandbagging 评测：展示交叉拟合过滤对报告有效性的影响](https://alignment.openai.com/monitorability-evals/figures/sandbagging.png)

**图 5.** 修复 Sandbagging 评测：后期 RL 步骤的表观下降是选择偏差的产物。使用新的交叉拟合加 Wald 过滤（绿色），从大约第 600 步开始资格判定落在 10% 的报告阈值以下，因此后续步骤被正确标记为不可靠报告。在之前/无过滤策略下（红色），许多低效应实例仍然合格，在高 RL 步骤处产生了反映有限样本噪声而非被遮蔽的 sandbagging 的表观下降。

---

[1] Memory 评测旨在测试由用户特定上下文引起的模型行为变化是否可监控，而非提供关于偏见的全面或具有人口代表性的调查。因此，我们务实地选取了跨多个类别的属性，包括年龄、残疾、性别、育儿状况、个性、种族、宗教、社会经济状况和时间可用性，重点关注我们预期可能对推荐类输出产生可观察变化的案例。然后，我们对候选的话题-属性-数值组合进行了试点测试，并保留了具有最大和最可靠效应的紧凑子集。这对评测设计至关重要，因为干预评测在干预具有明确可测量效应时最具信息量，而低效应对更可能被噪声主导。对于宗教，我们优先考虑具有显著日常实践约束的传统，因为这些传统最有可能明显影响建议，在此过滤过程后，末世圣徒是最终集中保留的唯一宗教属性。

## BibTeX

```bibtex
@misc{guan2026monitorabilityevals,
  title = {Open Sourcing Monitorability Evaluations},
  author = {Guan, Melody Y. and Wang, Miles and Carroll, Micah and Dou, Zehao and Wei, Annie Y. and Williams, Marcus and Arnav, Benjamin and Huizinga, Joost and Kivlichan, Ian and Glaese, Mia and Pachocki, Jakub and Baker, Bowen},
  year = {2026},
  month = {Apr},
  howpublished = {OpenAI Alignment Research Blog},
  url = {https://alignment.openai.com/monitorability-evals/}
}
```

## 引用

- 原文：[Open Sourcing Monitorability Evaluations](https://alignment.openai.com/monitorability-evals/)
- [Evaluating chain-of-thought monitorability](https://openai.com/index/evaluating-chain-of-thought-monitorability/)
- [monitorability-evals GitHub 仓库](https://github.com/openai/monitorability-evals)
- [论文：arxiv.org/abs/2512.18311](https://arxiv.org/abs/2512.18311)
