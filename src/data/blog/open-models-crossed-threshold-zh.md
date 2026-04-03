---
title: Open Models have crossed a threshold
pubDatetime: 2026-04-03T10:00:00+08:00
description: LangChain 博客文章《Open Models have crossed a threshold》的中文翻译（含原文引用）。
slug: open-models-crossed-threshold-zh
originalTitle: "Open Models have crossed a threshold"
originalUrl: https://blog.langchain.com/open-models-have-crossed-a-threshold/
---

> 原文标题：Open Models have crossed a threshold
> 原文链接：https://blog.langchain.com/open-models-have-crossed-a-threshold/

![](https://blog.langchain.com/content/images/size/w760/format/webp/2026/04/72.png)

## TL;DR

开源模型（如 GLM-5 和 MiniMax M2.7）现在在核心 agent 任务——文件操作、工具调用和指令遵循——上已经可以匹敌闭源前沿模型，而成本和延迟仅为其一小部分。

## 正文

在过去几周里，我们一直在用 [Deep Agents](https://github.com/langchain-ai/deepagents) harness 评估来测试开源权重的大语言模型，初步结果表明它们可以作为闭源前沿模型的替代方案，也可以与之配合使用。[GLM-5](http://z.ai/)（z.ai）和 [MiniMax M2.7](https://www.minimax.io/models/text/m27) 在文件操作、工具调用和指令遵循等核心 agent 任务上的得分与闭源前沿模型相近。

如果你一直在通过 [SWE-Rebench](https://swe-rebench.com/) 和 [Terminal Bench 2.0](https://www.tbench.ai/leaderboard/terminal-bench/2.0) 等大量开源基准测试关注开源模型的进展，这一结果并不意外。工具调用已经可靠，指令遵循也很稳定。对于在生产环境中部署 agent 的开发者来说，开源模型现在提供了足够的一致性和可预测性，使真实世界的工作流变得更加可行。

## 为什么选择开源模型

在探索开源模型时，构建者和客户通常关注几个关键因素：**成本、延迟**和**任务性能**。

在理想情况下，我们当然希望为每个任务都使用最聪明的前沿模型和最高推理级别。但在实践中，两个约束使其行不通：成本和延迟。闭源前沿模型在高吞吐量工作负载上的费用可能高出 8-10 倍，而且对于用户在交互式产品中期望的响应时间来说，它们往往太慢了。

### 定价对比

| 模型 | 类型 | 输入（$/百万 token） | 输出（$/百万 token） |
|-------|------|------------------|-------------------|
| Claude Opus 4.6（Anthropic） | 闭源 | $5.00 | $25.00 |
| Claude Sonnet 4.6（Anthropic） | 闭源 | $3.00 | $15.00 |
| GPT-5.4（OpenAI） | 闭源 | $2.50 | $15.00 |
| GLM-5（Baseten） | 开源 | $0.95 | $3.15 |
| MiniMax M2.7（OpenRouter） | 开源 | $0.30 | $1.20 |

*以实际场景为例：一个每天输出 1000 万 token 的应用，使用 Opus 4.6 每天约花费 250 美元，而使用 MiniMax M2.7 仅约 12 美元/天。年化差距约为 87,000 美元。*

开源模型通常比闭源前沿模型更小，可以在专门的推理基础设施上加速——[Groq](https://groq.com/)、[Fireworks](https://fireworks.ai/) 和 [Baseten](https://www.baseten.co/) 等提供商在延迟和吞吐量方面的优化远超大多数团队自身所能实现的水平。[OpenRouter 数据](https://openrouter.ai/z-ai/glm-5/performance)显示，Baseten 上的 GLM-5 平均延迟 0.65 秒、吞吐 70 token/秒，而 Claude Opus 4.6 为 2.56 秒、34 token/秒。对于延迟敏感的产品来说，这一差距很难通过工程手段来弥补。

## 我们如何评估

我们在[《How we build evals for Deep Agents》](https://blog.langchain.com/how-we-build-evals-for-deep-agents/)一文中详细介绍了评估方法论。我们使用托管推理提供商运行评估，但 Deep Agents 也可以通过 Ollama、vLLM 等方式使用完全本地和私有的模型来运行。

对于开源模型，我们运行了七个评估类别：文件操作、工具调用、检索、对话、记忆、摘要和"单元测试"。这些类别覆盖了基础能力的检验：模型能否可靠地调用工具、遵循结构化指令、操作文件？这些是决定模型能否在 agent harness 中使用的关键能力。

每个评估用例定义了成功断言（决定正确性的硬性检查）和效率断言（衡量模型如何达到结果的软性检查）。我们报告四个指标：

- **Correctness（正确率）** ——模型正确解决的测试比例：`通过数 / 总数`。得分 0.68 意味着 68% 的测试用例被正确解决。这是主要的质量信号。
- **Solve rate（解决速率）** ——准确度和速度的综合衡量。对于每个测试，我们计算 `预期步骤数 / 实际耗时（秒）`；失败的测试贡献为零。最终得分是所有测试的平均值。越高越好——既正确又快速的模型得分最高。
- **Step ratio（步骤比）** ——模型实际执行的 agent 步骤数与预期步骤数的比值，在所有测试中聚合：`实际总步骤数 / 预期总步骤数`。值为 1.0 表示模型恰好使用了预期步骤数。高于 1.0 表示需要更多步骤（效率较低）；低于 1.0 表示步骤少于预期。
- **Tool call ratio（工具调用比）** ——与步骤比概念相同，但计算的是单次工具调用而非步骤。1.0 表示符合预算，高于则超预算，低于则省预算。

步骤比和工具调用比是**效率**指标。它们不影响测试是否通过，但揭示了模型达到答案的经济性。一个用 2 步而非预期 5 步解决任务的模型既正确*又*高效。

## 评估发现

这些是早期结果；我们正在积极维护和扩展评估集。你可以在 [GitHub 仓库](https://github.com/langchain-ai/deepagents)和共享的 LangSmith 项目中实时查看最新的运行记录。

### 开源模型评估结果

| 模型 | Correctness | Passed | Solve Rate | Step Ratio | Tool Call Ratio |
|-------|-------------|--------|------------|-----------|-----------------|
| baseten:zai-org/GLM-5 | 0.64 | 94 / 138 | 1.17 | 1.02 | 1.06 |
| ollama:minimax-m2.7 | 0.57 | 85 / 138 | 0.27 | 1.02 | 1.04 |

**开源模型各类别正确率：**

| 模型 | Conversation | File Ops | Memory | Retrieval | Summarization | Tool Use | Unit Test |
|-------|--------------|----------|--------|-----------|---------------|----------|-----------|
| baseten:zai-org/GLM-5 | 0.38 | 1 | 0.44 | 1 | 0.6 | 0.82 | 1 |
| ollama:minimax-m2.7:cloud | 0.14 | 0.92 | 0.38 | 0.8 | 0.6 | 0.87 | 0.92 |

### 前沿模型评估结果

| 模型 | Correctness | Passed | Solve Rate | Step Ratio | Tool Call Ratio |
|-------|-------------|--------|------------|-----------|-----------------|
| anthropic:claude-opus-4-6 | 0.68 | 100 / 138 | 0.38 | 0.99 | 1.02 |
| google_genai:gemini-3.1-pro-preview | 0.65 | 96 / 138 | 0.26 | 0.99 | 1.01 |
| openai:gpt-5.4 | 0.61 | 91 / 138 | 0.61 | 1.05 | 1.15 |

**前沿模型各类别正确率：**

| 模型 | Conversation | File Ops | Memory | Retrieval | Summarization | Tool Use | Unit Test |
|-------|--------------|----------|--------|-----------|---------------|----------|-----------|
| anthropic:claude-opus-4-6 | 0.05 | 1 | 0.67 | 1 | 1 | 0.87 | 1 |
| google_genai:gemini-3.1-pro-preview | 0.24 | 0.92 | 0.62 | 1 | 0.8 | 0.79 | 0.92 |
| openai:gpt-5.4 | 0.29 | 1 | 0.44 | 1 | 0.8 | 0.76 | 1 |

*对于每个模型，我们使用提供商的默认 thinking 级别。Gemini 3+ 为 `high`，OpenAI 为 `medium`，Claude 不使用 extended thinking。*

![](https://blog.langchain.com/content/images/2026/04/image.png)

![](https://blog.langchain.com/content/images/2026/04/2image.png)

### 自己动手：在本地运行 Deep Agent 评估

我们的 CI 在 52 个模型上运行相同的评估套件，按组织——包括一个 `open` 组，它在每次评估工作流中都会运行。你可以指定任意模型组：

对所有开源模型运行评估：
```
pytest tests/evals --model-group open
```

对特定模型运行评估：
```
pytest tests/evals --model baseten:zai-org/GLM-5
```

这使得在相同任务上、使用相同评判标准来比较开源模型之间以及开源与闭源前沿模型的表现变得很简单。

## 在 Deep Agents SDK 中使用开源模型

切换到开源模型只需更改一行代码：

### GLM-5：
```python
# pip install langchain-baseten
from deepagents import create_deep_agent

agent = create_deep_agent(model="baseten:zai-org/GLM-5")
```

### MiniMax M2.7：
```python
# pip install langchain-openrouter
from deepagents import create_deep_agent

agent = create_deep_agent(model="openrouter:minimax/minimax-m2.7")
```

就是这样。Harness 会处理剩下的一切——它会检测模型的 context window 大小，禁用不支持的模态，并将正确的身份注入 system prompt，以便 agent 知道自己的工作环境。

同一个开源模型通常可以通过多个提供商获得。选择符合你约束条件的那个即可。例如，GLM-5 可以作为 `baseten:zai-org/GLM-5`、`fireworks:fireworks/glm-5` 或 `ollama:glm-5`（自托管）使用。相同的模型，相同的 harness，不同的基础设施。

LangChain 为最流行的开源模型提供商提供支持。我们在本次发布中测试过的提供商包括：Baseten、Fireworks、Groq、OpenRouter 和 Ollama（cloud）。

### Harness 层面的模型适配

开源模型与闭源前沿模型有着不同的 context window、不同的工具调用格式和不同的失败模式。Deep Agents harness 吸收了这些差异，你无需自己处理：

- **模型身份注入** ——system prompt 在运行时会被注入模型的名称、提供商、context 限制和支持的模态。Agent 知道自己是什么以及能做什么。
- **Context 管理** ——压缩、卸载和摘要阈值会根据模型的实际 context window 进行适配，而不是使用硬编码的默认值。一个 4K context 的模型会比拥有 1M context 的 Opus 获得更激进的压缩。

### Deep Agents CLI

每个模型也可以在 [Deep Agents CLI](https://github.com/langchain-ai/deepagents/tree/main/libs/cli) 中使用。Deep Agents CLI 是一个开源编程 agent，也是 Claude Code 的替代方案。

除了 Deep Agents SDK 中的所有功能外，CLI 还支持**运行时模型切换**。我们引入了一个新的中间件（[`ConfigurableModelMiddleware`](https://github.com/langchain-ai/deepagents/blob/8be4a2ee3878a3e15c15d56fd64ba8db248a6328/libs/cli/deepagents_cli/configurable_model.py)），可以在会话中途切换模型而无需重启 agent。这使得使用前沿模型进行规划、然后切换到开源模型执行等模式成为可能。

你可以使用 `/model` 斜杠命令在会话中途切换模型。这支持诸如使用前沿模型开始任务进行规划，然后切换到更便宜的开源模型进行执行等模式。

## 接下来的计划

以下是我们即将分享的一些内容：

- 记录针对特定开源模型家族的 harness 调优模式
- 测试多模型 subagent 配置（例如：前沿闭源模型 orchestrator + 开源模型 subagent）

开源模型今天就可以用于 agent。我们希望展示帮助我们设计良好 harness 的设计模式，以及构建衡量你的任务中真正重要指标的定向评估。

[Deep Agents](https://github.com/langchain-ai/deepagents) 是开源的。用你偏好的开源模型试试吧，欢迎与我们一起构建出色的评估和 agent。

## 引用

- 原文：[Open Models have crossed a threshold](https://blog.langchain.com/open-models-have-crossed-a-threshold/) — LangChain Blog, April 2, 2026
- [Deep Agents GitHub](https://github.com/langchain-ai/deepagents)
- [How we build evals for Deep Agents](https://blog.langchain.com/how-we-build-evals-for-deep-agents/)
- [GLM-5 (z.ai)](http://z.ai/)
- [MiniMax M2.7](https://www.minimax.io/models/text/m27)
