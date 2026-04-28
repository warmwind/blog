---
title: 使用 SageMaker AI 模型和 MLflow 构建 Strands Agents
pubDatetime: 2026-04-28T10:00:00+08:00
description: 本文演示如何使用 Strands Agents SDK 结合 SageMaker AI 端点上的模型构建 AI agent，并通过 SageMaker Serverless MLflow 实现生产级可观测性、A/B 测试及性能评估。
slug: strands-agents-sagemaker-mlflow-zh
originalTitle: Build Strands Agents with SageMaker AI models and MLflow
originalUrl: https://aws.amazon.com/blogs/machine-learning/build-strands-agents-with-sagemaker-ai-models-and-mlflow/
---

原文标题：Build Strands Agents with SageMaker AI models and MLflow<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/build-strands-agents-with-sagemaker-ai-models-and-mlflow/

![Build Strands Agents with SageMaker AI models and MLflow](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/27/ml-19842-feature-image.png)

构建 AI agent 的企业往往需要的不仅仅是托管基础模型（FM）服务所能提供的功能。他们需要对性能调优、规模化成本优化、合规与数据驻留、模型选择，以及与现有安全架构集成的网络配置进行精确控制。[Amazon SageMaker AI](https://aws.amazon.com/sagemaker/ai/) 端点满足这些需求，让组织能够控制计算资源、扩缩行为和基础架构部署，同时受益于 AWS 的托管运维层。这些由 SageMaker AI 部署的模型，可以驱动 AI agent、处理对话工作负载，并与 [Amazon Bedrock](https://aws.amazon.com/bedrock/) 上可用的 FM 等编排框架集成。区别在于，组织保留了对推理发生方式和地点的架构控制权。

本文将演示如何使用 Strands Agents SDK 结合部署在 SageMaker AI 端点上的模型来构建 AI agent。您将学习如何从 SageMaker JumpStart 部署基础模型，将其与 Strands Agents 集成，并使用 SageMaker Serverless MLflow 建立生产级可观测性以进行 agent 追踪。我们还将介绍如何在多个模型变体之间实现 A/B 测试，使用 MLflow 指标评估 agent 性能，以及如何在您控制的基础架构上构建、部署和持续改进 AI agent。

[Strands Agents SDK](https://strandsagents.com/) 是一个开源 SDK，采用模型驱动的方式，仅需几行代码即可构建和运行 AI agent。Strands 能够从简单到复杂的 agent 用例进行扩展，从本地开发到生产部署皆可胜任。

[Amazon SageMaker JumpStart](https://aws.amazon.com/sagemaker/ai/jumpstart/) 是一个机器学习（ML）中心，可帮助您加速 ML 之旅。借助 SageMaker JumpStart，您可以根据预定义的质量和责任指标，快速评估、比较和选择 FM，以执行文章摘要和图像生成等任务。

[SageMaker AI MLflow](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow.html) 是一种托管功能，通过实验追踪、模型版本控制和部署管理来简化机器学习生命周期。

本文将涵盖以下内容：

- **在 SageMaker AI 上部署模型** – 从 SageMaker JumpStart 部署基础模型。
- **将 Strands 与 SageMaker AI 集成** – 在 Strands Agents 中使用已部署的 SageMaker AI 模型。
- **设置 Agent 可观测性** – 为 agent 追踪配置 SageMaker AI MLflow App。
- **实现 A/B 测试与评估** – 部署多个模型变体，并使用 MLflow 指标评估 agent。

本文对应的完整代码 Jupyter notebook 可在 [GitHub repo](https://github.com/aws/amazon-sagemaker-examples/blob/default/%20%20%20ml_ops/sm-mlflow_eval/strands-agents-sagemaker-model-evaluation.ipynb) 中找到。

## 构建您的第一个 Strands Agent

Strands agent 将模型、系统提示和一组工具组合在一起，构建一个简单的 AI agent。Strands 提供多种模型提供商，包括 Amazon SageMaker AI。它还通过 strands-agent-tools SDK 提供许多常用工具，让组织能够快速为其业务需求构建 AI agent。

以下代码片段展示了如何使用 Strands Agents SDK 创建您的第一个 agent。使用 Strands Agents SDK 构建的详细 agent 示例可在 [GitHub repo](https://github.com/strands-agents/samples) 中找到。

```sql
model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0"
)

agent = Agent(model=model, tools=[http_request])
agent("Where is the international space station now?")
```

该 agent 在 Amazon Bedrock 上使用 Claude 4.5 Sonnet 多区域推理模型。可用推理配置文件列表可在 [Amazon Bedrock 用户指南](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) 中找到。

Amazon Bedrock 为您提供多种模型选择。可用模型的模型 ID 可在 [Amazon Bedrock 用户指南](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) 中找到。

## 为什么使用部署在 SageMaker AI 上的模型？

组织出于以下原因考虑在 SageMaker AI 上部署基础模型：

- **基础架构控制** – SageMaker AI 提供对计算实例、网络配置和扩缩策略的控制。这对于有严格延迟 SLA 或特定硬件要求的组织至关重要。
- **模型灵活性** – SageMaker AI 支持部署不同的模型，无论是自定义架构、微调变体，还是 Llama 或 Mistral 等开源替代方案。
- **成本可预测性** – SageMaker AI 专用端点通过预留实例、竞价定价和合适规格的计算资源，实现精确的成本预测和优化。这对于高流量工作负载尤为有益。
- **高级 MLOps** – SageMaker AI 与 MLflow 模型注册表的集成以及 A/B 测试功能，提供了许多组织在生产 AI 系统中所需的企业级模型治理能力。

## 使用 SageMaker AI 模型构建 Strands Agent

Strands Agents SDK 实现了一个 SageMaker AI 提供商，因此您可以针对部署在 SageMaker AI 推理端点上的模型运行 agent。这包括来自 SageMaker JumpStart 的预训练模型和自定义微调模型。您在 Strands Agents SDK 中使用的模型应支持兼容 OpenAI 的 chat completions API。本文将展示如何在 Strands Agents 中使用 SageMaker AI JumpStart 上可用的 Qwen3 4B 和 Qwen3 8B 模型。

### 前提条件

要执行本文中的代码，您必须具备以下条件：

- 拥有访问 Amazon Bedrock 和 Amazon SageMaker AI 的 AWS 账户。
- 具有访问 SageMaker AI、Amazon Bedrock 模型、SageMaker AI Serverless MLflow、Amazon Simple Storage Service（Amazon S3）和 Amazon SageMaker AI JumpStart 权限的角色。您可以使用信任策略来担任该角色。
- 在本地桌面或 SageMaker AI Studio 上运行的 Jupyter notebook。在本地运行时，请确保您已通过 AWS 账户身份验证并担任了具有所需权限的角色。

### 步骤 1：安装所需包

首先，我们在环境中安装所需的 Python 包。

```
%%writefile requirements.txt
strands-agents>=1.9.1
strands-agents-tools>=0.2.8
mlflow>=3.4.0
strands-agents[sagemaker]
mlflow-sagemaker>=1.5.11
pip install -r requirements.txt
```

### 步骤 2：将模型部署为 SageMaker AI 端点

包可用后，我们使用 SageMaker JumpStart API 将 Qwen3-4B 模型部署为 SageMaker AI 端点。

```python
# Deploy initial endpoint with Qwen-4B
import sagemaker
import boto3
from boto3.session import Session
from sagemaker.jumpstart.model import JumpStartModel

boto_session = Session()
sts = boto3.client('sts')
account_id = sts.get_caller_identity().get("Account")
region = boto_session.region_name

ENDPOINT_NAME = INITIAL_CONFIG_NAME = "llm-qwen-endpoint-sagemaker" 
# We will keep using this endpoint name

model_a = JumpStartModel(
    model_id="huggingface-reasoning-qwen3-4b", 
    model_version="1.0.0",
    name="qwen3-4b-model"
)

# Deploy the model to an endpoint
predictor_a = model_a.deploy(
    initial_instance_count=1,
    instance_type="ml.g5.2xlarge",
    endpoint_name=ENDPOINT_NAME
)
```

### 步骤 3：与 Strands agent 集成使用

模型部署后，我们创建一个 `SageMakerAIModel` 并在 Strands Agents 中使用它。

```python
from strands.models.sagemaker import SageMakerAIModel
from strands import Agent, tool
from strands_tools import http_request, calculator

model_sagemaker = SageMakerAIModel(
    endpoint_config={
        "endpoint_name": ENDPOINT_NAME, 
        "region_name": region 
    }, 
    payload_config={ 
        "max_tokens": 2048, 
        "temperature": 0.2, 
        "stream": True, 
    }
)

# Test the agent
agent = Agent(model=model_sagemaker, tools=[http_request]) 
agent("Where is the international space station now? (Use: http://api.open-notify.org/iss-now.json)")
```

有关 SageMaker AI 作为 Strands Agents 模型提供商的更多信息，请参阅 Strands Agent 网站上的 [Amazon SageMaker](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/model-providers/sagemaker/) 文档。

## 使用 SageMaker AI Serverless MLflow App 实现 Agent 可观测性

[SageMaker AI Serverless MLflow](https://aws.amazon.com/sagemaker/ai/experiments/) 通过自动捕获执行追踪、工具使用模式和决策工作流，无需自定义工具，即可为 AI agent 提供全面的可观测性。该托管服务有助于降低运维开销，同时提供与 Strands Agents SDK 的原生集成。这使得追踪 agent 对话流程成为可能。借助这一集中式可观测性服务，团队可以跨多个部署监控 agent 行为、识别性能瓶颈，并为合规要求维护审计追踪。

### 步骤 1：设置 SageMaker AI Serverless MLflow App

为 AI agent 设置可观测性的第一步是[设置 MLflow App](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow-app-setup.html)。您有两个主要的部署选项：

- 使用直观的 SageMaker AI Studio UI 进行引导配置的快速设置
- 使用 Boto3 进行程序化部署，以实现自动化和基础架构即代码实践

两种方式都会创建 Serverless MLflow App，让您可以专注于构建和监控 Strands Agents，而无需管理底层可观测性基础架构。本文使用 Boto3 SDK 部署 MLflow App。

```python
# Create S3 bucket for MLflow artifacts
s3_client = boto3.client('s3', region_name=region)
bucket_name = f'{account_id}-mlflow-bucket'
if region == 'us-east-1':
            s3_client.create_bucket(Bucket=bucket_name)
        else:
            s3_client.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={'LocationConstraint': region}
            ) 
# Create SageMaker client
sagemaker_client = boto3.client('sagemaker')

# Create MLflow App
mlflow_app_details = sagemaker_client.create_mlflow_app(
    Name='strands-mlflow-app',
    ArtifactStoreUri=f's3://{account_id}-mlflow-bucket/artifacts',
    RoleArn=role,
    
)

print(f"MLflow app creation initiated: { mlflow_app_details['Arn']}")
```

### 步骤 2：为 Strands Agent 追踪设置 MLflow App

创建 MLflow App 后，您需要为 Strands Agents 启用自动日志记录，以便 agent 交互、工具使用和性能指标自动被捕获并发送到 MLflow App，无需手动工具。

```python
import os
import mlflow

tracking_uri = mlflow_app_details['Arn']
print(f"MLflow App URL: {tracking_uri}")

# Set MLflow tracking URI
os.environ["MLFLOW_TRACKING_URI"] = tracking_uri
# Or you can set the tracking server as below.
#mlflow.set_tracking_uri(tracking_uri)

mlflow.set_experiment("Strands-MLflow") # This experiment name will be used in the UI
mlflow.strands.autolog()
```

### 步骤 3：运行 agent

MLflow App 设置并启用自动日志记录后，您现在可以像开始时一样调用 Strands Agent。

```python
def capitalize(response):
    return response.upper()
    
agent = Agent(model=model_sagemaker, tools=[http_request])
response = agent("Where is the international space station now?")
capitalize(response.message['content'][0]['text'])
```

追踪和指标将在您的 MLflow App 上可用，可以通过使用 `mlflow_app_details` 和 AWS Region 变量构建的签名 URL 进行访问。

```python
# Get presigned URL for MLflow App
presigned_response = sagemaker_client.create_presigned_mlflow_app_url(
    Arn=mlflow_app_details['Arn'] 
)
mlflow_ui_url = presigned_response['AuthorizedUrl']
print(f"MLflow UI URL: {mlflow_ui_url}")
```

### 步骤 4：在 MLflow 中查看追踪

agent 运行结束后，您的 agent 追踪、工具调用及其他指标将通过 MLflow App UI 的"Traces"部分提供。

实验中的追踪在列表视图中可供进一步检查。

![MLflow 3.4.0 Strands-MLflow 实验仪表板，显示 GenAI agent 追踪及执行时间和状态指标](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ml-19842-image-5-1.png)

选择特定追踪时，您可以选择以**执行时间线**或**跨度树**的形式查看详情。在两种视图中，您都可以看到 Agent Loop、工具调用、每个步骤的输入/输出及其他信息。

![MLflow 追踪详情弹框，显示 ISS 位置查询，延迟 2.45 分钟，坐标输出为纬度 -37.0416°、经度 -24.3535°](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ml-19842-image-6.png)

## 手动追踪

虽然之前的代码块中有 `capitalize(response.message['content'][0]['text'])`，但 capitalize 函数在 MLflow 追踪中并不可见。MLflow Strands 自动追踪会记录 agent 调用（及其工具和 FM 调用），而其他函数调用不会被记录。如果您需要追踪完整的代码块，可以使用 MLflow 的手动追踪功能，如以下代码块所示。

```python
@mlflow.trace(span_type="func", attributes={"operation": "capitalize"})
def capitalize(response):
    return response.upper()

@mlflow.trace
def run_agent():
    agent = Agent(tools=[http_request])
    mlflow.update_current_trace(request_preview="Run Strands Agent")
response = agent("Where is the international space station now? (Use: http://api.open-notify.org/iss-now.json) ")
    capitalized_response = capitalize(response.message['content'][0]['text'])

    return capitalized_response

# Execute the traced function
capitalized_response = run_agent()
print(capitalized_response)
```

在此代码块中，capitalize 函数使用 @mlflow.trace 进行装饰，以确保其执行、输入和输出在 MLflow 中可见。因此，您将在 MLflow 中看到如下追踪，其中包含 agent 调用和"capitalize"函数调用。

![MLflow run_agent 追踪，显示 ISS 位置数据处理及大写转换，执行时间 16.11 秒](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ml-19842-image-7.png)

## 部署新 LLM 进行 A/B 测试

借助 Amazon SageMaker AI，您可以优化 agent 应用程序的大型语言模型（LLM）。例如，若要通过将较小的 Qwen3-4B 模型升级到较大的 Qwen3-8B 模型来提升应用程序性能，您无需立即进行完整迁移。由于当前使用 Qwen3-4B 的 agent 运行良好，您可以将新的 Qwen3-8B 模型与其并排部署，并在两个 LLM 端点之间分配流量。通过这种方式，您可以在完全切换到较大模型之前进行 A/B 测试，以评估其影响和效果。首先，在同一端点后部署新模型作为第二个变体：

```sql
# Step1: Create a model from JumpStart
model_b_name  ="sagemaker-strands-demo-qwen3-8b"
model_b_id, model_b_version = "huggingface-reasoning-qwen3-8b", "1.0.0"

model_8b = JumpStartModel(
    model_id="huggingface-reasoning-qwen3-8b",  
    model_version="1.0.0",
    name=model_b_name
)
model_b.create(instance_type="ml.g5.2xlarge")

# Step2: Create production variants for A/B testing
# Create production variants for A/B testing
production_variants = [
   # The original model (champion)
   {
         "VariantName": "qwen-4b-variant",
         "ModelName": "qwen3-4b-model",
         "InitialInstanceCount": 1,
         "InstanceType": "ml.g5.2xlarge",
         "InitialVariantWeight": 0.5   # It will take 50% of the traffic
    },
   # The new model (challenger)
    {
         "VariantName": "qwen3-8b-variant",
         "ModelName": model_b_name,
         "InitialInstanceCount": 1,
         "InstanceType": "ml.g5.2xlarge",
         "InitialVariantWeight": 0.5   # It will take 50% of the traffic
    }
]

# Step3: Create new endpoint configuration
sagemaker_client = boto3.client('sagemaker')
ENDPOINT_CONFIG_AB_TESTING = "llm-endpoint-config-ab"
sagemaker_client.create_endpoint_config(
    EndpointConfigName=ENDPOINT_CONFIG_AB_TESTING,
    ProductionVariants=production_variants
)
# Step4: Update the endpoint with new A/B testing configuration
sagemaker_client.update_endpoint(
    EndpointName=ENDPOINT_NAME, #Remember, the endpoint name stays the same
    EndpointConfigName=ENDPOINT_CONFIG_AB_TESTING
)
# Wait until the update is completed
waiter = boto3.client('sagemaker').get_waiter('endpoint_in_service')
waiter.wait(EndpointName=ENDPOINT_NAME)
```

更新完成后，您用该端点创建的 agent 将以 50/50 的概率使用两个 LLM。为了进行受控实验，您可以创建两个分别指向特定变体的新 agent。

```python
from strands.models.sagemaker import SageMakerAIModel
from strands import Agent, tool
from strands_tools import http_request, calculator

model_sagemaker_a = SageMakerAIModel(
    endpoint_config={
        "endpoint_name": ENDPOINT_NAME,
        "region_name": region,
        "target_variant":"qwen-4b-variant"
    },
    payload_config={
        "max_tokens": 2048,
        "temperature": 0.2,
        "stream": True,
    }
)

model_sagemaker_b = SageMakerAIModel(
    endpoint_config={
        "endpoint_name": ENDPOINT_NAME,
        "region_name": region,
        "target_variant":"qwen-8b-variant"
    },
    payload_config={
        "max_tokens": 2048,
        "temperature": 0.2,
        "stream": True,
    }
)
```

## 使用 MLflow GenAI 通过模型变体评估 Agent

将两个模型变体部署在 A/B 测试端点后，下一步是在 Strands Agents 中使用它们。这两个 agent 除了模型本身外，其他方面完全相同。然后，我们将使用 MLflow 的 GenAI 评估框架对这些 agent 进行系统评估，该框架提供了一种使用自定义指标和基于 LLM 的评判者的结构化方法。

### 创建评估数据集

为了客观评估 agent 性能，您需要一组能够代表真实工作负载的一致测试用例。评估数据集中的每个条目都包含输入查询及期望值——评分者用来评估 agent 是否正确响应的基准值。这种结构有助于跨模型变体进行可重复的评估。

```css
eval_dataset = [
    {
        "inputs": {"query": "Calculate 15% tip on a $85.50 bill. Use calculator tool"},
        "expectations": {
            "expected_tool": "calculator",
            "expected_facts": ["The tip amount is approximately $12.83"]
        }
    },
    {
        "inputs": {"query": "What is 2048 divided by 64? Use calculator tool"},
        "expectations": {
            "expected_tool": "calculator",
            "expected_facts": ["The answer is 32"]
        }
    }
    # Add more test cases...
]
```

### 定义评估评分者

评分者决定如何将 agent 响应与您的期望进行评估。MLflow 支持自定义评分者（用于确定性检查，如验证是否使用了正确的工具）和内置的 LLM 评判者（用于评估主观质量，如事实正确性和相关性）。结合这些评分者类型有助于提供对 agent 性能的全面视图，从基本能力验证到细微的响应质量评估。

```python
from mlflow.genai.scorers import scorer, Correctness, RelevanceToQuery
from mlflow.entities import Feedback

@scorer
def tool_selection_scorer(inputs, outputs, expectations):
    expected_tool = expectations.get("expected_tool", "")
    tool_used = expected_tool in outputs.get("tools", [])
    return Feedback(name="tool_selection", value=1.0 if tool_used else 0.0)
```

### 运行评估

定义了数据集和评分者之后，您现在可以针对每个模型变体运行评估。`mlflow.genai.evaluate()` 函数在每个测试用例上运行您的 agent，应用评分者评估响应，并将结果记录到 MLflow 进行分析。为每个变体分别运行评估有助于确保您可以在相同条件下直接比较它们的性能。

```python
import mlflow
from strands import Agent
from strands_tools import calculator

mlflow.set_experiment("Strands_Agents_AB_Evaluation")

def predict_4b(query):
    agent = Agent(model=model_sagemaker_a, tools=[calculator])
    response = agent(query)
    return {"outputs": str(response), "tools": list(response.metrics.tool_metrics.keys())}

def predict_8b(query):
    agent = Agent(model=model_sagemaker_b, tools=[calculator])
    response = agent(query)
    return {"outputs": str(response), "tools": list(response.metrics.tool_metrics.keys())}

scorers = [
    tool_selection_scorer,
    Correctness(model="bedrock:/us.amazon.nova-pro-v1:0"),
    RelevanceToQuery(model="bedrock:/us.amazon.nova-pro-v1:0")
]
eval_results_4b = mlflow.genai.evaluate(data=eval_dataset, predict_fn=predict_4b, scorers=scorers)
eval_results_8b = mlflow.genai.evaluate(data=eval_dataset, predict_fn=predict_8b, scorers=scorers)
```

### 比较结果

两次评估完成后，您可以比较汇总指标，以确定哪个模型变体在您的特定工作负载上表现更好。这种比较提供了数据驱动的证据，使您能够做出明智的模型选择决策，而不是依赖假设或通用基准。

```python
metrics_4b = eval_results_4b.metrics
metrics_8b = eval_results_8b.metrics

for metric in metrics_4b: print(f"{metric}: 
    4B={metrics_4b[metric]:.3f}, 8B={metrics_8b[metric]:.3f}")
```

您还可以通过导航到 MLflow UI 的**Evaluations**选项卡并选择两个运行进行并排分析，查看详细的比较结果。

![MLflow 3.4.0 A/B 测试比较，显示两个 agent 变体在数学查询测试中的正确性和相关性得分均为 100%](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/07/ml-19842-image-9.png)

## 过渡到新模型

如果新模型被证明更好，您可以通过调整权重来过渡到新模型：

```css
production_variants = [
    {
        "VariantName": "qwen-8b-variant",
        "ModelName": model_b_name,
        "InitialInstanceCount": 1,
        "InstanceType": "ml.g5.2xlarge",
        "InitialVariantWeight": 1
    }
]
```

## 使用 MLflow 追踪调试问题

如果遇到 **"ImportError: cannot import name 'TokenUsageKey' from 'mlflow.tracing.constant' (/opt/conda/lib/python3.12/site-packages/mlflow/tracing/constant.py)"** 或其他在 MLflow 中追踪 Strands Agents 的问题，请检查以下内容：

- 检查已安装的 MLflow 版本，应为 3.4.0 或更高版本。
- 确保您用于执行 Strands Agent 的角色具有以下权限：
  - 读取、写入和列出用作 MLflow Tracking Server 工件位置的 s3:bucket
  - 访问 MLflow App

## 清理已创建的资源

以下代码将删除您创建的 SageMaker AI 端点和 MLflow App。

```
# Delete the endpoint
sagemaker_client.delete_endpoint(EndpointName=ENDPOINT_NAME)
sagemaker_client.delete_endpoint_config(EndpointConfigName=INITIAL_CONFIG_NAME)
sagemaker_client.delete_endpoint_config(EndpointConfigName=ENDPOINT_CONFIG_AB_TESTING)


# Delete MLflow App
sagemaker_client.delete_mlflow_app(
    Arn=server_info["Arn"]
)
```

## 结论

本文探讨了如何使用 Strands Agents SDK 结合部署在 Amazon SageMaker AI 端点上的模型来构建 AI agent，同时使用 SageMaker AI Serverless MLflow 进行全面的 agent 可观测性。这种方法为组织提供了对其 AI 基础架构更大的灵活性和控制力。在 SageMaker AI 上部署模型，可以精确控制计算资源、网络配置和扩缩策略，这对于有特定性能、成本或合规要求的组织尤为有价值。与 MLflow 的集成提供了强大的可观测性功能，让您能够追踪 agent 行为、监控性能指标并维护审计追踪。Strands Agents SDK、SageMaker AI 和 MLflow 的组合创建了一个强大的框架，用于构建、部署和监控 AI agent，您可以对其进行定制以满足特定业务需求。

### 后续步骤

若要开始使用这种方法构建您自己的 AI agent，我们推荐以下资源：

- 了解更多关于 [Amazon SageMaker AI](https://aws.amazon.com/sagemaker/) 及其模型部署和管理能力
- 探索 [Strands Agents SDK](https://strandsagents.com/latest/documentation/docs/) 以了解如何构建和定制 AI agent
- 深入了解 [SageMaker Serverless MLflow](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow.html) 以实现全面的 agent 可观测性
- 查阅 [Amazon Bedrock 或 Amazon SageMaker AI 决策指南](https://docs.aws.amazon.com/decision-guides/latest/bedrock-or-sagemaker/bedrock-or-sagemaker.html) 以了解哪种服务适合您的用例

按照本文中概述的步骤，您可以构建出能够充分利用 SageMaker AI 灵活基础架构和 MLflow 全面可观测性功能的精密 AI agent。我们期待看到您将构建出什么！

## 关于作者

**Dheeraj Hegde** 是 Amazon Web Services 的高级专家解决方案架构师，专注于生成式 AI 和机器学习。他帮助客户设计和构建 AI agent 及 agentic 架构，利用其深厚的机器学习背景提供生产就绪的生成式 AI 解决方案。

**Gi Kim** 是 Amazon Web Services 的高级专家解决方案架构师，专注于生成式 AI 和机器学习。他与客户合作，在 AWS 上构建智能的基于 agent 的系统，将其机器学习专业知识与推动自主 AI agent 极限的热情相结合。

## 引用

- 原文：[Build Strands Agents with SageMaker AI models and MLflow](https://aws.amazon.com/blogs/machine-learning/build-strands-agents-with-sagemaker-ai-models-and-mlflow/)
- [Strands Agents SDK](https://strandsagents.com/)
- [Amazon SageMaker JumpStart](https://aws.amazon.com/sagemaker/ai/jumpstart/)
- [SageMaker AI MLflow 文档](https://docs.aws.amazon.com/sagemaker/latest/dg/mlflow.html)
