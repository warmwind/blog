---
title: 单 Agent 与多 Agent：何时构建多 Agent 系统
pubDatetime: 2026-05-05T09:00:00+08:00
description: 深入解析 AI Agent 的核心组件、ReAct 工作流程，以及单 Agent 与多 Agent 架构的区别，帮助你做出正确的系统设计选择。
slug: single-agent-vs-multi-agent-zh
originalTitle: "Single Agent vs Multi-Agent: When to Build a Multi-Agent System"
originalUrl: https://towardsdatascience.com/single-agent-vs-multi-agent-when-to-build-a-multi-agent-system/
---

原文标题：Single Agent vs Multi-Agent: When to Build a Multi-Agent System<br>
原文链接：https://towardsdatascience.com/single-agent-vs-multi-agent-when-to-build-a-multi-agent-system/

## AI Agent

在构建 AI Agent 时，设计选择至关重要。对于简单直接的任务，单个 Agent 可能就足够了；而更复杂的工作流可能需要多个专业化 Agent 协同工作，每个 Agent 负责流程中的特定部分，例如检索、写作、验证、编码、测试或审查。

本文解释了 AI Agent 设计的核心组件、ReAct 方法、单 Agent 与多 Agent 架构之间的区别，以及如何根据任务选择正确的设计。文中还包括一个实用多 Agent RAG 系统的工作演示及其构建过程。

AI Agent 之所以变得流行，是因为现代 LLM 在编码、写作、推理以及跨领域解决问题等任务上已经具备高度能力。这降低了训练自定义模型的需求，并将更多注意力转向围绕现有 LLM 构建实际应用。Codex、Claude Code、Cursor 和 Windsurf 等工具已经在帮助软件工程师更快地工作，而企业则将 Agent 用于客户支持、自动化和其他现实世界任务。

AI Agent 是一种使用 LLM 进行推理、规划和使用工具来执行任务的应用程序，使模型能够以实用且有益的方式与其环境交互。

## AI Agent 的组件

大多数 AI Agent 的主要组件包括 **LLM、工具和记忆**。

![](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/ChatGPT-Image-Apr-28-2026-04_01_33-PM-1-1024x768.png)

*图片由 ChatGPT 生成*

- **LLM**：这是 AI Agent 的大脑。它是使 Agent 能够推理、规划并决定如何解决给定任务的大型语言模型。
- **工具（Tools）**：这些是辅助器，通常以代码函数的形式存在，允许 LLM 与其环境交互。工具帮助 Agent 连接到外部数据源、搜索互联网、从数据库检索信息、访问文件并执行特定操作。例如，编码 Agent 可以使用工具来编写、调试和保存文件；研究 Agent 可以使用网络搜索或向量数据库来收集信息；客户支持 Agent 可以使用公司内部文档根据可信业务知识回答问题。
- **记忆（Memory）**：这允许 Agent 存储交互中的相关信息并在之后使用，以提供更好、更一致的帮助。它帮助 Agent 在任务中保持上下文并改善整体用户体验。记忆在早期开发中可能是可选的，但它成为许多实际 AI Agent 系统的重要组成部分，尤其是当 Agent 需要处理后续问题、多步骤工作流或个性化交互时。AI Agent 中常用的记忆类型主要有两种：短期记忆和长期记忆。短期记忆跟踪当前会话或任务中的信息，而长期记忆则跨多个会话或对话存储有用信息，供 Agent 之后使用。

## Agent 中的 ReAct（推理 + 行动）

AI Agent 与基础聊天机器人的不同之处在于，聊天机器人通常遵循更直接的工作流：**用户查询 → LLM → 响应**。LLM 接收用户消息并主要根据提示及其现有上下文生成回复。

AI Agent 则更进一步，使用 LLM 来推理任务、决定需要做什么、选择是否需要工具、调用这些工具、观察结果并持续迭代，直到能够产生有用的答案。

这就是 **ReAct** 方法的用武之地。**ReAct 意为推理 + 行动（Reasoning + Acting）**。它是一种 Agent 模式，LLM 基于推理对任务进行分析并采取行动（通常通过工具）。它涉及围绕 LLM 设计核心逻辑循环。

![](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/react_workflow_cropped-1024x417.png)

*图片由 ChatGPT 生成*

### AI Agent 中基本的 ReAct 工作流程通常如下所示：

**第一步：Agent 接收用户查询**

LLM 对任务进行推理，并决定它是否可以直接回答，还是需要使用工具。它检查可用的工具并决定解决任务需要哪些工具。

**第二步：Agent 调用所需工具**

根据其推理，Agent 通过调用必要的工具采取行动。这些工具可能会搜索网络、从向量数据库检索文档、访问文件、运行代码或连接到外部 API。这些工具返回的结果被称为**工具输出**。

**第三步：工具输出被发送回 LLM**

工具输出作为额外上下文传回 LLM。这为 Agent 提供了更多相关信息，而不是仅仅依赖原始提示。

**第四步：LLM 检查证据并生成响应**

LLM 审查工具输出并检查它们是否足以解决任务。如果证据充分，它会为用户生成一个有依据的响应。如果不够，Agent 可能会重复推理、工具调用和观察步骤，直到拥有足够的信息来提供有用的答案。

## AI Agent 的结构

AI Agent 可以根据设计结构分为单 Agent 或多 Agent。

### 单 Agent 与多 Agent

![](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/ChatGPT-Image-Apr-27-2026-12_41_25-PM-1024x769.png)

*图片由 ChatGPT 生成*

**单 Agent** 是一种由一个 LLM 处理整个任务的 Agent 设计。它进行推理、规划，并在需要时调用所需工具。大多数 AI Agent 以单 Agent 系统开始，因为它们更简单、更易于维护，且通常足以应对许多任务。

**多 Agent 系统**使用专业化 Agent 来解决任务的不同部分。它通常有一个中心 Agent（通常称为**编排器**、**监督者**或**规划器**），负责协调其他 Agent 并决定每个 Agent 何时应该行动。每个专业化 Agent 都可以拥有自己的角色、工具和推理逻辑，使系统更具模块化，更适合复杂工作流。

### 何时构建多 Agent 系统

单 Agent 设计适用于需要有限工具使用的简单任务。例如，可以访问你日历来设置提醒的个人助手 Agent、只使用计算器工具的计算器 Agent，或使用网络搜索 API 检索最新信息的网络搜索 Agent。

然而，当任务需要许多工具、多步骤推理、不同职责或在将最终响应返回给用户之前进行验证时，单 Agent 可能会超载。常见问题包括提示过载、工具路由不当、Agent 职责不清以及由于单个 Agent 中过多复杂性而导致的可靠性降低。

当任务可能使单 Agent 设计超载，且你需要具有清晰角色、各自工具和独立职责的专业化 Agent 时，**多 Agent 系统**是更好的选择。

例如，一个**软件工程 Agent** 作为多 Agent 系统可能效果更好：

```
编排器 → 编码器 → 测试器 → 审查器
```

**编排器**协调工作流，**编码器 Agent** 生成代码，**测试器 Agent** 检查代码是否正常工作，**审查器 Agent** 审查解决方案以检查缺失部分或可能的改进。

另一个例子是**研究 Agent**，它研究一个主题，从不同数据源检索信息并生成有依据的内容：

```
编排器 → 检索器 → 写作器 → 验证器
```

**检索器 Agent** 从网络和存储在向量数据库中的本地文档收集信息。**写作器 Agent** 根据检索到的内容进行写作。**验证器 Agent** 在返回最终响应之前检查书面内容的错误、引用和事实准确性。

多 Agent 系统使工作流更具模块化，为每个阶段提供清晰的角色。然而，它们应该只在任务确实需要该设计时使用，因为由于更多 LLM 调用和更多活动组件，它们通常会增加延迟、成本和维护复杂性。

一个简单的规则是：

*当任务简单、步骤较少且只需要少量工具时，使用单 Agent。当任务需要专业化角色、多步骤推理、更强验证或跨不同工具和工作流的协调时，使用多 Agent 系统。*

### 多 Agent 项目演示

我构建了一个名为 **Multi-Agent RAG Researcher** 的项目，以使多 Agent 系统的概念更加实用。

该项目的目标是展示中心 Agent 如何协调多个专业化 Agent 来研究主题、从文档和网络检索证据、撰写有依据的内容，并在将内容返回给用户之前进行验证。该系统不是使用一个 Agent 处理所有事情，而是将工作流划分为不同的职责。

![](https://contributor.insightmediagroup.io/wp-content/uploads/2026/04/rag-researcher-1-1024x576.png)

*图片由 ChatGPT 生成*

在 GitHub 上查看该项目：[https://github.com/ayoolaolafenwa/multi-agent-rag-researcher](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher)

**克隆项目仓库**

```bash
git clone https://github.com/ayoolaolafenwa/multi-agent-rag-researcher.git
```

克隆仓库以跟随文章中的代码。克隆仓库后，项目结构将如下所示：

```
.
├── docs/                         # 默认 PDF 文件
├── memory/                       # SQLite 支持的会话记忆辅助程序
├── qdrant_vector_database/       # PDF 摄取和相似性搜索
├── ui/                           # Gradio 应用和 UI 处理程序
├── utils/
│   ├── requirements.txt          # Python 依赖项
├── worker_agents/                # 检索器、写作器和验证器
├── orchestrator_agent.py         # 主协调器
└── run_orchestrator.py           # CLI 入口点
```

### 多 Agent 架构

#### 数据源

有两个主要数据源：

- `Qdrant 向量数据库`

从 PDF 中检索信息分以下阶段处理：

- 可以从 `docs/` 文件夹加载多个 PDF 或通过 UI 上传。
- 文档被分割成块，转换为嵌入向量，并存储在本地 Qdrant 集合中。
- 然后使用相似性搜索在索引文档中检索最相关的块。
- 检索到的块包括引用元数据，如文档名称和页码。

项目中设置 Qdrant 向量数据库、PDF 摄取、分块、嵌入和相似性搜索的文档检索部分在 [qdrant_vector_database/vector_store.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/qdrant_vector_database/vector_store.py) 中处理。

- `Tavily 网络搜索`

Tavily 用于从网络检索最新或外部信息。检索器 Agent 在以下情况下可以使用它：

- 索引的 PDF 不包含查询内容
- 文档证据薄弱或不完整
- 需要更新的信息

**工作 Agent**

- `检索器 Agent`

其角色是：

- 它使用两种工具：PDF 文档检索和网络搜索。
- 给定查询，它决定是使用本地文档、网络搜索还是两者都用。
- 如果本地文档证据缺失或薄弱，它可以回退到网络搜索以收集更广泛或更新的上下文。

带有 Tavily 网络搜索的检索器 Agent 代码在 [worker_agents/retriever.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/worker_agents/retriever_agent.py) 中。它使用低推理强度的 gpt-5.4-mini。

- `写作器 Agent`

其角色是：

- 它接收来自检索器 Agent 的检索信息。
- 它根据可用证据撰写有依据的草稿。
- 当引用来自 PDF 或网络的支持引用时，它会将其包含进去。

写作器 Agent 代码在 [worker_agents/writer.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/worker_agents/writer_agent.py) 中。它使用低推理强度的 gpt-5.4。

- `验证器 Agent`

其角色是：

- 它接收来自写作器 Agent 的草稿及证据。
- 它检查草稿中的主张是否得到检索证据的支持。
- 它返回最终经过验证的响应。

工作 Agent 代码在 [worker_agents/verifier.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/worker_agents/verifier_agent.py) 中。它使用低推理强度的 gpt-5.4。

### 记忆

SQLite 用于为多 Agent 工作流提供短期记忆。对于给定的会话 ID，系统存储：

- 最新的用户查询
- 该会话的最新检索证据

这允许编排器为后续问题重用相关证据，而不是每次都重新检索相同的信息。

记忆代码在 [memory/memory.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/memory/memory.py) 中。

### 编排器

编排器协调三个工作 Agent：**检索器**、**写作器**和**验证器**。

#### 编排器如何协调多 Agent 工作流

- 它接收用户查询，并根据查询，可能直接响应或开始基于证据的工作流。
- 对于研究查询，它首先检查当前会话的记忆中是否有可以重用的相关缓存证据。
- 如果缓存证据不足，它调用**检索器 Agent** 从 PDF、网络或两者收集证据。
- 如果有文档证据但证据薄弱，**检索器 Agent** 还可以从网络获取最新信息以补充本地文档信息。
- 然后编排器将活跃证据和用户查询传递给**写作器 Agent**，让它生成有依据的草稿。
- 接下来，它将草稿和证据发送给**验证器 Agent**，后者检查主张并返回最终经验证的报告。
- 在会话期间，最新查询和检索证据存储在记忆中，供后续问题使用。
- 在后续问题中，编排器可能会重用缓存证据而不是再次调用**检索器 Agent**，然后继续使用**写作器 Agent** 和**验证器 Agent** 生成最终响应。

编排器代码在 [orchestrator_agent.py](https://github.com/ayoolaolafenwa/multi-agent-rag-researcher/blob/main/orchestrator_agent.py) 中。它使用低推理强度的 gpt-5.4-mini。

编排器有一个守护栏，使系统专注于研究和事实性问题。它拒绝不相关的通用任务，如编码帮助或简单数学，因为该系统的目标是作为研究助手运行。

**注意**：对于编排器和工作 Agent 中使用的模型，你可以将它们从 gpt-5.4 更改为你选择的任何 OpenAI 提供的模型。

### 项目设置

#### 前提条件

- Python 3.10 或更高版本
- OpenAI API 密钥：如果你还没有，请[创建 OpenAI 账户](https://auth.openai.com/create-account)并[生成 API 密钥](https://platform.openai.com/api-keys)。
- Tavily API 密钥：Tavily 是专为 AI Agent 设计的网络搜索工具。在 [Tavily.com](https://www.tavily.com/) 创建账户，设置好个人资料后，会生成一个 API 密钥供你复制到环境中。新账户可获得 1000 个免费积分，可用于最多 1000 次网络搜索。

**安装**

- 创建并激活虚拟环境：

```bash
python3 -m venv env
source env/bin/activate
```

2. 安装依赖项：

```bash
cd multi-agent-rag-researcher
pip3 install -r utils/requirements.txt
```

3. 创建 `utils/var.env` 文件并存储你的 API 密钥：

```
OPENAI_API_KEY=your_openai_api_key
TAVILY_API_KEY=your_tavily_api_key
```

4. 将你想要索引的 PDF 放在 `docs/` 文件夹中，或稍后通过 UI 上传 PDF。该项目在 `docs/` 中已包含现有 PDF，目前是 *Gemma 3 Technical Report.pdf* 和 *DeepSeek-V3.2.pdf*，你可以直接使用这些或用自己的文档替换。

**运行项目**

启动命令行应用：

```bash
python3 run_orchestrator.py
```

CLI 启动时，会将 `docs/` 中的 PDF 摄取到本地 Qdrant 存储中。输入 `q` 或 `exit` 结束会话。

**运行多 Agent 聊天 UI**

启动 Gradio UI：

```bash
python3 ui/gradio_app.py
```

UI 在启动时自动加载 `docs/` 中的默认 PDF。如果你上传新的 PDF，它们会替换该 UI 会话的活跃索引文档集。

### 多 Agent RAG Researcher 演示视频

### 注意事项

- 会话记忆存储在 `utils/memory.db` 中。
- 本地 Qdrant 数据存储在 `utils/qdrant_storage/` 中。
- 该系统设计用于研究和事实性问答，不适用于无关的通用任务。

## 结论

在这篇文章中，我解释了 AI Agent 的工作原理，它如何使用工具与环境交互，以及 ReAct 方法如何帮助它推理、规划、选择工具并执行特定任务。

我还介绍了 AI Agent 的结构设计，包括单 Agent 和多 Agent 系统。我解释了两种设计的工作原理，如何根据工作流选择每种设计，并对比了单 Agent 实现与多 Agent 架构。

最后，我详细演示了我的 Multi-Agent RAG Researcher 项目背后的多 Agent 设计，展示了它如何使用编排器协调三个工作 Agent、从网络和本地文档检索信息、使用记忆保持一致性，并在返回最终输出之前对内容进行写作和验证。

### 联系方式

Linkedin：[https://www.linkedin.com/in/ayoola-olafenwa-003b901a9/](https://www.linkedin.com/in/ayoola-olafenwa-003b901a9/)

### 参考文献

[https://developers.openai.com/cookbook](https://developers.openai.com/cookbook)

[https://developers.openai.com/api/docs/guides/function-calling](https://developers.openai.com/api/docs/guides/function-calling)

## 引用

- 原文：[Single Agent vs Multi-Agent: When to Build a Multi-Agent System](https://towardsdatascience.com/single-agent-vs-multi-agent-when-to-build-a-multi-agent-system/)
- [OpenAI Cookbook](https://developers.openai.com/cookbook)
- [OpenAI Function Calling Guide](https://developers.openai.com/api/docs/guides/function-calling)
