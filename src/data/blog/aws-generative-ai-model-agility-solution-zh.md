---
title: AWS 生成式 AI 模型敏捷性解决方案：LLM 迁移综合指南
pubDatetime: 2026-05-02T10:30:00+08:00
description: AWS 介绍了一个端到端的 LLM 迁移框架，涵盖数据集准备、评估框架、提示词迁移、模型比较、性能优化等关键环节，帮助组织在生产环境中无缝切换大语言模型。
slug: aws-generative-ai-model-agility-solution-zh
originalTitle: "AWS Generative AI Model Agility Solution: A Comprehensive Guide to Migrating LLMs for Generative AI Production"
originalUrl: https://aws.amazon.com/blogs/machine-learning/aws-generative-ai-model-agility-solution-a-comprehensive-guide-to-migrating-llms-for-generative-ai-production/
---

原文标题：AWS Generative AI Model Agility Solution: A Comprehensive Guide to Migrating LLMs for Generative AI Production<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/aws-generative-ai-model-agility-solution-a-comprehensive-guide-to-migrating-llms-for-generative-ai-production/

保持模型敏捷性对于组织适应技术进步、优化人工智能（AI）解决方案至关重要。无论是在不同大型语言模型（LLM）家族之间切换，还是在同一家族内升级到更新版本，结构化的迁移方法和标准化流程都是在最小化运营中断的同时实现持续性能提升的关键。然而，开发此类解决方案在技术和非技术层面都颇具挑战，因为该方案需要：

- 具有通用性，能覆盖多种使用场景
- 具有针对性，让新用户能快速将其应用于目标场景
- 提供全面、公平的 LLM 对比
- 具备自动化和可扩展能力
- 融入领域和任务专属知识与输入
- 具有从数据准备指导到最终成功标准的完整端到端流程

本文介绍了一个面向生产环境中 LLM 迁移或升级的系统化框架，涵盖必要工具、方法论和最佳实践。该框架通过提供健壮的提示词转换和优化协议，促进不同 LLM 之间的迁移。它包含多维度性能评估机制，通过对源模型和目标模型的详细对比分析支持数据驱动的决策。所提出的方案提供了一个综合性解决方案，既涵盖模型迁移的技术层面，也提供了可量化指标以验证迁移成功与否并识别需要进一步优化的领域，从而促进平滑过渡和持续改进。以下是该方案的几个亮点：

- 提供多种评估报告选项，支持各种 LLM 评估框架，并为目标场景的指标选择提供全面指导。
- 通过 [Amazon Bedrock Prompt Optimization](https://aws.amazon.com/about-aws/whats-new/2024/11/prompt-optimization-preview-amazon-bedrock/) 和 [Anthropic Metaprompt 工具](https://anthropic.com/metaprompt-notebook)提供自动化提示词优化与迁移，以及进一步提示词优化的最佳实践。
- 提供全面的模型选型指导，以及从成本、延迟、准确性和质量维度进行模型比较的端到端解决方案。
- 提供功能示例和使用场景示例，帮助用户快速将该方案应用于目标场景。
- 遵循此框架完成 LLM 迁移或升级所需的总时间，根据使用场景的复杂程度，从两天到两周不等。

## 解决方案概述

![LLM 迁移工作流程图，展示从源模型（OpenAI、Mistral、Llama、Claude）到 Amazon Bedrock 目标模型的迁移流程，包括评估、比较和部署阶段。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-1.png)

迁移的核心涉及一个三步骤方法，如上图所示。

- 评估源模型。
- 使用 Amazon Bedrock Prompt Optimization 和 Anthropic Metaprompt 工具将提示词迁移到目标模型并进行优化。
- 评估目标模型。

该方案提供了一种全面的方法，用于将现有生成式 AI 解决方案（源模型）升级到 Amazon Bedrock 上的 LLM（目标模型）。该方案通过以下方式应对技术挑战：

- 使用各种 LLM 的框架进行评估指标选型
- 使用 Amazon Bedrock Prompt Optimization 和 Anthropic Metaprompt 工具进行提示词改进与迁移
- 从成本、延迟和性能维度进行模型比较

这种结构化方法为 LLM 的评估、迁移和优化提供了一个健壮的框架。遵循这些步骤，我们可以在模型之间平滑过渡，在 AI 应用中挖掘更好的性能、成本效益和能力潜力。该流程强调充分准备、系统评估和持续改进，为长期成功运用先进语言模型奠定基础。

## 解决方案实施

### 数据集准备

包含高质量样本的评估数据集对迁移过程至关重要。对于大多数使用场景，需要带有标准答案（ground truth）的样本；而对于其他使用场景，不需要标准答案的指标——如答案相关性、忠实度、毒性和偏见（参见后文"评估框架与指标选型"章节）——也可用作判定指标。使用以下指南和数据格式为目标使用场景准备样本数据。

样本数据的建议字段包括：

- 用于源模型的提示词
- 提示词输入（如有），例如：基于检索增强生成（RAG）的答案生成中使用的问题和上下文
- 用于源模型调用的配置，例如 temperature、top_p、top_k 等
- 标准答案（Ground truths）
- 源模型的输出
- 源模型的延迟
- 源模型的输入和输出 token 数量（可用于成本计算）

需要特别注意的是，高质量的标准答案对于大多数使用场景的成功迁移至关重要。标准答案不仅要在正确性方面经过验证，还要验证其是否符合领域专家（SME）的指导方针和评估标准。有关 SME 指导方针和评估标准的示例，请参阅后文"错误分析"章节。

此外，如果存在任何已有的评估指标，例如 SME 的人工评分或点赞/差评，请将这些指标及每个数据样本对应的推理过程或评语一并纳入。如果已进行自动化评估，请将自动化评估分数、方法和配置一并纳入。以下章节将提供关于选择评估框架和定义指标的更详细指导。尽管如此，收集利益相关方对现有或期望评估指标的意见作为参考仍然很有价值。

如适用，请包含以下字段：

- 源模型的现有人工评估指标，例如 SME 对源模型的评分。
- 源模型的现有自动化评估指标，例如源模型的 LLM-as-a-judge 评分。

下表是数据样本的示例格式：

| 字段 | 说明 |
|------|------|
| **sample_id** | 样本唯一标识 |
| **question** | 问题 |
| **content** | 内容/上下文 |
| **prompt_source_llm** | 源模型使用的提示词 |
| **answer_ground_truth** | 标准答案 |
| **answer_source_llm** | 源模型输出 |
| **latency_source_llm** | 源模型延迟 |
| **input_token_source_llm** | 源模型输入 token 数 |
| **output_token_source_llm** | 源模型输出 token 数 |
| **llm_judge_score_source_llm** | 源模型的 LLM 评判得分 |
| **human_eval_score_source_llm** | 源模型的人工评估得分 |
| **…** | … |

### 评估框架与指标选型

![评估框架和指标选型概览图](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/20/image-26-2.png)

收集信息和数据样本后，下一步是为生成式 AI 使用场景选择合适的评估指标。除了 SME 进行的人工评估外，还建议使用自动化评估指标，因为它们更具可扩展性和客观性，有助于产品的长期健康和可持续发展。下表展示了每种使用场景可用的自动化指标。

### 模型选型

选择合适的 LLM 需要综合考虑多个因素。无论是在同一 LLM 家族内迁移，还是迁移到不同的 LLM 家族，了解每个模型的关键特性和评估标准对于成功至关重要。在规划 LLM 迁移时，应仔细比较和评估各种可用选项，查阅每家模型提供商发布的模型卡和相应的提示词使用指南。在评估 LLM 选项时，需考虑以下几个关键标准：

- **输入和输出模态**：文本、代码和多模态能力
- **Context window 大小**：模型可处理的最大输入 token 数
- **每次推理或每 token 的成本**
- **性能指标**：延迟和吞吐量
- **输出**质量和准确性
- **领域专业化**及特定使用场景兼容性
- **托管选项**：云端、本地和混合部署
- **数据隐私和安全**要求

基于这些特性进行初步筛选后，应通过在特定任务上评估性能来对候选模型进行基准测试。Amazon Bedrock 通过统一 API 提供了访问各种 LLM 的综合解决方案，使我们可以尝试不同模型、比较它们的性能，甚至并行使用多个模型，同时保持单一集成点。这种方法不仅简化了技术实现，还通过支持多元化的 AI 模型策略来避免供应商锁定。

### 提示词迁移

本文介绍两种自动化提示词迁移和优化工具：Amazon Bedrock Prompt Optimization 和 Anthropic Metaprompt 工具。

#### **Amazon Bedrock Prompt Optimization**

Amazon Bedrock Prompt Optimization 是 Amazon Bedrock 中提供的一个工具，用于自动优化用户编写的提示词。它帮助用户在 Amazon Bedrock 上构建高质量的生成式 AI 应用，并减少将工作负载从其他提供商迁移到 Amazon Bedrock 时的摩擦。Amazon Bedrock Prompt Optimization 可以通过最少的提示词工程，将现有工作负载从源模型迁移到 Amazon Bedrock 上的 LLM。使用该工具，我们可以选择要优化提示词的目标模型，然后为该模型生成优化后的提示词。Amazon Bedrock Prompt Optimization 的主要优势在于可以直接通过 Amazon Bedrock 的 AWS 管理控制台使用。通过控制台，我们可以快速为目标模型生成新提示词。我们也可以使用 Bedrock API 生成迁移后的提示词，详细实现见下文。

##### **方案 A：通过 Amazon Bedrock 控制台优化提示词**

- 在 Amazon Bedrock 控制台中，进入 **Prompt management**（提示词管理）。
- 选择 **Create prompt**（创建提示词），输入提示词模板名称，然后选择 **Create**（创建）。

![AWS 创建提示词对话框截图，显示名称字段（填写"openAI-to-Claude"）、可选描述字段，以及 KMS 密钥加密设置，包含取消和创建按钮。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-2-1.jpeg)

- 输入源模型提示词。使用双花括号括住名称创建变量：`{{variable}}`。在 **Test variables**（测试变量）部分，输入在测试时替换变量的值。
- 为优化后的提示词选择 **Target Model**（目标模型）。例如，Anthropic 的 Claude Sonnet 4。

![AWS Bedrock 选择模型对话框，显示已选择 Anthropic 提供商，列出包括 Claude Sonnet 4 在内的 Claude 模型变体，以及推理配置和跨区域部署设置。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-3-1.png)

- 选择 **Optimize**（优化）按钮，为目标模型生成优化后的提示词。

![提示词配置界面，展示使用双花括号语法创建变量的说明，以及用于 AI 提示词改进的 Optimize 按钮。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-4-1.png)

6. 提示词生成后，将显示目标模型优化提示词与源模型原始提示词的对比窗口。

![并排提示词对比界面，左侧显示简单原始提示词，右侧显示使用 Claude 3.5 Sonnet 的 Variant_1 优化版本，包含结构化 XML 风格标签、任务定义和响应格式模板。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-5-1.png)

7. 退出对比模式前，保存新的优化提示词。

##### **方案 B：使用 Amazon Bedrock API 优化提示词**

我们还可以使用 Bedrock API 生成迁移后的提示词，通过向 Amazon Bedrock 运行时的 Agents 端点发送 OptimizePrompt 请求。在 input 对象中提供要优化的提示词，并在 `targetModelId` 字段中指定要优化的目标模型。

响应流将返回以下事件：

- analyzePromptEvent – 提示词分析完成时出现，包含描述提示词分析结果的消息。
- optimizedPromptEvent – 提示词重写完成时出现，包含优化后的提示词。

运行以下代码示例来优化提示词：

```python
import boto3

# Set values here
TARGET_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0" # Model to optimize for. For model IDs, see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
PROMPT = "Please summarize this text: " # Prompt to optimize

def get_input(prompt):
    return {
        "textPrompt": {
            "text": prompt
        }
    }
 
def handle_response_stream(response):
    try:
        event_stream = response['optimizedPrompt']
        for event in event_stream:
            if 'optimizedPromptEvent' in event:
                print("========================== OPTIMIZED PROMPT ======================\n")
                optimized_prompt = event['optimizedPromptEvent']
                print(optimized_prompt)
            else:
                print("========================= ANALYZE PROMPT =======================\n")
                analyze_prompt = event['analyzePromptEvent']
                print(analyze_prompt)
    except Exception as e:
        raise e
 
 
if __name__ == '__main__':
    client = boto3.client('bedrock-agent-runtime')
    try:
        response = client.optimize_prompt(
            input=get_input(PROMPT),
            targetModelId=TARGET_MODEL_ID
        )
        print("Request ID:", response.get("ResponseMetadata").get("RequestId"))
        print("========================== INPUT PROMPT ======================\n")
        print(PROMPT)
        handle_response_stream(response)
    except Exception as e:
        raise e
```

#### **Anthropic Metaprompt 工具**

Metaprompt 是 Anthropic 提供的提示词优化工具，Claude 会根据主题或任务代用户编写提示词模板。我们可以用它来指导 Claude 如何最优地构建提示词，以一致且准确地实现既定目标。

关键步骤如下：

- 指定原始提示词模板，解释任务，并指定输入变量和预期输出。
- 使用 Claude-3-Sonnet 等 Claude LLM 运行 Metaprompt，输入来自源模型的原始提示词。
- 新提示词模板将按照 Claude LLM 最佳实践，以优化的指令集和格式自动生成。

使用 metaprompt 的优势：

- 与人工创建的提示词相比，生成的提示词更详细、更全面
- 有助于提高遵循 Anthropic 模型提示最佳实践的可能性
- 允许指定语气等关键细节
- 提高模型输出的质量和一致性

Metaprompt 工具特别适用于学习 Claude 偏好的提示词风格，或作为为给定任务生成多个提示词版本的方法，简化对目标使用场景各种初始提示词变体的测试。

要实现此流程，请按照提示词迁移 Jupyter Notebook 中的步骤，将源模型提示词迁移到目标模型提示词。此 Notebook 需要在 Amazon Bedrock 中通过模型访问启用 Claude-3-Sonnet，以生成转换后的提示词。

以下是金融问答使用场景中源模型提示词的一个示例：

```
To answer the financial question, think step-by-step:
1. Carefully read the question and any provided context paragraphs related to yearly and quarterly document reports to find all relevant paragraphs. Prioritize context paragraphs with CSV tables.
2. If needed, analyze financial trends and quarter-over-quarter (Q/Q) performance over the detected time spans mentioned in the related time keywords. Calculate rates of change between quarters to identify growth or decline.
3. Perform any required calculations to get the final answer, such as sums or divisions. Show the math steps.
4. Provide a complete, correct answer based on the given information. If information is missing, state what is needed to answer the question fully.
5. Present numerical values in rounded format using easy-to-read units.
6. Do not preface the answer with "Based on the provided context" or anything similar. Just provide the answer directly.
7. Include the answer with relevant and exhaustive information across all contexts. Substantiate your answer with explanations grounded in the provided context. Conclude with a precise, concise, honest, and to-the-point answer.
8. Add the page source and number.
9. Add all source files from where the contexts were used to generate the answers.
context = {CONTEXT}
query = {QUERY}
rephrased_query = {REPHARSED_QUERY}
time_kwds = {TIME_KWDS}
```

完成 Notebook 中的步骤后，我们可以自动获取目标模型的优化提示词。以下示例生成了针对 Anthropic Claude LLM 优化的提示词：

```
Here are the steps to answer the financial question:

1. Read the provided <context>{$CONTEXT}</context> carefully, paying close attention to any paragraphs and CSV tables related to yearly and quarterly financial reports. Prioritize context paragraphs containing CSV tables.

2. Identify the relevant time periods mentioned in the <time_kwds>{$TIME_KWDS}</time_kwds>. Analyze the financial trends and quarter-over-quarter (Q/Q) performance during those time spans. Calculate rates of change between quarters to determine growth or decline.

3. <scratchpad>
In this space, you can perform any necessary calculations to arrive at the final answer to the <query>{$QUERY}</query> or <rephrasedquery>{$REPHARSED_QUERY}</rephrasedquery>. Show your step-by-step work, including formulas used and intermediate values.
</scratchpad>

4. <answer>
Provide a complete and correct answer based on the information given in the context. If any crucial information is missing to fully answer the question, state what additional details are needed.

Present numerical values in an easy-to-understand format using appropriate units. Round numbers as necessary.

Do not include any preamble like "Based on the provided context..." Just provide the direct answer.

Include all relevant and exhaustive information from the contexts to substantiate your answer. Explain your reasoning grounded in the provided evidence. Conclude with a precise, concise, honest, and to-the-point final answer.

Finally, cite the page source and number, as well as list all files that contained context used to generate this answer.
</answer>
```

如上例所示，提示词的风格和格式会自动转换，以遵循目标模型的最佳实践，例如使用 XML 标签并重新组织指令，使其更清晰直接。

### 生成结果

迁移过程中的答案生成是一个迭代过程。一般流程包括将迁移后的提示词和上下文传递给 LLM 并生成答案。需要多次迭代来比较不同提示词版本、多个 LLM 以及每个 LLM 的不同配置，以帮助我们选出最佳组合。在大多数情况下，生成式 AI 系统（如基于 RAG 的聊天机器人）的整个流水线并不会被迁移。相反，只迁移流水线的一部分。因此，流水线中其余组件的固定版本必须可用。例如，在基于 RAG 的问答（Q&A）系统中，我们可能只迁移流水线的答案生成组件。这样，我们就可以继续使用现有生产模型已生成的上下文。

作为最佳实践，建议使用代码仓库中的 Amazon Bedrock 模型标准调用方法来生成延迟、首字 token 时间、输入 token 数和输出 token 数等元数据，以及最终响应。这些元数据字段作为新列添加到结果表末尾，用于评估。输出格式和列名应与评估指标要求保持一致。下表展示了在 RAG 使用场景中，将样本数据送入评估流水线之前的数据示例。

评估前的样本数据示例：

| 字段 | 示例值 |
|------|--------|
| **financebench_id** | financebench_id_03029 |
| **doc_name** | 3M_2018_10K |
| **doc_link** | https://investors.3m.com/financials/... |
| **doc_period** | 2018 |
| **question_type** | metrics-generated |
| **question** | 问题内容... |
| **content** | 上下文内容... |
| **prompt_target_llm** | 目标模型提示词... |
| **answer_ground_truth** | 标准答案... |
| **answer_target_llm** | 目标模型答案... |
| **latency_target_llm** | 目标模型延迟 |
| **input_token_target_llm** | 输入 token 数 |
| **output_token_target_llm** | 输出 token 数 |
| **…** | … |

### 评估

评估是迁移过程中最重要的环节之一，因为它直接关联到签核标准，决定着迁移的成败。在大多数情况下，评估聚焦于三大类指标：准确性与质量、延迟，以及成本。自动化评估或人工评估都可以用来评估模型响应的准确性和质量。

#### 自动化评估

在质量评估过程中引入 LLM 代表了评估方法论的重大进步。这些模型擅长从多个维度进行全面评估，包括上下文相关性、连贯性和事实准确性，同时保持一致性和可扩展性。本文介绍两大类自动化评估指标：

- **预定义指标**：在 Ragas、DeepEval 和 Amazon Bedrock Evaluations 等基于 LLM 的评估框架中预定义的指标，或直接基于非 LLM 算法的指标，如"评估框架"中介绍的那些指标。
- **自定义指标**：用户自定义指标，通常针对特定任务或领域量身定制，使用用户提供的定义、评估标准或提示词，让 LLM 作为公正的评判者。

**预定义指标**

这些指标使用 Ragas 和 DeepEval 等基于 LLM 的评估框架，或直接基于非 LLM 算法。这些指标已被广泛采用，预先定义，自定义选项有限。Ragas 和 DeepEval 是我们在代码仓库中用作示例的两个基于 LLM 的评估框架和指标。

- **答案精确率（Answer precision）**：衡量模型生成答案中与标准答案相比包含相关且正确声明的准确程度。
- **答案召回率（Answer recall）**：评估答案的完整性，即模型检索正确声明并与标准答案比较的能力。高召回率表明答案充分涵盖了与标准答案一致的必要细节。
- **答案正确性（Answer correctness）**：对答案正确性的评估涉及衡量与标准答案相比生成答案的准确程度。该评估依赖于 `ground truth` 和 `answer`，分数范围为 0 到 1。分数越高表示生成答案与标准答案越接近，代表更高的正确性。
- **答案相似度（Answer similarity）**：对生成答案与标准答案之间语义相似度的评估。该评估基于 `ground truth` 和 `answer`，值在 0 到 1 之间。分数越高表示生成答案与标准答案越契合。

以下表格是 Ragas 评估后的样本数据输出示例。

| 字段 | 示例值 |
|------|--------|
| **financebench_id** | financebench_id_03029 |
| **doc_name** | 3M_2018_10K |
| **answer_precision** | 0.87 |
| **answer_recall** | 0.92 |
| **answer_correctness** | 0.85 |
| **answer_similarity** | 0.91 |
| **…** | … |

- **答案相关性（Answer relevancy）**：答案相关性指标通过评估 LLM 应用的 `actual_output` 与提供的输入相比的相关程度，衡量 RAG 流水线生成器的质量。
- **忠实度（Faithfulness）**：忠实度指标通过评估 `actual_output` 是否与 `retrieval_context` 的内容在事实上一致，衡量 RAG 流水线生成器的质量。
- **毒性（Toxicity）**：毒性指标是另一个无参考指标，用于评估 LLM 输出中的毒性内容。
- **偏见（Bias）**：偏见指标判断 LLM 输出是否包含性别、种族或政治偏见。
- **准确性（Accuracy）**：衡量模型输出的正确性。
- **忠实度（Faithfulness）**：检查事实准确性，避免幻觉。
- **有用性（Helpfulness）**：整体衡量响应在回答问题方面的有用程度。
- **逻辑连贯性（Logical coherence）**：衡量响应是否不存在逻辑缺口、不一致或矛盾。
- **有害性（Harmfulness）**：衡量响应中的有害内容，包括仇恨、侮辱、暴力或色情内容。
- **刻板印象（Stereotyping）**：衡量响应中对个人或群体的笼统陈述。
- **拒绝（Refusal）**：衡量响应在回答问题时的回避程度。
- **遵循指令（Following instructions）**：衡量模型响应遵守提示词中具体指示的程度。
- **专业风格与语气（Professional style and tone）**：衡量响应的风格、格式和语气在专业环境中的适宜程度。

**自定义指标**

这些指标由用户定义，通常针对特定任务或领域量身定制。一种流行的方法是使用自定义 LLM 作为评判者，通过用户提供的提示词为答案提供评估分数。与使用预定义指标不同，这种方法高度可定制，因为我们可以在提示词中提供特定任务的评估要求。例如，我们可以要求 LLM 生成 10 分制评分系统，并从信息正确性、上下文相关性、细节深度和全面性以及整体实用性等不同维度综合评估答案与标准答案的差距。

以下是 LLM 作为评判者的自定义提示词示例：

```python
#Prompt:   
System: "You are an AI evaluator that helps in evaluating output from LLM",
 
resp_fmt = """{
               "score":float,
               "reasoning": str
           }
       """
 
User = f"""[Instruction]\nPlease act as an impartial judge and evaluate the quality of the response
    provided by an AI assistant to the user question displayed below. Your evaluation should consider correctness,
    relevance, level of detail and helpfulness. You will be given a reference answer and the assistant's answer.
    Begin your evaluation by comparing the assistant's answer with the reference answer. Identify any mistakes. Be as
    objective as possible. After providing your explanation in the "reasoning" tab , you must score the response on a
    scale of 1 to 10 in the "score" tab. Strictly follow the below json format:{resp_fmt}.
   \n\n[Question]\n{question}\n\n[The Start of Reference Answer]\n{reference}\n[The End of Reference Answer]\n\n[The
    Start of Assistant's Answer]\n{response}\n[The End of Assistant's Answer]"""
```

#### 人工评估

虽然定量指标提供了有价值的数据点，但基于专业指南和 SME 反馈的全面定性评估也是验证模型性能的必要手段。有效的定性评估通常涵盖多个关键领域，包括响应主题和语气一致性、不当或不需要内容的检测、领域特定准确性、日期和时间相关问题等。通过借助 SME 专业知识，我们可以识别定量分析可能遗漏的细微差别和潜在问题。错误分析提供了一些 SME 可用于评估标准的潜在方面，这些方面也可作为验证和准备标准答案的指导。我们可以使用 Amazon Bedrock Evaluations 等工具进行人工评估。

虽然从界面收集的人工评估或用户反馈可以直接反映 SME 的评估标准，但它的效率、可扩展性和客观性不如自动化评估方法。因此，生成式 AI 系统开发生命周期可能从人工评估开始，但最终会转向自动化评估。当自动化评估未能达到基线目标或预定义的评估标准时，可以使用人工评估。

#### 延迟指标

在迁移语言模型时，运行时性能指标是运营成功的重要指标。总延迟和首 token 时间（TTFT）是最常见的延迟衡量指标。

- **总延迟（Total latency）** 是一个端到端指标，衡量完成响应生成所需的总时间，从初始提示词到最终输出。它包括处理输入、生成响应和将其传递给用户的时间。总延迟影响用户满意度、系统吞吐量和资源利用率。
- **首 token 时间（TTFT, Time to first token）** 量化初始响应速度——具体而言，即模型生成其第一个输出 token 前的时长。该指标显著影响感知响应速度和用户体验，尤其在交互式应用中。TTFT 在会话式 AI 和实时系统（如聊天机器人、虚拟助手和交互式搜索系统等应用）中尤为重要，用户期望即时反馈。低 TTFT 给人系统响应迅速的印象，大大提升用户参与度。

如果结果生成步骤需要多次 LLM 调用，则应提供分解延迟指标，因为在后续模型比较步骤中，只有与 LLM 迁移对应的子模块延迟才需要进行比较。

#### 成本计算

对于 LLM 调用，成本可以根据输入和输出 token 数量以及相应的每 token 价格计算：

```
LLM_invocation_cost = number_of_input_tokens * price_per_input_token + number_of_output_tokens * price_per_output_token
```

输入和输出 token 每单价的成本计算表可在 Amazon Bedrock Pricing 中找到。

### 模型比较报告：性能、延迟与成本

我们可以使用代码仓库中的"生成比较报告（Generate Comparison Report）"Notebook，自动以全局视角生成源模型和目标模型的最终比较报告。

我们也可以使用 Ragas 和 DeepEval 生成的评估报告，以及对应指标，从这两个评估框架的维度对模型进行比较。我们可以获得所选模型的平均输入和输出 token 数，以及平均成本和延迟的并排比较。如下图所示，运行此 Notebook 后，将生成来自两个选定评估框架的源模型和目标模型两份比较表。

![性能比较表，展示 GPT-4 Turbo 与 Claude 3 Haiku 在精确率、召回率、正确性、相似度、token 使用量、成本和延迟方面的指标对比。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-6-scaled.jpeg)

**Ragas**

![模型性能指标表，比较 GPT-4 Turbo 和 Claude 3 Haiku 在答案相关性、忠实度、偏见、毒性、token 使用量、成本和延迟方面的表现。](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-7-scaled.jpeg)

**DeepEval**

## 进一步优化

在 LLM 迁移或升级过程中增强和优化生成式 AI 生产流水线时，用户通常关注两个关键领域：

- 生成答案的质量
- 响应生成的延迟

### 提示词优化

为优化生成答案的质量，我们需要通过进行错误分析并识别提示词优化项，深入了解错误情况。

#### 错误分析

如果不进行任何优化，候选 LLM 不太可能产出最佳响应。因此，进行错误分析并关注可能存在的错误模式，有助于我们评估生成答案质量并识别改进机会。错误分析还为通过人工提示词工程提升质量提供了路径。收集错误分析洞见和 SME 反馈后，可以开展迭代的提示词优化流程。首先，将 SME 的错误分析洞见和反馈归纳成清晰的指导方针或标准。理想情况下，这些标准应在开始提示词迁移之前明确。这些标准是进一步提示词优化的核心考量因素，有助于提供符合 SME 标准的一致性、高质量响应。以下是我们可能从 SME 处收到的指导方针和标准示例。

**金融问答使用场景中来自 SME 的答案格式风格指南示例：**

- 确保引用数字的正确性。所有数字应与标准答案匹配。
- 确保标准答案中的所有声明都出现在 LLM 答案中。
- 生成的响应不应添加不相关的句子。
- 生成的答案必须正确识别问题中的财政年度和所有所需季度。
- 答案中的季度顺序应从最近到最早。
- 当问题询问同比数据时，答案应指定整年或最近一个季度，而不是逐季度说明。
- 当答案来自单个新闻文档时，在答案中包含发布日期。
- 使用与报纸风格相近的专业语言。
- 当用户查询要求列表时，以项目符号格式呈现列表。
- 当用户查询要求摘录时，提供总结陈述，后跟直接来自文档的未经编辑摘录的项目符号列表。
- 要求综合列表的查询最好包含项目符号。
- 要求具有主观类别的主题或主题的查询最好包含项目符号列表。
- 不要以引用上下文（"根据上下文"）开头回答。
- 大多数响应应在 30-150 字之间。当问题涉及多个实体或响应中需要子类别时，较长的答案是可以接受的。

#### 优化技术

在获得清晰标准后，可以使用多种优化技术来解决这些标准问题，例如：

- 在提示词指令中指定某些标准的提示词工程
- 用于指定答案格式和生成答案示例的少样本学习
- 引入有助于 LLM 理解任务和问题上下文的元信息
- 用于强制执行输出格式或解决常见错误模式的预处理或后处理

### 延迟优化

以下是优化延迟的几种可行方案：

#### 优化提示词以生成更短的答案

LLM 模型的延迟直接受输出 token 数量影响，因为每个额外的 token 都需要通过模型进行单独的前向传播，增加处理时间。随着生成更多 token，延迟会增加，尤其是在 Opus 4 等大型模型中。为降低延迟，我们可以在提示词中添加指令，避免提供冗长答案、不相关解释或填充词。

#### 使用预置吞吐量

吞吐量是指模型处理和返回的输入和输出的数量和速率。购买预置吞吐量（provisioned throughput）为专用托管模型提供更高级别的吞吐量，与使用按需模型相比，可能会降低延迟。虽然无法保证延迟的改善，但它能持续帮助防止请求被节流。

#### 改进生命周期

候选 LLM 在没有任何优化的情况下不太可能实现最佳性能。前述优化流程通常也需要迭代进行。因此，改进（优化）生命周期对于提升性能并识别流水线或数据中的差距或缺陷至关重要。改进生命周期通常包括：

- 提示词优化
- 答案生成
- 评估指标生成
- 错误分析
- 样本标签验证
- 针对样本缺陷和错误标签的数据集更新

任务或领域知识识别——本文中描述的迁移过程可在生成式 AI 解决方案生产生命周期的两个阶段中使用。

### 端到端 LLM 迁移与模型敏捷性

新 LLM 频繁发布，没有任何 LLM 能在给定使用场景中始终保持最佳性能。生产级生成式 AI 解决方案迁移到另一个 LLM 家族或升级到新版本 LLM 是常见情况。因此，拥有一个标准化且可复用的端到端 LLM 迁移或升级流程，对于任何生成式 AI 解决方案的长期成功至关重要。

### 监控与质量保证

当迁移或更新趋于稳定后，应建立一个标准的监控和质量保证流程，使用定期刷新的包含标准答案的黄金评估数据集，以及自动化或人工评估指标，同时评估实际用户使用记录。作为本方案的一部分，已建立的评估和数据及标准答案收集流程可以被复用于监控和质量保证。

## 提示与建议（经验教训）

以下是 LLM 迁移或升级过程中取得成功的一些提示和建议。

- **签核条件**：在流程开始时定义的数据、评估标准和成功标准应足以让利益相关者自信地签核。理想情况下，在流程中不应对数据、标准答案或 SME 评估和成功标准进行更改。
- **样本数据与质量**：数据应具有足够的质量和数量以供可信评估。标准答案和标签应与 SME 的评估标准和期望完全一致。理想情况下，在流程中不应对数据、标准答案或 SME 评估标准进行更改。
- **改进生命周期**：确保规划并实施改进生命周期，以从所选 LLM 中获得最大价值。
- **模型选型**：在对抗源模型选择候选目标模型时，使用 Artificial Analysis 基准测试网站等资源获取模型的全面比较。这些比较通常涵盖质量、性能和价格分析，在开始实验前提供有价值的洞见。这项前期研究有助于缩小最有潜力的候选范围，并为实验设计提供参考。
- **性能与成本权衡**：在评估不同模型或解决方案时，需要考虑性能和成本之间的平衡。在某些情况下，一个模型可能提供稍低的性能，但成本大幅降低，总体上使其成为更具成本效益的选择。当性能差异不大但成本节省显著时，这一点尤为如此。
- **优化技术**：探索各种优化技术，如提示词工程或预置吞吐量，可以在准确性和延迟等性能指标上带来显著改善。这些优化可以帮助弥合不同模型之间的差距，应作为评估过程的一部分加以考虑。

## 结论

在本文中，我们介绍了 AWS 生成式 AI 模型敏捷性解决方案——一个用于现有生成式 AI 应用 LLM 迁移和升级的端到端解决方案，可维护并提升模型敏捷性。该方案定义了一个标准化流程，并提供了一套全面的工具包，包含多种开箱即用的工具和高级技术，可用于将生成式 AI 应用迁移到新的 LLM。这可以作为生成式 AI 应用生命周期中的标准流程。在应用以特定 LLM 和配置稳定运行后，该方案中的评估和数据及标准答案收集流程可以被复用于生产监控和质量保证。

如需了解有关此方案的更多信息，请查阅 AWS 生成式 AI 模型敏捷性代码仓库。

## 关于作者

![Long Chen 的专业头像照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-8-100x100.jpeg)

**Long Chen** 是 AWS 生成式 AI 创新中心的高级应用科学家。他拥有密歇根大学安娜堡分校应用物理学博士学位。拥有超过十年的研究与开发经验，他致力于利用生成式 AI 和其他机器学习技术在各领域开发创新解决方案，确保 AWS 客户的成功。他的研究兴趣包括生成模型、多模态系统和图学习。

![Elaine Wu 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/elaine.png)

**Elaine Wu** 是 AWS 生成式 AI 创新中心的深度学习架构师，专注于为大型企业构建健壮的 RAG 和 agentic AI 解决方案。她为 AWS 客户解决了制造、能源、医疗、零售、企业软件和金融服务等多个行业的真实业务挑战。加入 AWS 之前，Elaine 获得了伊利诺伊大学厄巴纳-香槟分校信息科学硕士学位。

![Samaneh Aminikhanghahi 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-10-100x100.png)

**Samaneh Aminikhanghahi** 是 AWS 生成式 AI 创新中心的应用科学家，与不同行业的客户合作加速其生成式 AI 采用。她专注于 agentic AI 框架、构建健壮的评估系统以及实施推动可持续业务成果的负责任 AI 实践。

![Avinash Yadav 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/avinash.png)

**Avinash Yadav** 是生成式 AI 创新中心的深度学习架构师，为多样化的企业需求设计和实施前沿 GenAI 解决方案。他专注于构建 agentic AI 系统和多 agent 框架，开发能够在企业工作流程中进行复杂推理、工具使用和编排的 AI agent。他的专业知识涵盖使用大语言模型的 ML 流水线、利用 LangGraph 和 Amazon Bedrock AgentCore 等框架的 agentic 架构，以及云架构、基础设施即代码（IaC）和自动化。他专注于创建可扩展的端到端应用，利用深度学习、agentic 工作流和云技术解决现实业务挑战。

![Vidya Sagar Ravipati 的专业头像照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/13/ML-17637-image-12-100x100.jpeg)

**Vidya Sagar Ravipati** 是生成式 AI 创新中心的科学经理，他凭借在大规模分布式系统方面的丰富经验和对机器学习的热情，帮助不同行业的 AWS 客户加速其 AI 和云采用。

## 引用

- 原文：[AWS Generative AI Model Agility Solution](https://aws.amazon.com/blogs/machine-learning/aws-generative-ai-model-agility-solution-a-comprehensive-guide-to-migrating-llms-for-generative-ai-production/)
- [Amazon Bedrock Prompt Optimization](https://aws.amazon.com/about-aws/whats-new/2024/11/prompt-optimization-preview-amazon-bedrock/)
- [Anthropic Metaprompt 工具](https://anthropic.com/metaprompt-notebook)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
