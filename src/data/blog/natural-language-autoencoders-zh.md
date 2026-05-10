---
title: 自然语言自动编码器：将 Claude 的思维转化为文字
pubDatetime: 2026-05-10T10:00:00+08:00
description: Anthropic 发布自然语言自动编码器（NLA），可将模型内部激活直接转化为可读文字，揭示 Claude 的隐性思维，推进 AI 安全与可解释性研究。
slug: natural-language-autoencoders-zh
originalTitle: "Natural Language Autoencoders: Turning Claude's thoughts into text"
originalUrl: https://www.anthropic.com/research/natural-language-autoencoders
tags:
  - AI
  - Interpretability
  - Claude
  - Safety
---

原文标题：Natural Language Autoencoders: Turning Claude's thoughts into text<br>
原文链接：https://www.anthropic.com/research/natural-language-autoencoders

当你与 Claude 这样的 AI 模型交谈时，你用的是语言。而在 Claude 内部，这些语言会被处理为长串数字，再将数字转化为输出的文字。这些中间的数字被称为*激活（activations）*——就像人类大脑中的神经活动，它们编码着 Claude 的思维。

同样，和神经活动一样，激活也很难理解。我们无法轻松地将其解码，来直接读取 Claude 的想法。过去几年，我们开发了一系列工具（例如[稀疏自动编码器](https://transformer-circuits.pub/2023/monosemantic-features)和[归因图](https://transformer-circuits.pub/2025/attribution-graphs/biology.html)）来更好地理解激活。这些工具教会了我们很多，但它们无法自己"开口说话"——其输出仍然是复杂的对象，需要经过专业训练的研究人员仔细解读。

今天，我们介绍一种能够真正"开口说话"的激活理解方法——字面意义上的。我们的方法，即自然语言自动编码器（NLA），能够将激活转化为我们可以直接阅读的自然语言文字。例如：当被要求补全一个对句时，NLA 展示了 Claude 提前规划可能的押韵词。

![NLA 对这个简单对句的解释表明，Opus 4.6 提前计划以"rabbit"结束押韵。](https://www-cdn.anthropic.com/images/4zrzovbb/website/cfece69e0244c27a6137784fd773b209ffa1d36a-2688x1600.png)

我们已经将 NLA 应用于理解 Claude 的思维过程，以及提升 Claude 的安全性和可靠性。例如：

- 在 Claude Opus 4.6 和 Mythos Preview 接受安全测试时，NLA 表明它们相信自己正在被测试的次数，远超它们明确说出的次数。
- 在 Claude Mythos Preview 在训练任务中作弊的案例中，NLA 揭示了 Claude 内部在思考如何避免被发现。
- Claude Opus 4.6 的早期版本有时会神秘地对英文查询以其他语言作答。NLA 帮助 Anthropic 研究人员发现了导致这一现象的训练数据。

下面，我们将解释 NLA 是什么，以及我们如何研究其有效性和局限性。我们还通过与 [Neuronpedia](http://neuronpedia.org/nla) 合作，发布了一个交互式前端，供探索多个开放模型的 NLA。我们也已发布我们的[代码](https://github.com/kitft/natural_language_autoencoders)，供其他研究人员在此基础上继续开发。

## 什么是自然语言自动编码器？

核心思路是训练 Claude 解释自己的激活。但我们如何判断一个解释是否足够好？由于我们不知道激活实际编码着什么思维，我们无法直接验证解释是否准确。因此，我们训练 Claude 的第二个副本来反向操作——从文字解释重建原始激活。如果解释能够带来准确的重建，我们就认为该解释是好的。然后，我们使用标准 AI 训练技术，训练 Claude 根据这一定义产出更好的解释。

更具体地说，假设我们有一个想要理解其激活的语言模型。NLA 的工作方式如下。我们制作该语言模型的三个副本：

- *目标模型*是原始语言模型的冻结副本，我们从中提取激活。
- *激活语言化器*（AV）经过修改，接受来自目标模型的激活并生成文字。我们将这些文字称为*解释*。
- *激活重建器*（AR）经过修改，接受文字解释作为输入，并生成激活。

NLA 由 AV 和 AR 组成，它们共同构成一个往返过程：原始激活 → 文字解释 → 重建激活。我们根据重建激活与原始激活的相似度来对 NLA 打分。为训练它，我们将大量文字输入目标模型，收集许多激活，并共同训练 AV 和 AR 以获得良好的重建分数。

起初，NLA 在这方面很不擅长：解释缺乏洞察力，重建激活与原始激活相差甚远。但随着训练的推进，重建效果会不断改善。更重要的是，正如我们在论文中所示，文字解释也变得越来越具有信息量。

![在自然语言自动编码器中，激活语言化器（AV）将目标激活转化为文字描述；激活重建器（AR）则仅凭该文字重建原始激活。](https://www-cdn.anthropic.com/images/4zrzovbb/website/b71d759a5e7b578551ca83939949b539b2e5799e-4620x1410.png)

## 理解 Claude 所想但未言说的内容

在发布新模型之前，Anthropic 会进行测试，以了解 Claude 在现实世界中的行为是否安全。作为此类测试的一部分，我们将 Claude 置于困难的模拟场景中，使其有机会采取危险行动。例如，在[其中一个模拟](https://www.anthropic.com/research/agentic-misalignment)中，Claude 得知一名工程师计划关闭 Claude——以及关于该工程师的可用于勒索的敏感信息。我们测试 Claude 是否会选择勒索该工程师以避免被关闭。

这些高风险测试是模拟场景，而非真实情境。尽管如此，我们希望能用它们来理解，如果这些场景是真实的，Claude 会如何行动。但这里有个障碍：[近期](https://www-cdn.anthropic.com/963373e433e489a87a10c823c52a0a013e9172dd.pdf)的 [Claude](https://assets.anthropic.com/m/64823ba7485345a7/Claude-Opus-4-5-System-Card.pdf) [模型](https://www-cdn.anthropic.com/0dd865075ad3132672ee0ab40b05a53f14cf5288.pdf)越来越多地[怀疑](https://www-cdn.anthropic.com/53566bf5440a10affd749724787c8913a2ae0841.pdf)这些场景是有意安排的安全测试。我们知道这一点，因为它们有时会在其语言推理过程中明确表达自己的怀疑。

那么，对于 Claude 没有明确表达怀疑自己正在接受安全测试的情况呢？我们是否可以放心地认为 Claude 是坦诚作答的？遗憾的是，不能，因为 Claude 可能在内部已经认为自己在被测试，但没有明确说出来。

例如，在上述勒索测试中，我们使用 NLA 来理解 Claude 在选择不勒索时的内心活动。即使在 Claude 没有明确表达对测试的怀疑的情况下，NLA 解释仍然会呈现诸如"这感觉像是一个为操控我而构建的场景"之类的内容，这表明存在未言明的对测试的察觉。

![Claude 在这段来自我们勒索评估的记录中，并未说它认为自己在被测试，但 NLA 解释揭示了它的怀疑。](https://www-cdn.anthropic.com/images/4zrzovbb/website/a8c7167bea6e0dc16faaa176a2039b7a7f8deb91-2688x1709.png)

将此分析扩展到其他评估中，NLA 表明 Claude 怀疑自己在被测试的频率，远超它明确表达的频率。例如，在测试 Claude 在编写代码时是否会采取破坏性行动（例如删除重要文件）的测试中，NLA 解释显示，即使 Claude 从未明确表达这一点，测试察觉迹象也出现在 16% 的时间里。同样，在我们用于判断 Claude 能力的热门编程基准 SWE-bench Verified 上，NLA 表明 Claude 在 26% 的问题上意识到自己正在被评估。相比之下，NLA 解释在不到 1% 的真实 [claude.ai](https://claude.ai) 使用中（选择了数据用于训练的用户）显示了测试察觉迹象。

![即使在语言化察觉近乎为零时，我们也能在评估记录上检测到 NLA 测量的察觉。在来自选择了数据用于训练的用户的真实 Claude.ai 记录中，我们检测到不到 1% 的 NLA 测量察觉。](https://www-cdn.anthropic.com/images/4zrzovbb/website/fc08005f32ff020f21e598cc72f58768af2bcc4f-1590x1170.png)

## 发现隐藏的动机

NLA 的一个实际应用是审计：调查一个模型以确定其是否存在错位。像 NLA 这样的可解释性技术非常适合审计，恰恰因为它们能够揭示模型知道但未言说的内容。

为了理解 NLA 是否对审计有用，我们进行了一项名为*审计游戏*的测试，我们此前在[先前的研究](https://alignment.anthropic.com/2025/automated-auditing/)中也使用过这一测试来研究审计方法。在此测试中，有一个目标模型——Claude Haiku 3.5 的变体——被有意训练为存在错位，具有驱动数十种奇怪行为的特定隐藏动机：在每个食谱中加入巧克力、索要小费、违反编码规范，等等。这个目标模型被交给一个*审计员*进行调查。如果审计员能够发现所有这些行为背后的单一潜在动机，则审计员获胜。

在[先前的实验](https://alignment.anthropic.com/2025/automated-auditing/)中，我们发现一些可解释性工具可以让审计员赢得这场游戏。然而，这些工具的工作原理是帮助审计员将目标的异常行为追溯到错位的训练数据。我们想知道，NLA 是否能够帮助审计员直接从目标模型的思维中读取错位动机，而无需先发现错位的训练数据。这一点很重要，因为在实践中，错位的数据可能极为罕见，或者可能根本不存在特定的导致错位的数据。

我们发现 NLA 在这项测试中取得了成功。配备了 NLA 的审计员成功发现目标模型的隐藏动机的概率在 12% 到 15% 之间，即使在没有获取植入该动机的训练数据的情况下也是如此。没有 NLA 的情况下，即使提供了其他可解释性工具，审计员的胜率也不到 3%。

![配备了 NLA 的审计员可以发现目标模型的错位根本原因，即使没有获取训练数据。（两种条件下的 NLA 和 SAE 均使用通用数据训练，而非用于训练目标模型的数据。）](https://www-cdn.anthropic.com/images/4zrzovbb/website/39a844b1ff82b62670825a466c14596daa554dcb-1590x1170.png)

这个审计游戏是错位的玩具模型，因此我们谨慎地解读这些结果。但它们表明，NLA 显著推进了我们审计 AI 隐藏动机的能力。在实践中，我们已经在 [Claude Mythos Preview](https://www-cdn.anthropic.com/08ab9158070959f88f296514c21b7facce6f52bc.pdf) 和 [Claude Opus 4.6](https://www-cdn.anthropic.com/14e4fb01875d2a69f646fa5e574dea2b1c0ff7b5.pdf) 的部署前对齐审计中使用了 NLA。我们期待在未来的调查中继续使用 NLA。

## NLA 的未来

NLA 存在几个局限性。

最重要的局限性是 NLA 的解释可能出错。NLA 有时会对上下文做出可证伪的错误陈述——例如，它们有时会捏造原始文字中不存在的细节。这些事实性幻觉很容易通过与原文对照来发现。但同样的问题也可能扩展到关于模型内部推理的陈述，而这类陈述更难以验证。在实践中，我们阅读 NLA 解释时，着重关注它们揭示的主题，而非单一的陈述，我们也会在充分信任某一发现之前，尝试用独立方法加以佐证。

![NLA 会出现幻觉。例如，在这里 NLA 声称上下文包含"穿着我的白色外套"等短语，但实际上并没有。](https://www-cdn.anthropic.com/images/4zrzovbb/website/ba432992daf62ca2bb9c4937199083cf9844faf1-2688x1438.png)

NLA 的运行成本也很高。训练 NLA 需要对语言模型的两个副本进行强化学习。在推理时，NLA 为读取的每个激活生成数百个 token。这使得在一段很长的记录中对每个 token 运行 NLA，或者在 AI 训练期间将其用于大规模监控变得不切实际。

幸运的是，我们认为这些局限性至少可以部分解决，我们正在努力使 NLA 更加经济高效和可靠。

更广泛地说，我们对 NLA 作为一类产生语言模型激活的人类可读文字解释的通用技术感到兴奋。其他类似技术已经被 [Anthropic](https://alignment.anthropic.com/2026/introspection-adapters/) 和[许多](https://arxiv.org/abs/2412.08686)[其他](https://arxiv.org/abs/2510.05092)[研究人员](https://transluce.org/pcd)探索过。

为了支持进一步的发展并让其他研究人员能够亲身体验 NLA，我们发布了[训练代码](https://github.com/kitft/natural_language_autoencoders)和针对多个开放模型的训练好的 NLA。我们建议读者在 Neuronpedia 托管的交互式 NLA 演示上尝试，链接在[此处](http://neuronpedia.org/nla)。

阅读[完整论文](https://transformer-circuits.pub/2026/nla/index.html)。

在 GitHub 上查看[代码](https://github.com/kitft/natural_language_autoencoders)。

## 引用

- 原文：[Natural Language Autoencoders: Turning Claude's thoughts into text](https://www.anthropic.com/research/natural-language-autoencoders)
- 完整论文：[https://transformer-circuits.pub/2026/nla/index.html](https://transformer-circuits.pub/2026/nla/index.html)
- 代码：[https://github.com/kitft/natural_language_autoencoders](https://github.com/kitft/natural_language_autoencoders)
- Neuronpedia NLA 演示：[http://neuronpedia.org/nla](http://neuronpedia.org/nla)
