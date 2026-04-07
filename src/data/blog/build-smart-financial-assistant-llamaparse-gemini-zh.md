---
title: "用 LlamaParse 和 Gemini 3.1 构建智能金融助手"
pubDatetime: 2026-03-27T20:00:00+08:00
description: "Google Developers Blog 文章《Build a smart financial assistant with LlamaParse and Gemini 3.1》中文翻译（含原文引用）。"
slug: build-smart-financial-assistant-llamaparse-gemini-zh
originalTitle: "Build a smart financial assistant with LlamaParse and Gemini 3.1"
originalUrl: https://developers.googleblog.com/build-a-smart-financial-assistant-with-llamaparse-and-gemini-31/
---

原文标题：Build a smart financial assistant with LlamaParse and Gemini 3.1<br>
原文链接：https://developers.googleblog.com/build-a-smart-financial-assistant-with-llamaparse-and-gemini-31/

# 用 LlamaParse 和 Gemini 3.1 构建智能金融助手

![](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/llamaindex_gemini-api_1.original.png)

*作者：Vishal Dharmadhikari（Developer Experience, Gemini）、Clelia Astra Bertelli（Open Source Engineer, LlamaIndex）*

从非结构化文档中提取文本一直是开发者的经典难题。几十年来，传统的光学字符识别（OCR）系统在处理复杂布局时一直很吃力，经常把多栏 PDF、嵌入图片和嵌套表格变成一堆不可读的纯文本。

如今，大语言模型（LLM）的多模态能力终于让可靠的文档理解成为可能。

LlamaParse 弥合了传统 OCR 与视觉语言 Agent 解析之间的差距。它能在 PDF、演示文稿和图片中实现最先进的文本提取。

在本文中，你将学习如何使用 Gemini 驱动 LlamaParse，从非结构化文档中提取高质量的文本和表格，并构建一个智能个人金融助手。提醒一下，Gemini 模型可能会犯错，不应依赖其提供专业建议。

## 为什么选择 LlamaParse？

在很多情况下，LLM 已经能够有效地完成这项任务，然而在处理大量文档集合或高度多变的格式时，一致性和可靠性可能会变得更具挑战性。

像 LlamaParse 这样的专用工具通过引入预处理步骤和可定制的解析指令来补充 LLM 的能力，这有助于结构化复杂元素，如大型表格或密集文本。在通用解析基准测试中，这种方法相比直接处理原始文档显示出大约 13-15% 的改进。

## 用例：解析经纪账户报表

经纪账户报表代表了文档解析的终极挑战。它们包含密集的金融术语、复杂的嵌套表格和动态布局。

为了帮助用户理解他们的财务状况，你需要一个工作流，不仅能解析文件，还能显式地提取表格并通过 LLM 解释数据。

由于这些高级推理和多模态需求，Gemini 3.1 Pro 是作为底层模型的完美选择。它在超大上下文窗口和原生空间布局理解之间取得了平衡。

该工作流分四个阶段运行：

1. **摄入（Ingest）**：你向 LlamaParse 引擎提交一个 PDF。
2. **路由（Route）**：引擎解析文档并发出一个 `ParsingDoneEvent`。
3. **提取（Extract）**：该事件触发两个并行任务——文本提取和表格提取——同时运行以最小化延迟。
4. **合成（Synthesize）**：两项提取完成后，Gemini 生成人类可读的摘要。

这种双模型架构是一个刻意的设计选择：Gemini 3.1 Pro 在解析过程中处理困难的布局理解，而 Gemini 3 Flash 处理最终的摘要——同时优化准确性和成本。

你可以在 [LlamaParse x Gemini demo GitHub 仓库](https://github.com/run-llama/llamaparse-gemini-demo) 中找到本教程的完整代码。

## 设置环境

首先，安装 LlamaCloud、LlamaIndex Workflows 和 Google GenAI SDK 所需的 Python 包。

```shell
pip install llama-cloud-services llama-index-workflows pandas google-genai
uv add llama-cloud-services llama-index-workflows pandas google-genai
```

然后，将你的 API 密钥导出为环境变量。从 [AI Studio](https://ai.studio/api-keys) 获取 Gemini API 密钥，从[控制台](https://cloud.llamaindex.ai/)获取 LlamaCloud API 密钥。**安全提示：切勿在应用程序源代码中硬编码你的 API 密钥。**

```shell
export LLAMA_CLOUD_API_KEY="your_llama_cloud_key"
export GEMINI_API_KEY="your_google_api_key"
```

## 第一步：创建和使用解析器

工作流的第一步是解析。你创建一个由 Gemini 3.1 Pro 支持的 LlamaParse 客户端，并在 `resources.py` 中定义它，以便作为资源注入到工作流中：

```python
def get_llama_parse() -> LlamaParse:
    return LlamaParse(
        api_key=os.getenv("LLAMA_CLOUD_API_KEY"),
        parse_mode="parse_page_with_agent",
        model="gemini-3.1-pro",
        result_type=ResultType.MD,
    )
```

`parse_page_with_agent` 模式应用了一层由 Gemini 引导的 Agent 迭代，基于视觉上下文来校正和格式化 OCR 结果。

在 `workflow.py` 中，定义事件、状态和解析步骤：

```python
class BrokerageStatementWorkflow(Workflow):
    @step
    async def parse_file(
        self,
        ev: FileEvent,
        ctx: Context[WorkflowState],
        parser: Annotated[LlamaParse, Resource(get_llama_parse)]
    ) -> ParsingDoneEvent | OutputEvent:
        result = cast(ParsingJobResult, (await parser.aparse(file_path=ev.input_file)))
        async with ctx.store.edit_state() as state:
            state.parsing_job_result = result
        return ParsingDoneEvent()
```

注意，你不会立即处理解析结果。而是将它们存储在全局 `WorkflowState` 中，以便后续的提取步骤可以使用。

## 第二步：提取文本和表格

为了给 LLM 提供解释金融报表所需的上下文，你需要提取完整的 Markdown 文本和表格数据。将提取步骤添加到你的 `BrokerageStatementWorkflow` 类中（参见 [workflow.py](https://github.com/run-llama/llamaparse-gemini-demo) 中的完整实现）：

```python
@step
async def extract_text(self, ev: ParsingDoneEvent, ctx: Context[WorkflowState]) -> TextExtractionDoneEvent:
    # 提取逻辑

@step
async def extract_tables(self, ev: ParsingDoneEvent, ctx: Context[WorkflowState], ...) -> TablesExtractionDoneEvent:
    # 提取逻辑
```

因为两个步骤都监听同一个 `ParsingDoneEvent`，LlamaIndex Workflows 会自动并行执行它们。这意味着你的文本和表格提取会同时运行——减少整体管道延迟，并使架构在你添加更多提取任务时自然可扩展。

## 第三步：生成摘要

数据提取完成后，你可以提示 Gemini 3.1 Pro 用通俗易懂、非技术性的语言生成摘要。

在 `resources.py` 中配置 LLM 客户端和提示模板。这里你使用 Gemini 3 Flash 进行最终的摘要生成，因为它在文本聚合任务上提供低延迟和高成本效率。

最终的合成步骤使用 `ctx.collect_events` 等待两项提取都完成后再调用 Gemini API。

```python
@step
async def ask_llm(
    self,
    ev: TablesExtractionDoneEvent | TextExtractionDoneEvent,
    ctx: Context[WorkflowState],
    llm: Annotated[GenAIClient, Resource(get_llm)],
    template: Annotated[Template, Resource(get_prompt_template)]
) -> OutputEvent:
    if ctx.collect_events(ev, [TablesExtractionDoneEvent, TextExtractionDoneEvent]) is None:
        return None
```

## 运行工作流

将所有内容串联起来，`main.py` 入口点创建并运行工作流：

```python
wf = BrokerageStatementWorkflow(timeout=600)
result = await wf.run(start_event=FileEvent(input_file=input_file))
```

要测试工作流，从 LlamaIndex datasets 下载一个示例报表：

```shell
curl -L https://raw.githubusercontent.com/run-llama/llama-datasets/main/llama_agents/bank_statements/brokerage_statement.pdf > brokerage_statement.pdf
```

运行工作流：

```shell
python3 main.py brokerage_statement.pdf
uv run run-workflow brokerage_statement.pdf
```

你现在拥有了一个完全可用的个人金融助手，在终端中运行，能够分析复杂的金融 PDF。

## 下一步

AI 管道的好坏取决于你输入的数据。通过将 Gemini 3.1 Pro 的多模态推理与 LlamaParse 的 Agent 摄入相结合，你可以确保应用程序拥有完整的结构化上下文——而不仅仅是扁平化的文本。

当你将架构建立在事件驱动的有状态性上（如这里演示的并行提取），你就构建了快速、可扩展且具有弹性的系统。在依赖输出之前请仔细核查。

准备好在生产环境中实现了吗？探索 [LlamaParse 文档](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) 和 [Gemini API 文档](https://ai.google.dev/docs) 来体验多模态生成，并深入了解 [GitHub 仓库](https://github.com/run-llama/llamaparse-gemini-demo) 中的完整代码。
