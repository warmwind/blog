---
title: "Agent 评估就绪清单（中文翻译）"
pubDatetime: 2026-03-28T20:00:00+08:00
description: "LangChain Blog 文章《Agent Evaluation Readiness Checklist》中文翻译（含原文引用）。"
slug: agent-evaluation-readiness-checklist-zh
---

> 原文标题：Agent Evaluation Readiness Checklist
> 原文链接：https://blog.langchain.com/agent-evaluation-readiness-checklist/

# Agent 评估就绪清单

本清单是 ["Agent 可观测性驱动 Agent 评估"](https://blog.langchain.com/agent-observability-powers-agent-evaluation/) 的实用配套文档，后者解释了为什么 agent 评估与传统软件测试不同，并介绍了核心可观测性原语（runs、traces、threads）。本文聚焦于实施方法论。

**关键原则：** "从能给你信号的最简单评估开始。几个端到端评估——测试你的 agent 是否能完成其核心任务——就能立即给你一个基线，即使你的架构还在变化中。"

---

## 第一节：构建评估之前

### 检查项：
- ☑️ 在构建评估基础设施之前，手动审查 20-50 条真实 agent 轨迹
- ☑️ 为单个任务定义明确的成功标准
- ☑️ 将能力评估与回归评估分开
- ☑️ 确保你能识别并清楚说明每次失败的原因
- ☑️ 将评估所有权分配给单个领域专家
- ☑️ 在归咎 agent 之前排除基础设施和数据管道问题

### 详细内容：

**先手动审查轨迹：** 在构建自动化系统之前，花 30 分钟使用 LangSmith 的轨迹和标注队列审查真实的 agent 轨迹。这比自动化分析更能有效地揭示失败模式。

**定义明确的成功标准：** 模糊的示例如"把这个文档总结好"应该替换为具体标准："从这份会议记录中提取 3 个主要行动项。每个应少于 20 个词，如果提到了负责人则应包含。"

**区分评估类型：**
- 能力评估回答"它能做什么？"，起始通过率较低
- 回归评估回答"它还能用吗？"，应保持约 100% 的通过率

**错误分析流程：** 按照以下结构化方法进行：
1. 收集失败的轨迹
2. 开放编码：与领域专家一起审查，不做预分类
3. 将问题分类为分类体系（提示词问题、工具设计问题、模型局限性、工具故障、数据缺口）
4. 迭代直到不再出现新的失败类别

文章指出"60-80% 的评估工作量"应集中在这个错误分析阶段。

**根因修复取决于失败类型：**
- 提示词问题 → 修复指令
- 工具设计问题 → 重新设计参数/示例
- 模型局限性 → 添加示例或更改架构
- 未知 → 进行更多分析

**单一领域专家负责制：** 应由一个人来维护数据集、重新校准判定器、分类新失败和定义质量标准，而不是通过委员会设计。

**基础设施验证：** Witan Labs 团队发现一个提取 bug 将基准测试从 50% 提升到了 73%，这表明基础设施问题经常伪装成推理失败。

![单步 vs. 完整轮次 vs. 多轮评估](https://blog.langchain.com/content/images/2026/03/From-Debugging-Code-to-Debugging-Reasoning-03-1.svg)

---

## 第二节：选择你的评估层级

### 检查项：
- ☑️ 理解三个评估层级：单步（run）、完整轮次（trace）和多轮（thread）
- ☑️ 从 trace 级别（完整轮次）评估开始，然后按需叠加 run 级别和 thread 级别

### 详细内容：

**单步（run 级别）评估：** 回答诸如"agent 是否选择了正确的工具？"或"它是否生成了有效的 API 调用？"等问题。这些最容易自动化，但需要稳定的 agent 架构。

**完整轮次（trace 级别）评估：** 大多数团队应该从这里开始。从三个维度评分：
1. 最终响应：输出是否正确且有用？
2. 轨迹：agent 是否走了一条合理的路径？
3. 状态变更：agent 是否创建了正确的产出物？（写入的文件、更新的数据库、安排的会议）

文章强调："状态变更评估经常被忽视，但对于执行操作（而非仅仅说话）的 agent 至关重要。"示例：验证日历事件确实存在且时间/参与者正确，而不仅仅检查响应说了"会议已安排！"

**多轮（thread 级别）评估：** 最难实施的层级；在 trace 级别评估稳定后再添加。

**实用技巧 — N-1 测试：** "从生产中获取真实对话前缀（前 N-1 轮），让 agent 只生成最后一轮。这避免了完全合成多轮模拟的复合错误问题。"

---

## 第三节：数据集构建

![数据集构建可视化](https://blog.langchain.com/content/images/2026/03/agent-evaluation-readiness-dataset-construction.png)

### 检查项：
- ☑️ 确保每个任务都是无歧义的，带有证明可解性的参考解决方案
- ☑️ 同时测试正向案例（行为应该发生）和负向案例（行为不应该发生）
- ☑️ 确保数据集结构与你选择的评估层级匹配
- ☑️ 根据你的 agent 类型（编码、对话、研究）定制数据集
- ☑️ 如果缺乏生产数据，生成种子示例
- ☑️ 从 dogfooding 错误、改编的外部基准和手写行为测试中获取数据
- ☑️ 建立轨迹到数据集的飞轮以实现持续改进

### 详细内容：

**清晰的任务定义：** 区分"帮我找去纽约的好航班"（模糊）和"查找从 SFO 到 JFK 的往返航班，12 月 15-17 日出发，12 月 22 日返回，经济舱，400 美元以下"（无歧义）。包含证明可解性的参考解决方案。

**正向和负向案例：** 避免只针对"它是否在应该搜索时搜索了？"进行优化。测试负向案例以防止 agent 搜索一切。

**按评估层级构建数据集：**
- Run 级别需要参考工具调用/决策
- Trace 级别需要预期输出和/或状态变更
- Thread 级别需要多轮对话序列和上下文保持

**按 Agent 类型定制：**
- 编码 agent：在质量评判标准之外包含确定性测试套件
- 对话 agent：包含多维标准（任务完成度和交互质量）
- 研究 agent：包含有据性检查（声明是否有来源支持？）和覆盖率检查

**种子示例生成：** 定义关键变化维度（查询复杂度、主题、边界情况）。创建约 20 个手动示例覆盖各维度，通过现有 agent 运行，审查并存储为基准事实。

**质量优于数量：** "你有信心的 20-50 个经过人工审查的示例，将优于你未验证过的数百个合成示例。"

**三种持续获取策略：**
1. 每天进行 dogfooding，将每个错误转化为评估（团队在真实工作流中进行压力测试）
2. 从 [Terminal Bench](https://www.tbench.ai/?ref=blog.langchain.com) 或 [BFCL](https://gorilla.cs.berkeley.edu/leaderboard.html?ref=blog.langchain.com) 中提取和改编任务，而不是运行完整基准
3. 为特定行为编写专注测试（"它是否并行化了工具调用？"或"它是否提出了澄清问题？"）

---

## 第四节：评分器设计

![评分器设计可视化](https://blog.langchain.com/content/images/2026/03/agent-evaluation-readiness-grader-design.png)

### 检查项：
- ☑️ 按评估维度选择专门的评分器：基于代码的用于客观检查，LLM-as-judge 用于主观评估，人工用于模糊案例，成对比较用于版本对比
- ☑️ 区分 guardrails（内联、运行时）和 evaluators（异步、质量评估）
- ☑️ 优先使用二元通过/失败，而非数值量表
- ☑️ 将 LLM-as-a-Judge 评分器校准到人类偏好
- ☑️ 评分结果而非精确路径，并为渐进式进展构建部分得分
- ☑️ 使用从你的错误分析中衍生的自定义评估器，而非通用的现成指标

### 评分器类型对比：

| 评分器类型 | 最适合 | 注意事项 |
|---|---|---|
| 基于代码 | 确定性检查、工具调用验证、输出格式、执行结果 | 可能对有效但意外的格式误判失败 |
| LLM-as-judge | 细微的质量判断、基于评判标准的评分、开放式任务 | 需要与人类校准 |
| 人工 | 校准、主观标准、边界情况 | 昂贵、缓慢、难以扩展 |

**关键指导：** "当存在客观正确答案时，默认使用基于代码的评估器。LLM-as-judge 用于客观任务评分可能不可靠，不一致的判断可能掩盖真正的回归。"

**实用技巧：** 与其用一个单体的正确性评估器，不如按维度分解为专门的评分器。Witan Labs 团队构建了 5 个评估器（内容准确性、结构、视觉格式、公式场景、文本质量），每个都有适当的阈值。

### Guardrails vs. Evaluators：

| 方面 | Guardrails | Evaluators |
|---|---|---|
| 何时 | 执行期间，在用户看到输出之前 | 生成之后，异步进行 |
| 速度 | 毫秒级（必须快） | 秒到分钟（可以昂贵） |
| 目的 | 阻止危险/格式错误的输出 | 衡量质量并捕获回归 |
| 示例 | PII 检测、格式验证、安全过滤 | LLM-as-judge 评分、轨迹分析 |

**优先使用二元量表：** 数值 1-5 量表在相邻分数之间引入主观差异，并需要更大的样本量。二元判断迫使更清晰的思考。注意：最近的研究表明，短 0-5 量表在 LLM-as-judge 场景中可能产生更强的人机对齐，但二元仍然更简单。

**LLM-as-Judge 校准：**
- 从 20+ 个标注示例开始，使用 LangSmith 的 Align Evaluator
- 向约 100 个示例扩展以获得生产信心
- 在判定输出中包含推理过程以实现可审计性
- 定期重新校准（判定器会随时间漂移）
- 使用 few-shot 示例提高一致性

**评分哲学：** "不要评判 agent 走的路径，评判它产出了什么。"如果存在更聪明的路线，不要要求"工具 A → B → C 按此顺序"。更好的做法是问"会议是否正确安排了？"而不是"它是否在 `create_event` 之前调用了 `check_availability`？"

**部分得分：** "一个正确识别了问题但在最后一步失败的 agent，比一个立即失败的 agent 更好。构建部分得分机制，让你的指标反映渐进式进展。"

**自定义评估器很重要：** "现成的指标如'有用性'或'连贯性'会产生虚假的信心。真正重要的评估器是那些能捕获你特定失败模式的评估器。"

---

## 第五节：运行与迭代

![运行与迭代可视化](https://blog.langchain.com/content/images/2026/03/agent-evaluation-readiness-running-iterating.png)

### 检查项：
- ☑️ 区分离线、在线和临时评估，并全部使用
- ☑️ 每个任务运行多次试验以应对非确定性
- ☑️ 手动审查失败评估的轨迹以验证评分器的公平性
- ☑️ 确保每次试验在干净、隔离的环境中运行，没有共享状态
- ☑️ 按能力类别标记评估，记录每个评估测量的内容，并跟踪效率指标
- ☑️ 识别通过率何时趋于平稳，并相应地演进你的测试套件
- ☑️ 只保留直接衡量你关心的生产行为的评估
- ☑️ 投资于工具接口设计和测试，而不仅仅是提示词优化
- ☑️ 区分任务失败（agent 搞错了）和评估失败（评分器搞错了）

### 评估类型对比：

| 时机 | 是什么 | 何时使用 |
|---|---|---|
| 离线 | 精选数据集，部署前运行 | 在发布前测试变更 |
| 在线 | 对生产轨迹的持续评估 | 捕获真实流量中的失败 |
| 临时 | 对已摄取轨迹的探索性分析 | 发现未预料到的模式 |

**处理非确定性：** 使用多次重复来应对模型输出的变化。运行多次试验时，在声称改进之前计算置信区间。考虑 pass@k（k 次尝试中至少一次成功）或 pass^k（k 次尝试全部成功）指标。

**跟踪运营指标：** "一个准确率 95% 但慢 10 倍的 agent 可能并不是改进。"监控所用轮次、token 使用量、延迟和每任务成本。

**标记和文档化：** 按能力分组评估（file_operations、retrieval、tool_use、memory、conversation）。添加文档字符串解释每个评估如何衡量 agent 能力。附加元数据以跨维度过滤。

**识别通过率平台期：** 当通过率趋于平稳且同类型任务不再揭示失败时，是时候演进了：添加更难的任务、测试新能力或转换维度。"在饱和的评估集上反复磨练是浪费精力的。"

**评估精简：** "每个评估都会随着时间对你的系统施加压力。更多评估不等于更好的 agent。构建有针对性的评估，并定期精简那些不再提供信号的评估。"

**工具设计投资：** "Anthropic 团队指出，在构建其 SWE-bench agent 时，他们花在优化工具上的时间比优化提示词更多。测试模型实际如何使用你的工具：尝试不同的参数格式，重新设计接口使错误更难发生。"目标：使错误在结构上不可能发生，而不仅仅是不太可能。

**失败分类：** 明确跟踪运行状态（完成、错误、超时）。将任务失败与评估失败分开，保持指标清洁。

---

## 第六节：生产就绪

![生产就绪可视化](https://blog.langchain.com/content/images/2026/03/agent-evaluation-readiness-production-readiness.png)

### 检查项：
- ☑️ 将持续高通过率的能力评估提升到回归套件中
- ☑️ 将回归评估集成到 CI/CD 流水线中，设置自动化质量门禁
- ☑️ 捕获用户反馈
- ☑️ 为生产流量设置在线评估
- ☑️ 安排定期的生产轨迹手动探索，超越自动化检查
- ☑️ 将你的提示词和工具定义与代码一起进行版本控制
- ☑️ 确保生产失败反馈到数据集、错误分析和评估改进中

### 详细内容：

**提升流水线：** 一旦任务可靠通过，将它们从"我们能做到吗？"移到回归套件中的"我们还能做到吗？"。

**CI/CD 集成：** 典型流程：
1. 代码/提示词变更触发流水线
2. 离线评估运行（便宜、快速的评分器用于单元/集成/数据集测试）
3. 如果离线评估通过则进行预览部署
4. 在线评估针对预览环境用实时数据运行（昂贵的 LLM-as-judge）
5. 只有所有门禁都通过才推送到生产；将失败路由到标注队列

在 CI 中使用便宜的基于代码的评分器用于每次提交。将昂贵的 LLM-as-judge 评估保留给预览/生产环境。

**在线评估：** 包括安全检查、格式验证、质量启发式规则。文章指出："你会在生产中发现你从未预料到的失败模式。"

**用户反馈：** 一旦投入生产，"用户反馈成为你最有价值的信号之一。自动化评估只能捕获你已经知道的失败模式。用户会暴露那些你不知道的。"

**结构化探索：** 定期探索生产轨迹，寻找超越自动化通过/失败检查的意外模式，使用 LangSmith 的 Insights Agent 等工具。

**版本控制：** "LangSmith 使得对提示词进行版本控制变得容易。没有这个，你无法将评估结果与特定变更关联，也无法知道哪次编辑导致了回归。"

**反馈飞轮：** 生产中的成功和失败反馈到数据集、错误分析和评估改进中。

![生产反馈飞轮](https://blog.langchain.com/content/images/2026/03/flywheel_Example.png)

---

## 完整清单总结

完整清单涵盖上述所有章节，跨六大类别：

1. **构建评估之前**（6 项）
2. **选择你的评估层级**（2 项）
3. **数据集构建**（7 项）
4. **评分器设计**（6 项）
5. **运行与迭代**（9 项）
6. **生产就绪**（7 项）

---

## 延伸阅读

**LangChain 内部资源：**
- [Agent Observability Powers Agent Evaluation](https://blog.langchain.com/agent-observability-powers-agent-evaluation/)
- [You don't know what your agent will do until it's in production](https://blog.langchain.com/you-dont-know-what-your-agent-will-do-until-its-in-production/)
- [Evaluating skills](https://blog.langchain.com/evaluating-skills/)
- [How we build evals for Deep Agents](https://blog.langchain.com/how-we-build-evals-for-deep-agents/)

**外部基准：**
- [Terminal Bench 2.0](https://www.tbench.ai/?ref=blog.langchain.com)
- [BFCL (Berkeley Function Calling Leaderboard)](https://gorilla.cs.berkeley.edu/leaderboard.html?ref=blog.langchain.com)

**Anthropic 资源：**
- [Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents?ref=blog.langchain.com)
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents?ref=blog.langchain.com)

**OpenAI 资源：**
- [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills?ref=blog.langchain.com)

**学术论文：**
- [LLM Evals: Everything You Need to Know](https://hamel.dev/blog/posts/evals-faq/?ref=blog.langchain.com) — Hamel Husain
- [Agent-as-a-Judge: Evaluate Agents with Agents](https://arxiv.org/abs/2410.10934?ref=blog.langchain.com)
- [A Survey on LLM-as-a-Judge](https://arxiv.org/abs/2411.15594?ref=blog.langchain.com)
- [Judge Reliability Harness](https://arxiv.org/abs/2603.05399?ref=blog.langchain.com)
- [Short scales research](https://arxiv.org/abs/2601.03444?ref=blog.langchain.com)

**LangSmith 文档：**
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts?ref=blog.langchain.com)
- [Evaluation quick start](https://docs.langchain.com/langsmith/evaluation-quickstart?ref=blog.langchain.com)
- [Manage datasets](https://docs.langchain.com/langsmith/manage-datasets?ref=blog.langchain.com)
- [LLM-as-judge setup](https://docs.langchain.com/langsmith/llm-as-judge?ref=blog.langchain.com)
- [Few-shot evaluators](https://docs.langchain.com/langsmith/create-few-shot-evaluators?ref=blog.langchain.com)
- [Pairwise evaluation](https://docs.langchain.com/langsmith/evaluate-pairwise?ref=blog.langchain.com)
- [Align evaluators with human feedback](https://docs.langchain.com/langsmith/improve-judge-evaluator-feedback?ref=blog.langchain.com)
- [Online evaluations](https://docs.langchain.com/langsmith/online-evaluations-code?ref=blog.langchain.com)
- [CI/CD pipeline example](https://docs.langchain.com/langsmith/cicd-pipeline-example?ref=blog.langchain.com)
- [Annotation queues](https://docs.langchain.com/langsmith/annotation-queues?ref=blog.langchain.com)
- [Insights Agent](https://docs.langchain.com/langsmith/insights?ref=blog.langchain.com)
- [Prompt versioning](https://docs.langchain.com/langsmith/prompt-engineering-concepts?ref=blog.langchain.com)
- [LangSmith CLI](https://docs.langsmith.com/langsmith/langsmith-cli?ref=blog.langchain.com)

---

## 引用

- 原文：[Agent Evaluation Readiness Checklist](https://blog.langchain.com/agent-evaluation-readiness-checklist/) — LangChain Blog, Victor Moreira, 2026-03-27
