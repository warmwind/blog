---
title: 为 Amazon Bedrock Knowledge Bases 构建并部署自动同步方案
pubDatetime: 2026-04-28T11:00:00+08:00
description: 本文介绍一种事件驱动的自动同步方案，结合 EventBridge、Lambda、SQS、Step Functions 和 DynamoDB，在遵守服务配额的同时，将 S3 文档变更实时同步到 Amazon Bedrock Knowledge Bases。
slug: bedrock-knowledge-bases-auto-sync-zh
originalTitle: Build and deploy an automatic sync solution for Amazon Bedrock Knowledge Bases
originalUrl: https://aws.amazon.com/blogs/machine-learning/build-and-deploy-an-automatic-sync-solution-for-amazon-bedrock-knowledge-bases/
---

原文标题：Build and deploy an automatic sync solution for Amazon Bedrock Knowledge Bases<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/build-and-deploy-an-automatic-sync-solution-for-amazon-bedrock-knowledge-bases/

![Build and deploy an automatic sync solution for Amazon Bedrock Knowledge Bases](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/27/ml-18250.png)

借助 [Amazon Bedrock Knowledge Bases](https://aws.amazon.com/bedrock/knowledge-bases/)，您可以为[基础模型](https://aws.amazon.com/what-is/foundation-models/)（FM）和 agent 提供来自组织私有数据源的上下文信息，以提供更相关、更准确且更个性化的响应。随着数据的增长，保持 [Amazon Simple Storage Service](https://aws.amazon.com/s3/)（Amazon S3）与知识库之间的实时同步，对于提供准确、最新的响应变得至关重要。

本文探讨一种自动化方案，该方案能够检测 S3 事件并触发摄取作业，同时遵守[服务配额](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html)并提供全面的监控。此无服务器方案使用事件驱动架构，在不超出 Amazon Bedrock API 限制的情况下，保持您的知识库持续更新。

## 挑战

Amazon Bedrock 中的知识库需要在 S3 中添加、修改或删除文档（包括元数据文件）时进行手动同步。组织需要自动同步来满足以下需求：频繁内容更新、团队全天上传文档的多用户环境、需要立即访问最新信息的实时应用程序（如客户支持系统），以及通过消除易于延迟或被遗忘的手动同步流程来提升运营效率。为了实现可靠的自动化，组织必须在遵守 Amazon 服务配额和速率限制的同时，精心编排同步操作。

## 服务设计考量

在实现自动同步时，客户必须考虑 Amazon Bedrock 的保护性约束。Amazon Bedrock 服务配额对并发摄取作业的限制为：

- 每个 AWS 账户 5 个作业（有助于防止资源耗尽）
- 每个知识库 1 个作业（促进专注处理）
- 每个数据源 1 个作业（维护数据一致性）

有关 Amazon Bedrock 服务配额的更多信息，请参阅 Amazon Bedrock 参考指南中的 [Amazon Bedrock 服务配额](https://docs.aws.amazon.com/general/latest/gr/bedrock.html#limits_bedrock)。这些限制特定于每个 [AWS 区域](https://docs.aws.amazon.com/glossary/latest/reference/glos-chap.html#region)，未来可能会变化，请参阅文档以获取最新的配额信息。

针对知识库的 [StartIngestionJob API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_StartIngestionJob.html) 在每个支持的区域中的速率限制为每秒 0.1 个请求（每 10 秒 1 个请求）。

假设内容团队在发布期间更新多个文件。如果没有协调，同步请求会因服务限制而排队，需要手动监督。协调化的方法能够无缝处理这种情况，确保在遵守服务约束的同时高效处理变更。

## 方案概述

此事件驱动方案自动将您的 Amazon S3 文档与 Amazon Bedrock Knowledge Bases 同步。当文档在您的 S3 存储桶中添加、修改或删除时（包括元数据文件），该方案会自动触发同步作业，同时遵守服务配额和速率限制。该方案使用简化的 [AWS Serverless Application Model](https://aws.amazon.com/serverless/sam/)（AWS SAM）部署，并以完全无服务器架构运行，无需进行基础架构管理。

该方案实现了一种事件驱动架构，结合关键 AWS 服务，在智能管理摄取作业的同时实时处理 Amazon S3 变更。以下组件协同工作，在遵守服务配额的同时实现可靠同步：

1. [Amazon EventBridge](https://aws.amazon.com/eventbridge/) 捕获来自 Amazon S3 的实时变更
2. [AWS Lambda](https://aws.amazon.com/lambda/) 函数处理事件并管理同步
3. [Amazon Simple Queue Service](https://aws.amazon.com/sqs/)（Amazon SQS）队列缓冲请求以遵守服务配额
4. [AWS Step Functions](https://aws.amazon.com/step-functions/) 编排同步工作流
5. [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) 跟踪文档变更和作业元数据

下图展示了该方案如何使用 AWS 服务创建事件驱动的同步系统。

![AWS 架构图，展示使用 AWS Step Functions、Lambda、Amazon S3、EventBridge、SQS、Amazon Bedrock、DynamoDB、CloudWatch 和 SNS 进行事件驱动的知识库摄取和监控的自动化文档同步工作流](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/16/ML-18250-image-1.png)

该方案架构由五个相互连接的组件组成，协同工作以管理完整的同步工作流。让我们探讨每个组件在系统中的功能，并通过代码示例说明这个即用型方案背后的技术实现。

### 阶段 1：文档变更检测

初始阶段建立 S3 存储桶中文档变更的自动检测和处理机制。此阶段执行的主要操作如下：

1. **EventBridge 捕获 S3 事件** – 上传、修改或删除文档时，S3 自动向 EventBridge 发送事件
2. **Lambda 顺序处理事件** – EventBridge 触发事件处理器 Lambda 函数，该函数提取文档元数据（文件路径、变更类型和时间戳），并在 DynamoDB 中创建跟踪条目用于审计目的
3. **SQS 将同步请求排队** – 同一个 Lambda 函数立即向 Amazon SQS 发送同步请求消息，该消息缓冲请求以管理速率限制并实现可靠处理

以下代码展示了事件处理器 Lambda 函数如何处理传入的 S3 事件并协调跟踪和排队过程：

```python
# Event Processor Lambda extracts change information
def lambda_handler(event, context):
    for record in event.get('Records', []):
        # Extract S3 information
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        event_name = record['eventName']
        
        # Determine change type
        change_type = get_change_type(event_name)
        
        # Create tracking entry in DynamoDB
        tracking_table.put_item(
            Item={
                'change_id': str(uuid.uuid4()),
                'knowledge_base_id': kb_id,
                'change_type': change_type,
                'key': key,
                'processed': False,
                'timestamp': datetime.utcnow().timestamp()
            }
        )
        
        # Send immediate notification to SQS
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps({
                'change_type': change_type,
                'bucket': bucket,
                'key': key,
                'knowledge_base_id': kb_id
            })
        )
```

### 阶段 2：队列管理

为了保持一致的处理并遵守服务配额，该方案实现了一个队列机制来管理文档变更请求。队列管理阶段涉及以下关键步骤：

1. **Amazon SQS 缓冲请求** – 来自阶段 1 的消息被排队，以确保满足同步作业请求之间的速率限制
2. **Lambda 处理消息** – 同步处理器 Lambda 函数一次从 SQS 队列中消费一条消息
3. **工作流启动** – 每条消息触发一个新的 Step Functions 执行，包含文档变更详情和知识库配置

以下代码演示了同步处理器 Lambda 函数如何消费 SQS 消息并启动编排工作流：

```python
def lambda_handler(event, context):
    for record in event.get('Records', []):
        message = json.loads(record['body'])
        kb_id = message['knowledge_base_id']
        
        # Get or discover data source ID
        data_source_id = get_data_source_id(kb_id)
        
        # Start Step Functions workflow
        sfn_input = {
            'knowledge_base_id': kb_id,
            'data_source_id': data_source_id,
            'message': message
        }
        
        response = sfn.start_execution(
            stateMachineArn=STEP_FUNCTION_ARN,
            name=f"sync-{kb_id}-{int(datetime.utcnow().timestamp())}",
            input=json.dumps(sfn_input)
        )
```

### 阶段 3：编排同步

编排阶段使用 AWS Step Functions 在管理服务配额和处理故障的同时协调同步过程。该工作流包括：

1. **配额验证** – 检查当前区域跨知识库的活跃摄取作业，确认未超过服务限制
2. **条件执行** – 如果配额允许，立即启动同步作业；否则等待 5 分钟后再次检查
3. **作业监控** – 跟踪同步作业进度，处理成功完成和失败场景
4. **错误处理** – 为失败的同步尝试实现重试逻辑和死信队列处理

以下 Step Functions 状态机定义展示了配额管理和作业执行的决策逻辑：

```css
{
  "Comment": "Workflow for syncing documents to Amazon Bedrock Knowledge Base",
  "StartAt": "CheckServiceQuota",
  "States": {
    "CheckServiceQuota": {
      "Type": "Task",
      "Resource": "${CheckQuotaFunctionArn}",
      "Next": "EvaluateQuotaCheck"
    },
    "EvaluateQuotaCheck": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.quota_check.all_quotas_ok",
          "BooleanEquals": true,
          "Next": "StartSyncJob"
        },
        {
          "Variable": "$.quota_check.all_quotas_ok",
          "BooleanEquals": false,
          "Next": "QuotaExceeded"
        }
      ]
    },
    "QuotaExceeded": {
      "Type": "Wait",
      "Seconds": 300,
      "Next": "CheckServiceQuota"
    },
    "StartSyncJob": {
      "Type": "Task",
      "Resource": "${StartSyncFunctionArn}",
      "Next": "MonitorSyncJob"
    }
  }
}
```

### 阶段 4：知识库处理

在此阶段，知识库处理同步的内容并使其可供使用。发生以下步骤：

- **文档处理** – Amazon Bedrock 扫描同步作业期间识别的变更文档
- **向量转换** – 使用已配置的嵌入模型对文档进行分块并转换为向量嵌入
- **索引更新** – 新的嵌入存储在向量数据库中，同时删除过时的嵌入
- **内容可用性** – 更新的内容立即可用于语义搜索和检索

### 阶段 5：监控与告警

最后阶段实现全面的监控和告警，确保方案可靠运行。包括：

- **状态跟踪** – 作业成功完成或失败时，在 DynamoDB 中更新文档变更状态
- **通知交付** – 通过 Amazon SNS 向配置的电子邮件地址或端点发送成功或失败告警
- **性能监控** – [Amazon CloudWatch](https://aws.amazon.com/cloudwatch/) 指标跟踪同步作业持续时间、成功率和配额使用情况
- **自动告警** – 当错误率超过阈值或作业卡住时，CloudWatch 告警会触发

## 关键特性

该方案提供了几项基本功能，有助于在 Amazon S3 和知识库之间实现高效可靠的同步。让我们探讨每个关键特性及其优势。

### 实时事件处理

该方案立即响应 S3 变更。EventBridge 集成实时捕获 S3 事件。该系统通过使用 S3 事件通知自动触发摄取作业，在 Amazon S3 对象变更发生时即时处理。响应迅速，无需等待计划进程。

### 全面的配额管理

该方案遵守 Amazon Bedrock 服务配额：

```python
# Service quotas validation
MAX_CONCURRENT_JOBS_PER_ACCOUNT = 5
MAX_CONCURRENT_JOBS_PER_DATA_SOURCE = 1
MAX_CONCURRENT_JOBS_PER_KB = 1
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 * 1024  # 50 GB
MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024 * 1024  # 100 GB

def check_quotas(kb_id, data_source_id):
    # Get current active jobs
    response = bedrock.list_ingestion_jobs(
        knowledgeBaseId=kb_id,
        dataSourceId=data_source_id
    )
    
    active_jobs = [job for job in response['ingestionJobSummaries'] 
                   if job['status'] in ['STARTING', 'IN_PROGRESS']]
    
    return {
        'all_quotas_ok': len(active_jobs) == 0,
        'kb_quota_ok': len(active_jobs) < MAX_CONCURRENT_JOBS_PER_KB
    }
```

### 智能速率限制

SQS 队列配置实现适当的速率限制：

```ruby
SyncQueue:
  Type: AWS::SQS::Queue
  Properties:
    VisibilityTimeout: 300
    MessageRetentionPeriod: 1209600  # 14 days
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt SyncQueueDLQ.Arn
      maxReceiveCount: 5

SyncProcessorFunction:
  Events:
    SQSEvent:
      Type: SQS
      Properties:
        Queue: !GetAtt SyncQueue.Arn
        BatchSize: 1  # Process one message at a time
```

### 健壮的错误处理

该方案通过针对失败消息的死信队列、针对瞬态故障的自动重试逻辑以及通过 CloudWatch 进行详细日志记录，实现全面的错误处理，以确保可靠运行和简化故障排除。

## 前提条件

在部署此方案之前，请确保您具备以下条件：

- 拥有创建和管理以下服务权限的 AWS 账户：
  - Amazon Bedrock
  - AWS Lambda
  - Amazon EventBridge
  - Amazon SQS
  - AWS Step Functions
  - Amazon DynamoDB
  - Amazon S3
  - [AWS Identity and Access Management](https://aws.amazon.com/iam/)（IAM）角色和策略
- 预先配置的 Amazon Bedrock 知识库，包含：
  - 至少一个连接到 Amazon S3 的数据源
  - 管理 Amazon Bedrock Knowledge Bases 的适当权限
- 在开发机器上安装以下工具：
  - [AWS Command Line Interface](https://aws.amazon.com/cli/)（AWS CLI）2.x 或更高版本。有关安装信息，请参阅[安装或更新到最新版本的 AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)。
  - AWS SAM CLI 1.x 或更高版本。有关安装信息，请参阅[安装 AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)。
  - Python 3.12 或更高版本。请访问 [Python 下载](https://www.python.org/downloads/release/python-3120/)。

基础架构部署的预计时间：5–10 分钟

## 方案演练

本节将逐步介绍在您的 AWS 环境中部署自动同步方案的过程。按照以下步骤部署此方案：

1. 克隆 [GitHub 仓库](https://github.com/aws-samples/sample-automatic-sync-for-bedrock-knowledge-bases)：

```
git clone https://github.com/aws-samples/sample-automatic-sync-for-bedrock-knowledge-bases
cd sample-automatic-sync-for-bedrock-knowledge-bases
```

2. 构建并部署方案：

```
sam build
sam deploy --guided
```

部署期间，系统会提示您提供以下参数：

- Stack Name [`kb-auto-sync`] – CloudFormation 堆栈的名称
- AWS Region [`us-west-2`] – Amazon Bedrock 知识库所在的区域
- KnowledgeBaseId – 您的 Amazon Bedrock 知识库标识符
- S3BucketName – 包含您文档的 S3 存储桶名称
- S3KeyPrefix（可选）– 要同步的特定文件夹前缀（例如，`documents/`）
- NotificationsEmail（可选）– 用于接收同步作业通知的电子邮件地址
- MaxConcurrentJobs [5] – 最大并发同步作业数
- Allow AWS SAM CLI IAM role creation [Y/n] – 创建 IAM 角色的权限
- Save arguments to configuration file [Y/n] – 保存设置以供将来部署使用

以下代码显示了示例输入：

设置 `sam deploy` 的默认参数

===============================

`Stack Name [kb-auto-sync]: my-kb-sync`<br>
`AWS Region [us-west-2]: us-east-1`<br>
`Parameter KnowledgeBaseId: kb-1234567890`<br>
`Parameter S3BucketName: my-document-bucket`<br>
`Parameter S3KeyPrefix: documents/`<br>
`Parameter NotificationsEmail: user@example.com`<br>
`Allow SAM CLI IAM role creation [Y/n]: Y`<br>
`Save arguments to configuration file [Y/n]: Y`

部署完成后将创建必要的资源并输出堆栈详情。

## 成本考量

该方案使用多个 AWS 服务，每个服务都有其定价模型：

- [AWS Lambda 定价](https://aws.amazon.com/lambda/pricing/) – 按请求和计算时间付费
- [Amazon EventBridge 定价](https://aws.amazon.com/eventbridge/pricing/) – 按事件付费
- [Amazon SQS 定价](https://aws.amazon.com/sqs/pricing/) – 按请求付费
- [AWS Step Functions 定价](https://aws.amazon.com/step-functions/pricing/) – 按状态转换付费
- [Amazon DynamoDB 定价](https://aws.amazon.com/dynamodb/pricing/) – 按存储和吞吐量付费
- [Amazon CloudWatch 定价](https://aws.amazon.com/cloudwatch/pricing/) – 按仪表板创建、指标告警和日志存储付费
- [Amazon SNS 定价](https://aws.amazon.com/sns/pricing/) – 按每月 API 请求数付费

以下是每 10,000 个文档的典型使用月度估算成本：

- Lambda 调用：约 $0.20
- EventBridge 事件：约 $1.00
- 其他服务：最低成本

该方案非常适合需要实时文档同步、频繁处理文档更新且需要以最少手动干预进行自动化知识库维护的组织。该过程在真实世界示例中遵循以下操作，其中用户上传文档：

1. 用户在下午 2:00 将文档上传到 Amazon S3
2. EventBridge 立即捕获 S3 事件
3. 事件处理器 Lambda 函数创建跟踪条目并发送 SQS 消息
4. 同步处理器 Lambda 函数收到消息并启动 Step Functions 工作流
5. 配额检查验证知识库没有活跃作业
6. 摄取作业立即启动
7. 监控函数跟踪进度直到下午 2:05 完成
8. 变更在 DynamoDB 中标记为已处理

## 故障排查

同步作业失败和速率限制是常见问题，可按如下方式解决：

- **同步作业失败** – 这可能在权限配置错误或文档大小超过限制时发生。解决方法：
  - 在 Amazon Bedrock 控制台中，在您的知识库数据源同步历史中查看摄取作业警告。
  - 验证 IAM 权限是否正确配置
  - 确认文档大小在允许的限制内
- **速率限制** – 当同时处理过多同步请求或达到服务配额时会发生此情况。解决步骤：
  - 监控 CloudWatch 指标以识别瓶颈
  - 根据需要调整并发设置以保持在限制内

## 清理

为了避免持续产生费用，正确清理此方案创建的资源非常重要。按照以下步骤完成组件的删除。

要使用 AWS SAM 删除堆栈，请输入以下代码：

```
# Interactive deletion (recommended)
sam delete \
    --stack-name kb-auto-sync \
    --region YOUR_REGION
# Or non-interactive deletion
sam delete \
    --stack-name kb-auto-sync \
    --region YOUR_REGION \
    --no-prompts
```

要使用 CloudFormation 删除堆栈，请按照以下步骤操作：

1. 打开 [AWS CloudFormation 控制台](https://console.aws.amazon.com/cloudformation)
2. 选择您的堆栈：`kb-auto-sync`（或您在部署期间选择的自定义名称）
3. 选择**删除**并确认删除
4. 等待堆栈删除完成且无错误

以下资源将在堆栈删除后保留：

- 原始 S3 文档
- Amazon Bedrock 知识库
- CloudWatch 日志（直到保留期限到期）
- 在堆栈外部手动创建的资源

## 结论

此事件驱动的自动同步方案提供了一种实时将 Amazon Bedrock Knowledge Bases 与 S3 文档保持同步的解决方案。通过将即时事件处理与智能配额管理和全面监控相结合，该方案在优化性能的同时确保可靠运行。实时方法非常适合需要立即文档可用性的应用程序，例如客户支持系统、文档系统和知识管理解决方案。

## 后续步骤与附加资源

想了解更多？以下是一些有用的资源，帮助您继续旅程。深度学习：

- [Amazon Bedrock Workshop](https://catalog.us-east-1.prod.workshops.aws/workshops/a4bdb007-5600-4368-81c5-ff5b4154f518/en-US)
- [在组织中实现事件驱动架构的最佳实践](https://aws.amazon.com/blogs/architecture/best-practices-for-implementing-event-driven-architectures-in-your-organization/)

相关方案：

- [自动同步数据到 Amazon Bedrock](https://repost.aws/knowledge-center/bedrock-automatically-sync-data)

文档：

- [Amazon Bedrock 用户指南](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- [Amazon Bedrock Knowledge Bases 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [将数据与 Amazon Bedrock 知识库同步](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-data-source-sync-ingest.html)
- [事件驱动架构入门](https://aws.amazon.com/blogs/compute/getting-started-with-event-driven-architecture/)

支持和社区：

- [Amazon Bedrock 知识库概述](https://repost.aws/search/content?globalSearch=bedrock+knowledgebase)
- [Amazon Bedrock 示例](https://github.com/aws-samples/amazon-bedrock-samples)

## 关于作者

**Manideep Reddy Gillela** 是 Amazon Web Services 的交付顾问——云基础架构架构师。他帮助企业客户设计和实施可扩展、安全且具有成本效益的云解决方案。凭借超过 6 年的云架构和基础架构设计经验，以及对 AWS 上生成式 AI 和 AI/ML 解决方案的专注，他与多个行业的领先组织合作，加速其数字化转型之旅。

**Sushma Nagaraj** 是 Amazon Web Services 的合作伙伴解决方案架构师，拥有超过五年帮助合作伙伴和客户构建安全、可扩展云解决方案的经验。专注于 DevOps 和基础架构自动化，她与战略合作伙伴合作，设计 AWS 优化架构，主导技术研讨会，并提供高影响力的概念验证。她的专业知识还延伸到 AI/ML 领域，支持客户使用 AWS AI 服务构建智能应用程序。

**Luis Felipe Florez Leano** 是 Amazon Web Services 美洲 GenAI 合作伙伴解决方案架构团队的解决方案架构师。在此职位上，他与美洲各地的 AWS 合作伙伴合作，帮助他们在 AWS 上设计、构建和扩展生成式 AI 解决方案，利用其经验支持合作伙伴将其 AI 创新变为现实，重点关注使用 Amazon Bedrock 和其他 AWS AI 服务的实际实现，以及帮助组织把握生成式 AI 的技术和商业机会。

## 引用

- 原文：[Build and deploy an automatic sync solution for Amazon Bedrock Knowledge Bases](https://aws.amazon.com/blogs/machine-learning/build-and-deploy-an-automatic-sync-solution-for-amazon-bedrock-knowledge-bases/)
- [Amazon Bedrock Knowledge Bases](https://aws.amazon.com/bedrock/knowledge-bases/)
- [AWS SAM CLI](https://aws.amazon.com/serverless/sam/)
- [GitHub 示例代码](https://github.com/aws-samples/sample-automatic-sync-for-bedrock-knowledge-bases)
