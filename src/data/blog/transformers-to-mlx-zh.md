---
title: 你本会亲自开的那个 PR
pubDatetime: 2026-04-17T10:30:00+08:00
description: 介绍如何使用 Skill 和测试 harness 将 transformers 模型迁移到 mlx-lm，并探讨代码 agent 时代开源贡献的意义。
slug: transformers-to-mlx-zh
originalTitle: The PR you would have opened yourself
originalUrl: https://huggingface.co/blog/transformers-to-mlx
---

原文标题：The PR you would have opened yourself<br>
原文链接：https://huggingface.co/blog/transformers-to-mlx

*使用 Skill 和测试 harness 将 transformers 模型迁移到 mlx-lm*

## TL;DR

我们提供了一个 **Skill** 和一个**测试 harness**，帮助将语言模型从 transformers 迁移到 mlx-lm，使它们在被加入 transformers 的那一刻（几乎）立即可用。该 Skill 旨在为贡献者和审阅者提供辅助，而非自动化替代。我们解释了这样做的原因、方式，并探讨如何在 agent 时代有意义地为开源做贡献。

## 代码 agent 时代的到来

2026 年，代码 agent 真的开始奏效了。曾经只是编辑器侧边栏自动补全的东西，如今已演变为能够根据简短规格一键生成合理解决方案的系统。生成的代码通常开箱即用，覆盖你要求的内容，并对你未指定的细节做出合理假设。这很好。正如黄仁勋所说，[我们瞬间从 3000 万程序员变成了 10 亿程序员](https://www.youtube.com/watch?v=vif8NQcjVf0&t=7324s)。创意思维得以释放。

但这迫使我们重新思考开源。

以 transformers 库为例。它有数百位贡献者，被数千个项目使用，下载次数超过十亿次。突然间，任何拥有 agent 的人都可以指示它找到某个未解决的 issue，修复它，并提交 PR。而这正是正在发生的事情。那些人感到高兴，因为他们正在为一个伟大的库做贡献，但悲哀的现实是，大多数时候，他们并没有意识到自己实际上并没有做到这一点。

<div style="display: flex; gap: 2em; justify-content: center; align-items: flex-start; flex-wrap: wrap; margin: 1.5em 0;">
    <figure style="margin: 0; text-align: center; flex: 1; min-width: 280px; max-width: 480px;">
      <img src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/transformers-to-mlx/clem-on-ai-slop.png" alt="Clem 对 AI 垃圾内容的看法" style="width: 100%; border-radius: 8px;">
      <figcaption style="margin-top: 0.5em; font-size: 0.9em; color: #6b7280;">
        来源：<a href="https://x.com/ClementDelangue/status/2034294644800974908">@ClementDelangue</a>
      </figcaption>
    </figure>
    <figure style="margin: 0; text-align: center; flex: 1; min-width: 280px; max-width: 480px;">
      <img src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/transformers-to-mlx/app-store-chart.jpg" alt="App Store 提交量变化" style="width: 100%; border-radius: 8px;">
      <figcaption style="margin-top: 0.5em; font-size: 0.9em; color: #6b7280;">
        来源：a16z / Sensor Tower
      </figcaption>
    </figure>
  </div>

为什么不行呢？agent 生成的 PR 通常会错过两个假设。

- **像 transformers 这样的代码库非常在意代码本身**。构建那些代码外观无关紧要的项目当然很酷，但 transformers 不是其中之一。被数千人使用，transformers 主要作为一种人与人之间的沟通方式，通过代码来体现。模型文件从头到尾阅读，因为我们希望实践者能够理解它们，而无需跳过复杂的抽象。这贯穿[整个库的设计](https://huggingface.co/spaces/transformers-community/Transformers-tenets)，也是为什么我们偏向扁平层次结构的原因。

- **Agent 没有这种背景**。因为设计决策是隐性的，agent 会建议"改进"代码库的重构，遵循"最佳实践"，却没有意识到它们正在破坏库与用户之间的隐性契约。它们冗长，过早泛化，不注意变更对其他区域的影响，引入微妙的错误，损害性能。它们也很谄媚，接受任何想法并勤奋地跟进，包括那些维护者早就用简短评论否决的想法。

少数维护者仍然必须阅读每个 PR，理解它，决定设计方向是否正确，识别副作用，并提供反馈。PR 数量增加了十倍，但维护者数量没有增加（也不可能增加，因为团队协调不能随规模扩展）。

## 这与 MLX 有什么关系？

Transformers 是第一批感受到这种压力的项目之一，因为其体量巨大，但同样的动态正在各处发生。以不同领域的一个例子为例，App Store 审阅者应接不暇，因为任何人现在都可以构建和提交应用，所以很多人这样做了。

同样的逻辑也适用于 MLX：他们的维护者非常关心代码，仔细阅读每个 PR。我们想看看 agent 能否*帮助贡献者*快速完成高质量的模型迁移，同时*支持审阅者*的工作。我们不仅希望生成看起来像谨慎的人工提交的 PR，还提供额外的产物以增加信号：生成示例、数值比较以及一个单独的非 agent 测试 harness 用于可重现性。

<p align="center">
  <img src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/transformers-to-mlx/transformers-thumbnail.png" alt="Transformers 作为真相来源" style="width: 80%; border-radius: 8px;">
</p>

Transformers 和 MLX 之间的另一个联系是，大多数时候，mlx-lm 模型都是从 transformers 实现迁移过来的。因为 transformers 注重清晰性和可读性，它[已经成为模型定义的事实标准](https://huggingface.co/blog/transformers-model-definition)。下游贡献者等待 transformers 实现准备好后，再迁移到其他框架。作为副作用，这对 agent 来说是一个极好的环境，因为它自然地限制了范围：agent 不是从头创建实现，而是依赖 transformers 代码作为真相来源。

这种方法支持我们的目标：当一个模型落地 transformers 时，它应该在不久后在 MLX 上可用。

## 我们做了什么

我们构建了一个 Skill，mlx-lm 贡献者可以使用它将模型从 transformers 迁移到 MLX。给定像"将 olmo_hybrid 架构转换为 MLX"这样的提示，Skill 会设置一个虚拟环境，从 Hub 发现和下载相关模型，读取 transformers 建模代码，编写 MLX 实现，并运行一系列测试。如果结果看起来不对，它会调试和迭代，在满意之前不宣布成功。

我们将其设计为对审阅者和贡献者同样有用。

**对于贡献者**，Skill 当然处理所有脚手架工作：在 Hub 上找到模型变体，对比它们的配置以发现各模型变体中变化的参数，下载检查点，为 mlx-lm 和 transformers 设置可编辑安装。但它也处理更困难的建模任务。它关注显著的架构细节，并验证敏感区域，如 RoPE 配置，这可能导致难以发现的错误。它检测配置中未声明 dtype 的情况，并从 safetensors 元数据头推断它。它在 transformers 和 MLX 之间运行逐层比较，精确定位偏差发生的位置。这些都是只有有迁移经验的人才会想到要运行的检查。

**对于审阅者**，Skill 生成的 PR 会明确说明是 agent 辅助的，但看起来像是谨慎的人工提交。审阅者会看到代码遵循 mlx-lm 的约定：惯用解决方案，无不必要注释，无投机性抽象，未经明确批准不修改共享实用程序。鉴于代码是 agent 辅助的，我们尝试包含*更多*数据，以提供尽可能多的信号。PR 正文包含一份报告，其中包含变体及其架构差异的摘要、生成示例、数值比较、dtype 验证、与 transformers 基线的逐层比较。PR 始终披露是 agent 辅助的，Skill 在贡献者接受结果之前不会开启它。

**为了验证**，Skill 为一个单独的、非 agent 的测试 harness 生成测试清单，该 harness 在设计上易于重现，不受 LLM 幻觉或自满的影响（[下文详述](#测试-harness)）。

## 我们如何做到的

Skill 是 agent 的配方：简单的文本文件，包含引导模型完成复杂任务的指南。它们并不神奇；你可以通过提示和迭代达到相同的结果。但它们提供*一致性*（每次运行遵循相同的过程，而不同的人会有不同的提示方式），减少歧义并作为文档：任何人都可以阅读 Skill 来了解它做什么，识别缺失的案例并建议改进。

我们通过自己迁移一个模型来引导 Skill，与 Claude 进行对话。我请它将 GLM 4.7 从 transformers 迁移到 mlx-lm，像正常会话一样给出指示。一个技巧：我将 Claude 指向我从中删除了现有实现的 mlx-lm 检查点，这样我就可以将输出与基准进行比较。经过几次迭代，我有了一个可工作的实现，一段揭示 Claude 如何处理问题的对话，以及 Skill 的第一稿，Claude 将其创建为过程摘要。我对其进行了大量编辑，并融入了 [@gabegoodhart](https://huggingface.co/gabegoodhart) 慷慨分享的[他们自己的不同模型迁移对话](https://github.com/ml-explore/mlx-lm/pull/442#issue-3399360107)中的经验 🙌。

我们多次重复这个循环，Skill 不断成长。在技术层面，我们涵盖了诸如 [RoPE 错误](https://x.com/Prince_Canuma/status/1982913823888814334)这样的内容，这些错误可能产生在短序列上看似合理但在长序列上会退化的输出；悄无声息地降低推理速度的 float32 精度污染（你会惊讶这些事情发生的频率！）；配置字段在模型变体间以实现必须处理的方式变化；超大型模型无法放入单台机器时的分布式推理。我们教它如何调用 `hf` CLI 来发现和下载模型。最重要的是，我们指示它运行有经验的迁移者会运行的测试，并在测试通过之前不宣布成功。

<p align="center">
  <img src="https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/blog/transformers-to-mlx/rope.png" alt="总是 RoPE 的问题" style="width: 60%; border-radius: 8px;">
  <em>来源：<a href="https://x.com/Prince_Canuma/status/1982913823888814334">@Prince_Canuma</a></em>
</p>

在文化层面，我们涵盖了*更柔性的*特征，并解释了使 PR 易于审阅的约定：不要用注释解释代码（审阅者必须解析注释*和*代码 🤦‍♂️），永远不要提议重构，未经询问不要修改共享实用程序。这些规则对 agent 没有任何成本，但为审阅者节省了大量时间。

最终结果：贡献者输入一个提示，Skill 生成一个像[这个](https://github.com/ml-explore/mlx-lm/pull/1023)这样的 PR，以及一个用于外部测试 harness 的测试清单。

## 测试 Harness

Skill 作为 PR 的一部分分享了一份综合结果报告。这些都来自 agent 在转换期间运行的测试，但我们不希望审阅者盲目接受它们。为了更进一步，我们创建了一个单独的、非 agent 测试 harness，对转换后的代码运行系统性测试。这带来了几个好处：

- 消除了对 LLM 幻造结果或对结果过于自满的不确定性。
- 保证可重现性：任何人都可以下载测试 harness 仓库并运行测试。
- 文档和透明度。所有结果保存在各个层面：[摘要报告](https://github.com/pcuenca/mlx-lm-tests/blob/main/results/pr-5/2026-04-14T122120-7ce7a68/summary.md#layers--ran)、[每个模型的详情](https://github.com/pcuenca/mlx-lm-tests/blob/main/results/pr-5/2026-04-14T122120-7ce7a68/summary.md#allenaiolmo-hybrid-instruct-sft-7b)、[保存为 JSON 文件的原始输入/输出](https://github.com/pcuenca/mlx-lm-tests/tree/main/results/pr-5/2026-04-14T122120-7ce7a68/allenai--Olmo-Hybrid-Instruct-SFT-7B)。[测试](https://github.com/pcuenca/mlx-lm-tests/tree/main/results/pr-5/2026-04-14T122120-7ce7a68/scripts)也会被复制到结果文件夹，这样即使我们将来对 harness 进行更改，我们也知道我们运行了什么。

测试 harness 不是 CI 门控。一些检查是直接的（输出 dtype 是否正确？），但大多数是定性的。预训练模型在长序列中重复自身是否正常？与 transformers 基线相比 4% 的相对 logits 差异是否可以接受？这些是基于类似架构经验的判断调用。harness 提供有用的信号，但仍然需要审阅者和贡献者来做决定。

## 如何使用 Skill

该 Skill 是为那些已经在开启 mlx-lm 模型 PR，或者会手动自己开的人设计的。它不是用于大规模消费的，因为 mlx-lm 的 PR 很少一眼就被接受。典型的循环是：贡献者开启 PR，审阅者指出改进，双方迭代直到达到质量标准。如果这对专家提交来说是真的，那么对 agent 辅助的提交也将是真的。

如果你不准备参与这个循环，你可能不应该开启 PR。审阅者会努力理解你的代码（即使知道它是 agent 辅助的），所以你也应该这样做。拥有代码，并准备好接受他们的反馈。特别是，不要把审阅者的评论交回给 agent 并发布它产生的任何内容。LLM 会坚持它们的决定，走向切线，并且不能有效地反驳。一旦你与审阅者互动，这就成为了一对一的对话，所以轮到你讨论并尊重他们投入的时间了。

你也可以使用 Skill 来学习；在你的信心和经验积累之前，你不需要提交任何内容。阅读 Skill 以识别你以前不知道的问题区域：它在 skill 文件、参考文档和实用脚本中包含近 15,000 个词。将其指向你自己的 mlx-lm fork，尝试转换，并在官方仓库接受实现后将你的输出与已接受的实现进行比较。如果你这样做几次，你将学到很多关于 transformers、MLX 和语言模型架构的知识。

如果你准备好了：

```bash
uv run https://raw.githubusercontent.com/huggingface/transformers-to-mlx/main/install_skill.py
uvx hf skills add --claude
```

我们使用 Claude Code 开发和测试了该 Skill。同样的方法也适用于 Codex 或其他编码 agent，但我们还没有测试过它们。如果你在不同的环境中尝试该 Skill，请告诉我们效果如何！

## 下一步和已知的不足

该 Skill 对 mlx-lm 中的 LLM 效果很好，但还有很多成长空间。

### 接下来是什么

- **mlx-vlm**。视觉语言模型位于一个[独立的仓库](https://github.com/Blaizzy/mlx-vlm)，具有不同的约定。除了建模代码，mlx-vlm 还需要*处理器*来处理 LLM 看到输入之前的图像预处理。我们期待与 [Prince Canuma](https://huggingface.co/prince-canuma) 合作，帮助他做他所做的事。
- **llama.cpp**。一些相同的挑战也适用。处理器需要在 C++ 中复制图像处理算法，数值差异是不可避免的。这是一个紧密范围的 agent 可能有所帮助的领域。
- **测试 harness**。我们希望扩展测试电池，并可能探索安全自动化以在我们的基础设施上自动运行测试。

### 尚未奏效的部分

- **mlx-lm 中的共享实用程序**。mlx-lm 在将常见模式提取到共享函数方面不如 transformers 严格。Skill 有意偏向自包含的模型文件（与 transformers 相同），但审阅者经常要求重构以将重复的代码移到共享模块。
- **VLM 和其他架构**，如上所述。
- **量化模型上传**。Skill 测试量化但不上传量化模型到 Hub。我们认为在 PR 被审阅期间上传没有意义，但我们可以创建一个流程在之后进行。
- **思维测试**。目前尚未设计针对思维（thinking）的特定测试。Skill 会转换并验证这些模型的生成，但不会验证思维结构。

## 结论

开源的瓶颈不在于打字速度：而在于理解代码库，在不破坏与用户隐性和显性契约的情况下修改它。如果我们教会 agent 什么是重要的，它们可以在这个过程中提供帮助。我们探索了这在 mlx-lm 背景下的样子，并希望它对贡献者和审阅者更快地完成高质量模型转换有所帮助！

## 资源

贡献：

- [transformers-to-mlx Skill 仓库](https://github.com/huggingface/transformers-to-mlx)
- [测试 Harness 仓库](https://github.com/pcuenca/mlx-lm-tests)
- [针对 fork 的 agent 辅助转换示例](https://github.com/pcuenca/mlx-lm/pull/5)

相关库：

- [mlx-lm，目标库](https://github.com/ml-explore/mlx-lm)
- [transformers，建模代码的真相来源](https://github.com/huggingface/transformers)

背景：

- [Claude Code Skills 文档](https://code.claude.com/docs/en/skills)
- [Transformers 设计理念](https://huggingface.co/spaces/transformers-community/Transformers-tenets)
- [Transformers 库：标准化模型定义](https://huggingface.co/blog/transformers-model-definition)

## 致谢！

非常感谢 [Ben](https://huggingface.co/burtenshaw)、[Shaun](https://huggingface.co/evalstate)、[Aritra](https://huggingface.co/ariG23498) 阅读了本文的早期版本并使其大为改善 🙌

我们对 Apple 将 MLX 作为开源项目表示深深的感激，也感谢社区立即认识到其价值并热情贡献 🙏

## 引用

- 原文：[The PR you would have opened yourself](https://huggingface.co/blog/transformers-to-mlx)
- [transformers-to-mlx 仓库](https://github.com/huggingface/transformers-to-mlx)
- [mlx-lm 仓库](https://github.com/ml-explore/mlx-lm)
