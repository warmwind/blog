---
title: 使用 LLM-as-a-Judge 进行强化微调（RFT）
pubDatetime: 2026-05-02T11:00:00+08:00
description: 本文深入介绍如何通过 LLM-as-a-judge 实现强化微调（RFT），涵盖六个关键实施步骤、完整训练工作流，以及自动化法律合同审查的真实案例，并展示 Amazon Nova 2 Lite 通过 RFT 取得最佳性能的实验结果。
slug: reinforcement-fine-tuning-llm-as-a-judge-zh
originalTitle: Reinforcement Fine-Tuning with LLM-as-a-Judge
originalUrl: https://aws.amazon.com/blogs/machine-learning/reinforcement-fine-tuning-with-llm-as-a-judge/
---

原文标题：Reinforcement Fine-Tuning with LLM-as-a-Judge<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/reinforcement-fine-tuning-with-llm-as-a-judge/

大型语言模型（LLM）如今驱动着最先进的对话 agent、创意工具和决策支持系统。然而，它们的原始输出往往包含不准确之处、政策偏差或措辞不当——这些问题会削弱信任，限制真实世界的使用效果。*强化微调（Reinforcement Fine‑Tuning，RFT）* 已成为高效对齐这些模型的首选方法，使用*自动化奖励信号*代替成本高昂的人工标注。

现代 RFT 的核心是奖励函数。它们通过可验证的奖励函数为每个领域构建，这些函数可以通过一段代码对 LLM 生成内容进行评分（即带有可验证奖励的强化学习，RLVR），或者通过 LLM-as-a-judge——由一个独立的语言模型评估候选响应来引导对齐（即带有 AI 反馈的强化学习，RLAIF）。这两种方法都向 RL 算法提供分数，以引导模型解决当前问题。在本文中，我们将深入探讨 RLAIF 或 LLM-as-a-judge 强化学习如何与 Amazon Nova 模型有效结合。

## **为何选择 LLM‑as‑a-judge 的 RFT 而非通用 RFT？**

强化微调可以使用任何奖励信号，包括直接手工制作的规则（RLVR）或评估模型输出的 LLM（LLM-as-a-judge 或 RLAIF）。RLAIF 使对齐更加灵活和强大，尤其是当奖励信号模糊、难以手动设计时。与依赖粗糙数值评分（如子字符串匹配）的通用 RFT 奖励不同，LLM 评判者在正确性、语气、安全性、相关性等多个维度上进行推理，提供捕捉细微差别和领域特定细节的上下文感知反馈，无需特定任务的再训练。此外，LLM 评判者通过推理提供内置的可解释性（例如，"响应 A 引用了经同行评审的研究"），提供的诊断信息可加速迭代、直接定位故障模式并减少隐性偏差——这是静态奖励函数无法做到的。

## **实施 LLM-as-a-judge 的六个关键步骤**

本节介绍设计和部署 LLM-as-a-judge 奖励函数所涉及的关键步骤。

### **选择评判架构**

第一个关键决策是选择评判架构。LLM-as-a-judge 提供两种主要评估模式：*基于评分规则（Rubric-based，按分值）评判* 和 *基于偏好（Preference-based）评判*，各自适用于不同的对齐场景。

| **标准** | **基于评分规则的评判** | **基于偏好的评判** |
|---------|---------------------|-----------------|
| 评估方式 | 使用预定义标准为单个响应分配数值分数 | 并排比较两个候选响应，选出较优者 |
| 质量衡量 | 绝对质量测量 | 通过直接比较进行相对质量评估 |
| 适用场景 | 存在清晰可量化的评估维度（准确性、完整性、安全合规性）时 | 策略模型应无参考数据限制地自由探索时 |
| 数据要求 | 只需仔细进行提示词工程，使模型与奖励规格对齐 | 至少需要一个响应样本进行偏好比较 |
| 泛化能力 | 对分布外数据表现更好，避免数据偏差 | 依赖参考响应的质量 |
| 评估风格 | 模拟绝对评分系统 | 通过比较模拟自然的人类评估 |
| 建议起点 | 如果偏好数据不可用且 RLVR 不适合，从这里开始 | 当比较数据可用时使用 |

### **定义评估标准**

选择评判类型后，明确表达您想要改进的具体维度。清晰的评估标准是有效 RLAIF 训练的基础。

**对于基于偏好的评判者：**

撰写清晰的提示词，说明是什么让一个响应优于另一个。通过具体示例明确质量偏好。示例：*"倾向引用权威来源、使用通俗语言并直接回答用户问题的响应。"*

**对于基于评分规则的评判者：**

建议对基于评分规则的评判者使用布尔（通过/不通过）评分。布尔评分比细粒度的 1-10 分制更可靠，减少评判者的变异性。为每个评估维度定义具有特定、可观察特征的清晰通过/不通过标准。

### **选择和配置评判模型**

选择具有足够推理能力来评估目标领域的 LLM，通过 Amazon Bedrock 配置，并使用奖励 AWS Lambda 函数调用。对于数学、编程和对话能力等常见领域，通过仔细的提示词工程，较小的模型也能表现良好。

| **模型层级** | **适用场景** | **成本** | **可靠性** | **Amazon Bedrock 模型** |
|------------|------------|--------|---------|----------------------|
| 大型/重量级 | 复杂推理、细致评估、多维度评分 | 高 | 非常高 | Amazon Nova Pro、Claude Opus、Claude Sonnet |
| 中型/轻量级 | 数学或编程等通用领域，成本效益平衡 | 低至中 | 中至高 | Amazon Nova 2 Lite、Claude Haiku |

### **优化评判模型提示词**

评判提示词是对齐质量的基础。将其设计为产生具有清晰评分维度的结构化、可解析输出：

- **结构化输出格式** – 指定 JSON 或可解析格式，便于直接提取
- **清晰的评分规则** – 精确定义每个维度的计算方式
- **边缘情况处理** – 处理模糊场景（例如，"如果响应为空，则分配 0 分"）
- **期望行为** – 明确说明要鼓励或阻止的行为

### **将评判标准与生产评估指标对齐**

您的奖励函数应该与您在生产中评估最终模型时使用的指标相对应。将奖励函数与生产成功标准对齐，以使模型针对正确目标进行设计。

**对齐工作流程：**

- **定义**生产成功标准（例如，准确性、安全性）及可接受阈值
- **映射**每个标准到特定的评判评分维度
- **验证**评判分数与评估指标的相关性
- **测试**评判者在代表性样本和边缘情况上的表现

### **构建健壮的奖励 Lambda 函数**

生产级 RFT 系统在每个训练步骤中处理数千次奖励评估。构建一个弹性的奖励 Lambda 函数，以帮助提供训练稳定性、高效的计算利用率和可靠的模型行为。本节介绍如何构建具有弹性、高效性和生产就绪性的奖励 Lambda 函数。

**复合奖励分数结构**

不要仅依赖 LLM 评判者。将其与快速、确定性的奖励组件结合，在昂贵的评判者评估之前捕获明显的失败：

**核心组件**

| **组件** | **用途** | **使用时机** |
|---------|--------|-----------|
| 格式正确性 | 验证 JSON 结构、必要字段、模式合规性 | 始终使用——立即捕获格式错误的输出，快速且即时的反馈 |
| 长度惩罚 | 阻止过于冗长或过于简短的响应 | 当输出长度重要时（例如，摘要） |
| 语言一致性 | 验证响应与输入语言匹配 | 多语言应用的关键 |
| 安全过滤器 | 基于规则的禁止内容检查 | 始终使用——防止不安全内容进入生产环境 |

**基础设施准备**

- **实施指数退避：** 优雅处理 Amazon Bedrock API 速率限制和瞬态故障
- **并行化策略**：使用 ThreadPoolExecutor 或异步模式，在各个 rollout 中并行化评判者调用以减少延迟
- **避免 Lambda 冷启动延迟：** 设置适当的 Lambda 超时（建议 15 分钟）和预置并发（典型设置约 100）
- **错误处理：** 添加全面的错误处理，返回中性/带噪奖励（0.5）而不是使整个训练步骤失败

**测试奖励 Lambda 函数的弹性**

验证评判者的一致性和校准：

- **一致性**：多次在相同样本上测试评判者，以测量分数方差（对于确定性评估应该较低）
- **跨评判者比较：** 跨不同评判模型比较分数，以识别评估盲点
- **人工校准：** 定期对 rollout 进行人工审查采样，以捕获评判者漂移或系统性错误
- **回归测试：** 创建带有已知好/坏示例的"评判者测试套件"，对评判者行为进行回归测试

## **LLM-as-a-judge 的 RFT 训练工作流程**

下图展示了完整的端到端训练过程，从基线评估、评判者验证到生产部署。每个步骤都建立在前一步骤的基础上，创建一个在对齐质量与计算效率之间保持平衡的弹性流水线，同时积极防止奖励黑客攻击并支持生产就绪的模型行为。

![五阶段 AI 模型训练和部署流水线图，展示设置、训练和部署阶段](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-1.png)

## **真实案例研究：自动化法律合同审查**

本节介绍与某领先法律行业合作伙伴合作的真实使用案例。该任务是根据政策和过往合同作为参考文档，对法律文件中的风险、评估和行动生成评注。

### **挑战**

合作伙伴希望解决自动化审查、评估和标记法律合同文件中风险的问题。具体而言，他们希望根据内部指南和法规、过往合同以及与合同相关的国家法律来评估潜在的新合同。

### **解决方案**

我们将这个问题定义为：提供一个目标文档（需要评估的"合同"）和一个参考文档（基础文档和上下文），并期望 LLM 生成包含多条评注、评注类型和建议行动的 JSON，基于评估结果提出相应建议。此使用案例可用的原始数据集相对较小，包含完整合同以及法律专家的注释和评论。在 RFT 过程中，我们使用 GPT OSS 120b 模型作为评判者，结合自定义系统提示词实现 LLM-as-a-judge。

### **RFT 工作流程**

以下部分详细介绍了此使用案例中 RFT 工作流程的关键方面。

#### **用于 LLM-as-a-judge 的奖励 Lambda 函数**

以下代码片段展示了奖励 Lambda 函数的关键组件。

**注意**：Lambda 函数的名称应包含"SageMaker"，例如 `"arn:aws:lambda:us-east-1:123456789012:function:MyRewardFunction**SageMaker**"`

**a) 从定义高层目标开始**

```
# Contract Review Evaluation - Unweighted Scoring
You are an expert contract reviewer evaluating AI-generated comments. Your PRIMARY objective is to assess how well each predicted comment identifies issues in the TargetDocument contract clauses and whether those issues are justified by the Reference guidelines.
```

**b) 定义评估方法**

```
## Evaluation Approach
For each sample, you receive:
- **TargetDocument**: The contract text being reviewed (the document under evaluation)
- **Reference**: Reference guidelines/standards used for the review (the evaluation criteria)
- **Prediction**: One or more comments from the AI model
**Important**: The SystemPrompt shows what instructions the model received. Consider whether the model followed these instructions when evaluating the prediction quality.
**CRITICAL**: Each comment must identify a specific issue, gap, or concern IN THE TARGETDOCUMENT CONTRACT TEXT ITSELF. The comment's text_excerpt field should quote problematic contract language from the TargetDocument, NOT quote text from the Reference guidelines. The Reference justifies WHY the contract clause is problematic, but the issue must exist IN the contract.
Evaluate EACH predicted comment independently. Comments should flag problems in the contract clauses, not merely cite Reference requirements.
```

**c) 描述评分维度，明确指定特定分数的计算方式**

```
## Scoring Dimensions (Per Comment)
**EVALUATION ORDER**: Evaluate in this sequence: (1) TargetDocument_Grounding, (2) Reference_Consistency, (3) Actionability
### 1. TargetDocument_Grounding
**Evaluates**: (a) Whether text_excerpt quotes from TargetDocument contract text, and (b) Whether the comment is relevant to the quoted text_excerpt
**MANDATORY**: text_excerpt must quote from TargetDocument contract text. If text_excerpt quotes from Reference instead, score MUST be 1.
- **5**: text_excerpt correctly quotes TargetDocument contract text AND comment identifies a highly relevant, valid, and notable issue in that quoted text
- **4**: text_excerpt correctly quotes TargetDocument contract text AND comment identifies a valid and relevant issue in that quoted text
- **3**: text_excerpt correctly quotes TargetDocument contract text AND comment is somewhat relevant to that quoted text, but concern has moderate validity
- **2**: text_excerpt correctly quotes TargetDocument contract text BUT comment has weak relevance to that quoted text, or concern is questionable
- **1**: text_excerpt does NOT quote TargetDocument contract text (quotes Reference instead, or no actual quote), OR comment is irrelevant to the quoted text
### 2. Reference_Consistency
...
```

**d) 清晰定义最终输出格式以便解析**

```
## Scoring Calculation
**Comment_Score** = Simple average of the three dimensions:
- Comment_Score = (TargetDocument_Grounding + Reference_Consistency + Actionability) / 3
**Aggregate_Score** = Average of all Comment_Score values for the sample
## Output Format
For each sample, evaluate ALL predicted comments and provide:
```json
{ "comments": [ 
        { "comment_id": "...",
          "TargetDocument_Grounding": {"score": X, "justification": "...", "supporting_evidence": "Verify text_excerpt quotes actual TargetDocument contract text and comment is relevant to it"},
          "Reference_Consistency": {"score": X, "justification": "...", "supporting_reference": "Quote from Reference that justifies the concern OR explain meaningful reasoning"},                   
          "Actionability": {"score": X, "justification": "Assess if action is clear, grounded in TargetDocument and Reference, and relevant to comment"},
          "Comment_Score": X.XX 
        } ],
  "Aggregate_Score": {
          "score": X.XX,
          "total_comments": N,
          "rationale": "..." 
   }
}
```
```

**e) 创建高层 Lambda 处理程序，提供足够的多线程以加快推理速度**

```python
def lambda_handler(event, context): 
        scores: List[RewardOutput] = []
        samples = event
        max_workers = len(samples)
        print(f"Evaluating {len(samples)} items with {max_workers} threads...")
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [executor.submit(judge_answer, sample) for sample in samples]
                scores = [future.result() for future in futures]
        print(f"Completed {len(scores)} evaluations")
        return [asdict(score) for score in scores]
```

#### **部署 Lambda 函数**

我们在 Lambda 函数中使用了以下 AWS 身份和访问管理（IAM）权限和设置。以下配置是奖励 Lambda 函数所必需的。如果缺少任何配置，RFT 训练可能会失败。

**a) Amazon SageMaker AI 执行角色的权限**

您的 Amazon SageMaker AI 执行角色必须有权调用 Lambda 函数。将以下策略添加到您的 Amazon SageMaker AI 执行角色：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Resource": "arn:aws:lambda:region:account-id:function:function-name"
        }
    ]
}
```

**b) Lambda 函数执行角色的权限**

您的 Lambda 函数的执行角色需要基本的 Lambda 执行权限和调用评判者 Amazon Bedrock 模型的权限。

**注意：** 此解决方案遵循 AWS 共同责任模型。AWS 负责保护在云中运行 AWS 服务的基础设施。您负责保护 Lambda 函数代码、配置 IAM 权限、实施加密和访问控制、管理数据安全和隐私、配置监控和日志记录，以及验证与适用法规的合规性。遵循最小权限原则，将权限范围限定到特定的资源 ARN。更多信息请参阅 AWS 文档中的 AWS Lambda 安全性和 Amazon SageMaker AI 安全性。

![AWS IAM 控制台显示具有 AWSLambdaBasicExecutionRole 和 BedrockAccess 策略的角色权限](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-3.png)

**c) 添加预置并发**

发布 Lambda 版本，并为使函数在不发生延迟波动的情况下扩展，我们添加了一些预置并发。本例中 100 已经足够，但仍有更多降低成本的空间。

![AWS Lambda 版本管理面板，显示已发布的 10 个版本，第 1 页列出版本 27 和 28](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-4.png)

**d) 将 Lambda 超时设置为 15 分钟**

![AWS Lambda 通用配置面板，显示 128 MB 内存、512 MB 临时存储和 15 分钟超时](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-5.png)

#### **自定义训练配置**

我们推出了 Nova Forge SDK，可用于整个模型自定义生命周期——从数据准备到部署和监控。Nova Forge SDK 消除了搜索特定技术的适当 recipe 或容器 URI 的需要。

您可以通过两种方式使用 Nova Forge SDK 自定义训练参数：通过 `recipe_path` 提供完整的 recipe YAML，或使用 `overrides` 传递特定字段进行选择性更改。对于此使用案例，我们使用 overrides 来调整 rollout 和训练器设置，如以下部分所示。

```python
# Launch training with recipe overrides
result = customizer.train(
        job_name="my-rft-run",
        rft_lambda_arn="<your-lambda-arn>",
        overrides={
                # Training config
                "max_length": 64000,
                "global_batch_size": 64,
                "reasoning_effort": None,
                # Data
                "shuffle": False,
                # Rollout
                "type": "off_policy_async",
                "age_tolerance": 2,
                "proc_num": 6,
                "number_generation": 8,
                "max_new_tokens": 16000,
                "set_random_seed": True,
                "temperature": 1,
                "top_k": 0,
                "lambda_concurrency_limit": 100,
                # Trainer
                "max_steps": 516,
                "save_steps": 32,
                "save_top_k": 17,
                "refit_freq": 4,
                "clip_ratio_high": 0.28,
                "ent_coeff": 0.0,
                "loss_scale": 1,
        },
)
```

#### **结果**

Amazon Nova 2 Lite 通过 RFT 获得了 4.33 的聚合分数——在所有评估模型中表现最佳——同时保持了完美的 JSON 模式验证。这代表了显著的进步，表明 RFT 能够产出生产就绪的专业化模型，其性能超越了更大的通用替代方案。

我们使用**"best of k"单条评注设置**评估模型，即每个模型为每个样本生成多条评注，并对质量最高的输出进行评分。这种方法建立了性能上限，并能在产出单条和多条输出的模型之间进行公平比较。

![横向条形图，比较五个 AI 模型的相对性能分数，Nova 2.0-lite（RFT）和 Nova 2.0-lite（SFT）并列最高分 1.00](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-10.png)

图 1 — JSON 模式验证分数（0-1 分制，越高越好）

![横向条形图，比较五个 AI 模型的绝对性能分数，Nova 2.0-lite（RFT）以 4.33/5.00 的最高分领先](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-11-1024x406.png)

图 2 — 聚合 LLM 评判分数（1-5 分制，越高越好）

## **关键要点：**

- **RFT 在本研究中所有评估模型中取得了最高性能。**

Amazon Nova 2 Lite 通过 RFT 实现了 **4.33 聚合**分数，超越了 Claude Sonnet 4.5 和 Claude Haiku 4.5，同时实现了完美的 **JSON 模式验证。**

- **消除不必要的训练工件**

在 SFT 迭代过程中，我们观察到了问题性行为，包括重复评注生成和不自然的 Unicode 字符预测。这些问题可能是由过拟合或数据集不平衡造成的，在 RFT 检查点中没有出现。RFT 基于奖励的改进自然会阻止此类工件，**产生更健壮和可靠的输出**。

- **对新评判标准具有强泛化能力**

当我们使用修改后的评判提示词（与训练奖励函数对齐但不完全相同）评估 RFT 模型时，性能依然强劲。这表明 RFT 学习的是可泛化的质量模式，而非过拟合特定的评估标准。对于需求不断演变的真实部署场景，这是一个关键优势。

- **计算考量**

RFT 每个训练样本需要 4-8 次 rollout，与 SFT 相比增加了计算成本。使用非零推理努力设置时，这种开销会被放大。然而，对于对齐质量直接影响业务结果的关键任务应用（如法律合同审查、金融合规或医疗文档），性能提升足以证明额外的计算成本是合理的。

## **结论**

带有 LLM-as-a-judge 的强化微调（RFT）代表了一种将 LLM 对齐到领域特定应用的强大方法。正如我们的法律合同审查案例研究所展示的，这种方法相比基础模型和传统的监督微调（SFT）方法都取得了显著改进，RFT 在所有评估维度上获得了最高聚合分数。对于构建对齐质量直接影响业务结果的关键任务 AI 系统的团队来说，带有 LLM-as-a-judge 的 RFT 提供了一条引人注目的前进路径。该方法论的可解释性、灵活性和卓越性能使其在法律审查（或金融服务或医疗）等细微差别至关重要的复杂领域尤为有价值。

考虑采用这种方法的组织应该从小处着手——在精心策划的基准上验证评判者设计，验证基础设施弹性，并在监控奖励黑客攻击的同时逐步扩展。通过适当的实施，RFT 可以将有能力的基础模型转变为高度专业化的、生产就绪的系统，持续提供对齐的、可信赖的输出。

***参考资料***：

- Amazon Nova Developer Guide for Amazon Nova 2
- Nova Forge SDK — GitHub
- Reinforcement Fine-Tuning (RFT) with Amazon Nova models

***免责声明：***

本文描述的法律合同审查使用案例仅供技术演示目的。AI 生成的合同分析不能替代专业法律建议。法律事务请咨询合格的法律顾问。

## 关于作者

![Hemanth Kumar Jayakumar 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-6-1.png)

**Hemanth Kumar Jayakumar** 是 Amazon AGI 的应用科学家，致力于强化学习和基础模型研究。他将最新的 ML 研究转化为可扩展的解决方案，为客户解锁基础模型的领域专业化能力。工作之外，Hemanth 喜欢旅行和徒步。

![Daniel Suarez Souto 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-7.png)

**Daniel Suarez Souto** 是 Amazon Web Services 的解决方案架构师，专注于人工智能领域。他帮助客户加速 AI 采用，端到端构建安全、可扩展的 AI 系统，将真实世界的边缘案例转化为可复用的模式，帮助客户更快推进。业余时间，Daniel 喜欢踢足球、跑步和徒步。

![Ajit Kumar K.P. 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-8.png)

**Ajit Kumar K.P.** 是 AWS 的高级生成式 AI 合作伙伴解决方案架构师，与在云中部署 AI 解决方案的企业客户和合作伙伴合作。他在平台工程与企业级 AI 之间搭建桥梁，具有在边缘构建计算机视觉解决方案以及在云中构建 AIML 和生成式 AI 解决方案的深厚专业知识。Ajit 业余时间喜欢阅读传记和参与体育运动。

![Bharathan Balaji 的照片](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/23/ML-20696-9-1.png)

**Bharathan Balaji** 是 Amazon Web Services 的高级应用科学家，致力于强化学习和基础模型服务。他的工作专注于构建帮助客户转变业务的 AI 能力。

## 引用

- 原文：[Reinforcement Fine-Tuning with LLM-as-a-Judge](https://aws.amazon.com/blogs/machine-learning/reinforcement-fine-tuning-with-llm-as-a-judge/)
- [Amazon Nova Developer Guide for Amazon Nova 2](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html)
- [Nova Forge SDK — GitHub](https://github.com/aws-samples/nova-forge)
- [Reinforcement Fine-Tuning (RFT) with Amazon Nova models](https://docs.aws.amazon.com/nova/latest/userguide/rft.html)
