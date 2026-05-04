---
title: 大规模管理 Agent 记忆：AgentCore Memory 中的命名空间设计模式
pubDatetime: 2026-05-04T10:00:00+08:00
description: 本文介绍如何在 Amazon Bedrock AgentCore Memory 中设计命名空间层次结构、选择正确的检索模式，并实现基于 IAM 的访问控制，帮助开发者构建高效的 Agent 记忆系统。
slug: agentcore-memory-namespace-design-patterns-zh
originalTitle: "Organizing Agents' memory at scale: Namespace design patterns in AgentCore Memory"
originalUrl: https://aws.amazon.com/blogs/machine-learning/organizing-agents-memory-at-scale-namespace-design-patterns-in-agentcore-memory/
tags:
  - AI
  - AWS
  - AgentCore
  - Memory
---

原文标题：Organizing Agents' memory at scale: Namespace design patterns in AgentCore Memory<br>
原文链接：https://aws.amazon.com/blogs/machine-learning/organizing-agents-memory-at-scale-namespace-design-patterns-in-agentcore-memory/

在构建 AI Agent 时，开发者往往难以跨会话组织记忆，这会导致检索到不相关的上下文，并引发安全漏洞。跨会话记忆上下文的 AI Agent 所需要的不仅仅是存储。它们需要有组织的、可检索的、安全的记忆。在 Amazon Bedrock AgentCore Memory 中，*命名空间*决定了长期记忆记录的组织方式、检索方式以及访问权限。正确设计命名空间对于构建有效的记忆系统至关重要。

本文将介绍如何设计命名空间层次结构、选择正确的检索模式，以及为 AgentCore Memory 实现基于 AWS Identity and Access Management (IAM) 的访问控制。如果你是 AgentCore Memory 的新用户，建议先阅读我们的入门博客：[Amazon Bedrock AgentCore Memory: Building context-aware agents](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-agentcore-memory-building-context-aware-agents/)。

## 什么是命名空间？

*命名空间*是在 AgentCore Memory 资源中组织长期记忆记录的层次路径。可以把它们想象成文件系统中的目录路径。它们提供逻辑结构、支持作用域检索，并支持访问控制。

当 AgentCore Memory 从你的对话中提取长期记忆记录时，每条记忆记录都会存储在一个命名空间下。例如，用户偏好可能存放在 `/actor/customer-123/preferences/` 下，而会话摘要则可能存储在 `/actor/customer-123/session/session-789/summary/`。通过这种结构，你可以以精确的粒度检索记忆记录。

如果你曾使用过 Amazon DynamoDB 中的分区键或 Amazon Simple Storage Service (Amazon S3) 中的文件夹结构，这个思维模型可以很好地迁移过来。正如你在选择分区键或设计 S3 文件夹层次结构之前会思考访问模式一样，在设计命名空间结构之前，你也应该思考检索模式。需要确定：

- 谁需要访问这些记忆：单个用户？某个 Agent 的所有用户？
- 所需的检索粒度：是按会话的摘要？跨会话的偏好？
- 重要的隔离边界：一个用户的记忆是否应该对另一个用户可见？Agent 作用域的记忆？

与分区键的主要区别在于，命名空间除了支持精确匹配外，还支持层次检索。你可以在层次结构的每一层进行查询，而不仅仅是叶子层级。通过精心设计的命名空间，你可以从同一个记忆资源中检索限定在单个会话、跨会话的单个用户或更广泛分组的记忆记录。命名空间是同一底层存储中的逻辑分组。它们提供组织结构和访问控制，但不同命名空间的长期记忆记录共存于同一记忆资源中。你的层次结构是组织数据以实现有效检索模式的主要工具。

## 命名空间模板与解析

创建记忆资源时，你可以在每个策略配置的 `namespaceTemplate` 字段中定义命名空间模板。模板支持三个预定义变量：

- `{actorId}` – 解析为正在处理的事件中的 actor 标识符
- `{sessionId}` – 解析为事件中的会话标识符
- `{memoryStrategyId}` – 解析为策略标识符

下面是一个使用命名空间模板创建记忆资源的示例：

```
response = agentcore_client.create_memory(
    name="CustomerSupportMemory",
    description="Memory for customer support agents",
    eventExpiryDuration=30,
    memoryStrategies=[
        {
            "semanticMemoryStrategy": {
                "name": "customer-facts",
                "namespaceTemplate": "/actor/{actorId}/facts/"
            }
        },
        {
            "summaryMemoryStrategy": {
                "name": "session-summaries",
                "namespaceTemplate": "/actor/{actorId}/session/{sessionId}/summary/"
            }
        }
    ]
)
```

当 `actorId=customer-456`、`sessionId=session-789` 的事件到达时，解析后的命名空间变为：

- `/actor/customer-456/facts/`
- `/actor/customer-456/session/session-789/summary/`

## 按记忆策略设计命名空间

每种记忆策略有不同的作用域需求，命名空间设计应反映该数据的访问方式。以下是针对不同记忆策略的一些常见命名空间设计模式。

### 1. 语义记忆和用户偏好：Actor 作用域

语义记忆捕获对话中的事实和知识（例如"客户公司有 500 名员工"）。用户偏好记忆捕获选择和风格（例如"用户倾向于使用 Python 进行开发工作"）。这两种记忆类型会随时间累积，且跨会话保持相关性。一月份学到的事实在三月份应该仍然可以检索。对于这些策略，将命名空间限定在 actor 上：

```
/actor/{actorId}/facts/
/actor/{actorId}/preferences/
```

这意味着给定用户的事实和偏好被整合在单个命名空间下，无论它们是从哪个会话中提取的。整合引擎会合并同一命名空间内相关的记忆。图 1 展示了作用域如何影响整合逻辑的示例。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/24/ML-20833-image-1.png)

下图展示了 actor 作用域的语义记忆和偏好记忆的组织方式：

```
Memory Resource: CustomerSupportMemory
│
├── /actor/customer-123/
│   ├── facts/
│   │   ├── "Company has 500 employees across Seattle, Austin, Boston"
│   │   ├── "Currently migrating from on-premises to cloud"
│   │   └── "Primary contact is the VP of Engineering"
│   └── preferences/
│       ├── "Prefers email communication over phone"
│       └── "Usually prefers detailed technical explanations"
│
├── /actor/customer-456/
│   ├── facts/
│   │   ├── "Startup with 20 employees"
│   │   └── "Using serverless architecture"
│   └── preferences/
│       └── "Prefers concise, high-level summaries"
```

在某些使用场景中，管理员可能需要跨 actor 检索信息，同时保持记忆按 actor 组织。例如，客户支持 Agent 可能需要查找其他客户反映的已知问题，或者销售 Agent 可能需要在用户群中查找相似的客户画像。对于此类场景，将命名空间结构设计为以 actor 标识符作为记忆类型的子级而非父级：

```
/customer-issues/{actorId}/
/sales/{actorId}/
```

通过这种反转结构，你可以使用 `namespacePath="/customer-issues/"` 检索所有客户反映的常见问题，同时仍保持按 actor 的组织方式。限定到 `namespace="/customer-issues/customer-123/"` 的查询只会返回该 actor 的已报告问题，在需要时保持隔离。

### 2. 摘要：会话作用域

摘要记忆创建对话的叙述，捕获要点和决策。与其将整个对话历史输入到大型语言模型 (LLM) 的上下文窗口，不如检索一个紧凑的摘要，在显著减少 token 使用的同时保留关键信息。由于摘要本质上与特定对话相关，它们应包含会话标识符：`/actor/{actorId}/session/{sessionId}/summary/`。这种作用域意味着每个会话都有自己的摘要，同时仍在 actor 下进行组织，以便在需要时进行跨会话检索。

```
Memory Resource: CustomerSupportMemory
│
├── /actor/customer-123/
│   ├── session/session-001/summary/
│   │   └── "Customer inquired about enterprise pricing, discussed
│   │        implementation timeline, requested follow-up demo"
│   ├── session/session-002/summary/
│   │   └── "Follow-up on demo scheduling, confirmed Q3 timeline,
│   │        discussed integration requirements with existing CRM"
│   └── session/session-003/summary/
│       └── "Technical deep-dive on API integration, reviewed
│            authentication options, chose OAuth 2.0 approach"
```

### 3. 情节记忆：带反思层次的会话作用域

情节记忆捕获完整的推理轨迹，包括目标、采取的步骤、结果和反思。由于每个情节代表特定交互期间发生的事情，情节应限定到会话，与摘要类似。例如，一个航班预订 Agent 可能会存储一个情节，捕获它如何搜索航班、比较选项、处理舱位限制，并最终将客户重新预订到替代航线。该情节属于它发生的会话。反思是存储在父级的跨情节洞察。它们对跨会话的学习进行概括，例如"当舱位限制阻止修改时，立即搜索替代航班，而不仅仅是解释政策"。反思的命名空间必须是情节命名空间的子路径：

```
Episodes:    /actor/{actorId}/session/{sessionId}/episodes/
Reflections: /actor/{actorId}/
```

## 检索模式

### 检索 API

AgentCore Memory 为长期记忆提供三个主要检索 API，每个 API 适合不同的访问模式。选择正确的 API 是构建有效 Agent 的关键。

#### 1. 使用 RetrieveMemoryRecords 进行语义搜索

使用 `RetrieveMemoryRecords` 查找与查询语义相关的记忆。这是 Agent 交互期间的主要检索方法，基于含义而非精确文本匹配来呈现最相关的记忆。

```
# Retrieve memories relevant to the current user query
memories = agentcore_client.retrieve_memory_records(
    memoryId="mem-12345abcdef",
    namespace="/actor/customer-123/facts/",
    searchCriteria={
        "searchQuery": "What cloud migration approach is the customer using?",
        "topK": 5
    }
)
```

搜索查询可以来自两个来源：

- **直接来自用户查询** – 当用户的问题自然映射到记忆中存储的信息类型时，直接传递用户的问题。例如，如果用户问"我的预算是多少？"，该查询很适合用于检索偏好或事实记忆。
- **LLM 生成的查询** – 对于更复杂的场景，让你的 Agent 的 LLM 生成一个有针对性的搜索查询。当用户的原始输入与存储的记忆不直接对应时，这很有用。例如，如果用户说"帮我规划下次旅行"，LLM 可能会生成一个搜索查询，如"旅行偏好、目的地历史、预算限制"，以检索最相关的记忆。请注意，这会增加延迟。

#### 2. 使用 ListMemoryRecords 进行直接检索

当你需要枚举特定命名空间内的记忆时，使用 `ListMemoryRecords`，例如在控制台 UI 中显示用户存储的偏好、审计存在哪些记忆，或执行批量操作。

```
# List all memories in a specific namespace
records = agentcore_client.list_memory_records(
    memoryId="mem-12345abcdef",
    namespace="/actor/customer-123/preferences/"
)
```

#### 3. GetMemoryRecord 和 DeleteMemoryRecord

当你知道特定记忆记录 ID（例如，从之前的列表或检索调用中获取），使用 `GetMemoryRecord` 进行直接查找，或使用 `DeleteMemoryRecord` 删除特定记忆：

```
# Get a specific memory record
record = agentcore_client.get_memory_record(
    memoryId="mem-12345abcdef",
    memoryRecordId="rec-abc123"
)

# Delete a specific memory record
agentcore_client.delete_memory_record(
    memoryId="mem-12345abcdef",
    memoryRecordId="rec-abc123"
)
```

这些适用于记忆管理工作流，用于帮助用户通过应用程序 UI 查看、更正或删除特定记忆。

### Namespace 与 NamespacePath：精确匹配与层次检索

AgentCore Memory 提供两个不同的字段用于限定检索范围，理解其区别对于正确行为至关重要。

![](https://d2908q01vomqb2.cloudfront.net/f1f836cb4ea6efb2a0b1b99f41ad8b103eff4b59/2026/04/24/ML-20833-image-2.png)

#### 1. namespace — 精确匹配

`namespace` 字段执行**精确匹配**。它只返回存储在该精确命名空间路径下的记忆记录。

```
# Returns ONLY records stored at /actor/customer-123/facts/
records = agentcore_client.retrieve_memory_records(
    memoryId="mem-12345abcdef",
    namespace="/actor/customer-123/facts/",
    searchCriteria={
        "searchQuery": "cloud migration",
        "topK": 5
    }
)
```

当你确切知道要查询哪个命名空间并需要精确作用域时，这是正确的选择。例如，仅检索用户的偏好而不拉取他们的事实或摘要。

#### 2. namespacePath — 层次检索

`namespacePath` 字段执行**层次匹配**，返回命名空间位于指定路径下的记忆记录。

```
# Returns records from
# /actor/customer-123/facts/,
# /actor/customer-123/preferences/,
# /actor/customer-123/session/*/summary/, etc.
records = agentcore_client.retrieve_memory_records(
    memoryId="mem-12345abcdef",
    namespacePath="/actor/customer-123/",
    searchCriteria={
        "searchQuery": "cloud migration",
        "topK": 5
    }
)
```

当你希望跨用户的所有类型记忆进行搜索，或构建"显示我们对该客户所了解的一切"这类功能时，这很有用。请注意，需要仔细考虑你的隔离和检索模式，确保树遍历不会暴露无意公开的数据。

### 何时使用哪种方式

| 场景 | API | 字段 | 示例 |
|------|-----|------|------|
| 1 | 检索语义上相关的用户偏好 | RetrieveMemoryRecords | namespace | /actor/customer-123/preferences/ |
| 2 | 检索特定会话摘要 | ListMemoryRecords | namespace | /actor/customer-123/session/session-001/summary/ |
| 3 | 列出用户的所有偏好 | ListMemoryRecords | namespace | /actor/customer-123/preferences/ |
| 4 | 跨用户所有记忆进行搜索 | RetrieveMemoryRecords | namespacePath | /actor/customer-123/ |
| 5 | 列出用户跨会话的摘要 | ListMemoryRecords | namespacePath | /actor/customer-123/session/ |

### 为命名空间访问控制编写 IAM 策略

命名空间通过条件键与 AWS Identity and Access Management (IAM) 集成，这些条件键限制主体可以在 Memory API 请求中包含哪些命名空间。

#### 1. 精确匹配策略

使用 `StringEquals` 与 `bedrock-agentcore:namespace` 条件键，将访问限制到特定命名空间：

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:RetrieveMemoryRecords",
        "bedrock-agentcore:ListMemoryRecords"
      ],
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:123456789012:memory/mem-12345abcdef",
      "Condition": {
        "StringEquals": {
          "bedrock-agentcore:namespace": "/actor/${aws:PrincipalTag/userId}/preferences/"
        }
      }
    }
  ]
}
```

该策略确保用户只能从自己的偏好命名空间检索记忆，使用 `userId` 主体标签（注入）进行动态作用域划分。

#### 2. 层次检索策略

使用 `StringLike` 与 `bedrock-agentcore:namespacePath` 条件键进行层次访问：

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:RetrieveMemoryRecords",
        "bedrock-agentcore:ListMemoryRecords"
      ],
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:123456789012:memory/mem-12345abcdef",
      "Condition": {
        "StringLike": {
          "bedrock-agentcore:namespacePath": "/actor/${aws:PrincipalTag/userId}/*"
        }
      }
    }
  ]
}
```

通过这种方式，用户可以对其命名空间（事实、偏好、摘要）进行层次检索，同时帮助防止访问其他用户的数据。

## 结论

命名空间设计是使用 AgentCore Memory 构建有效记忆系统的基础。就像为数据库设计键模式或为对象存储设计前缀结构一样，提前规划访问模式有助于你创建支持精确检索、用户间清晰隔离以及基于 IAM 访问控制的命名空间层次结构。关键要点：

- 在制定命名空间模板之前，**规划你的访问模式和隔离边界**
- 将语义记忆和偏好记忆**限定到 actor**（`/actor/{actorId}/`）以实现跨会话整合
- 将摘要**限定到会话**（`/actor/{actorId}/session/{sessionId}/`），因为它们特定于某次对话（在需要的地方，如摘要或情节）
- 当你知道精确路径时**使用 `namespace` 进行精确匹配**，当需要在子树中搜索时**使用 `namespacePath` 进行层次检索**
- 在命名空间路径中**使用前导和尾部斜杠**以保持一致性，并帮助防止前缀冲突
- **使用 IAM 条件键**（`bedrock-agentcore:namespace` 和 `bedrock-agentcore:namespacePath`）控制可以请求哪些命名空间

要开始使用，请访问以下资源：

- [AgentCore Memory Organization Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-organization.html)
- [Agentcore Memory: Long term memory organization documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/specify-long-term-memory-organization.html)
- [AWS Samples GitHub Repository](https://github.com/awslabs/agentcore-samples/tree/main/01-tutorials/04-AgentCore-memory)

## 引用

- 原文：[Organizing Agents' memory at scale: Namespace design patterns in AgentCore Memory](https://aws.amazon.com/blogs/machine-learning/organizing-agents-memory-at-scale-namespace-design-patterns-in-agentcore-memory/)
- [Amazon Bedrock AgentCore Memory: Building context-aware agents](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-agentcore-memory-building-context-aware-agents/)
- [AgentCore Memory Organization Documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-organization.html)
