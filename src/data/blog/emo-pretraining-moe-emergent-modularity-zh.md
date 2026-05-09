---
title: EMO：通过预训练混合专家模型实现涌现式模块化
pubDatetime: 2026-05-09T10:00:00+08:00
description: Ai2 发布 EMO——一种新型混合专家（MoE）模型，通过预训练使模块化结构直接从数据中涌现，仅用 12.5% 的专家即可保持接近全模型的性能。
slug: emo-pretraining-moe-emergent-modularity-zh
originalTitle: "EMO: Pretraining mixture of experts for emergent modularity"
originalUrl: "https://huggingface.co/blog/allenai/emo"
tags:
  - AI
  - MoE
  - 模型架构
  - 预训练
---

原文标题：EMO: Pretraining mixture of experts for emergent modularity<br>
原文链接：https://huggingface.co/blog/allenai/emo

---

🧠 **模型：** [https://huggingface.co/collections/allenai/emo](https://huggingface.co/collections/allenai/emo) | 📄 **技术报告：** [https://allenai.org/papers/emo](https://allenai.org/papers/emo) | 💻 **代码：** [https://github.com/allenai/EMO](https://github.com/allenai/EMO) | 📊 **可视化：** [https://emovisualization.netlify.app/](https://emovisualization.netlify.app/)

![EMO blog post draft ryan - Google Docs-image-1 (1)](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/812CTj_1vPuk8Xrgt5hfi.png)

今天我们发布了 [**EMO**](https://huggingface.co/collections/allenai/emo)——一种新型混合专家（MoE）模型，通过端到端预训练，使模块化结构直接从数据中涌现，无需依赖人工定义的先验知识。EMO 允许你仅使用一小部分专家（仅占总量的 12.5%）来处理特定任务，同时保持接近全模型的性能；当所有专家一起使用时，EMO 仍然是一个强大的通用模型。

大型语言模型通常作为单体系统进行训练和部署：单个模型被初始化、预训练、微调并作为一个统一整体提供服务。但应用往往只需要其中一部分能力，例如代码生成、数学推理或特定领域的知识。随着前沿语言模型规模常规达到数万亿参数，对大多数用户而言，使用和适应完整模型变得不切实际，并且会为那些可能根本用不到的参数带来不必要的计算成本和内存开销。

混合专家（MoE）模型似乎是一种放宽这一约束的自然方式。MoE 在每一层不使用一个大型前馈网络，而是包含许多更小的网络（称为专家），并且对每个输入 token 只激活其中一小部分。原则上，一个只需要某种能力的任务应该只需加载相关的专家。

然而在实践中，现有的 MoE 仍然需要完整模型才能良好运作。即使在单个输入中，不同的 token 往往激活不同的专家，因此一个任务最终可能在生成过程中使用到所有专家。正如我们在论文中所展示的，这部分是因为标准 MoE 中的专家往往专注于低级词汇模式（如介词或标点符号），而非更高级的领域或能力。因此，专家的小型子集无法被单独可靠地使用。

我们希望 MoE 模型的专家能够组织成连贯的组，可以被选择性地使用和组合。

一种在预训练期间鼓励这一点的方式是基于预定义的语义领域（如数学、生物学或代码）将 token 路由给专家。BTX 和我们的 FlexOlmo 项目等先前工作已经尝试过这种方法。然而，预定义领域有重要的局限性：它们需要对预训练语料库中的数据进行领域标注，这可能既模糊又昂贵；它们还可能向模型的组织方式注入过多的人为偏见。更重要的是，预先固定领域也固定了模型的模块化结构：如果在推理时出现了新的领域或能力，就不清楚应该使用哪些专家。

这就是 EMO 的用武之地。

我们证明了 EMO——一个在 1 万亿 token 上训练的、1B 活跃参数、14B 总参数（8 个活跃专家，128 个总专家）的 MoE——支持选择性专家使用：对于给定的任务或领域，我们可以仅使用一小部分专家（仅占总专家数的 12.5%），同时保持接近全模型的性能。与此同时，当所有专家一起使用时，EMO 仍然是一个强大的通用模型。相比之下，在相同数据上训练的相同架构的标准 MoE，在选择性使用其专家子集时会出现严重的性能下降。

![EMO blog post draft ryan - Google Docs-image-2 (1)](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/CPWUSB64LhBEjMI0Rgg6L.png)

*EMO 是一个将模块化作为第一要务进行训练的 MoE 模型。对于给定的领域（如数学、代码、生物医学），用户可以选择任意大小的专家子集并保持接近全模型的性能。这将单个模型转变为一个可组合的架构，为大型稀疏 MoE 提供了灵活的部署方式，并改善了内存-精度权衡。*

## 如何让模块化涌现？

在 MoE 中，一个称为路由器的小型网络决定每个 token 激活哪些专家。我们希望路由器学会，来自相似领域的 token 应该激活相似的专家子集。我们的核心观察是：*同一文档中的 token 通常来自同一领域*。因此，我们使用文档边界作为弱监督信号：在训练期间，一个文档中的所有 token 被限制从共享的专家池中选择其活跃专家。

![EMO blog post draft ryan - Google Docs-image-3 (1)](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/slqCFgfncHGGK1lErZNvl.png)

*标准 MoE 与 EMO 训练对比（k=2，n=10，共享专家为简化起见省略）。（左）在标准 MoE 中，每个 token 独立选择其 top-k 专家。跨 token 而言，所有专家都会被使用。（右）在 EMO 中，路由器首先为每个文档选择一个专家子集，然后所有 token 被约束在这个子集内路由。这强制文档中专家使用保持一致，鼓励专家组形成领域专业化。*

例如，在一个有 10 个总专家、每个 token 有 2 个活跃专家的 MoE 中，一个文档中的所有 token 都被限制在同一个由 4 个专家组成的池子内路由，如上图所示。这个池子由路由器自身选择：我们对文档中所有 token 的路由器专家偏好取平均，然后选择使用最多的专家作为文档的共享池。不同文档可以使用不同的池子，允许反复出现的专家组直接从训练数据中涌现。

在实现该系统时有一些注意事项：

**负载均衡。** 一个技术挑战是负载均衡。在标准 MoE 训练中，负载均衡目标用于防止模型坍塌到只有少数几个专家上。乍一看，这似乎与 EMO 的训练目标相冲突：我们明确地将每个文档限制为只使用专家子集。

这种冲突来自负载均衡通常应用的规模。在许多 MoE 实现中，负载均衡是在局部计算的，通常在仅包含少量文档的微批次中进行。这个局部目标可能会迫使同一文档内的 token 分散到许多专家上，直接与 EMO 的目标相悖——即保持文档内专家使用的一致性。

为了解决这个问题，我们在许多文档中全局地应用负载均衡。在这个更大的规模上，两个目标变得互补：EMO 鼓励同一文档中的 token 使用连贯的专家池，而全局负载均衡鼓励不同文档共同覆盖所有专家。在实践中，我们发现全局负载均衡对稳定训练非常重要。

**文档池大小。** 文档池大小控制了模块化约束的严格程度。较小的池子迫使同一文档中的 token 共享更紧密的专家集合，鼓励更强的模块化；较大的池子给模型更多灵活性，但会削弱约束。

我们在训练期间随机采样池子大小，而不是固定一个大小。这防止了 EMO 对单一子集大小的过拟合，并允许其在推理时支持不同的专家子集大小。

## 基准测试结果

在通用基准上，EMO 的性能与标准 MoE 模型相当，这表明模块化目标不会以牺牲全模型性能为代价。然而更重要的问题是，当我们只保留专家子集时模型是否仍然有效。在这种情况下，我们通过根据专家在少量任务验证数据上的路由使用情况对专家进行排名来构建特定任务的专家子集，保留使用最多的专家并丢弃其余的。

下图显示了 EMO 在选择性专家使用下仍然保持稳健。当我们只保留 25% 的专家（32 个专家子集）时，EMO 在所有基准上的绝对性能仅损失约 1%；即使我们只保留 12.5% 的专家（16 个专家子集），总体下降也只有约 3%。这在微调前后都成立。相比之下，对应的标准 MoE 在专家子集变小时会急剧下降，在最小专家子集设置中通常接近甚至低于随机性能。

![EMO blog post draft ryan - Google Docs-image-4](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/ki3pHaOktjGM1qI4JBeYG.png)

此外，我们证明了为任务选择正确的专家出奇地便宜：只需一个包含少样本演示的示例就足以识别出与使用完整验证集选择的专家子集性能相当的模块。而且 EMO 不受限于任何特定的选择方法：它与 Easy-EP 等现有专家剪枝方法配合良好，两者相互补充。

![EMO blog post draft ryan - Google Docs-image-5 (1)](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/NMSuavox_S24mxIBovCMd.png)

*较小的 1300 亿 token 设置。在不同内存预算下 16 个 MMLU 类别的平均性能。EMO 专家子集推动了内存-精度权衡的帕累托前沿，优于标准 MoE，甚至优于从头训练的固定预算模型。*

## 专家子集在专注于什么？

为了了解 EMO 在训练后实际学到了什么，我们对 12K 个预训练文档的前 100 个 token 的路由器激活情况进行了聚类。与标准 MoE 的差异是显著的。

EMO 的 token 聚类对应于诸如*健康、医疗与健康*、*新闻报道*、*美国政治与选举*和*电影与音乐*等事物。标准 MoE 产生的聚类则是*介词*、*专有名词*、*系动词*或*冠词*等。在 EMO 中，来自给定文档的 token 大多落入同一聚类；在标准 MoE 中，它们最终分散在许多聚类中。

这种对比在单个示例中最容易看出。以一篇健康文章为例：在 EMO 中，几乎每个 token 都会路由到*健康、医疗与健康*聚类。在标准 MoE 中，顶级聚类是*所有格与冠词*；模型会将该文章与每一个碰巧使用了 *the* 或 *your* 这类词的文本归为一类，无论那段文本是关于什么的。

![EMO blog post draft ryan - Google Docs-image-6 (1)](https://cdn-uploads.huggingface.co/production/uploads/638e39b249de7ae552d977b5/FG27xp8oJXUZW9cTju235.png)

*在 1T token 上训练的 MoE 模型的预训练数据 token 聚类。EMO 的聚类对应语义上有意义的领域，同一文档的 token 大多聚集在一起。标准 MoE 训练产生表面级或句法特征的聚类，文档 token 分散在多个聚类中。*

由于 EMO 形成的模块映射到语义领域而非表面特征，你可以选择一个小型专家子集，仍然拥有一个功能正常的模型：该组对应的是真实的能力。

你可以在[我们的交互式可视化](https://emovisualization.netlify.app/)中亲自探索聚类结果。

## 我们发布了什么

我们发布了[完整的 EMO 训练模型](https://huggingface.co/collections/allenai/emo)、一个在相同数据上训练的对应标准 MoE 基线，以及[训练代码](https://github.com/allenai/EMO)。我们希望这些成果对其他研究 MoE 中涌现式模块化的团队有所帮助。

还有很多工作要做。EMO 是迈向使大型稀疏模型更加模块化的早期一步，但许多问题仍然存在：如何更好地选择和组合专家子集，如何在不破坏完整模型的情况下更新模块，以及如何将模块化结构用于更好的可解释性和可控性。发布这些模型应该有助于社区研究这些问题，并朝着更易于部署、适应、检查和组合的模块化语言模型迈进。

---

## 引用

- 原文：[EMO: Pretraining mixture of experts for emergent modularity](https://huggingface.co/blog/allenai/emo)
- 模型集合：[https://huggingface.co/collections/allenai/emo](https://huggingface.co/collections/allenai/emo)
- 技术报告：[https://allenai.org/papers/emo](https://allenai.org/papers/emo)
- 代码：[https://github.com/allenai/EMO](https://github.com/allenai/EMO)
- 可视化工具：[https://emovisualization.netlify.app/](https://emovisualization.netlify.app/)
